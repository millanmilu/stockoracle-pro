"""
sentiment_market.py — Market-wide Sentiment Analysis
Aggregates per-ticker news sentiment and derives a composite
Fear & Greed index (0-100) from sentiment, breadth, RSI extremes and volatility.
"""

import logging
import statistics
from typing import Dict, Any, List

logger = logging.getLogger("stockoracle.sentiment_market")


# ── Fear & Greed component weights ──────────────────────────────────────────
# Inspired by CNN's Fear & Greed model, adapted for NSE
_WEIGHTS = {
    "sentiment":  0.35,   # News sentiment score across all tickers
    "breadth":    0.25,   # % of tickers with positive daily change
    "momentum":   0.20,   # % of tickers above their 20-day MA
    "volatility": 0.20,   # Inverse volatility (high vol = fear)
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _score_to_fng(raw_score: float) -> int:
    """Map a raw composite score [-1, +1] → Fear & Greed [0, 100]."""
    return int(_clamp((raw_score + 1.0) / 2.0 * 100.0))


def _label_fng(score: int) -> str:
    if score <= 20:
        return "Extreme Fear"
    elif score <= 40:
        return "Fear"
    elif score <= 60:
        return "Neutral"
    elif score <= 80:
        return "Greed"
    else:
        return "Extreme Greed"


def _fng_color(score: int) -> str:
    if score <= 20:
        return "#F43F5E"
    elif score <= 40:
        return "#F97316"
    elif score <= 60:
        return "#F59E0B"
    elif score <= 80:
        return "#34D399"
    else:
        return "#10B981"


def get_market_sentiment(tickers: List[str]) -> Dict[str, Any]:
    """
    Fetches news sentiment for each ticker, computes per-ticker scores,
    and builds a composite Fear & Greed index.

    Returns:
        {
          "fear_greed_score": int,          # 0–100
          "fear_greed_label": str,
          "fear_greed_color": str,
          "market_mood": str,               # Bullish / Bearish / Mixed
          "bull_count": int,
          "bear_count": int,
          "neutral_count": int,
          "tickers": [
            {"ticker": str, "sentiment": float, "label": str, "color": str}, ...
          ]
        }
    """
    from backend.analysis.sentiment import fetch_and_score_sentiment
    from backend.data.fetcher import fetch_stock_data, fetch_company_info

    ticker_results: List[Dict] = []
    sentiment_scores: List[float] = []
    breadth_scores: List[float] = []  # 1 if up, 0 if down
    momentum_scores: List[float] = []  # 1 if above MA20, 0 if below
    vol_scores: List[float] = []       # recent 20d rolling std

    for t in tickers:
        try:
            # Sentiment score from FinBERT/VADER pipeline
            score = fetch_and_score_sentiment(t)
            sentiment_scores.append(score)

            # Price data for breadth + momentum + volatility
            try:
                df = fetch_stock_data(t, period="45D")
                if df is not None and len(df) >= 2:
                    close = df["close"]
                    last = float(close.iloc[-1])
                    prev = float(close.iloc[-2])
                    breadth_scores.append(1.0 if last >= prev else 0.0)

                    if len(close) >= 20:
                        ma20 = float(close.rolling(20).mean().iloc[-1])
                        momentum_scores.append(1.0 if last >= ma20 else 0.0)

                    if len(close) >= 10:
                        vol = float(close.pct_change().rolling(min(10, len(close))).std().iloc[-1])
                        vol_scores.append(vol if not __import__("math").isnan(vol) else 0.02)
            except Exception as price_err:
                logger.debug("Price data error for %s: %s", t, price_err)

            # Determine label + color for this ticker
            if score > 0.1:
                label = "Bullish"
                color = "#10B981"
            elif score < -0.1:
                label = "Bearish"
                color = "#F43F5E"
            else:
                label = "Neutral"
                color = "#F59E0B"

            ticker_results.append({
                "ticker": t,
                "sentiment": round(score, 4),
                "label": label,
                "color": color,
            })

        except Exception as e:
            logger.warning("Skipping %s in market sentiment: %s", t, e)
            ticker_results.append({
                "ticker": t,
                "sentiment": 0.0,
                "label": "Neutral",
                "color": "#F59E0B",
            })

    # ── Composite Fear & Greed calculation ───────────────────────────────────
    avg_sentiment = statistics.mean(sentiment_scores) if sentiment_scores else 0.0
    avg_breadth   = statistics.mean(breadth_scores) if breadth_scores else 0.5
    avg_momentum  = statistics.mean(momentum_scores) if momentum_scores else 0.5

    # High volatility → fear. Normalise: typical NSE daily vol is ~1-3%.
    avg_vol = statistics.mean(vol_scores) if vol_scores else 0.015
    vol_component = _clamp(1.0 - (avg_vol / 0.03), 0.0, 1.0)  # 0 = max fear, 1 = calm

    # Map breadth / momentum / vol → [-1, +1] space
    breadth_raw   = (avg_breadth   * 2.0) - 1.0
    momentum_raw  = (avg_momentum  * 2.0) - 1.0
    vol_raw       = (vol_component * 2.0) - 1.0

    composite = (
        _WEIGHTS["sentiment"]  * avg_sentiment +
        _WEIGHTS["breadth"]    * breadth_raw   +
        _WEIGHTS["momentum"]   * momentum_raw  +
        _WEIGHTS["volatility"] * vol_raw
    )

    fng_score = _score_to_fng(composite)
    fng_label = _label_fng(fng_score)
    fng_color = _fng_color(fng_score)

    # ── Bull / Bear / Neutral counts ─────────────────────────────────────────
    bull = sum(1 for r in ticker_results if r["label"] == "Bullish")
    bear = sum(1 for r in ticker_results if r["label"] == "Bearish")
    neut = sum(1 for r in ticker_results if r["label"] == "Neutral")

    if bull > bear:
        mood = "Bullish"
    elif bear > bull:
        mood = "Bearish"
    else:
        mood = "Mixed"

    return {
        "fear_greed_score": fng_score,
        "fear_greed_label": fng_label,
        "fear_greed_color": fng_color,
        "market_mood":      mood,
        "bull_count":       bull,
        "bear_count":       bear,
        "neutral_count":    neut,
        "avg_sentiment":    round(avg_sentiment, 4),
        "tickers":          ticker_results,
    }
