"""StockOracle Pro — core trend & volatility indicators.


Split verbatim out of ``backend/analysis/indicators.py`` (pure code motion).
SMA/EMA/RSI(neutral-50 fix)/MACD/BB/ATR/ADX/Supertrend/Channels/Pivots/Ichimoku.
"""

from typing import Dict

import numpy as np
import pandas as pd

from .constants import (
    DEFAULT_SMA_20, DEFAULT_EMA_12,
    DEFAULT_RSI_PERIOD, DEFAULT_RSI_NEUTRAL,
    DEFAULT_MACD_FAST, DEFAULT_MACD_SLOW, DEFAULT_MACD_SIGNAL,
    DEFAULT_BB_PERIOD, DEFAULT_BB_STD,
    DEFAULT_ATR_PERIOD, DEFAULT_ADX_PERIOD,
    DEFAULT_SUPERTREND_PERIOD, DEFAULT_SUPERTREND_MULTIPLIER,
    DEFAULT_KELTNER_EMA_PERIOD, DEFAULT_KELTNER_ATR_PERIOD, DEFAULT_KELTNER_MULTIPLIER,
    DEFAULT_DONCHIAN_PERIOD,
    DEFAULT_ICHIMOKU_TENKAN, DEFAULT_ICHIMOKU_KIJUN,
    DEFAULT_ICHIMOKU_SENKOU_B, DEFAULT_ICHIMOKU_DISPLACEMENT,
    DEFAULT_FIBONACCI_PERIOD,
)

# ── Standard Moving Averages ──────────────────────────────────────────────────
def calculate_sma(series: pd.Series, period: int = DEFAULT_SMA_20) -> pd.Series:
    """Simple Moving Average with min_periods=1 preserving all bars."""
    return series.rolling(window=period, min_periods=1).mean()


def calculate_ema(series: pd.Series, period: int = DEFAULT_EMA_12) -> pd.Series:
    """Exponential Moving Average."""
    return series.ewm(span=period, adjust=False).mean()


# ── Relative Strength Index (RSI) with Neutral 50 Bug Fix ─────────────────────
def calculate_rsi(series: pd.Series, period: int = DEFAULT_RSI_PERIOD) -> pd.Series:
    """
    Computes Relative Strength Index (RSI).
    Fixes critical bug: When both gain and loss are 0 (e.g. flat prices),
    returns exactly 50.0 (neutral) instead of ~100 or NaN.
    """
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=period, min_periods=1).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period, min_periods=1).mean()

    # Vectorized condition handling
    both_zero = (gain == 0.0) & (loss == 0.0)
    loss_zero = (loss == 0.0) & (gain > 0.0)
    gain_zero = (gain == 0.0) & (loss > 0.0)

    rs = gain / (loss.replace(0.0, np.nan))
    rsi = 100.0 - (100.0 / (1.0 + rs))

    rsi = rsi.where(~both_zero, DEFAULT_RSI_NEUTRAL)
    rsi = rsi.where(~loss_zero, 100.0)
    rsi = rsi.where(~gain_zero, 0.0)

    return rsi.fillna(DEFAULT_RSI_NEUTRAL)


# ── MACD ──────────────────────────────────────────────────────────────────────
def calculate_macd(
    series: pd.Series,
    fast: int = DEFAULT_MACD_FAST,
    slow: int = DEFAULT_MACD_SLOW,
    signal: int = DEFAULT_MACD_SIGNAL
) -> Dict[str, pd.Series]:
    """Moving Average Convergence Divergence."""
    ema_fast = calculate_ema(series, fast)
    ema_slow = calculate_ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = calculate_ema(macd_line, signal)
    macd_hist = macd_line - signal_line
    return {
        "macd": macd_line.fillna(0.0),
        "signal": signal_line.fillna(0.0),
        "hist": macd_hist.fillna(0.0),
    }


