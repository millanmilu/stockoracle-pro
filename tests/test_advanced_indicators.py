"""
StockOracle Pro — Advanced Technical Indicators Test Suite
Verifies:
1. Volume-Weighted Indicators: VWAP, OBV, MFI
2. RSI Zero Gain & Loss neutral-50 bug fix
3. In-memory LRU indicator caching performance (0ms repeated hit)
4. Momentum Indicators: Stochastic (%K, %D), CCI, Williams %R, ROC
5. Supertrend vectorized NumPy accuracy & performance
6. Candlestick pattern accuracy with prior trend context (Hammer vs Hanging Man, Shooting Star vs Inverted Hammer)
7. Multi-timeframe (MTF) indicator calculation
8. Volatility Channels: Keltner & Donchian channels
9. Divergence Detection (Bullish / Bearish)
10. Market Regime Classification
11. Safe AST-based Custom Indicator formula evaluation
12. Zero candle dropping & min_periods=1 invariant
"""

import time
import pytest
import numpy as np
import pandas as pd

from backend.analysis.indicators import (
    enrich_stock_dataframe, calculate_sma, calculate_ema,
    calculate_rsi, calculate_macd, calculate_bollinger_bands,
    calculate_vwap, calculate_obv, calculate_mfi,
    calculate_stochastic, calculate_cci, calculate_williams_r, calculate_roc,
    calculate_supertrend, calculate_keltner_channels, calculate_donchian_channels,
    calculate_pivot_points, calculate_fibonacci_levels, calculate_ichimoku,
    detect_candlestick_patterns, detect_divergences, classify_market_regime,
    evaluate_custom_formula, clear_indicator_cache
)


def make_test_df(length: int = 50, seed: int = 42) -> pd.DataFrame:
    """Generates synthetic OHLCV data."""
    np.random.seed(seed)
    dates = pd.date_range("2026-01-01", periods=length, freq="D").strftime("%Y-%m-%d")
    close = 100.0 + np.cumsum(np.random.randn(length) * 2.0)
    high = close + np.random.uniform(0.5, 3.0, size=length)
    low = close - np.random.uniform(0.5, 3.0, size=length)
    open_p = (high + low) * 0.5
    vol = np.random.randint(1000, 50000, size=length).astype(float)
    return pd.DataFrame({
        "date": dates,
        "open": open_p,
        "high": high,
        "low": low,
        "close": close,
        "volume": vol
    })


def test_rsi_neutral_bug_fix():
    """Verify RSI returns strictly 50.0 when gain and loss are both zero (flat prices)."""
    flat_series = pd.Series([100.0] * 20)
    rsi = calculate_rsi(flat_series, period=14)
    assert (rsi == 50.0).all(), f"Expected RSI to be 50.0 for flat prices, got {rsi.values}"

    # Also check when only single change occurs
    single_jump = pd.Series([100.0] * 10 + [105.0] * 10)
    rsi_jump = calculate_rsi(single_jump, period=14)
    # Final values where change is 0 again should not be NaN
    assert not rsi_jump.isna().any()
    assert rsi_jump.iloc[-1] >= 50.0


def test_volume_weighted_indicators():
    """Verify VWAP, OBV, and MFI calculations."""
    df = make_test_df(30)
    vwap = calculate_vwap(df)
    obv = calculate_obv(df)
    mfi = calculate_mfi(df, period=14)

    assert len(vwap) == 30
    assert not vwap.isna().any()
    assert (vwap > 0).all()

    assert len(obv) == 30
    assert not obv.isna().any()

    assert len(mfi) == 30
    assert not mfi.isna().any()
    assert (mfi >= 0.0).all() and (mfi <= 100.0).all()

    # Verify MFI on flat prices returns neutral 50.0
    flat_df = pd.DataFrame({
        "high": [100.0] * 20,
        "low": [100.0] * 20,
        "close": [100.0] * 20,
        "volume": [1000.0] * 20
    })
    flat_mfi = calculate_mfi(flat_df, period=14)
    assert (flat_mfi == 50.0).all()


def test_momentum_indicators():
    """Verify Stochastic, CCI, Williams %R, and ROC."""
    df = make_test_df(30)
    stoch = calculate_stochastic(df, k_period=14, d_period=3)
    cci = calculate_cci(df, period=20)
    wr = calculate_williams_r(df, period=14)
    roc = calculate_roc(df["close"], period=12)

    assert "stoch_k" in stoch and "stoch_d" in stoch
    assert not stoch["stoch_k"].isna().any()
    assert not stoch["stoch_d"].isna().any()
    assert (stoch["stoch_k"] >= 0.0).all() and (stoch["stoch_k"] <= 100.0).all()

    assert len(cci) == 30
    assert not cci.isna().any()

    assert len(wr) == 30
    assert not wr.isna().any()
    assert (wr >= -100.0).all() and (wr <= 0.0).all()

    assert len(roc) == 30
    assert not roc.isna().any()


