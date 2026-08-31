"""
StockOracle Pro — AI Natural Language Screener Query Converter
Uses Gemini 2.0 to convert unstructured trader queries into strictly validated Screener DSL formulas.
"""
import os
import json
import logging
from typing import Dict, Any

from backend.research.screener_dsl import parse_screener_query

logger = logging.getLogger("StockOracle.Research.AIScreener")


def convert_natural_language_to_screener_query(prompt_text: str) -> Dict[str, Any]:
    """
    Translates a natural language user query into a validated formula DSL string and AST.
    """
    prompt = prompt_text.strip()
    if not prompt:
        return {"error": "Prompt cannot be empty."}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # High quality heuristic fallback if no Gemini key is provided
        p_lower = prompt.lower()
        parts = []
        if "it" in p_lower or "tech" in p_lower:
            parts.append("sector == 'IT'")
        elif "bank" in p_lower or "financial" in p_lower:
            parts.append("sector == 'Banking / Finance'")
        elif "auto" in p_lower:
            parts.append("sector == 'Automobile'")

        if "roce" in p_lower or "quality" in p_lower:
            parts.append("ROCE > 18")
        if "debt" in p_lower or "low debt" in p_lower:
            parts.append("DebtToEquity < 0.6")
        if "oversold" in p_lower or "rsi" in p_lower:
            parts.append("RSI14 < 40")
        elif "overbought" in p_lower:
            parts.append("RSI14 > 70")
        if "volume" in p_lower or "breakout" in p_lower:
            parts.append("VolumeRatio20D > 1.3")
        if "undervalued" in p_lower or "cheap" in p_lower or "pe" in p_lower:
            parts.append("PE < 25")

        formula = " AND ".join(parts) if parts else "ROCE > 15 AND DebtToEquity < 1.0"
        parsed = parse_screener_query(formula)
        return {
            "prompt": prompt,
            "formula_query": formula,
            "explanation": f"Generated heuristic screen: {formula}",
            "ast": parsed.get("ast"),
            "valid": parsed.get("success", False),
        }

    try:
        from backend.ai.provider import ask_ai
        system_instruction = """You are a financial quantitative query generator for StockOracle Pro.
Convert the user's trading request into a valid Screener.in style formula DSL string.

Available Metric Identifiers:
- ROCE (Return on Capital Employed %)
- ROE (Return on Equity %)
- PE (Price to Earnings Ratio)
- PB (Price to Book Ratio)
- DebtToEquity (Debt to Equity Ratio)
- MarketCap (Market Capitalization in Crores ₹)
- ProfitGrowth3Y (3-Year Net Profit CAGR %)
- SalesGrowth3Y (3-Year Revenue CAGR %)
- RSI14 (14-Day Relative Strength Index, 0-100)
- VolumeRatio20D (Current Volume vs 20-Day Average Ratio)
- Change1D (Today's % Change)
- Distance52WHigh (% distance from 52-week high, negative values like -5.0)
- AIConsensus (AI Consensus Score, 0-100)
- PCR (Put-Call Ratio)
- sector (String sector name, e.g. 'IT', 'Energy', 'Banking / Finance', 'Automobile', 'Pharma', 'FMCG')

Rules:
1. Output ONLY a valid JSON object matching:
{
  "formula_query": "ROCE > 20 AND DebtToEquity < 0.5 AND RSI14 < 40",
  "explanation": "Finds quality companies with ROCE > 20% and low debt that are currently oversold."
}
2. Use uppercase for AND, OR, NOT.
3. String values must be single-quoted (e.g. sector == 'IT')."""

        res_text = ask_ai(
            question=f"User Prompt: \"{prompt}\"",
            context="",
            json_mode=True,
            system_instruction=system_instruction,
            max_tokens=250,
            temperature=0.1
        )
        text = res_text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())

        formula = data.get("formula_query", "ROCE > 15")
        parsed = parse_screener_query(formula)

        return {
            "prompt": prompt,
            "formula_query": formula,
            "explanation": data.get("explanation", ""),
            "ast": parsed.get("ast"),
            "valid": parsed.get("success", False),
            "parse_error": parsed.get("error"),
        }
    except Exception as exc:
        logger.warning("AI screener query generation error: %s", exc)
        fallback_formula = "ROCE > 18 AND DebtToEquity < 0.5 AND RSI14 < 45"
        parsed = parse_screener_query(fallback_formula)
        return {
            "prompt": prompt,
            "formula_query": fallback_formula,
            "explanation": "Heuristic fallback screen for quality oversold stocks.",
            "ast": parsed.get("ast"),
            "valid": True,
        }