# ── Bollinger Bands ───────────────────────────────────────────────────────────
def calculate_bollinger_bands(
    series: pd.Series,
    period: int = DEFAULT_BB_PERIOD,
    std_dev: float = DEFAULT_BB_STD
) -> Dict[str, pd.Series]:
    """Bollinger Bands (Upper, Middle/SMA, Lower, %B)."""
    sma = calculate_sma(series, period)
    std = series.rolling(window=period, min_periods=1).std().fillna(0.0)
    upper = sma + (std_dev * std)
    lower = sma - (std_dev * std)
    pct_b = (series - lower) / (upper - lower + 1e-9)
    return {
        "upper": upper,
        "middle": sma,
        "lower": lower,
        "pct_b": pct_b.fillna(0.5),
    }

# ── Volatility & Trend (ATR, ADX) ─────────────────────────────────────────────
def calculate_atr(df: pd.DataFrame, period: int = DEFAULT_ATR_PERIOD) -> pd.Series:
    """Average True Range (ATR)."""
    high = df["high"]
    low = df["low"]
    close_prev = df["close"].shift(1).fillna(df["open"])

    tr1 = high - low
    tr2 = (high - close_prev).abs()
    tr3 = (low - close_prev).abs()

    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period, min_periods=1).mean().fillna(0.0)


def calculate_adx(df: pd.DataFrame, period: int = DEFAULT_ADX_PERIOD) -> pd.Series:
    """Average Directional Index (ADX)."""
    high = df["high"]
    low = df["low"]
    close = df["close"]

    upmove = high.diff().fillna(0.0)
    downmove = (low.shift(1) - low).fillna(0.0)

    pos_dm = np.where((upmove > downmove) & (upmove > 0.0), upmove, 0.0)
    neg_dm = np.where((downmove > upmove) & (downmove > 0.0), downmove, 0.0)

    tr1 = high - low
    tr2 = (high - close.shift(1).fillna(close)).abs()
    tr3 = (low - close.shift(1).fillna(close)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    tr_smooth = tr.rolling(window=period, min_periods=1).sum()
    pos_dm_smooth = pd.Series(pos_dm, index=df.index).rolling(window=period, min_periods=1).sum()
    neg_dm_smooth = pd.Series(neg_dm, index=df.index).rolling(window=period, min_periods=1).sum()

    plus_di = 100.0 * (pos_dm_smooth / (tr_smooth + 1e-9))
    minus_di = 100.0 * (neg_dm_smooth / (tr_smooth + 1e-9))

    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9)
    adx = dx.rolling(window=period, min_periods=1).mean()
    return adx.fillna(0.0)


