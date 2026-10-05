"""StockOracle Pro — technical confluence, transparent AI score & why-explanation.


Split verbatim out of ``backend/research/screener_engines.py`` (pure code motion).
"""

from typing import Any, Dict, List, Optional

from .screener_shared import DEFAULT_AI_WEIGHTS, _f

# ═══════════════════════════════════════════════════════════════════════════
# 6. TECHNICAL CONFLUENCE + TRANSPARENT AI SCORE
# ═══════════════════════════════════════════════════════════════════════════

def compute_confluence(
    tech: Dict[str, Any],
    struct: Dict[str, Any],
    vol: Dict[str, Any],
    momentum: Dict[str, Any],
    breakout: Dict[str, Any],
) -> Dict[str, Any]:
    """Technical Confluence 0-100 with component scores + human-readable reasons."""
    reasons: List[str] = []
    # Trend 0-100
    trend = 50.0
    close_v = tech.get("_close")
    e50, e200 = tech.get("ema_50"), tech.get("ema_200")
    if close_v and e50 and e200:
        if close_v > e50 and close_v > e200:
            trend = 82.0
            reasons.append(f"Price above EMA 50 ({e50:.0f}) and EMA 200 ({e200:.0f})")
        elif close_v < e50 and close_v < e200:
            trend = 22.0
            reasons.append(f"Price below EMA 50 ({e50:.0f}) and EMA 200 ({e200:.0f})")
        elif close_v > e50:
            trend = 63.0
            reasons.append(f"Price above EMA 50 ({e50:.0f}) but below EMA 200")
        else:
            trend = 38.0
            reasons.append("Price below key moving averages")
    if tech.get("supertrend_dir") == 1.0:
        trend = min(100.0, trend + 6.0)
        reasons.append("Supertrend bullish")
    elif tech.get("supertrend_dir") == -1.0:
        trend = max(0.0, trend - 6.0)
        reasons.append("Supertrend bearish")
    if (tech.get("adx_14") or 0) >= 25:
        trend = min(100.0, trend + 4.0)

    # Momentum 0-100
    rsi = tech.get("rsi_14")
    momentum_score = 50.0
    if rsi is not None:
        if 55 <= rsi <= 70:
            momentum_score = 74.0
        elif 45 <= rsi < 55:
            momentum_score = 58.0
        elif rsi > 70:
            momentum_score = 62.0
        elif rsi < 30:
            momentum_score = 30.0
        elif rsi < 45:
            momentum_score = 40.0
        reasons.append(f"RSI(14) = {rsi:.1f}")
    if tech.get("macd_bullish") is True:
        momentum_score = min(100.0, momentum_score + 10.0)
        reasons.append("MACD bullish (line above signal)")
    elif tech.get("macd_bullish") is False:
        momentum_score = max(0.0, momentum_score - 10.0)
        reasons.append("MACD bearish (line below signal)")
    if tech.get("macd_crossover") == "BULLISH_CROSSOVER":
        reasons.append("Fresh MACD bullish crossover")
        momentum_score = min(100.0, momentum_score + 4.0)
    if momentum.get("ema_alignment") == "BULLISH_ALIGNED":
        reasons.append("EMA 20 > 50 > 200 bullish alignment")
        momentum_score = min(100.0, momentum_score + 4.0)

    # Volume 0-100
    rv = vol.get("rel_volume") or 1.0
    volume_score = max(5.0, min(100.0, 45.0 + (rv - 1.0) * 35.0))
    if vol.get("volume_spike"):
        reasons.append(f"Relative volume {rv:.1f}x — institutional participation")
    else:
        reasons.append(f"Relative volume {rv:.1f}x")

    # Structure 0-100
    structure_score = 50.0
    if struct.get("bos") == "BULLISH_BOS":
        structure_score = 85.0
        reasons.append("Bullish break of structure detected")
    elif struct.get("bos") == "BEARISH_BOS":
        structure_score = 18.0
        reasons.append("Bearish break of structure detected")
    elif struct.get("choch"):
        structure_score = 55.0
        reasons.append(f"Change of character ({struct.get('choch')}) — wait for confirmation")
    elif struct.get("structure_label") == "HH/HL_UPTREND":
        structure_score = 78.0
        reasons.append("Higher-high / higher-low uptrend structure")
    elif struct.get("structure_label") == "LH/LL_DOWNTREND":
        structure_score = 25.0
        reasons.append("Lower-high / lower-low downtrend structure")
    elif struct.get("consolidation"):
        structure_score = 48.0
        reasons.append("Consolidation — no directional structure edge")
    if breakout.get("breakout_52w_high"):
        structure_score = min(100.0, structure_score + 8.0)
        reasons.append("Trading at/above 52-week high")
    if struct.get("liquidity_sweep"):
        reasons.append(f"Liquidity sweep ({struct.get('liquidity_sweep')}) — traps possible")

    # Volatility 0-100 (higher = calmer / more favourable for trend systems)
    volatility_score = 60.0
    atrp = tech.get("atr_pct")
    if atrp is not None:
        if atrp <= 1.5:
            volatility_score = 72.0
            reasons.append(f"ATR {atrp:.2f}% — controlled volatility")
        elif atrp <= 3.0:
            volatility_score = 63.0
        elif atrp <= 5.0:
            volatility_score = 48.0
            reasons.append(f"ATR {atrp:.2f}% — elevated volatility, size down")
        else:
            volatility_score = 32.0
            reasons.append(f"ATR {atrp:.2f}% — very high volatility")

    confluence = round(
        trend * 0.30 + momentum_score * 0.25 + volume_score * 0.20
        + structure_score * 0.15 + volatility_score * 0.10,
        1,
    )
    return {
        "trend": round(trend, 1),
        "momentum": round(momentum_score, 1),
        "volume": round(volume_score, 1),
        "structure": round(structure_score, 1),
        "volatility": round(volatility_score, 1),
        "confluence": confluence,
        "reasons": reasons[:12],
    }


