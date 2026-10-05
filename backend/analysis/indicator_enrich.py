"""StockOracle Pro — master technical indicator enrichment pipeline.


Split verbatim out of ``backend/analysis/indicators.py`` (pure code motion).
AGENTS.md locks: zero candle dropping, min_periods=1, RSI neutral-50, LRU cache.
"""

from typing import Optional

import pandas as pd

from .constants import (
    DEFAULT_SMA_20, DEFAULT_SMA_50, DEFAULT_SMA_200,
    DEFAULT_EMA_9, DEFAULT_EMA_12, DEFAULT_EMA_21, DEFAULT_EMA_26,
    DEFAULT_RSI_PERIOD,
    DEFAULT_MACD_FAST, DEFAULT_MACD_SLOW, DEFAULT_MACD_SIGNAL,
    DEFAULT_BB_PERIOD, DEFAULT_BB_STD,
    DEFAULT_ATR_PERIOD, DEFAULT_ADX_PERIOD,
    DEFAULT_SUPERTREND_PERIOD, DEFAULT_SUPERTREND_MULTIPLIER,
    DEFAULT_STOCH_K_PERIOD, DEFAULT_STOCH_D_PERIOD,
    DEFAULT_CCI_PERIOD, DEFAULT_WILLIAMS_R_PERIOD,
    DEFAULT_ROC_PERIOD, DEFAULT_MFI_PERIOD,
    DEFAULT_FIBONACCI_PERIOD, INDICATOR_CACHE_MAX_ENTRIES,
)
from .indicator_cache import _get_cache_fingerprint, _indicator_cache
from .indicator_trend import (
    calculate_sma, calculate_ema, calculate_rsi, calculate_macd,
    calculate_bollinger_bands, calculate_atr, calculate_adx,
    calculate_supertrend, calculate_keltner_channels, calculate_donchian_channels,
    calculate_pivot_points, calculate_fibonacci_levels, calculate_ichimoku,
    calculate_adx_full,
)
from .indicator_volume import calculate_vwap, calculate_obv, calculate_mfi, calculate_cmf
from .indicator_momentum import (
    calculate_stochastic, calculate_cci, calculate_williams_r, calculate_roc,
    calculate_stoch_rsi, calculate_elder_ray, calculate_psar,
)
from .indicator_patterns import (
    detect_candlestick_patterns, detect_divergences, classify_market_regime,
)

