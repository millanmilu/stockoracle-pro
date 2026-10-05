"""StockOracle Pro — candlestick patterns, divergence, regime & MTF.


Split verbatim out of ``backend/analysis/indicators.py`` (pure code motion).
"""

from typing import Dict, Optional

import numpy as np
import pandas as pd

from .constants import (
    DEFAULT_RSI_PERIOD, DEFAULT_SMA_20, DEFAULT_EMA_12, DEFAULT_SUPERTREND_PERIOD,
)
from .indicator_trend import (
    calculate_sma, calculate_ema, calculate_rsi, calculate_adx,
    calculate_bollinger_bands, calculate_supertrend,
)

# ── Candlestick Patterns with Prior Trend Context ─────────────────────────────
def detect_candlestick_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Scans for high-conviction candlestick patterns.
    Validates Hammer and Shooting Star against prior trend context to prevent false positives.
    """
    df = df.copy()
    o, h, l, c = df["open"], df["high"], df["low"], df["close"]

    body = (c - o).abs()
    candle_range = (h - l).replace(0.0, 1e-9)
    body_avg = body.rolling(window=10, min_periods=1).mean()

    # Prior trend detection (5-period slope/direction)
    prior_downtrend = (c.shift(1) < c.shift(4).bfill()) | (c.shift(1) < calculate_sma(c, 5).shift(1).bfill())
    prior_uptrend = (c.shift(1) > c.shift(4).bfill()) | (c.shift(1) > calculate_sma(c, 5).shift(1).bfill())

    lower_shadow = np.minimum(o, c) - l
    upper_shadow = h - np.maximum(o, c)

    # 1. Doji
    df["pattern_doji"] = body <= (0.1 * candle_range)

    # 2. Hammer (must occur after prior downtrend)
    hammer_shape = (lower_shadow >= 2.0 * body) & (upper_shadow <= np.maximum(0.2 * body, 0.1 * candle_range)) & (c > (l + 0.5 * candle_range))
    df["pattern_hammer"] = hammer_shape & prior_downtrend

    # 3. Hanging Man (same hammer shape, but occurs at top of uptrend)
    df["pattern_hanging_man"] = hammer_shape & prior_uptrend

    # 4. Shooting Star (must occur after prior uptrend)
    shooting_star_shape = (upper_shadow >= 2.0 * body) & (lower_shadow <= np.maximum(0.2 * body, 0.1 * candle_range)) & (c < (l + 0.5 * candle_range))
    df["pattern_shooting_star"] = shooting_star_shape & prior_uptrend

    # 5. Inverted Hammer (shooting star shape after downtrend)
    df["pattern_inverted_hammer"] = shooting_star_shape & prior_downtrend

    # 6. Bullish Engulfing
    df["pattern_bullish_engulfing"] = (
        (c.shift(1).bfill() < o.shift(1).bfill()) &
        (c > o) &
        (c >= o.shift(1).bfill()) &
        (o <= c.shift(1).bfill())
    )

    # 7. Bearish Engulfing
    df["pattern_bearish_engulfing"] = (
        (c.shift(1).bfill() > o.shift(1).bfill()) &
        (c < o) &
        (c <= o.shift(1).bfill()) &
        (o >= c.shift(1).bfill())
    )

    # 8. Morning Star (three candles)
    df["pattern_morning_star"] = (
        (c.shift(2).bfill() < o.shift(2).bfill()) &
        (body.shift(1).bfill() < (body_avg.shift(1).bfill() * 0.5)) &
        (c.shift(1).bfill() < c.shift(2).bfill()) &
        (c > o) &
        (c > ((o.shift(2).bfill() + c.shift(2).bfill()) * 0.5))
    )

    # 9. Evening Star (three candles)
    df["pattern_evening_star"] = (
        (c.shift(2).bfill() > o.shift(2).bfill()) &
        (body.shift(1).bfill() < (body_avg.shift(1).bfill() * 0.5)) &
        (c.shift(1).bfill() > c.shift(2).bfill()) &
        (c < o) &
        (c < ((o.shift(2).bfill() + c.shift(2).bfill()) * 0.5))
    )

    # 10. Harami
    df["pattern_harami"] = (
        ((c.shift(1).bfill() < o.shift(1).bfill()) & (c > o) & (c < o.shift(1).bfill()) & (o > c.shift(1).bfill())) |
        ((c.shift(1).bfill() > o.shift(1).bfill()) & (c < o) & (c > o.shift(1).bfill()) & (o < c.shift(1).bfill()))
    )

    # 11. Marubozu
    df["pattern_marubozu"] = (body >= 0.9 * candle_range) & (body > body_avg * 1.5)

    pattern_cols = [col for col in df.columns if col.startswith("pattern_")]
    df[pattern_cols] = df[pattern_cols].fillna(False).astype(bool)

    return df


# ── Divergence Detection (Bullish / Bearish) ──────────────────────────────────
def detect_divergences(
    df: pd.DataFrame,
    oscillator_col: str = "rsi",
    lookback: int = 14
) -> Dict[str, pd.Series]:
    """
    Detects Bullish and Bearish divergences between price and momentum oscillator.
    - Bullish Divergence: Price forms Lower Low, but Oscillator forms Higher Low.
    - Bearish Divergence: Price forms Higher High, but Oscillator forms Lower High.
    """
    if oscillator_col not in df.columns:
        osc = calculate_rsi(df["close"], DEFAULT_RSI_PERIOD)
    else:
        osc = df[oscillator_col]

    close = df["close"]
    n = len(df)
    bullish_div = np.zeros(n, dtype=bool)
    bearish_div = np.zeros(n, dtype=bool)

    # Rolling window check for local peaks and troughs
    close_arr = close.to_numpy()
    osc_arr = osc.to_numpy()

    for i in range(lookback, n):
        w_close = close_arr[i - lookback:i + 1]
        w_osc = osc_arr[i - lookback:i + 1]

        # Check for lower low in price but higher low in oscillator
        if w_close[-1] < np.min(w_close[:-1]) and w_osc[-1] > np.min(w_osc[:-1]):
            bullish_div[i] = True

        # Check for higher high in price but lower high in oscillator
        if w_close[-1] > np.max(w_close[:-1]) and w_osc[-1] < np.max(w_osc[:-1]):
            bearish_div[i] = True

    return {
        "bullish_divergence": pd.Series(bullish_div, index=df.index),
        "bearish_divergence": pd.Series(bearish_div, index=df.index),
    }


# ── Market Regime Classification ─────────────────────────────────────────────
def classify_market_regime(df: pd.DataFrame) -> pd.Series:
    """
    Classifies market regime into 5 states:
    - 'BULLISH_TRENDING': ADX >= 25, price > SMA 50, EMA 9 > EMA 21
    - 'BEARISH_TRENDING': ADX >= 25, price < SMA 50, EMA 9 < EMA 21
    - 'VOLATILITY_EXPANSION': BB bandwidth in top 20%
    - 'RANGING_CONSOLIDATION': ADX < 20, tight BB width
    - 'NEUTRAL': Transitional/reversal phase
    """
    adx = calculate_adx(df, 14)
    sma_50 = calculate_sma(df["close"], 50)
    ema_9 = calculate_ema(df["close"], 9)
    ema_21 = calculate_ema(df["close"], 21)

    bb = calculate_bollinger_bands(df["close"], 20)
    bb_width = (bb["upper"] - bb["lower"]) / (bb["middle"].replace(0, np.nan))
    bb_width_p80 = bb_width.rolling(window=50, min_periods=1).quantile(0.80)

    regimes = []
    close = df["close"].to_numpy()
    adx_arr = adx.to_numpy()
    sma50_arr = sma_50.to_numpy()
    ema9_arr = ema_9.to_numpy()
    ema21_arr = ema_21.to_numpy()
    bbw_arr = bb_width.to_numpy()
    bbw80_arr = bb_width_p80.to_numpy()

    for i in range(len(df)):
        if adx_arr[i] >= 25.0 and close[i] > sma50_arr[i] and ema9_arr[i] > ema21_arr[i]:
            regimes.append("BULLISH_TRENDING")
        elif adx_arr[i] >= 25.0 and close[i] < sma50_arr[i] and ema9_arr[i] < ema21_arr[i]:
            regimes.append("BEARISH_TRENDING")
        elif bbw_arr[i] > bbw80_arr[i] and adx_arr[i] >= 20.0:
            regimes.append("VOLATILITY_EXPANSION")
        elif adx_arr[i] < 20.0:
            regimes.append("RANGING_CONSOLIDATION")
        else:
            regimes.append("NEUTRAL")

    return pd.Series(regimes, index=df.index, name="market_regime")


# ── Multi-Timeframe (MTF) Support ─────────────────────────────────────────────
def calculate_mtf_indicator(
    df: pd.DataFrame,
    indicator: str = "rsi",
    higher_timeframe: str = "1D",
    **kwargs
) -> pd.Series:
    """
    Calculates indicator from a higher timeframe (e.g. Daily RSI on a 15-minute chart).
    Uses non-lookahead resampling and merges back onto the original candle series via forward fill.
    """
    if "date" not in df.columns:
        return calculate_rsi(df["close"])

    df_temp = df.copy()
    df_temp["datetime"] = pd.to_datetime(df_temp["date"])
    df_temp = df_temp.set_index("datetime").sort_index()

    # Resample to higher timeframe OHLCV
    ohlc_dict = {
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
    }
    if "volume" in df_temp.columns:
        ohlc_dict["volume"] = "sum"

    resampled = df_temp.resample(higher_timeframe).agg(ohlc_dict).dropna(subset=["close"])
    if resampled.empty:
        return calculate_rsi(df["close"])

    # Compute indicator on higher timeframe
    ind = indicator.lower()
    if ind == "rsi":
        higher_vals = calculate_rsi(resampled["close"], kwargs.get("period", DEFAULT_RSI_PERIOD))
    elif ind == "sma":
        higher_vals = calculate_sma(resampled["close"], kwargs.get("period", DEFAULT_SMA_20))
    elif ind == "ema":
        higher_vals = calculate_ema(resampled["close"], kwargs.get("period", DEFAULT_EMA_12))
    elif ind == "supertrend":
        st = calculate_supertrend(resampled, kwargs.get("period", DEFAULT_SUPERTREND_PERIOD))
        higher_vals = st["supertrend"]
    else:
        higher_vals = calculate_rsi(resampled["close"])

    resampled[f"mtf_{ind}"] = higher_vals
    merged = pd.merge_asof(
        df_temp.reset_index(),
        resampled[[f"mtf_{ind}"]].reset_index(),
        on="datetime",
        direction="backward"
    )
    return merged[f"mtf_{ind}"].ffill().bfill()
