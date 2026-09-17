"""
StockOracle Pro — AI Natural Language Screener Query Converter
Uses Unified Multi-AI Engine to convert unstructured trader queries into strictly validated Screener DSL formulas.
"""
import os
import json
import logging
from typing import Dict, Any, List

from backend.research.screener_dsl import parse_screener_query, FIELD_MAP
from backend.ai.provider import ask_ai, extract_json_from_ai_response

logger = logging.getLogger("StockOracle.Research.AIScreener")

# Metrics that are NOT available from the connected data source and must never
# be generated. If the user asks for one, respond with an explicit notice.
UNAVAILABLE_METRICS = {
    "delivery volume": "Delivery volume is not provided by the connected feed.",
    "delivery": "Delivery volume is not provided by the connected feed.",
    "promoter holding": "Promoter holding is not available from the connected data source.",
    "promoter": "Promoter holding is not available from the connected data source.",
    "institutional holding": "Institutional holding is not available from the connected data source.",
    "fii": "FII/DII holding is not available from the connected data source.",
    "dii": "FII/DII holding is not available from the connected data source.",
    "free cash flow": "Free cash flow is not available from the connected data source.",
    "fcf": "Free cash flow is not available from the connected data source.",
    "dividend yield": "Dividend yield is not available from the connected data source.",
    "operating margin": "Operating margin is not available from the connected data source.",
    "net margin": "Net margin is not available from the connected data source.",
    "eps growth": "EPS growth is not available from the connected data source.",
    "social sentiment": "Social sentiment is not available; news sentiment is scored neutral.",
}


def _unavailable_notes(prompt_text: str) -> List[str]:
    p = prompt_text.lower()
    seen_msgs = set()
    notes = []
    for key, msg in UNAVAILABLE_METRICS.items():
        if key in p and msg not in seen_msgs:
            seen_msgs.add(msg)
            notes.append(f"Data unavailable for this condition: {msg}")
    return notes


def _ast_to_filter_preview(ast: Any) -> List[Dict[str, Any]]:
    """Flattens AST comparisons into editable filter rows for the UI preview."""
    rows: List[Dict[str, Any]] = []

    def _walk(node: Any):
        if not isinstance(node, dict):
            return
        t = node.get("type")
        if t == "COMPARISON":
            rows.append({
                "field": node.get("field"),
                "column": node.get("column"),
                "operator": node.get("operator"),
                "value": node.get("value"),
            })
        else:
            for k in ("left", "right", "expr"):
                if node.get(k) is not None:
                    _walk(node[k])

    _walk(ast or {})
    return rows