# ── Master Technical Indicator Enrichment Pipeline ───────────────────────────
def enrich_stock_dataframe(
    df: pd.DataFrame,
    use_cache: bool = True,
    cache_key: Optional[str] = None
) -> pd.DataFrame:
    """
    Computes all technical indicators and appends them to the dataframe.
    Guarantees:
    1. Zero Candle Dropping (AGENTS.md Invariant)
    2. min_periods=1 standard for all rolling indicators
    3. High-performance LRU in-memory caching to eliminate 200-400ms duplicate computation
    """
    if df is None or df.empty:
        return df

    # Check LRU cache
    fingerprint = _get_cache_fingerprint(df, cache_key)
    if use_cache and fingerprint in _indicator_cache:
        # Move to end for LRU
        _indicator_cache.move_to_end(fingerprint)
        return _indicator_cache[fingerprint].copy()

    df = df.copy()

    # 1. Moving Averages & Trend
    df["sma_20"] = calculate_sma(df["close"], DEFAULT_SMA_20)
    df["sma_50"] = calculate_sma(df["close"], DEFAULT_SMA_50)
    df["sma_200"] = calculate_sma(df["close"], DEFAULT_SMA_200)
    df["ema_9"] = calculate_ema(df["close"], DEFAULT_EMA_9)
    df["ema_12"] = calculate_ema(df["close"], DEFAULT_EMA_12)
    df["ema_21"] = calculate_ema(df["close"], DEFAULT_EMA_21)
    df["ema_26"] = calculate_ema(df["close"], DEFAULT_EMA_26)

    # 2. Volume-Weighted Indicators
    df["vwap"] = calculate_vwap(df)
    df["obv"] = calculate_obv(df)
    df["mfi"] = calculate_mfi(df, DEFAULT_MFI_PERIOD)
    if "volume" in df.columns:
        df["volume_sma_20"] = calculate_sma(df["volume"], DEFAULT_SMA_20)
    else:
        df["volume_sma_20"] = pd.Series(0.0, index=df.index)

    # 3. Supertrend (Vectorized NumPy)
    st_data = calculate_supertrend(df, DEFAULT_SUPERTREND_PERIOD, DEFAULT_SUPERTREND_MULTIPLIER)
    df["supertrend"] = st_data["supertrend"]
    df["supertrend_dir"] = st_data["direction"]

    # 4. RSI (With neutral 50 bug fix)
    df["rsi"] = calculate_rsi(df["close"], DEFAULT_RSI_PERIOD)

    # 5. MACD
    macd_data = calculate_macd(df["close"], DEFAULT_MACD_FAST, DEFAULT_MACD_SLOW, DEFAULT_MACD_SIGNAL)
    df["macd"] = macd_data["macd"]
    df["macd_signal"] = macd_data["signal"]
    df["macd_hist"] = macd_data["hist"]

    # 6. Bollinger Bands
    bb_data = calculate_bollinger_bands(df["close"], DEFAULT_BB_PERIOD, DEFAULT_BB_STD)
    df["bb_upper"] = bb_data["upper"]
    df["bb_middle"] = bb_data["middle"]
    df["bb_lower"] = bb_data["lower"]
    df["bb_pct_b"] = bb_data["pct_b"]

    # 7. ATR & ADX
    df["atr"] = calculate_atr(df, DEFAULT_ATR_PERIOD)
    df["adx"] = calculate_adx(df, DEFAULT_ADX_PERIOD)

    # 8. Momentum Oscillators (Stochastic, CCI, Williams %R, ROC)
    stoch = calculate_stochastic(df, DEFAULT_STOCH_K_PERIOD, DEFAULT_STOCH_D_PERIOD)
    df["stoch_k"] = stoch["stoch_k"]
    df["stoch_d"] = stoch["stoch_d"]
    df["cci"] = calculate_cci(df, DEFAULT_CCI_PERIOD)
    df["williams_r"] = calculate_williams_r(df, DEFAULT_WILLIAMS_R_PERIOD)
    df["roc"] = calculate_roc(df["close"], DEFAULT_ROC_PERIOD)

    # 9. Volatility Channels (Keltner & Donchian)
    keltner = calculate_keltner_channels(df)
    df["keltner_upper"] = keltner["keltner_upper"]
    df["keltner_middle"] = keltner["keltner_middle"]
    df["keltner_lower"] = keltner["keltner_lower"]

    donchian = calculate_donchian_channels(df)
    df["donchian_upper"] = donchian["donchian_upper"]
    df["donchian_middle"] = donchian["donchian_middle"]
    df["donchian_lower"] = donchian["donchian_lower"]

    # 10. Pivot Points & Fibonacci (Lookahead-free)
    pivots = calculate_pivot_points(df)
    df["pivot"] = pivots["pivot"]
    df["r1"] = pivots["r1"]
    df["s1"] = pivots["s1"]
    df["r2"] = pivots["r2"]
    df["s2"] = pivots["s2"]

    fibs = calculate_fibonacci_levels(df, DEFAULT_FIBONACCI_PERIOD)
    df["fib_236"] = fibs["fib_236"]
    df["fib_382"] = fibs["fib_382"]
    df["fib_500"] = fibs["fib_500"]
    df["fib_618"] = fibs["fib_618"]

    # 11. Ichimoku Cloud
    ichimoku = calculate_ichimoku(df)
    df["ichimoku_tenkan"] = ichimoku["ichimoku_tenkan"]
    df["ichimoku_kijun"] = ichimoku["ichimoku_kijun"]
    df["ichimoku_senkou_a"] = ichimoku["ichimoku_senkou_a"]
    df["ichimoku_senkou_b"] = ichimoku["ichimoku_senkou_b"]
    df["ichimoku_chikou"] = ichimoku["ichimoku_chikou"]

    # 12. Stochastic RSI
    stoch_rsi = calculate_stoch_rsi(df["close"])
    df["stoch_rsi_k"] = stoch_rsi["stoch_rsi_k"]
    df["stoch_rsi_d"] = stoch_rsi["stoch_rsi_d"]

    # 13. Chaikin Money Flow
    df["cmf"] = calculate_cmf(df)

    # 14. Elder Ray Index
    elder = calculate_elder_ray(df)
    df["elder_bull"] = elder["elder_bull"]
    df["elder_bear"] = elder["elder_bear"]

    # 15. Parabolic SAR
    psar_data = calculate_psar(df)
    df["psar"] = psar_data["psar"]
    df["psar_dir"] = psar_data["psar_dir"]

    # 16. Full ADX with +DI / -DI
    adx_full = calculate_adx_full(df)
    df["adx"] = adx_full["adx"]
    df["plus_di"] = adx_full["plus_di"]
    df["minus_di"] = adx_full["minus_di"]

    # 17. Candlestick Patterns with Trend Context

    df = detect_candlestick_patterns(df)

    # 13. Divergence Detection
    divs = detect_divergences(df, "rsi")
    df["bullish_divergence"] = divs["bullish_divergence"]
    df["bearish_divergence"] = divs["bearish_divergence"]

    # 14. Market Regime Classification
    df["market_regime"] = classify_market_regime(df)

    # AGENTS.md Invariant: NEVER drop raw price rows.
    # Only remove rows where ALL core OHLC price columns are simultaneously NaN.
    price_cols = [c for c in ["open", "high", "low", "close"] if c in df.columns]
    if price_cols:
        df = df[~df[price_cols].isna().all(axis=1)]

    # Store in LRU cache
    if use_cache:
        if len(_indicator_cache) >= INDICATOR_CACHE_MAX_ENTRIES:
            _indicator_cache.popitem(last=False)
        _indicator_cache[fingerprint] = df.copy()

    return df
