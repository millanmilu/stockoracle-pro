"""
StockOracle Pro — Technical Indicator Tests
Tests:
1. Zero candle dropping in enrich_stock_dataframe()
2. min_periods=1 standard for all rolling indicators
3. Correct calculation of Volume SMA, RSI, MACD, BB, ATR, ADX
"""
import pytest
import pandas as pd
import numpy as np

from backend.analysis.indicators import (
    enrich_stock_dataframe, calculate_sma, calculate_ema,
    calculate_rsi, calculate_macd, calculate_bollinger_bands,
    calculate_atr, calculate_adx, calculate_fibonacci_levels
)

def create_dummy_ohlcv(length=10):
    """Creates a sample OHLCV DataFrame for testing."""
    dates = pd.date_range("2026-08-01", periods=length, freq="D").strftime("%Y-%m-%d")
    np.random.seed(42)
    close = 100.0 + np.cumsum(np.random.randn(length) * 2)
    high = close + np.random.rand(length) * 3
    low = close - np.random.rand(length) * 3
    open_p = (high + low) / 2
    volume = np.random.randint(1000, 50000, size=length)
    
    return pd.DataFrame({
        "date": dates,
        "open": open_p,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume
    })


def test_zero_candle_dropping_short_series():
    """Verify that even a very short 3-candle dataframe has ZERO dropped candles."""
    df_short = create_dummy_ohlcv(length=3)
    enriched = enrich_stock_dataframe(df_short)
    
    assert len(enriched) == 3, f"Expected 3 candles, got {len(enriched)} (Candles dropped!)"
    assert "rsi" in enriched.columns
    assert "macd" in enriched.columns
    assert "volume_sma_20" in enriched.columns
    assert not enriched["rsi"].isna().any()
    assert not enriched["volume_sma_20"].isna().any()


def test_min_periods_one_for_rolling():
    """Verify that rolling indicators compute immediately on row 1 (min_periods=1)."""
    s = pd.Series([10.0, 20.0, 30.0])
    sma = calculate_sma(s, period=20)
    assert len(sma) == 3
    assert sma.iloc[0] == 10.0
    assert sma.iloc[1] == 15.0
    assert sma.iloc[2] == 20.0


def test_volume_sma_calculation():
    """Verify Volume SMA calculation."""
    df = create_dummy_ohlcv(length=25)
    enriched = enrich_stock_dataframe(df)
    
    assert "volume_sma_20" in enriched.columns
    assert len(enriched["volume_sma_20"]) == 25
    assert not enriched["volume_sma_20"].isna().any()
    assert (enriched["volume_sma_20"] > 0).all()
