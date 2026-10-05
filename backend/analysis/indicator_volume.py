"""StockOracle Pro — volume-weighted indicators.


Split verbatim out of ``backend/analysis/indicators.py`` (pure code motion).
VWAP / OBV / MFI / CMF.
"""

import numpy as np
import pandas as pd

from .constants import DEFAULT_MFI_PERIOD, DEFAULT_RSI_NEUTRAL

# ── Volume-Weighted Indicators (VWAP, OBV, MFI) ──────────────────────────────
def _session_day_keys(df: pd.DataFrame):
    """
    Best-effort per-row calendar-day key (UTC) for session-anchored VWAP.
    Looks for a 'date'/'timestamp'/'datetime' column first, then a DatetimeIndex.
    Returns a list of day keys (one per row), or None when no usable
    timestamps exist so callers can keep their legacy behaviour.
    """
    s = None
    for col in ("date", "timestamp", "datetime"):
        if col in df.columns:
            s = df[col]
            break
    if s is None:
        if isinstance(df.index, pd.DatetimeIndex):
            s = pd.Series(df.index, index=df.index)
        else:
            return None
    try:
        parsed = pd.to_datetime(s, errors="coerce", utc=True)
    except (TypeError, ValueError, OverflowError):
        return None
    if parsed.isna().all():
        return None
    return parsed.dt.date.tolist()


def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """
    Calculates Volume Weighted Average Price (VWAP), session-anchored.

    Semantics:
    - Intraday data: cumulators reset at each calendar-day (UTC) boundary, so
      VWAP tracks the current session rather than the entire chart history.
    - Daily/weekly/monthly bars: every bar is its own session, so a bar's
      VWAP equals its typical price.
    - Zero/missing volume, or rows without usable timestamps, fall back
      gracefully to typical price.
    """
    typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
    if "volume" not in df.columns or df["volume"].sum() == 0:
        return typical_price

    day_keys = _session_day_keys(df)
    if day_keys is None:
        # No usable timestamps — keep the legacy cumulative behaviour.
        cum_vol_price = (typical_price * df["volume"]).cumsum()
        cum_vol = df["volume"].cumsum()
        vwap = cum_vol_price / cum_vol.replace(0, np.nan)
        return vwap.ffill().bfill().fillna(typical_price)

    vol = df["volume"].astype(float)
    grouped = pd.Series(day_keys, index=df.index)
    cum_pv = (typical_price * vol).groupby(grouped).cumsum()
    cum_vol = vol.groupby(grouped).cumsum()
    vwap = cum_pv / cum_vol.replace(0, np.nan)
    return vwap.fillna(typical_price)


def calculate_obv(df: pd.DataFrame) -> pd.Series:
    """
    Calculates On-Balance Volume (OBV).
    Adds volume on up days, subtracts volume on down days.
    """
    if "volume" not in df.columns or df["volume"].empty:
        return pd.Series(0.0, index=df.index)

    close_diff = df["close"].diff().fillna(0.0)
    direction = np.where(close_diff > 0, 1.0, np.where(close_diff < 0, -1.0, 0.0))
    obv = (direction * df["volume"].fillna(0.0)).cumsum()
    return pd.Series(obv, index=df.index, dtype=np.float64)


def calculate_mfi(df: pd.DataFrame, period: int = DEFAULT_MFI_PERIOD) -> pd.Series:
    """
    Calculates Money Flow Index (MFI) — Volume-weighted RSI.
    Correctly handles zero flow periods (returns neutral 50.0).
    """
    typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
    vol = df["volume"] if "volume" in df.columns else pd.Series(0.0, index=df.index)
    raw_money_flow = typical_price * vol

    tp_diff = typical_price.diff().fillna(0.0)
    pos_flow = raw_money_flow.where(tp_diff > 0, 0.0).rolling(window=period, min_periods=1).sum()
    neg_flow = raw_money_flow.where(tp_diff < 0, 0.0).rolling(window=period, min_periods=1).sum()

    both_zero = (pos_flow == 0.0) & (neg_flow == 0.0)
    neg_zero = (neg_flow == 0.0) & (pos_flow > 0.0)

    mfr = pos_flow / neg_flow.replace(0.0, np.nan)
    mfi = 100.0 - (100.0 / (1.0 + mfr))

    mfi = mfi.where(~both_zero, DEFAULT_RSI_NEUTRAL)
    mfi = mfi.where(~neg_zero, 100.0)
    return mfi.fillna(DEFAULT_RSI_NEUTRAL)

# ── Chaikin Money Flow (CMF) ──────────────────────────────────────────────────
def calculate_cmf(df: pd.DataFrame, period: int = 20) -> pd.Series:
    """
    Chaikin Money Flow — measures buying/selling pressure (-1 to +1).
    CMF = Sum(MFV, N) / Sum(Volume, N)
    Money Flow Volume = ((Close - Low) - (High - Close)) / (High - Low) * Volume
    """
    hl_range = (df["high"] - df["low"]).replace(0.0, np.nan)
    mf_multiplier = ((df["close"] - df["low"]) - (df["high"] - df["close"])) / hl_range
    mf_multiplier = mf_multiplier.fillna(0.0)
    vol = df["volume"].fillna(0.0) if "volume" in df.columns else pd.Series(0.0, index=df.index)
    mf_volume = mf_multiplier * vol
    cmf = (
        mf_volume.rolling(window=period, min_periods=1).sum() /
        vol.rolling(window=period, min_periods=1).sum().replace(0.0, np.nan)
    )
    return cmf.fillna(0.0)