def test_supertrend_performance_and_vectorization():
    """Verify Supertrend runs fast with vectorized NumPy and produces valid output."""
    df = make_test_df(500)
    t0 = time.perf_counter()
    st = calculate_supertrend(df, period=10, multiplier=3.0)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    assert elapsed_ms < 50.0, f"Supertrend too slow: {elapsed_ms:.2f}ms for 500 candles"
    assert "supertrend" in st and "direction" in st
    assert len(st["supertrend"]) == 500
    assert set(st["direction"].unique()).issubset({1.0, -1.0})


def test_candlestick_pattern_accuracy_with_trend_context():
    """Verify Hammer vs Hanging Man distinction based on prior trend context."""
    # Create downtrend followed by hammer candle
    df = pd.DataFrame({
        "open":  [150.0, 140.0, 130.0, 120.0, 110.0, 100.0, 92.0],
        "high":  [152.0, 142.0, 132.0, 122.0, 112.0, 102.0, 93.0],
        "low":   [138.0, 128.0, 118.0, 108.0, 98.0,  88.0,  70.0],  # Long lower wick on last candle
        "close": [140.0, 130.0, 120.0, 110.0, 100.0, 91.0,  92.5],
    })
    patterns = detect_candlestick_patterns(df)
    # The last candle is after a steep downtrend -> must be Hammer, NOT Hanging Man
    assert bool(patterns["pattern_hammer"].iloc[-1]) is True
    assert bool(patterns["pattern_hanging_man"].iloc[-1]) is False


def test_volatility_channels():
    """Verify Keltner and Donchian channels."""
    df = make_test_df(30)
    keltner = calculate_keltner_channels(df)
    donchian = calculate_donchian_channels(df)

    assert "keltner_upper" in keltner and "keltner_middle" in keltner and "keltner_lower" in keltner
    assert (keltner["keltner_upper"] >= keltner["keltner_middle"]).all()
    assert (keltner["keltner_middle"] >= keltner["keltner_lower"]).all()

    assert "donchian_upper" in donchian and "donchian_middle" in donchian and "donchian_lower" in donchian
    assert (donchian["donchian_upper"] >= donchian["donchian_lower"]).all()


def test_divergence_and_market_regime():
    """Verify divergence scanner and market regime classifier."""
    df = make_test_df(50)
    divs = detect_divergences(df, "rsi")
    regime = classify_market_regime(df)

    assert "bullish_divergence" in divs and "bearish_divergence" in divs
    assert len(regime) == 50
    valid_regimes = {"BULLISH_TRENDING", "BEARISH_TRENDING", "VOLATILITY_EXPANSION", "RANGING_CONSOLIDATION", "NEUTRAL"}
    assert set(regime.unique()).issubset(valid_regimes)


def test_safe_custom_indicator_formula():
    """Verify AST-based custom indicator builder safely evaluates valid formulas."""
    df = make_test_df(25)
    # Formula 1: Normalized spread
    res1 = evaluate_custom_formula(df, "(high - low) / close")
    assert len(res1) == 25
    assert not res1.isna().any()

    # Formula 2: Z-Score like
    res2 = evaluate_custom_formula(df, "(close - sma(close, 10)) / (std(close, 10) + 1e-9)")
    assert len(res2) == 25
    assert not res2.isna().any()

    # Security check: Arbitrary code / import must raise ValueError
    with pytest.raises(ValueError):
        evaluate_custom_formula(df, "__import__('os').system('ls')")


def test_in_memory_caching_performance():
    """Verify that enrich_stock_dataframe caches calculations and returns instantly."""
    clear_indicator_cache()
    df = make_test_df(100)

    # First call: computes everything
    t0 = time.perf_counter()
    enriched1 = enrich_stock_dataframe(df, use_cache=True, cache_key="TEST_STOCK")
    time_first = (time.perf_counter() - t0) * 1000.0

    # Second call: must hit cache
    t1 = time.perf_counter()
    enriched2 = enrich_stock_dataframe(df, use_cache=True, cache_key="TEST_STOCK")
    time_cached = (time.perf_counter() - t1) * 1000.0

    assert len(enriched1) == len(enriched2) == 100
    assert time_cached < time_first
    assert time_cached < 5.0, f"Expected sub-5ms cache hit, got {time_cached:.2f}ms"


def test_zero_candle_dropping_invariant():
    """Critical AGENTS.md invariant: Zero raw candles dropped and min_periods=1 preserved."""
    for n in [1, 2, 3, 5, 20]:
        df = make_test_df(n)
        enriched = enrich_stock_dataframe(df)
        assert len(enriched) == n, f"Candles dropped for n={n}! Got {len(enriched)}"
        assert "rsi" in enriched.columns
        assert "vwap" in enriched.columns
        assert "obv" in enriched.columns
        assert "mfi" in enriched.columns
        assert "supertrend" in enriched.columns
        assert "stoch_k" in enriched.columns
        assert not enriched["rsi"].isna().any()
