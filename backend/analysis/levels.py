import numpy as np
import pandas as pd
from typing import Dict, Any, List


def calculate_support_resistance(df: pd.DataFrame, window: int = 10) -> Dict[str, Any]:
    """
    Calculates key support and resistance levels using:
    1. Pivot Points (Classic method) from the last completed session
    2. Local swing highs/lows (fractal-style) over rolling window
    3. Fibonacci retracement levels from 52-week high/low
    """
    closes = df["close"].values.astype(float)
    highs  = df["high"].values.astype(float)
    lows   = df["low"].values.astype(float)

    current_price = float(closes[-1])

    # ── 1. Classic Pivot Points (last session) ──────────────────────────────
    last_high  = float(highs[-2])
    last_low   = float(lows[-2])
    last_close = float(closes[-2])

    pp  = (last_high + last_low + last_close) / 3
    r1  = 2 * pp - last_low
    r2  = pp + (last_high - last_low)
    r3  = last_high + 2 * (pp - last_low)
    s1  = 2 * pp - last_high
    s2  = pp - (last_high - last_low)
    s3  = last_low - 2 * (last_high - pp)

    # ── 2. Swing Highs / Lows (last 6 months) ──────────────────────────────
    recent_df  = df.tail(min(120, len(df))).copy().reset_index(drop=True)
    swing_highs: List[float] = []
    swing_lows:  List[float] = []

    for i in range(window, len(recent_df) - window):
        h = float(recent_df["high"].iloc[i])
        l = float(recent_df["low"].iloc[i])
        if h == recent_df["high"].iloc[i - window: i + window + 1].max():
            swing_highs.append(h)
        if l == recent_df["low"].iloc[i - window: i + window + 1].min():
            swing_lows.append(l)

    # Cluster nearby levels (within 0.5% of each other) and keep strongest
    def cluster(levels: List[float], pct: float = 0.005) -> List[float]:
        if not levels:
            return []
        levels = sorted(levels)
        clusters: List[List[float]] = [[levels[0]]]
        for v in levels[1:]:
            if abs(v - clusters[-1][-1]) / (clusters[-1][-1] + 1e-9) <= pct:
                clusters[-1].append(v)
            else:
                clusters.append([v])
        return [round(float(np.mean(c)), 2) for c in clusters]

    key_resistances = cluster(swing_highs)
    key_supports    = cluster(swing_lows)

    # Keep the 3 closest above/below current price
    resistances_above = sorted([r for r in key_resistances if r > current_price])[:3]
    supports_below    = sorted([s for s in key_supports    if s < current_price], reverse=True)[:3]

    # ── 3. Fibonacci Retracement (52-week range) ──────────────────────────────
    period_high = float(np.max(highs[-252:]) if len(highs) >= 252 else np.max(highs))
    period_low  = float(np.min(lows[-252:])  if len(lows)  >= 252 else np.min(lows))
    diff        = period_high - period_low

    fib_levels = {
        "fib_0":    round(period_low,                  2),
        "fib_236":  round(period_low + 0.236 * diff,   2),
        "fib_382":  round(period_low + 0.382 * diff,   2),
        "fib_500":  round(period_low + 0.500 * diff,   2),
        "fib_618":  round(period_low + 0.618 * diff,   2),
        "fib_786":  round(period_low + 0.786 * diff,   2),
        "fib_100":  round(period_high,                 2),
    }

    return {
        "current_price":     round(current_price, 2),
        "pivot_point":       round(pp,  2),
        "resistance_1":      round(r1,  2),
        "resistance_2":      round(r2,  2),
        "resistance_3":      round(r3,  2),
        "support_1":         round(s1,  2),
        "support_2":         round(s2,  2),
        "support_3":         round(s3,  2),
        "swing_resistances": [round(r, 2) for r in resistances_above],
        "swing_supports":    [round(s, 2) for s in supports_below],
        "fibonacci":         fib_levels,
        "period_high":       round(period_high, 2),
        "period_low":        round(period_low,  2),
    }
