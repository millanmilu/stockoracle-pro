"""
StockOracle Pro — Volume Profile (VPVR) & Institutional Order Flow Engine
Calculates price-by-volume distribution, Point of Control (POC), Value Area High (VAH), and Value Area Low (VAL).
"""
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List

from backend.data.fetcher import fetch_stock_data

logger = logging.getLogger("StockOracle.Analysis.VolumeProfile")


def calculate_volume_profile(ticker: str, period: str = "3M", n_bins: int = 25) -> Dict[str, Any]:
    """
    Computes horizontal Volume-at-Price histogram with POC, VAH, and VAL.
    """
    ticker = ticker.upper().strip()
    df = fetch_stock_data(ticker, period=period)
    if df is None or df.empty or len(df) < 10:
        return {"error": f"Insufficient price data for {ticker}"}

    lows = df["low"].values.astype(float)
    highs = df["high"].values.astype(float)
    closes = df["close"].values.astype(float)
    opens = df["open"].values.astype(float)
    volumes = df["volume"].values.astype(float)

    min_price = float(np.min(lows))
    max_price = float(np.max(highs))
    bins = np.linspace(min_price, max_price, n_bins + 1)
    bin_centers = (bins[:-1] + bins[1:]) / 2.0

    buy_vols = np.zeros(n_bins)
    sell_vols = np.zeros(n_bins)

    for i in range(len(df)):
        c_low = lows[i]
        c_high = highs[i]
        c_vol = volumes[i]
        is_bull = closes[i] >= opens[i]

        # Allocate volume across intersected price bins
        active_bins = np.where((bin_centers >= c_low) & (bin_centers <= c_high))[0]
        if len(active_bins) > 0:
            vol_per_bin = c_vol / len(active_bins)
            if is_bull:
                buy_vols[active_bins] += vol_per_bin
            else:
                sell_vols[active_bins] += vol_per_bin
        else:
            # Fallback to closest center
            closest = np.argmin(np.abs(bin_centers - closes[i]))
            if is_bull:
                buy_vols[closest] += c_vol
            else:
                sell_vols[closest] += c_vol

    total_vols = buy_vols + sell_vols
    total_volume_sum = np.sum(total_vols)

    # 1. Point of Control (POC): bin with maximum volume
    poc_idx = int(np.argmax(total_vols))
    poc_price = round(float(bin_centers[poc_idx]), 2)

    # 2. Value Area: 70% of total volume expanding outward from POC
    target_va_vol = 0.70 * total_volume_sum
    accumulated_vol = total_vols[poc_idx]
    lower_idx = poc_idx
    upper_idx = poc_idx

    while accumulated_vol < target_va_vol and (lower_idx > 0 or upper_idx < n_bins - 1):
        next_lower = total_vols[lower_idx - 1] if lower_idx > 0 else 0
        next_upper = total_vols[upper_idx + 1] if upper_idx < n_bins - 1 else 0

        if next_lower >= next_upper and lower_idx > 0:
            lower_idx -= 1
            accumulated_vol += next_lower
        elif upper_idx < n_bins - 1:
            upper_idx += 1
            accumulated_vol += next_upper
        else:
            break

    val_price = round(float(bins[lower_idx]), 2)
    vah_price = round(float(bins[upper_idx + 1]), 2)

    profile_data = []
    for j in range(n_bins):
        profile_data.append({
            "price_level": round(float(bin_centers[j]), 2),
            "total_volume": int(total_vols[j]),
            "buy_volume": int(buy_vols[j]),
            "sell_volume": int(sell_vols[j]),
            "is_poc": bool(j == poc_idx),
            "is_value_area": bool(lower_idx <= j <= upper_idx),
        })

    return {
        "ticker": ticker,
        "period": period,
        "poc_price": poc_price,
        "vah_price": vah_price,
        "val_price": val_price,
        "current_price": round(float(closes[-1]), 2),
        "total_volume": int(total_volume_sum),
        "profile": profile_data,
    }
