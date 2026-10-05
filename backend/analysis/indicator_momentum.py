"""StockOracle Pro — momentum oscillators.


Split verbatim out of ``backend/analysis/indicators.py`` (pure code motion).
Stochastic / CCI / Williams %R / ROC / Stoch RSI / Elder Ray / Parabolic SAR.
"""

from typing import Dict

import numpy as np
import pandas as pd

from .constants import (
    DEFAULT_STOCH_K_PERIOD, DEFAULT_STOCH_D_PERIOD,
    DEFAULT_CCI_PERIOD, DEFAULT_WILLIAMS_R_PERIOD, DEFAULT_ROC_PERIOD,
)
from .indicator_trend import calculate_ema, calculate_rsi

# ── Momentum Indicators (Stochastic, CCI, Williams %R, ROC) ───────────────────
def calculate_stochastic(
    df: pd.DataFrame,
    k_period: int = DEFAULT_STOCH_K_PERIOD,
    d_period: int = DEFAULT_STOCH_D_PERIOD
) -> Dict[str, pd.Series]:
    """
    Calculates Stochastic Oscillator (%K and %D).
    %K = (Close - Low_N) / (High_N - Low_N) * 100
    %D = SMA(%K, d_period)
    """
    low_min = df["low"].rolling(window=k_period, min_periods=1).min()
    high_max = df["high"].rolling(window=k_period, min_periods=1).max()
    denom = (high_max - low_min).replace(0.0, np.nan)
    stoch_k = ((df["close"] - low_min) / denom) * 100.0
    stoch_k = stoch_k.fillna(50.0)
    stoch_d = stoch_k.rolling(window=d_period, min_periods=1).mean().fillna(50.0)
    return {"stoch_k": stoch_k, "stoch_d": stoch_d}


def calculate_cci(df: pd.DataFrame, period: int = DEFAULT_CCI_PERIOD) -> pd.Series:
    """
    Calculates Commodity Channel Index (CCI).
    CCI = (Typical Price - SMA(TP)) / (0.015 * Mean Absolute Deviation)
    """
    tp = (df["high"] + df["low"] + df["close"]) / 3.0
    tp_sma = tp.rolling(window=period, min_periods=1).mean()
    # Fast mean absolute deviation
    mad = tp.rolling(window=period, min_periods=1).apply(
        lambda x: np.mean(np.abs(x - np.mean(x))), raw=True
    ).replace(0.0, 1e-9)
    cci = (tp - tp_sma) / (0.015 * mad)
    return cci.fillna(0.0)


def calculate_williams_r(df: pd.DataFrame, period: int = DEFAULT_WILLIAMS_R_PERIOD) -> pd.Series:
    """
    Calculates Williams %R (-100 to 0).
    %R = (Highest High - Close) / (Highest High - Lowest Low) * -100
    """
    high_max = df["high"].rolling(window=period, min_periods=1).max()
    low_min = df["low"].rolling(window=period, min_periods=1).min()
    denom = (high_max - low_min).replace(0.0, np.nan)
    wr = ((high_max - df["close"]) / denom) * -100.0
    return wr.fillna(-50.0)


def calculate_roc(series: pd.Series, period: int = DEFAULT_ROC_PERIOD) -> pd.Series:
    """Calculates Rate of Change (ROC)."""
    return (series.pct_change(periods=period).fillna(0.0) * 100.0).round(4)

# ── Stochastic RSI ────────────────────────────────────────────────────────────
def calculate_stoch_rsi(
    series: pd.Series,
    rsi_period: int = 14,
    stoch_period: int = 14,
    k_period: int = 3,
    d_period: int = 3
) -> Dict[str, pd.Series]:
    """
    Stochastic RSI — Applies Stochastic formula on RSI values.
    Returns %K and %D smoothed lines in 0-100 range.
    """
    rsi = calculate_rsi(series, rsi_period)
    rsi_min = rsi.rolling(window=stoch_period, min_periods=1).min()
    rsi_max = rsi.rolling(window=stoch_period, min_periods=1).max()
    denom = (rsi_max - rsi_min).replace(0.0, np.nan)
    stoch_k_raw = ((rsi - rsi_min) / denom * 100.0).fillna(50.0)
    stoch_k = stoch_k_raw.rolling(window=k_period, min_periods=1).mean().fillna(50.0)
    stoch_d = stoch_k.rolling(window=d_period, min_periods=1).mean().fillna(50.0)
    return {"stoch_rsi_k": stoch_k, "stoch_rsi_d": stoch_d}

# ── Elder Ray Index ────────────────────────────────────────────────────────────
def calculate_elder_ray(df: pd.DataFrame, ema_period: int = 13) -> Dict[str, pd.Series]:
    """
    Elder Ray Index — measures bull/bear power relative to EMA.
    Bull Power = High - EMA(Close)
    Bear Power = Low  - EMA(Close)
    """
    ema = calculate_ema(df["close"], ema_period)
    bull_power = df["high"] - ema
    bear_power = df["low"] - ema
    return {
        "elder_bull": bull_power.fillna(0.0),
        "elder_bear": bear_power.fillna(0.0),
    }


# ── Parabolic SAR ─────────────────────────────────────────────────────────────
def calculate_psar(
    df: pd.DataFrame,
    start: float = 0.02,
    increment: float = 0.02,
    maximum: float = 0.20
) -> Dict[str, pd.Series]:
    """
    Parabolic SAR — trailing stop-and-reverse indicator.
    Returns psar values and direction (1=bullish, -1=bearish).
    """
    high = df["high"].to_numpy(dtype=np.float64)
    low = df["low"].to_numpy(dtype=np.float64)
    n = len(high)
    psar = np.empty(n, dtype=np.float64)
    direction = np.ones(n, dtype=np.float64)

    if n < 2:
        return {
            "psar": pd.Series(df["close"].values, index=df.index),
            "psar_dir": pd.Series(np.ones(n), index=df.index),
        }

    # Initial state: assume bullish
    bull = True
    af = start
    ep = high[0]
    psar[0] = low[0]
    direction[0] = 1.0

    for i in range(1, n):
        prev_psar = psar[i - 1]
        if bull:
            psar[i] = prev_psar + af * (ep - prev_psar)
            psar[i] = min(psar[i], low[i - 1], low[max(0, i - 2)])
            if low[i] < psar[i]:
                bull = False
                psar[i] = ep
                ep = low[i]
                af = start
                direction[i] = -1.0
            else:
                direction[i] = 1.0
                if high[i] > ep:
                    ep = high[i]
                    af = min(af + increment, maximum)
        else:
            psar[i] = prev_psar - af * (prev_psar - ep)
            psar[i] = max(psar[i], high[i - 1], high[max(0, i - 2)])
            if high[i] > psar[i]:
                bull = True
                psar[i] = ep
                ep = high[i]
                af = start
                direction[i] = 1.0
            else:
                direction[i] = -1.0
                if low[i] < ep:
                    ep = low[i]
                    af = min(af + increment, maximum)

    return {
        "psar": pd.Series(psar, index=df.index),
        "psar_dir": pd.Series(direction, index=df.index),
    }
