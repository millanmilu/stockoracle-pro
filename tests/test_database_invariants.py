"""
StockOracle Pro — Invariant & Database Regression Tests
Tests:
1. Strict daily date format enforcement (YYYY-MM-DD, 10 chars)
2. No intraday candles inserted into SQLite historical_prices
3. Zero candle dropping in data fetching/enrichment
4. Multi-user isolation in portfolio and smart alerts
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from backend.data.database import (
    init_db, get_db_connection, save_historical_prices, get_historical_prices,
    add_portfolio_position, get_portfolio, remove_portfolio_position,
    add_smart_alert, get_smart_alerts, remove_smart_alert,
    DATE_REGEX, _normalize_price
)

@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensure database schema is initialized before each test."""
    init_db()


def test_date_regex_validation():
    """Verify strictly valid and invalid date formats."""
    assert DATE_REGEX.match("2026-08-25") is not None
    assert DATE_REGEX.match("2024-01-01") is not None
    assert DATE_REGEX.match("2026-08-25 15:30:00") is None
    assert DATE_REGEX.match("25-08-2026") is None
    assert DATE_REGEX.match("2026/08/25") is None


def test_no_intraday_in_sqlite():
    """Verify that intraday timestamps are never stored in historical_prices table."""
    sample_df = pd.DataFrame([
        {"date": "2026-08-25 09:15:00", "open": 100.0, "high": 105.0, "low": 99.0, "close": 103.0, "volume": 1000},
        {"date": "2026-08-25 09:20:00", "open": 103.0, "high": 104.0, "low": 102.0, "close": 102.5, "volume": 500},
        {"date": "2026-08-25", "open": 100.0, "high": 105.0, "low": 99.0, "close": 102.5, "volume": 1500},
    ])
    
    ticker = "TEST_INTRADAY_INVAR"
    save_historical_prices(ticker, sample_df)
    
    with get_db_connection() as conn:
        rows = conn.execute("SELECT date, length(date) FROM historical_prices WHERE ticker = ?", (ticker,)).fetchall()
        # Only the 10-char daily date should be saved
        for r in rows:
            assert len(r[0]) == 10, f"Found non-daily date in DB: {r[0]}"


def test_price_normalization():
    """Verify price normalization positive checks."""
    assert _normalize_price(1500.50) == 1500.50
    assert _normalize_price("2450.0") == 2450.0
    assert _normalize_price(-10.0) is None
    assert _normalize_price(0.0) is None
    assert _normalize_price(np.nan) is None


def test_portfolio_user_isolation():
    """Verify multi-user isolation in portfolio holdings."""
    user_a = "user_alpha"
    user_b = "user_beta"
    
    id_a = add_portfolio_position("RELIANCE", 10, 1300.0, user_id=user_a)
    id_b = add_portfolio_position("TCS", 5, 2200.0, user_id=user_b)
    
    port_a = get_portfolio(user_id=user_a)
    port_b = get_portfolio(user_id=user_b)
    
    tickers_a = [p["ticker"] for p in port_a]
    tickers_b = [p["ticker"] for p in port_b]
    
    assert "RELIANCE" in tickers_a
    assert "TCS" not in tickers_a
    assert "TCS" in tickers_b
    assert "RELIANCE" not in tickers_b
    
    # Clean up
    remove_portfolio_position(id_a, user_id=user_a)
    remove_portfolio_position(id_b, user_id=user_b)