def convert_natural_language_to_screener_query(prompt_text: str) -> Dict[str, Any]:
    """
    Translates a natural language user query into a validated formula DSL string and AST.
    Uses multi-AI provider (Gemini, OpenAI, Groq, Claude, Mistral, Cohere) with heuristic fallback.
    Never invents unavailable fields — those yield explicit 'Data unavailable' notes.
    """
    prompt = prompt_text.strip()
    if not prompt:
        return {"error": "Prompt cannot be empty."}

    unavailable = _unavailable_notes(prompt)

    # 1. Try Unified Multi-AI Engine
    try:
        system_instruction = """You are a financial quantitative query generator for StockOracle Pro.
Convert the user's trading request into a valid Screener.in style formula DSL string.

Available Metric Identifiers (USE ONLY THESE — never invent others):
- ROCE (Return on Capital Employed %)
- ROE (Return on Equity %)
- PE (Price to Earnings Ratio)
- PB (Price to Book Ratio)
- DebtToEquity (Debt to Equity Ratio)
- MarketCap (Market Capitalization in Crores)
- ProfitGrowth3Y, SalesGrowth3Y (3-Year CAGR %)
- RSI14 (0-100), VolumeRatio20D (x average)
- Change1D, Change1W, Change1M (% returns)
- Distance52WHigh, Distance52WLow (% distance), Pos52W (0-100 position)
- EMA9, EMA20, EMA50, EMA200, ADX, ATRPct, BBWidth, StochK, CCI, ROC, WilliamsR
- MACDHist, Supertrend, HistVol (20D annualised %)
- Structure (e.g. 'HH/HL_UPTREND'), Trend (e.g. 'BULLISH'), MomentumState, EMAAlignment
- Regime (TRENDING/RANGING/BREAKOUT/CONSOLIDATION/HIGH_VOLATILITY/LOW_VOLATILITY)
- Breakout52W (1/0), VolumeBreakout (1/0), BreakoutStrength (0-100)
- Confluence (0-100), AIConsensus (0-100), AIConfidence (0-100)
- RsNifty, RsSector (1-month excess return %)
- PCR (Put-Call Ratio)
- sector (e.g. 'IT', 'Energy', 'Banking / Finance', 'Automobile', 'Pharma', 'FMCG')

Rules:
1. Output ONLY a valid JSON object matching:
{
  "formula_query": "ROCE > 20 AND DebtToEquity < 0.5 AND RSI14 < 40",
  "explanation": "Finds quality companies with ROCE > 20% and low debt that are currently oversold."
}
2. Use uppercase for AND, OR, NOT.
3. String values must be single-quoted (e.g. sector == 'IT').
4. NEVER use: delivery volume, promoter/FII/DII holding, free cash flow, dividend yield, margins, EPS, social sentiment."""

        res_text = ask_ai(
            question=f"User Prompt: \"{prompt}\"",
            context="",
            json_mode=True,
            system_instruction=system_instruction,
            max_tokens=300,
            temperature=0.1
        )

        data = extract_json_from_ai_response(res_text)
        if data and "formula_query" in data:
            formula = data.get("formula_query", "").strip()
            parsed = parse_screener_query(formula)
            if parsed.get("success", False):
                return {
                    "prompt": prompt,
                    "formula_query": formula,
                    "explanation": data.get("explanation", ""),
                    "ast": parsed.get("ast"),
                    "filters_preview": _ast_to_filter_preview(parsed.get("ast")),
                    "valid": True,
                    "parse_error": None,
                    "unavailable_notes": unavailable,
                }
            # AI returned an invalid formula (e.g. invented field) — surface
            # the parse error instead of silently falling back.
            return {
                "prompt": prompt,
                "formula_query": formula,
                "explanation": data.get("explanation", ""),
                "ast": None,
                "filters_preview": [],
                "valid": False,
                "parse_error": parsed.get("error"),
                "unavailable_notes": unavailable + [
                    f"Data unavailable for this condition: {parsed.get('error')}"
                ],
            }
    except Exception as exc:
        logger.warning("AI screener query generation error: %s", exc)

    # 2. Heuristic fallback screen if AI is unconfigured, rate-limited, or returned invalid syntax
    # NOTE: short tokens use word boundaries — naive substring checks misfire
    # ("it" in "with", "pe" in "performance").
    import re as _re

    def _has(pattern: str) -> bool:
        return _re.search(pattern, p_lower) is not None

    p_lower = prompt.lower()
    parts = []
    if _has(r"\bit\b") or _has(r"\btech\b") or _has(r"\btechnology\b"):
        parts.append("sector == 'IT'")
    elif _has(r"\bbanks?\b") or _has(r"\bfinancial\b") or _has(r"\bfinance\b"):
        parts.append("sector == 'Banking / Finance'")
    elif _has(r"\bauto\b") or _has(r"\bautomobile\b"):
        parts.append("sector == 'Automobile'")
    elif _has(r"\benergy\b") or _has(r"\bpower\b"):
        parts.append("sector == 'Energy / Oil & Gas'")

    if "large cap" in p_lower or "large-cap" in p_lower:
        parts.append("MarketCap > 50000")
    if "roce" in p_lower or "quality" in p_lower or "fundamentally strong" in p_lower:
        parts.append("ROCE > 18")
    if "debt" in p_lower or "low debt" in p_lower:
        parts.append("DebtToEquity < 0.6")
    if "oversold" in p_lower or ("rsi" in p_lower and "below" in p_lower):
        parts.append("RSI14 < 40")
    elif "overbought" in p_lower:
        parts.append("RSI14 > 70")
    elif "rsi" in p_lower:
        parts.append("RSI14 < 45")
    if "unusual volume" in p_lower or "volume" in p_lower or "breakout" in p_lower:
        parts.append("VolumeRatio20D > 1.5" if "unusual" in p_lower or "2" in p_lower else "VolumeRatio20D > 1.3")
    if "52 week high" in p_lower or "52-week high" in p_lower or "52w high" in p_lower:
        parts.append("Distance52WHigh > -3")
    if "200 ema" in p_lower or "200ema" in p_lower or "above 200" in p_lower:
        parts.append("EMA200 < 100000000")  # placeholder replaced below
        # Replace with a real directional condition via confluence instead:
        parts = [p for p in parts if "EMA200 <" not in p]
        parts.append("Confluence > 60")
    if "macd" in p_lower and "bullish" in p_lower:
        parts.append("MACDHist > 0")
    if "momentum" in p_lower and "positive" in p_lower:
        parts.append("RSI14 > 50")
    if "bullish" in p_lower and not any("RSI14" in p for p in parts):
        parts.append("RSI14 > 50")
    if "undervalued" in p_lower or "cheap" in p_lower or _has(r"\bpe\b") or _has(r"\bp/e\b"):
        parts.append("PE < 25")
    if "ai" in p_lower and ("confidence" in p_lower or "high" in p_lower):
        parts.append("AIConsensus > 75")

    fallback_formula = " AND ".join(parts) if parts else "ROCE > 18 AND DebtToEquity < 0.5 AND RSI14 < 45"
    parsed = parse_screener_query(fallback_formula)
    return {
        "prompt": prompt,
        "formula_query": fallback_formula,
        "explanation": "Heuristic fallback screen (AI provider unavailable). Review filters before running.",
        "ast": parsed.get("ast"),
        "filters_preview": _ast_to_filter_preview(parsed.get("ast")),
        "valid": parsed.get("success", True),
        "parse_error": parsed.get("error"),
        "unavailable_notes": unavailable,
    }