def compute_ai_score(
    tech: Dict[str, Any],
    struct: Dict[str, Any],
    vol: Dict[str, Any],
    momentum: Dict[str, Any],
    confluence: Dict[str, Any],
    fundamentals: Dict[str, Any],
    sentiment: Optional[Dict[str, Any]] = None,
    ml_score: Optional[float] = None,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """Transparent 0-100 AI score. Every sub-score is rule-based and explained.

    weights keys: technical, momentum, volume, structure, fundamental,
    sentiment, ml_model (must sum ~1.0; normalised defensively).
    """
    w = dict(DEFAULT_AI_WEIGHTS)
    if weights:
        for k in list(w.keys()):
            if k in weights:
                try:
                    w[k] = max(0.0, float(weights[k]))
                except Exception:
                    pass
    total_w = sum(w.values()) or 1.0
    for k in w:
        w[k] = w[k] / total_w

    positives: List[str] = []
    negatives: List[str] = []

    # Technical 0-100 from confluence trend + EMA/price placement
    technical = float(confluence.get("trend", 50.0))
    close_v = tech.get("_close")
    e200 = tech.get("ema_200")
    if close_v and e200:
        if close_v > e200:
            positives.append(f"Price above EMA 200 ({e200:.0f})")
        else:
            negatives.append(f"Price below EMA 200 ({e200:.0f})")

    # Momentum 0-100
    momentum_sub = float(confluence.get("momentum", 50.0))
    if tech.get("macd_bullish") is True:
        positives.append("Positive MACD (line above signal)")
    elif tech.get("macd_bullish") is False:
        negatives.append("MACD below signal line")

    # Volume 0-100
    volume_sub = float(confluence.get("volume", 50.0))
    rv = vol.get("rel_volume") or 1.0
    if rv >= 1.5:
        positives.append(f"Volume expansion ({rv:.1f}x vs 20-day average)")
    elif rv < 0.7:
        negatives.append(f"Thin volume ({rv:.1f}x vs average)")

    # Structure 0-100
    structure_sub = float(confluence.get("structure", 50.0))
    if struct.get("bos") == "BULLISH_BOS" or struct.get("structure_label") == "HH/HL_UPTREND":
        positives.append("Bullish market structure (HH/HL or bullish BOS)")
    elif struct.get("bos") == "BEARISH_BOS" or struct.get("structure_label") == "LH/LL_DOWNTREND":
        negatives.append("Bearish market structure")

    # Fundamental 0-100 (only from real available fields; missing -> neutral 50 + note)
    fund_notes: List[str] = []
    roce = _f(fundamentals.get("roce_pct"))
    de = _f(fundamentals.get("debt_to_equity"))
    roe = _f(fundamentals.get("roe_pct"))
    pe = _f(fundamentals.get("pe_ratio"))
    fundamental = 50.0
    if roce is not None:
        fundamental += max(-15.0, min(15.0, (roce - 15.0) * 0.8))
        if roce >= 20:
            positives.append(f"High ROCE {roce:.1f}%")
        elif roce < 10:
            negatives.append(f"Weak ROCE {roce:.1f}%")
    else:
        fund_notes.append("ROCE unavailable — scored neutral")
    if de is not None:
        fundamental += max(-12.0, min(8.0, (0.6 - de) * 10.0))
        if de <= 0.3:
            positives.append(f"Low leverage (D/E {de:.2f})")
        elif de >= 1.5:
            negatives.append(f"High leverage (D/E {de:.2f})")
    else:
        fund_notes.append("Debt/Equity unavailable — scored neutral")
    if roe is not None:
        fundamental += max(-8.0, min(8.0, (roe - 14.0) * 0.5))
    if pe is not None:
        if pe > 60:
            fundamental -= 8.0
            negatives.append(f"Stretched valuation (P/E {pe:.1f}x)")
        elif 0 < pe < 18 and (roce or 0) >= 15:
            fundamental += 5.0
            positives.append(f"Reasonable valuation (P/E {pe:.1f}x)")
    fundamental = max(0.0, min(100.0, fundamental))

    # Sentiment 0-100 (neutral when unavailable — explicitly labelled)
    sentiment_sub = 50.0
    sentiment_note = "News sentiment unavailable — scored neutral"
    if sentiment and sentiment.get("score") is not None:
        try:
            sentiment_sub = max(0.0, min(100.0, float(sentiment["score"])))
            sentiment_note = str(sentiment.get("label", "Model output"))
        except Exception:
            pass

    # ML model 0-100 (neutral when no trained model — explicitly labelled)
    ml_sub = 50.0
    ml_note = "No trained ML model for this ticker — scored neutral"
    if ml_score is not None:
        try:
            ml_sub = max(0.0, min(100.0, float(ml_score)))
            ml_note = "Trained model output"
        except Exception:
            pass

    score = round(
        technical * w["technical"] + momentum_sub * w["momentum"]
        + volume_sub * w["volume"] + structure_sub * w["structure"]
        + fundamental * w["fundamental"] + sentiment_sub * w["sentiment"]
        + ml_sub * w["ml_model"],
        1,
    )
    if score >= 80:
        signal = "STRONG BUY"
    elif score >= 65:
        signal = "BUY"
    elif score >= 45:
        signal = "NEUTRAL"
    elif score >= 30:
        signal = "AVOID"
    else:
        signal = "SELL"

    # ── Structural Signal Verification ──────────────────────────────────────
    # EMA position is a MANDATORY gating factor for directional signals.
    # A BUY/STRONG BUY requires price to be above EMA 200 at minimum — RSI
    # or MACD alone cannot override a bearish EMA structure.
    # A SELL/AVOID requires price to be below EMA 200 at minimum.
    # This eliminates confusing "BEARISH EMA trend + BUY signal" contradictions.
    #
    # EMA position score (ema_bull / ema_bear):
    #   BULLISH_ALIGNED (price > EMA20 > EMA50 > EMA200) → 2  (strongest)
    #   price > EMA 200                                   → 1
    #   BEARISH_ALIGNED or price < EMA 200                → 0  (blocks BUY)
    #
    # Signal rules:
    #   STRONG BUY → ema_bull = 2 (BULLISH_ALIGNED mandatory) + 1 more confirmation
    #   BUY        → ema_bull ≥ 1 (price above EMA200 mandatory) + RSI or MACD bull
    #   AVOID      → ema_bear ≥ 1
    #   SELL       → ema_bear = 2 (BEARISH_ALIGNED mandatory) + 1 more confirmation
    # ------------------------------------------------------------------
    _ema_align = momentum.get("ema_alignment", "")
    _close     = tech.get("_close")
    _e200      = tech.get("ema_200")
    _rsi       = tech.get("rsi_14")
    _macd_bull = tech.get("macd_bullish")

    # EMA position score (mandatory gate: price must be on the right side of EMA 200)
    ema_bull = (2 if (_ema_align == "BULLISH_ALIGNED" and _close and _e200 and _close > _e200)
                else 1 if (_close and _e200 and _close > _e200)
                else 0)
    ema_bear = (2 if (_ema_align == "BEARISH_ALIGNED" and _close and _e200 and _close < _e200)
                else 1 if (_close and _e200 and _close < _e200)
                else 0)

    # Additional confirmations (momentum support)
    rsi_bull = 1 if (_rsi is not None and _rsi > 50) else 0
    rsi_bear = 1 if (_rsi is not None and _rsi < 50) else 0
    macd_bull_conf = 1 if _macd_bull is True else 0
    macd_bear_conf = 1 if _macd_bull is False else 0

    bull_conf = ema_bull + rsi_bull + macd_bull_conf
    bear_conf = ema_bear + rsi_bear + macd_bear_conf

    # Apply gating: EMA position is non-negotiable
    if signal in ("STRONG BUY", "BUY") and ema_bull == 0:
        # EMA structure is bearish/flat — cannot issue a bullish signal
        signal = "NEUTRAL"
    elif signal == "STRONG BUY" and (ema_bull < 2 or bull_conf < 3):
        # STRONG BUY needs full BULLISH_ALIGNED + additional momentum
        signal = "BUY" if bull_conf >= 2 else "NEUTRAL"
    elif signal == "BUY" and bull_conf < 2:
        # BUY needs price > EMA200 + at least one more confirmation
        signal = "NEUTRAL"
    elif signal in ("SELL", "AVOID") and ema_bear == 0:
        # EMA structure is bullish/flat — cannot issue a bearish signal
        signal = "NEUTRAL"
    elif signal == "SELL" and (ema_bear < 2 or bear_conf < 3):
        signal = "AVOID" if bear_conf >= 2 else "NEUTRAL"
    elif signal == "AVOID" and bear_conf < 2:
        signal = "NEUTRAL"

    # Swing structure gating: price structure and signal MUST NOT contradict.
    # If the recent swing pivots form a lower-high/lower-low pattern (trend_hint == 'BEARISH'),
    # the stock is in a pullback or distribution — it CANNOT be a BUY or STRONG BUY.
    _trend_hint = str(struct.get("trend_hint") or "").upper()
    if _trend_hint == "BEARISH" and signal in ("STRONG BUY", "BUY"):
        signal = "NEUTRAL"
    elif _trend_hint == "BULLISH" and signal in ("SELL", "AVOID"):
        signal = "NEUTRAL"
    # ── End verification ─────────────────────────────────────────────────────


    return {
        "ai_score": score,
        "ai_signal": signal,
        "ai_confidence": round(max(30.0, min(97.0, 45.0 + abs(score - 50.0) * 0.9)), 1),
        "weights": {k: round(v, 3) for k, v in w.items()},
        "components": {
            "technical": round(technical, 1),
            "momentum": round(momentum_sub, 1),
            "volume": round(volume_sub, 1),
            "structure": round(structure_sub, 1),
            "fundamental": round(fundamental, 1),
            "sentiment": round(sentiment_sub, 1),
            "ml_model": round(ml_sub, 1),
        },
        "positives": positives[:8],
        "negatives": negatives[:8],
        "notes": fund_notes + [sentiment_note, ml_note],
    }


def build_why_explanation(
    ticker: str,
    tech: Dict[str, Any],
    vol: Dict[str, Any],
    momentum: Dict[str, Any],
    struct: Dict[str, Any],
    rs: Dict[str, Any],
    ai: Dict[str, Any],
    regime: Dict[str, Any],
) -> List[str]:
    """'Why is this stock appearing?' — only supported claims, each traceable."""
    why: List[str] = []
    e50, e200 = tech.get("ema_50"), tech.get("ema_200")
    close_v = tech.get("_close")
    if close_v and e50 and e200:
        if close_v > e50 and close_v > e200:
            why.append(f"Price above EMA 50 ({e50:.0f}) and EMA 200 ({e200:.0f}).")
        elif close_v > e50:
            why.append(f"Price above EMA 50 ({e50:.0f}).")
    rv = vol.get("rel_volume")
    if rv is not None:
        why.append(f"Relative volume is {rv:.1f}x the 20-day average.")
    if tech.get("macd_crossover") == "BULLISH_CROSSOVER":
        why.append("Fresh MACD bullish crossover detected.")
    elif tech.get("macd_bullish") is True:
        why.append("MACD line is above its signal line.")
    if momentum.get("ema_alignment") == "BULLISH_ALIGNED":
        why.append("EMA 20 > EMA 50 > EMA 200 bullish alignment.")
    if struct.get("bos") == "BULLISH_BOS":
        lvl = struct.get("breakout_price")
        why.append(f"Bullish break of structure above {lvl}." if lvl else "Bullish break of structure.")
    if rs.get("rs_vs_nifty_pct") is not None:
        direction = "positive" if rs["rs_vs_nifty_pct"] >= 0 else "negative"
        why.append(f"1-month relative strength vs NIFTY is {direction} ({rs['rs_vs_nifty_pct']:+.1f}%).")
    if regime.get("regime") and regime.get("regime") != "N/A":
        why.append(f"Market regime classified as {regime['regime']} with {regime.get('confidence', '?')}% confidence.")
    if tech.get("rsi_14") is not None:
        why.append(f"RSI(14) reads {tech['rsi_14']:.1f}.")
    # Cap + ticker prefix removed (caller adds header); keep factual only
    return why[:8]
