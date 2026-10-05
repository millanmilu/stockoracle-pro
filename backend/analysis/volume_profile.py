"""
StockOracle Pro — Volume Profile (VPVR) & Institutional Order Flow Engine
Calculates price-by-volume distribution, Point of Control (POC), Value Area High (VAH), and Value Area Low (VAL).
"""
import json
import logging
import urllib.request
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from typing import Dict, Any, List

from backend.data.fetcher import fetch_stock_data

logger = logging.getLogger("StockOracle.Analysis.VolumeProfile")


def _period_to_seconds(period: str) -> int:
    p = (period or "").strip().upper()
    if not p:
        return 86400
    if p.endswith("D") and p[:-1].isdigit():
        return int(p[:-1]) * 86400
    if p.endswith("W") and p[:-1].isdigit():
        return int(p[:-1]) * 7 * 86400
    if p.endswith("M") and p[:-1].isdigit():
        return int(p[:-1]) * 30 * 86400
    if p.endswith("Y") and p[:-1].isdigit():
        return int(p[:-1]) * 365 * 86400
    return 86400


def calculate_exchange_report(ticker: str, period: str = "1D", n_bins: int = 25, value_area_percent: float = 70.0) -> Dict[str, Any]:
    """Builds a trade-level exchange report using Binance aggTrades.

    This is distinct from candle-derived VPVR: it aggregates actual trade price/quantity
    rows, then computes POC/VAH/VAL from exchange-side execution volume.
    """
    ticker = ticker.upper().strip()
    try:
        from backend.data.fetcher import _binance_crypto_symbol
        pair = _binance_crypto_symbol(ticker)
    except Exception:
        return {"error": f"Exchange report is only supported for crypto tickers; got {ticker}"}

    if not pair.endswith("USDT"):
        return {"error": f"Exchange report requires Binance USDT pair for {ticker}; got {pair}"}

    window_seconds = _period_to_seconds(period)
    end_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    start_ms = int((datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).timestamp() * 1000)

    rows: List[Dict[str, float]] = []
    next_start = start_ms
    while next_start < end_ms:
        url = (
            f"https://api.binance.com/api/v3/aggTrades?symbol={pair}&startTime={next_start}&endTime={end_ms}&limit=1000"
        )
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"}), timeout=8) as resp:
                data = json.loads(resp.read().decode())
        except Exception as exc:
            logger.debug("Binance aggTrades failed for %s: %s", ticker, exc)
            break
        if not isinstance(data, list) or not data:
            break
        rows.extend({
            "price": float(item["p"]),
            "qty": float(item["q"]),
            "buyer_maker": bool(item.get("m", False)),
        } for item in data if isinstance(item, dict) and item.get("p") is not None and item.get("q") is not None)
        if len(data) < 1000:
            break
        next_start = max(next_start + 1000, int(data[-1]["T"]) + 1)

    if not rows:
        return {"error": f"No exchange trades available for {ticker} ({pair})"}

    prices = np.array([r["price"] for r in rows], dtype=float)
    qtys = np.array([r["qty"] for r in rows], dtype=float)
    buy = np.zeros_like(qtys, dtype=float)
    sell = np.zeros_like(qtys, dtype=float)
    for idx, row in enumerate(rows):
        if row["buyer_maker"]:
            buy[idx] = row["qty"]
        else:
            sell[idx] = row["qty"]

    min_price = float(np.min(prices))
    max_price = float(np.max(prices))
    if max_price <= min_price:
        return {
            "ticker": ticker,
            "pair": pair,
            "source": "binance_aggtrade",
            "poc_price": round(min_price, 2),
            "vah_price": round(max_price, 2),
            "val_price": round(min_price, 2),
            "total_volume": float(np.sum(qtys)),
            "buy_volume": float(np.sum(buy)),
            "sell_volume": float(np.sum(sell)),
            "profile": [{"price_level": round(min_price, 2), "total_volume": float(np.sum(qtys)), "buy_volume": float(np.sum(buy)), "sell_volume": float(np.sum(sell))}],
        }

    bins = np.linspace(min_price, max_price, n_bins + 1)
    bin_centers = (bins[:-1] + bins[1:]) / 2.0
    buy_bins = np.zeros(n_bins, dtype=float)
    sell_bins = np.zeros(n_bins, dtype=float)
    for price, qty, buyer_maker in zip(prices, qtys, [r["buyer_maker"] for r in rows]):
        idx = int(np.clip((price - min_price) / (max_price - min_price + 1e-9) * n_bins, 0, n_bins - 1))
        if buyer_maker:
            buy_bins[idx] += qty
        else:
            sell_bins[idx] += qty

    total_bins = buy_bins + sell_bins
    total_volume = float(np.sum(total_bins))
    target = total_volume * (value_area_percent / 100.0)
    poc_idx = int(np.argmax(total_bins))
    acc = total_bins[poc_idx]
    start_idx = poc_idx
    end_idx = poc_idx
    while acc < target and (start_idx > 0 or end_idx < n_bins - 1):
        down = total_bins[start_idx - 1] if start_idx > 0 else -1
        up = total_bins[end_idx + 1] if end_idx < n_bins - 1 else -1
        if down < 0 and up < 0:
            break
        if up > down:
            end_idx += 1
            acc += total_bins[end_idx]
        elif down >= up and start_idx > 0:
            start_idx -= 1
            acc += total_bins[start_idx]
        else:
            break

    val_price = round(float(bins[start_idx]), 2)
    vah_price = round(float(bins[end_idx + 1]), 2)
    poc_price = round(float(bin_centers[poc_idx]), 2)

    profile = []
    for idx in range(n_bins):
        profile.append({
            "price_level": round(float(bin_centers[idx]), 2),
            "total_volume": float(total_bins[idx]),
            "buy_volume": float(buy_bins[idx]),
            "sell_volume": float(sell_bins[idx]),
            "is_poc": idx == poc_idx,
            "is_value_area": start_idx <= idx <= end_idx,
        })

    return {
        "ticker": ticker,
        "pair": pair,
        "source": "binance_aggtrade",
        "poc_price": poc_price,
        "vah_price": vah_price,
        "val_price": val_price,
        "total_volume": total_volume,
        "buy_volume": float(np.sum(buy_bins)),
        "sell_volume": float(np.sum(sell_bins)),
        "profile": profile,
    }


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

    valid_prices = np.isfinite(np.column_stack((opens, highs, lows, closes))).all(axis=1)
    valid_prices &= (opens > 0) & (highs > 0) & (lows > 0) & (closes > 0)
    if not valid_prices.any():
        return {"error": f"No valid price data for {ticker}"}
    opens = opens[valid_prices]
    highs = np.maximum(highs[valid_prices], np.maximum(opens, closes[valid_prices]))
    lows = np.minimum(lows[valid_prices], np.minimum(opens, closes[valid_prices]))
    closes = closes[valid_prices]
    volumes = volumes[valid_prices]

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

        if not np.isfinite(c_vol) or c_vol <= 0:
            continue

        # Distribute volume by the fraction of each bin overlapped by the candle.
        c_low = min(c_low, opens[i], closes[i])
        c_high = max(c_high, opens[i], closes[i])
        candle_range = c_high - c_low
        if candle_range <= 0:
            # Flat bar: assign all volume to the containing bin.
            closest = np.argmin(np.abs(bin_centers - closes[i]))
            if is_bull:
                buy_vols[closest] += c_vol
            else:
                sell_vols[closest] += c_vol
            continue

        first_bin = max(0, min(n_bins - 1, int((c_low - min_price) / (max_price - min_price) * n_bins)))
        last_bin = max(0, min(n_bins - 1, int((c_high - min_price) / (max_price - min_price) * n_bins)))
        for bin_idx in range(first_bin, last_bin + 1):
            overlap = max(0.0, min(c_high, bins[bin_idx + 1]) - max(c_low, bins[bin_idx]))
            if overlap <= 0:
                continue
            allocated_volume = c_vol * overlap / candle_range
            if is_bull:
                buy_vols[bin_idx] += allocated_volume
            else:
                sell_vols[bin_idx] += allocated_volume

    total_vols = buy_vols + sell_vols
    total_volume_sum = np.sum(total_vols)
    if total_volume_sum <= 0:
        return {"error": f"No positive volume data for {ticker}"}

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

        if next_lower > next_upper and lower_idx > 0:
            lower_idx -= 1
            accumulated_vol += next_lower
        elif next_upper > next_lower and upper_idx < n_bins - 1:
            upper_idx += 1
            accumulated_vol += next_upper
        elif lower_idx > 0 and upper_idx < n_bins - 1:
            # Match frontend tie-breaking: nearer row first, then upper row.
            lower_distance = poc_idx - (lower_idx - 1)
            upper_distance = (upper_idx + 1) - poc_idx
            if upper_distance <= lower_distance:
                upper_idx += 1
                accumulated_vol += next_upper
            else:
                lower_idx -= 1
                accumulated_vol += next_lower
        elif lower_idx > 0:
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
            "total_volume": float(total_vols[j]),
            "buy_volume": float(buy_vols[j]),
            "sell_volume": float(sell_vols[j]),
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
        "total_volume": float(total_volume_sum),
        "profile": profile_data,
    }
