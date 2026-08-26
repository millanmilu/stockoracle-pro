"""
StockOracle Pro — Phase 4 Research, Options & Screener 2.0 Regression Tests
"""
import pytest
from backend.data.database import (
    init_db, add_saved_scan, get_saved_scans, delete_saved_scan
)
from backend.data.options import (
    calculate_black_scholes_greeks, _compute_max_pain, _get_pcr_sentiment
)
from backend.data.fundamentals import _parse_number


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_saved_scans_crud():
    """Verify adding, listing, and deleting custom screener presets with user isolation."""
    user_a = "trader_scan_a"
    user_b = "trader_scan_b"

    filter_a = {"min_rsi": 30, "max_rsi": 45, "signal": "BULLISH"}
    filter_b = {"min_price": 500, "max_price": 2000}

    id_a = add_saved_scan("RSI Oversold Momentum", filter_a, "Scan for oversold bounce", user_id=user_a)
    id_b = add_saved_scan("Midcap Range", filter_b, "Price filter", user_id=user_b)

    assert id_a > 0
    assert id_b > 0

    scans_a = get_saved_scans(user_id=user_a)
    scans_b = get_saved_scans(user_id=user_b)

    assert len(scans_a) == 1
    assert scans_a[0]["name"] == "RSI Oversold Momentum"
    assert scans_a[0]["filters"]["min_rsi"] == 30

    assert len(scans_b) == 1
    assert scans_b[0]["name"] == "Midcap Range"

    # Cleanup
    delete_saved_scan(id_a, user_id=user_a)
    delete_saved_scan(id_b, user_id=user_b)

    assert len(get_saved_scans(user_id=user_a)) == 0


def test_black_scholes_greeks_calculation():
    """Verify Black-Scholes Delta, Gamma, Theta, and Vega for Call and Put options."""
    spot = 1400.0
    strike = 1400.0  # ATM
    tte = 14 / 365.0  # 14 days to expiry
    iv = 20.0  # 20% volatility

    # Call Greeks
    ce_greeks = calculate_black_scholes_greeks(spot, strike, tte, iv, option_type="CE")
    assert ce_greeks["delta"] is not None
    assert 0.45 <= ce_greeks["delta"] <= 0.60  # ATM Call delta ~0.50
    assert ce_greeks["gamma"] > 0
    assert ce_greeks["theta"] < 0  # Time decay is negative
    assert ce_greeks["vega"] > 0

    # Put Greeks
    pe_greeks = calculate_black_scholes_greeks(spot, strike, tte, iv, option_type="PE")
    assert pe_greeks["delta"] is not None
    assert -0.60 <= pe_greeks["delta"] <= -0.40  # ATM Put delta ~ -0.50
    assert pe_greeks["theta"] < 0


def test_max_pain_and_pcr_sentiment():
    """Verify Max Pain calculation and PCR sentiment classification."""
    sample_chain = [
        {"strike_price": 1300.0, "call_oi": 1000, "put_oi": 5000},
        {"strike_price": 1350.0, "call_oi": 2000, "put_oi": 4000},
        {"strike_price": 1400.0, "call_oi": 5000, "put_oi": 2000},
        {"strike_price": 1450.0, "call_oi": 6000, "put_oi": 1000},
    ]

    max_pain = _compute_max_pain(sample_chain)
    assert max_pain is not None
    assert max_pain in [1350.0, 1400.0]

    # PCR Sentiment
    assert "BULLISH" in _get_pcr_sentiment(1.4)
    assert "BEARISH" in _get_pcr_sentiment(0.5)
    assert "BALANCED" in _get_pcr_sentiment(0.9)


def test_fundamentals_number_parser():
    """Verify regex-based number parsing from various financial formats."""
    assert _parse_number("₹ 1,420.50 Cr") == 1420.50
    assert _parse_number("24.5 %") == 24.5
    assert _parse_number("-3.14 %") == -3.14
    assert _parse_number("N/A") is None
    assert _parse_number("") is None
