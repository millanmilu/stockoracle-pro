import numpy as np
import pandas as pd
from typing import List, Dict, Any
from backend.analysis.indicators import enrich_stock_dataframe


def get_recent_patterns(df: pd.DataFrame, days: int = 30) -> List[Dict[str, Any]]:
    """
    Scans the last `days` rows of enriched OHLCV data and returns detected
    candlestick patterns with date, type, direction, and strength score.
    """
    enriched = enrich_stock_dataframe(df)
    recent = enriched.tail(days).copy()

    pattern_cols = {
        "pattern_hammer":             ("Hammer",              "bullish", 3),
        "pattern_bullish_engulfing":  ("Bullish Engulfing",   "bullish", 4),
        "pattern_morning_star":       ("Morning Star",        "bullish", 5),
        "pattern_doji":               ("Doji",                "neutral", 2),
        "pattern_harami":             ("Harami",              "bullish", 2),
        "pattern_shooting_star":      ("Shooting Star",       "bearish", 3),
        "pattern_bearish_engulfing":  ("Bearish Engulfing",   "bearish", 4),
        "pattern_evening_star":       ("Evening Star",        "bearish", 5),
        "pattern_marubozu":           ("Marubozu",            "neutral", 2),
    }

    results = []
    for _, row in recent.iterrows():
        for col, (name, direction, strength) in pattern_cols.items():
            if row.get(col, False):
                # Override marubozu direction based on candle colour
                if col == "pattern_marubozu":
                    direction = "bullish" if row["close"] > row["open"] else "bearish"
                results.append({
                    "date":      str(row["date"]),
                    "pattern":   name,
                    "direction": direction,
                    "strength":  strength,
                    "close":     round(float(row["close"]), 2),
                    "change_pct": round(float((row["close"] - row["open"]) / (row["open"] + 1e-9) * 100), 2),
                })

    # Most recent first
    results.sort(key=lambda x: x["date"], reverse=True)
    return results


def get_pattern_summary(df: pd.DataFrame, lookback: int = 30) -> Dict[str, Any]:
    """
    Returns a summary of bullish vs bearish pattern counts for the bias gauge.
    """
    patterns = get_recent_patterns(df, days=lookback)
    bullish = sum(1 for p in patterns if p["direction"] == "bullish")
    bearish = sum(1 for p in patterns if p["direction"] == "bearish")
    neutral = sum(1 for p in patterns if p["direction"] == "neutral")
    total   = bullish + bearish + neutral

    bias_score = int(((bullish - bearish) / max(total, 1)) * 50 + 50)  # 0–100

    return {
        "patterns":    patterns,
        "bullish":     bullish,
        "bearish":     bearish,
        "neutral":     neutral,
        "total":       total,
        "bias_score":  bias_score,
        "bias_label":  "Bullish" if bias_score > 55 else "Bearish" if bias_score < 45 else "Neutral",
    }
