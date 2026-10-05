"""StockOracle Pro — look-ahead-free causal feature engineering for backtests.


Split verbatim out of ``backend/analysis/backtester.py`` (pure code motion).
"""

from typing import Tuple

import numpy as np
import pandas as pd

def _build_features_row_by_row(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes ALL indicators using strictly past data only — zero look-ahead bias.
    Uses causal rolling & ewm operations with min_periods=1.
    """
    df = df.copy().sort_values("date").reset_index(drop=True)
    closes = df["close"].values.astype(float)
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    volumes = df["volume"].values.astype(float)

    n = len(df)
    out = df.copy()

    # ── Causal RSI (14) ────────────────────────────────────────────────────────
    delta = pd.Series(closes).diff()
    gain = delta.clip(lower=0).fillna(0)
    loss = (-delta).clip(lower=0).fillna(0)
    avg_gain = gain.ewm(alpha=1/14, min_periods=1, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/14, min_periods=1, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    out["rsi_14"] = (100 - 100 / (1 + rs)).values

    # ── Causal MACD (12, 26, 9) ───────────────────────────────────────────────
    ema12 = pd.Series(closes).ewm(span=12, adjust=False).mean()
    ema26 = pd.Series(closes).ewm(span=26, adjust=False).mean()
    macd_line = (ema12 - ema26).values
    macd_sig = pd.Series(macd_line).ewm(span=9, adjust=False).mean().values
    out["macd"] = macd_line
    out["macd_signal"] = macd_sig
    out["macd_hist"] = macd_line - macd_sig

    # ── Causal ATR (14) ─────────────────────────────────────────────────────────
    prev_close = pd.Series(closes).shift(1)
    tr = pd.concat([
        pd.Series(highs) - pd.Series(lows),
        (pd.Series(highs) - prev_close).abs(),
        (pd.Series(lows) - prev_close).abs(),
    ], axis=1).max(axis=1)
    out["atr_14"] = tr.rolling(14, min_periods=1).mean().values

    # ── Causal Bollinger Bands (20, 2 std) ────────────────────────────────────
    rm20 = pd.Series(closes).rolling(20, min_periods=1).mean()
    rs20 = pd.Series(closes).rolling(20, min_periods=1).std().fillna(0)
    bb_upper = (rm20 + 2 * rs20).values
    bb_lower = (rm20 - 2 * rs20).values
    out["bb_upper"] = bb_upper
    out["bb_lower"] = bb_lower
    out["bb_mid"] = rm20.values
    out["bb_pct_b"] = ((pd.Series(closes) - bb_lower) / (bb_upper - bb_lower + 1e-9)).values

    # ── Rolling Means (Moving Averages) ────────────────────────────────────────
    out["roll_mean_5"]  = pd.Series(closes).rolling(5, min_periods=1).mean().values
    out["roll_mean_9"]  = pd.Series(closes).ewm(span=9, adjust=False).mean().values
    out["roll_mean_10"] = pd.Series(closes).rolling(10, min_periods=1).mean().values
    out["roll_mean_20"] = rm20.values
    out["roll_mean_21"] = pd.Series(closes).ewm(span=21, adjust=False).mean().values
    out["roll_mean_50"] = pd.Series(closes).rolling(50, min_periods=1).mean().values

    # ── Rolling Stds ──────────────────────────────────────────────────────────
    out["roll_std_5"]  = pd.Series(closes).rolling(5, min_periods=1).std().fillna(0).values
    out["roll_std_10"] = pd.Series(closes).rolling(10, min_periods=1).std().fillna(0).values
    out["roll_std_20"] = rs20.values

    # ── Lagged Closes ────────────────────────────────────────────────────────
    for lag in range(1, 6):
        out[f"lag_{lag}"] = pd.Series(closes).shift(lag).values

    # ── Rate of Change ───────────────────────────────────────────────────────
    out["roc_1"] = pd.Series(closes).pct_change(1).fillna(0).values * 100
    out["roc_5"] = pd.Series(closes).pct_change(5).fillna(0).values * 100

    # ── Volume ratio ─────────────────────────────────────────────────────────
    vol_sma20 = pd.Series(volumes).rolling(20, min_periods=1).mean()
    out["volume_ratio"] = (pd.Series(volumes) / (vol_sma20 + 1e-9)).values

    # ── Day-of-week cyclical encoding ────────────────────────────────────────
    dates_parsed = pd.to_datetime(df["date"], format="mixed", errors="coerce")
    dow = dates_parsed.dt.dayofweek.fillna(0).astype(int)
    out["dow_sin"] = np.sin(2 * np.pi * dow / 7)
    out["dow_cos"] = np.cos(2 * np.pi * dow / 7)
    out["sentiment"] = 0.0

    return out.dropna().reset_index(drop=True)


def _compute_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 2.0) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes Supertrend indicator causally.
    Returns: (supertrend_values, direction) where direction is 1 (bullish) or -1 (bearish).
    """
    high = df["high"].values.astype(float)
    low = df["low"].values.astype(float)
    close = df["close"].values.astype(float)
    n = len(df)

    prev_close = pd.Series(close).shift(1)
    tr = pd.concat([
        pd.Series(high) - pd.Series(low),
        (pd.Series(high) - prev_close).abs(),
        (pd.Series(low) - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr = tr.rolling(period, min_periods=1).mean().values

    hl2 = (high + low) / 2.0
    basic_upper = hl2 + multiplier * atr
    basic_lower = hl2 - multiplier * atr

    final_upper = np.zeros(n)
    final_lower = np.zeros(n)
    direction = np.zeros(n)

    for i in range(n):
        if i == 0:
            final_upper[i] = basic_upper[i]
            final_lower[i] = basic_lower[i]
            direction[i] = 1 if close[i] >= hl2[i] else -1
            continue

        final_upper[i] = basic_upper[i] if (basic_upper[i] < final_upper[i-1] or close[i-1] > final_upper[i-1]) else final_upper[i-1]
        final_lower[i] = basic_lower[i] if (basic_lower[i] > final_lower[i-1] or close[i-1] < final_lower[i-1]) else final_lower[i-1]

        if direction[i-1] == 1:
            direction[i] = -1 if close[i] < final_lower[i] else 1
        else:
            direction[i] = 1 if close[i] > final_upper[i] else -1

    st_val = np.where(direction == 1, final_lower, final_upper)
    return st_val, direction
