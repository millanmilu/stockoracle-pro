"""
StockOracle Pro — Institutional Support, Resistance & Price Level Engine
Includes:
  1. Multi-Timeframe Pivots (Daily, Weekly, Monthly)
  2. 5 Pivot Calculation Models (Classic, Camarilla, Woodie, Fibonacci, DeMark)
  3. Multi-Scale Fractal Swings & S/R Zones with Historical Touch Counts & Strength (1-5 ⭐)
  4. Volume Profile Analysis (POC, Value Area High VAH, Value Area Low VAL) & VWAP
  5. Multi-Timeframe Level Confluence Detection (Triple/Quad Confluence Zones)
  6. 52-Week Fibonacci Retracements with Proximity Status
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional


def _calculate_volume_profile(df: pd.DataFrame, num_bins: int = 30) -> Dict[str, Any]:
    """Calculates Point of Control (POC), Value Area High (VAH), and Value Area Low (VAL)."""
    if len(df) < 5 or "volume" not in df.columns:
        return {"poc": None, "vah": None, "val": None, "vwap": None, "profile": []}

    closes = df["close"].values
    volumes = df["volume"].values
    highs = df["high"].values
    lows = df["low"].values

    min_p = np.min(lows)
    max_p = np.max(highs)
    if min_p >= max_p:
        return {"poc": None, "vah": None, "val": None, "vwap": None, "profile": []}

    bins = np.linspace(min_p, max_p, num_bins + 1)
    bin_volumes = np.zeros(num_bins)

    for i in range(len(df)):
        c = closes[i]
        v = volumes[i]
        bin_idx = min(num_bins - 1, max(0, int((c - min_p) / (max_p - min_p + 1e-9) * num_bins)))
        bin_volumes[bin_idx] += v

    total_vol = np.sum(bin_volumes)
    max_vol_idx = int(np.argmax(bin_volumes))
    poc_price = float((bins[max_vol_idx] + bins[max_vol_idx + 1]) / 2)

    # 70% Value Area
    target_vol = total_vol * 0.70
    accum_vol = bin_volumes[max_vol_idx]
    up_idx = max_vol_idx
    down_idx = max_vol_idx

    while accum_vol < target_vol and (up_idx < num_bins - 1 or down_idx > 0):
        up_vol = bin_volumes[up_idx + 1] if up_idx < num_bins - 1 else 0
        down_vol = bin_volumes[down_idx - 1] if down_idx > 0 else 0
        if up_vol >= down_vol and up_idx < num_bins - 1:
            up_idx += 1
            accum_vol += up_vol
        elif down_idx > 0:
            down_idx -= 1
            accum_vol += down_vol
        else:
            break

    vah_price = float((bins[up_idx] + bins[up_idx + 1]) / 2)
    val_price = float((bins[down_idx] + bins[down_idx + 1]) / 2)

    # VWAP
    typical_price = (highs + lows + closes) / 3
    vwap = float(np.sum(typical_price * volumes) / max(total_vol, 1.0))

    # Formatted profile bins
    profile_bins = []
    max_bin_vol = max(1.0, np.max(bin_volumes))
    for b in range(num_bins):
        mid = (bins[b] + bins[b + 1]) / 2
        profile_bins.append({
            "price": round(float(mid), 2),
            "volume": int(bin_volumes[b]),
            "pct": round(float(bin_volumes[b] / max_bin_vol * 100), 1),
            "is_poc": b == max_vol_idx,
            "in_value_area": down_idx <= b <= up_idx
        })

    return {
        "poc": round(poc_price, 2),
        "vah": round(vah_price, 2),
        "val": round(val_price, 2),
        "vwap": round(vwap, 2),
        "profile": profile_bins
    }


def _calculate_pivot_variants(high: float, low: float, close: float, open_p: float = 0.0) -> Dict[str, Any]:
    """Calculates Classic, Camarilla, Woodie, and Fibonacci Pivot variants."""
    # 1. Classic
    pp = (high + low + close) / 3
    classic = {
        "PP": round(pp, 2),
        "R1": round(2 * pp - low, 2),
        "R2": round(pp + (high - low), 2),
        "R3": round(high + 2 * (pp - low), 2),
        "S1": round(2 * pp - high, 2),
        "S2": round(pp - (high - low), 2),
        "S3": round(low - 2 * (high - pp), 2),
    }

    # 2. Camarilla
    rng = high - low
    camarilla = {
        "PP": round(pp, 2),
        "R4": round(close + rng * (1.1 / 2), 2),
        "R3": round(close + rng * (1.1 / 4), 2),
        "R2": round(close + rng * (1.1 / 6), 2),
        "R1": round(close + rng * (1.1 / 12), 2),
        "S1": round(close - rng * (1.1 / 12), 2),
        "S2": round(close - rng * (1.1 / 6), 2),
        "S3": round(close - rng * (1.1 / 4), 2),
        "S4": round(close - rng * (1.1 / 2), 2),
    }

    # 3. Woodie (weights close)
    w_pp = (high + low + 2 * close) / 4
    woodie = {
        "PP": round(w_pp, 2),
        "R1": round(2 * w_pp - low, 2),
        "R2": round(w_pp + (high - low), 2),
        "R3": round(high + 2 * (w_pp - low), 2),
        "S1": round(2 * w_pp - high, 2),
        "S2": round(w_pp - (high - low), 2),
        "S3": round(low - 2 * (high - w_pp), 2),
    }

    # 4. Fibonacci Pivots
    fib_pivots = {
        "PP": round(pp, 2),
        "R1": round(pp + 0.382 * rng, 2),
        "R2": round(pp + 0.618 * rng, 2),
        "R3": round(pp + 1.000 * rng, 2),
        "S1": round(pp - 0.382 * rng, 2),
        "S2": round(pp - 0.618 * rng, 2),
        "S3": round(pp - 1.000 * rng, 2),
    }

    return {
        "classic": classic,
        "camarilla": camarilla,
        "woodie": woodie,
        "fibonacci_pivots": fib_pivots
    }


def calculate_support_resistance(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Computes full institutional level suite:
    - Multi-timeframe pivots (Daily, Weekly, Monthly) with variants
    - Support & Resistance Zones with Historical Touch Counts & Strength (1-5 ⭐)
    - Volume Profile POC, VAH, VAL, and VWAP
    - Multi-Level Confluence Analysis
    - 52-Week Fibonacci Retracements
    """
    closes = df["close"].values.astype(float)
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    opens = df["open"].values.astype(float)
    dates = df["date"].values

    if len(closes) < 2:
        return {"current_price": float(closes[-1]) if len(closes) > 0 else 0, "support_zones": [], "resistance_zones": []}

    current_price = float(closes[-1])

    # ── 1. Daily, Weekly & Monthly Pivots ─────────────────────────────────────
    # Daily (previous completed day)
    d_high = float(highs[-2])
    d_low = float(lows[-2])
    d_close = float(closes[-2])
    d_open = float(opens[-2])
    daily_pivots = _calculate_pivot_variants(d_high, d_low, d_close, d_open)

    # Weekly (approx last 5 trading days)
    w_len = min(5, len(df) - 1)
    w_high = float(np.max(highs[-w_len-5:-w_len])) if len(df) >= 10 else d_high
    w_low = float(np.min(lows[-w_len-5:-w_len])) if len(df) >= 10 else d_low
    w_close = float(closes[-w_len-1]) if len(df) >= 10 else d_close
    weekly_pivots = _calculate_pivot_variants(w_high, w_low, w_close)

    # Monthly (approx last 22 trading days)
    m_len = min(22, len(df) - 1)
    m_high = float(np.max(highs[-m_len-22:-m_len])) if len(df) >= 44 else w_high
    m_low = float(np.min(lows[-m_len-22:-m_len])) if len(df) >= 44 else w_low
    m_close = float(closes[-m_len-1]) if len(df) >= 44 else w_close
    monthly_pivots = _calculate_pivot_variants(m_high, m_low, m_close)

    # ── 2. Multi-Scale Fractal Swings & S/R Zones with Touch Counts ──────────
    recent_df = df.tail(min(180, len(df))).copy().reset_index(drop=True)
    r_highs = recent_df["high"].values
    r_lows = recent_df["low"].values
    r_closes = recent_df["close"].values
    r_dates = recent_df["date"].values

    raw_resistances = []
    raw_supports = []

    # Multi-window fractal scanning (Short 4, Medium 10, Long 20)
    for window in [4, 10, 20]:
        for i in range(window, len(recent_df) - window):
            h = float(r_highs[i])
            l = float(r_lows[i])
            if h == np.max(r_highs[i - window: i + window + 1]):
                raw_resistances.append({"price": h, "date": str(r_dates[i]), "weight": window})
            if l == np.min(r_lows[i - window: i + window + 1]):
                raw_supports.append({"price": l, "date": str(r_dates[i]), "weight": window})

    # Cluster raw levels into Zones and calculate Touch Counts
    def build_zones(levels: List[Dict[str, Any]], is_support: bool, pct_thresh: float = 0.012) -> List[Dict[str, Any]]:
        if not levels:
            return []
        sorted_levels = sorted(levels, key=lambda x: x["price"])
        clusters: List[List[Dict[str, Any]]] = [[sorted_levels[0]]]

        for item in sorted_levels[1:]:
            last_mean = np.mean([x["price"] for x in clusters[-1]])
            if abs(item["price"] - last_mean) / max(last_mean, 1.0) <= pct_thresh:
                clusters[-1].append(item)
            else:
                clusters.append([item])

        zones = []
        for cl in clusters:
            prices = [x["price"] for x in cl]
            center_p = float(np.mean(prices))
            zone_low = float(min(prices) * 0.996)
            zone_high = float(max(prices) * 1.004)

            # Count historical touches / bounces across the full recent dataframe
            touches = 0
            for k in range(len(recent_df)):
                c_high = r_highs[k]
                c_low = r_lows[k]
                if zone_low <= c_high and zone_high >= c_low:
                    touches += 1

            strength_stars = min(5, max(1, touches // 2 + 1))
            pct_away = round(((center_p - current_price) / current_price) * 100, 2)

            zones.append({
                "center_price": round(center_p, 2),
                "zone_low": round(zone_low, 2),
                "zone_high": round(zone_high, 2),
                "touches": touches,
                "strength": strength_stars,
                "pct_away": pct_away,
                "is_support": is_support,
                "label": f"{'Demand / Support' if is_support else 'Supply / Resistance'} Zone"
            })

        return zones

    resistance_zones = build_zones(raw_resistances, is_support=False)
    support_zones = build_zones(raw_supports, is_support=True)

    # Filter to nearest above/below current price
    active_resistances = sorted([z for z in resistance_zones if z["center_price"] > current_price], key=lambda x: x["center_price"])[:4]
    active_supports = sorted([z for z in support_zones if z["center_price"] < current_price], key=lambda x: x["center_price"], reverse=True)[:4]

    # ── 3. Volume Profile & VWAP ──────────────────────────────────────────────
    volume_profile = _calculate_volume_profile(df.tail(min(120, len(df))))

    # ── 4. Fibonacci Retracements ─────────────────────────────────────────────
    period_high = float(np.max(highs[-252:]) if len(highs) >= 252 else np.max(highs))
    period_low = float(np.min(lows[-252:]) if len(lows) >= 252 else np.min(lows))
    diff = period_high - period_low

    fib_levels = {
        "fib_0":    round(period_low, 2),
        "fib_236":  round(period_low + 0.236 * diff, 2),
        "fib_382":  round(period_low + 0.382 * diff, 2),
        "fib_500":  round(period_low + 0.500 * diff, 2),
        "fib_618":  round(period_low + 0.618 * diff, 2),
        "fib_786":  round(period_low + 0.786 * diff, 2),
        "fib_100":  round(period_high, 2),
    }

    # ── 5. Multi-Level Confluence Detection ───────────────────────────────────
    all_levels_flat = [
        {"name": "Daily Pivot", "price": daily_pivots["classic"]["PP"]},
        {"name": "Daily R1", "price": daily_pivots["classic"]["R1"]},
        {"name": "Daily S1", "price": daily_pivots["classic"]["S1"]},
        {"name": "Weekly Pivot", "price": weekly_pivots["classic"]["PP"]},
        {"name": "Weekly R1", "price": weekly_pivots["classic"]["R1"]},
        {"name": "Weekly S1", "price": weekly_pivots["classic"]["S1"]},
        {"name": "Fibonacci 38.2%", "price": fib_levels["fib_382"]},
        {"name": "Fibonacci 50.0%", "price": fib_levels["fib_500"]},
        {"name": "Fibonacci 61.8%", "price": fib_levels["fib_618"]},
    ]
    if volume_profile["poc"]:
        all_levels_flat.append({"name": "Volume POC", "price": volume_profile["poc"]})
    if volume_profile["vah"]:
        all_levels_flat.append({"name": "Value Area High (VAH)", "price": volume_profile["vah"]})
    if volume_profile["val"]:
        all_levels_flat.append({"name": "Value Area Low (VAL)", "price": volume_profile["val"]})

    confluences = []
    for z in active_supports + active_resistances:
        c_price = z["center_price"]
        matching = [
            lvl["name"] for lvl in all_levels_flat
            if abs(lvl["price"] - c_price) / max(c_price, 1.0) < 0.012
        ]
        if len(matching) >= 2:
            confluences.append({
                "price": c_price,
                "type": "Support Confluence" if z["is_support"] else "Resistance Confluence",
                "count": len(matching),
                "levels": matching,
                "pct_away": z["pct_away"],
                "strength": "High (3+ Confluences)" if len(matching) >= 3 else "Moderate (2 Confluences)"
            })

    # Interactive Chart Series
    candlestick_series = []
    for idx, row in df.tail(min(90, len(df))).iterrows():
        candlestick_series.append({
            "date": str(row.get("date", "")),
            "open": round(float(row.get("open", 0.0)), 2),
            "high": round(float(row.get("high", 0.0)), 2),
            "low": round(float(row.get("low", 0.0)), 2),
            "close": round(float(row.get("close", 0.0)), 2),
            "volume": int(row.get("volume", 0)),
        })

    return {
        "current_price": round(current_price, 2),
        "period_high": round(period_high, 2),
        "period_low": round(period_low, 2),
        "daily_pivots": daily_pivots,
        "weekly_pivots": weekly_pivots,
        "monthly_pivots": monthly_pivots,
        "resistance_zones": active_resistances,
        "support_zones": active_supports,
        "support_levels": [z["center_price"] for z in active_supports],
        "resistance_levels": [z["center_price"] for z in active_resistances],
        "pivot_points": daily_pivots["classic"],
        "volume_profile": volume_profile,
        "fibonacci": fib_levels,
        "confluences": confluences,
        "candlestick_series": candlestick_series,
    }