# ── High-Performance Vectorized Supertrend ────────────────────────────────────
def _supertrend_core_numpy(
    close_arr: np.ndarray,
    basic_upper: np.ndarray,
    basic_lower: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """
    Optimized NumPy loop for Supertrend.
    Operates on contiguous 1D C-arrays for 10x-50x speedup over standard DataFrame iterations.
    """
    n = len(close_arr)
    final_upper = np.zeros(n, dtype=np.float64)
    final_lower = np.zeros(n, dtype=np.float64)
    supertrend = np.zeros(n, dtype=np.float64)
    direction = np.ones(n, dtype=np.float64)

    if n == 0:
        return supertrend, direction

    final_upper[0] = basic_upper[0]
    final_lower[0] = basic_lower[0]
    supertrend[0] = basic_lower[0]
    direction[0] = 1.0

    for i in range(1, n):
        prev_fu = final_upper[i - 1]
        prev_fl = final_lower[i - 1]
        prev_close = close_arr[i - 1]
        curr_bu = basic_upper[i]
        curr_bl = basic_lower[i]

        # Trailing upper band
        if curr_bu < prev_fu or prev_close > prev_fu:
            final_upper[i] = curr_bu
        else:
            final_upper[i] = prev_fu

        # Trailing lower band
        if curr_bl > prev_fl or prev_close < prev_fl:
            final_lower[i] = curr_bl
        else:
            final_lower[i] = prev_fl

        # Trend direction decision
        if direction[i - 1] == 1.0:
            if close_arr[i] < final_lower[i]:
                direction[i] = -1.0
                supertrend[i] = final_upper[i]
            else:
                direction[i] = 1.0
                supertrend[i] = final_lower[i]
        else:
            if close_arr[i] > final_upper[i]:
                direction[i] = 1.0
                supertrend[i] = final_lower[i]
            else:
                direction[i] = -1.0
                supertrend[i] = final_upper[i]

    return supertrend, direction


def calculate_supertrend(
    df: pd.DataFrame,
    period: int = DEFAULT_SUPERTREND_PERIOD,
    multiplier: float = DEFAULT_SUPERTREND_MULTIPLIER
) -> Dict[str, pd.Series]:
    """Calculates Supertrend indicator with trend direction (1 = Bullish green, -1 = Bearish red)."""
    atr = calculate_atr(df, period)
    hl2 = (df["high"] + df["low"]) * 0.5
    basic_upper = (hl2 + (multiplier * atr)).to_numpy(dtype=np.float64)
    basic_lower = (hl2 - (multiplier * atr)).to_numpy(dtype=np.float64)
    close_arr = df["close"].to_numpy(dtype=np.float64)

    st_arr, dir_arr = _supertrend_core_numpy(close_arr, basic_upper, basic_lower)

    return {
        "supertrend": pd.Series(st_arr, index=df.index),
        "direction": pd.Series(dir_arr, index=df.index),
    }


# ── Volatility Channels (Keltner & Donchian) ──────────────────────────────────
def calculate_keltner_channels(
    df: pd.DataFrame,
    ema_period: int = DEFAULT_KELTNER_EMA_PERIOD,
    atr_period: int = DEFAULT_KELTNER_ATR_PERIOD,
    multiplier: float = DEFAULT_KELTNER_MULTIPLIER
) -> Dict[str, pd.Series]:
    """
    Calculates Keltner Channels.
    Middle = EMA(close, ema_period)
    Upper/Lower = Middle +/- multiplier * ATR(atr_period)
    """
    middle = calculate_ema(df["close"], ema_period)
    atr = calculate_atr(df, atr_period)
    upper = middle + (multiplier * atr)
    lower = middle - (multiplier * atr)
    return {
        "keltner_upper": upper,
        "keltner_middle": middle,
        "keltner_lower": lower,
    }


def calculate_donchian_channels(
    df: pd.DataFrame,
    period: int = DEFAULT_DONCHIAN_PERIOD
) -> Dict[str, pd.Series]:
    """
    Calculates Donchian Channels (20-period highest high and lowest low).
    """
    upper = df["high"].rolling(window=period, min_periods=1).max()
    lower = df["low"].rolling(window=period, min_periods=1).min()
    middle = (upper + lower) * 0.5
    return {
        "donchian_upper": upper,
        "donchian_middle": middle,
        "donchian_lower": lower,
    }


# ── Pivot Points & Fibonacci (Lookahead Bias Fixed) ───────────────────────────
def calculate_pivot_points(df: pd.DataFrame) -> Dict[str, pd.Series]:
    """
    Calculates Standard Classic Pivot Points with ZERO lookahead bias.
    On candle T, pivot levels are derived strictly from the prior candle/day T-1.
    """
    high_prev = df["high"].shift(1).bfill()
    low_prev = df["low"].shift(1).bfill()
    close_prev = df["close"].shift(1).bfill()

    pivot = (high_prev + low_prev + close_prev) / 3.0
    r1 = (2.0 * pivot) - low_prev
    s1 = (2.0 * pivot) - high_prev
    r2 = pivot + (high_prev - low_prev)
    s2 = pivot - (high_prev - low_prev)

    return {"pivot": pivot, "r1": r1, "s1": s1, "r2": r2, "s2": s2}


def calculate_fibonacci_levels(df: pd.DataFrame, period: int = DEFAULT_FIBONACCI_PERIOD) -> Dict[str, pd.Series]:
    """Fibonacci Retracement levels over rolling lookback window."""
    effective_period = min(period, max(len(df), 1))
    high_roll = df["high"].rolling(window=effective_period, min_periods=1).max()
    low_roll = df["low"].rolling(window=effective_period, min_periods=1).min()
    diff = high_roll - low_roll

    return {
        "fib_236": high_roll - 0.236 * diff,
        "fib_382": high_roll - 0.382 * diff,
        "fib_500": high_roll - 0.500 * diff,
        "fib_618": high_roll - 0.618 * diff,
    }


# ── Ichimoku Cloud ────────────────────────────────────────────────────────────
def calculate_ichimoku(df: pd.DataFrame) -> Dict[str, pd.Series]:
    """Calculates full Ichimoku Kinko Hyo cloud metrics."""
    high = df["high"]
    low = df["low"]

    tenkan = (high.rolling(DEFAULT_ICHIMOKU_TENKAN, min_periods=1).max() +
              low.rolling(DEFAULT_ICHIMOKU_TENKAN, min_periods=1).min()) * 0.5

    kijun = (high.rolling(DEFAULT_ICHIMOKU_KIJUN, min_periods=1).max() +
             low.rolling(DEFAULT_ICHIMOKU_KIJUN, min_periods=1).min()) * 0.5

    senkou_a = ((tenkan + kijun) * 0.5).shift(DEFAULT_ICHIMOKU_DISPLACEMENT)

    senkou_b = ((high.rolling(DEFAULT_ICHIMOKU_SENKOU_B, min_periods=1).max() +
                 low.rolling(DEFAULT_ICHIMOKU_SENKOU_B, min_periods=1).min()) * 0.5).shift(DEFAULT_ICHIMOKU_DISPLACEMENT)

    chikou = df["close"].shift(-DEFAULT_ICHIMOKU_DISPLACEMENT)

    return {
        "ichimoku_tenkan": tenkan,
        "ichimoku_kijun": kijun,
        "ichimoku_senkou_a": senkou_a,
        "ichimoku_senkou_b": senkou_b,
        "ichimoku_chikou": chikou,
    }

# ── ADX with +DI / -DI lines ─────────────────────────────────────────────────
def calculate_adx_full(df: pd.DataFrame, period: int = 14) -> Dict[str, pd.Series]:
    """
    Full ADX — returns ADX line, +DI and -DI directional index lines.
    """
    high = df["high"]
    low = df["low"]
    close = df["close"]

    upmove = high.diff().fillna(0.0)
    downmove = (low.shift(1) - low).fillna(0.0)

    pos_dm = pd.Series(np.where((upmove > downmove) & (upmove > 0.0), upmove, 0.0), index=df.index)
    neg_dm = pd.Series(np.where((downmove > upmove) & (downmove > 0.0), downmove, 0.0), index=df.index)

    tr1 = high - low
    tr2 = (high - close.shift(1).fillna(close)).abs()
    tr3 = (low - close.shift(1).fillna(close)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    tr_smooth = tr.rolling(window=period, min_periods=1).sum()
    pos_sm = pos_dm.rolling(window=period, min_periods=1).sum()
    neg_sm = neg_dm.rolling(window=period, min_periods=1).sum()

    plus_di = (100.0 * pos_sm / (tr_smooth + 1e-9)).fillna(0.0)
    minus_di = (100.0 * neg_sm / (tr_smooth + 1e-9)).fillna(0.0)
    dx = (100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9)).fillna(0.0)
    adx = dx.rolling(window=period, min_periods=1).mean().fillna(0.0)

    return {"adx": adx, "plus_di": plus_di, "minus_di": minus_di}
