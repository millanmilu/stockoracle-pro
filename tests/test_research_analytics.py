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
from backend.data.fundamentals import _parse_number, _normalize_pct_field
from backend.data.fundamentals_deep import (
    _calculate_altman_z_score,
    _calculate_intrinsic_dcf,
    _calculate_piotroski_f_score,
    _fetch_universe_fallback,
    _finalize_freshness_status,
)


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


def test_dividend_yield_normalization_fraction_vs_percent():
    """Newer yfinance may return an already-percent dividendYield (>1)."""
    assert _normalize_pct_field(0.035) == 3.5  # fraction → percent
    assert _normalize_pct_field(3.5) == 3.5  # already percent → untouched
    assert _normalize_pct_field(0.0) == 0.0
    assert _normalize_pct_field(None) is None
    assert _normalize_pct_field("N/A") is None


def test_altman_z_score_insufficient_data_returns_null():
    """Missing statements must yield null score, never a fake Safe Zone."""
    empty = _calculate_altman_z_score([], [])
    assert empty["z_score"] is None
    assert empty["zone"] == "Insufficient Data"

    # Missing market-cap anchor must also refuse to score.
    partial = _calculate_altman_z_score(
        [{"Sales": 1000.0, "Operating Profit": 200.0}],
        [{"Reserves": 500.0, "Total Assets": 2000.0, "Total Liabilities": 1000.0}],
        mcap_cr=None,
    )
    assert partial["z_score"] is None
    assert partial["zone"] == "Insufficient Data"

    # Fully reported inputs still score normally.
    full = _calculate_altman_z_score(
        [{"Sales": 1000.0, "Operating Profit": 200.0}],
        [{"Reserves": 500.0, "Total Assets": 2000.0, "Total Liabilities": 1000.0}],
        mcap_cr=3000.0,
    )
    assert full["z_score"] is not None
    assert full["zone"] in ("Safe Zone", "Grey Zone", "Distress Zone")


def test_piotroski_insufficient_data_returns_null():
    """Fewer than 2 annual statements must not fabricate a 6/9 PASS baseline."""
    result = _calculate_piotroski_f_score([{"Net Profit": 100.0}], [], [])
    assert result["score"] is None
    assert result["rating"] == "INSUFFICIENT DATA"
    assert len(result["criteria"]) == 9
    assert all(c.get("passed") is None for c in result["criteria"])

    # Two years of real data still scores 0-9.
    annual = [
        {"Net Profit": 80.0, "Sales": 900.0, "OPM %": 14.0},
        {"Net Profit": 100.0, "Sales": 1000.0, "OPM %": 15.0},
    ]
    bs = [
        {"Total Assets": 1900.0, "Borrowings": 200.0, "Equity Capital": 100.0, "Other Liabilities": 300.0},
        {"Total Assets": 2000.0, "Borrowings": 190.0, "Equity Capital": 100.0, "Other Liabilities": 300.0},
    ]
    cf = [{}, {"Cash from Operating Activity": 150.0}]
    scored = _calculate_piotroski_f_score(annual, bs, cf)
    assert scored["score"] is not None
    assert 0 <= scored["score"] <= 9


def test_dcf_without_cmp_returns_null_margin_not_fake_verdict():
    """DCF without a real CMP must not anchor on ₹1000 or emit a fake verdict."""
    annual = [
        {"Sales": 800.0}, {"Sales": 850.0}, {"Sales": 900.0},
        {"Sales": 950.0}, {"Sales": 1000.0},
    ]
    result = _calculate_intrinsic_dcf("TEST", annual, [], eps=50.0, bvps=200.0, cmp=None)
    assert result["current_market_price"] is None
    assert result["margin_of_safety_pct"] is None
    assert result["valuation_verdict"] == "INSUFFICIENT DATA"
    assert result["dcf_fair_value"] is not None

    # Without a real EPS anchor there is no honest valuation at all.
    no_eps = _calculate_intrinsic_dcf("TEST", annual, [], eps=None, bvps=None, cmp=1500.0)
    assert no_eps["dcf_fair_value"] is None
    assert no_eps["valuation_verdict"] == "INSUFFICIENT DATA"


# ─────────────────────────────────────────────────────────────────────────────
# Fundamentals deep — reference baseline must never invent financial statements
# ─────────────────────────────────────────────────────────────────────────────

def _a_universe_ticker():
    """First curated reference row, or None when the universe seed is empty."""
    from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE
    for row in (MASTER_NSE_UNIVERSE or []):
        ticker = str(row.get("ticker", "")).upper().strip()
        if ticker:
            return ticker
    return None


def test_universe_fallback_never_fabricates_statements():
    """The resilience baseline used to invent a 5-year P&L, four quarters, a
    balance sheet, a cash-flow statement and a shareholding pattern — all from
    hardcoded growth defaults — and the profile still said "Verified".

    Absent statements must stay absent: the UI renders a gap honestly, but a
    fabricated series reads as fact and even fed the CAGR block.
    """
    ticker = _a_universe_ticker()
    if not ticker:
        pytest.skip("curated universe seed is empty")

    profile = _fetch_universe_fallback(ticker)
    assert profile, "a ticker from the curated universe must resolve"

    for field in ("annual_pl", "quarterly_results", "balance_sheet",
                  "cash_flow", "shareholding"):
        assert profile[field] == [], (
            f"reference baseline fabricated {field!r}; absent statements must stay absent"
        )


def test_universe_fallback_keeps_only_reference_fields():
    """Identity/ratios/price are real reference-row values and must survive."""
    ticker = _a_universe_ticker()
    if not ticker:
        pytest.skip("curated universe seed is empty")

    profile = _fetch_universe_fallback(ticker)
    assert profile.get("name")
    # The blurb must admit the gap instead of presenting the row as a full profile.
    assert "unavailable" in profile["about"].lower()

    for field in ("annual_pl", "quarterly_results", "balance_sheet",
                  "cash_flow", "shareholding"):
        assert profile[field] == []

    # EPS is an exact rearrangement of a real price and a real multiple, not an
    # invented observation — so when both exist the identity must hold.
    cmp_val, pe = profile.get("cmp"), profile.get("pe_ratio")
    if cmp_val and pe and pe > 0:
        assert profile["eps"] == pytest.approx(round(cmp_val / pe, 2))


def test_unknown_ticker_yields_no_reference_profile():
    assert _fetch_universe_fallback("ZZZZZZ") == {}


@pytest.mark.parametrize("payload,expected_verified", [
    ({"data_freshness": {"data_source": "Screener.in Consolidated (live scrape)"},
      "annual_pl": [{"Sales": 1.0}], "balance_sheet": [{"Assets": 1.0}],
      "shareholding": [{"quarter": "Mar 2026"}]}, True),
    # A 200 response whose tables did not parse is NOT verified.
    ({"data_freshness": {"data_source": "Screener.in Consolidated (live scrape)"},
      "annual_pl": [], "balance_sheet": [], "shareholding": []}, False),
    ({"data_freshness": {"data_source": "StockOracle reference baseline (no verified statements)"},
      "annual_pl": [], "balance_sheet": [], "shareholding": []}, False),
    ({"data_freshness": {"data_source": "Unavailable"},
      "annual_pl": [], "balance_sheet": [], "shareholding": []}, False),
])
def test_freshness_status_is_derived_not_claimed(payload, expected_verified):
    """"Verified" must mean statements were actually parsed — the floor profile
    shipped status="Verified" before anything had been fetched, and the fallback
    merge sites left that label in place while most of the payload was invented."""
    _finalize_freshness_status(payload)
    fresh = payload["data_freshness"]
    assert (fresh["status"] == "Verified") is expected_verified
    assert fresh["statements_available"] is expected_verified


def test_baseline_fallback_reports_no_verified_statements():
    """End-to-end shape of the fallback: reference identity + honest freshness."""
    ticker = _a_universe_ticker()
    if not ticker:
        pytest.skip("curated universe seed is empty")

    payload = {
        "data_freshness": {
            "data_source": "StockOracle reference baseline (no verified statements)"
        },
        "annual_pl": [],
        "balance_sheet": [],
        "shareholding": [],
    }
    payload.update(_fetch_universe_fallback(ticker))
    _finalize_freshness_status(payload)

    assert payload["data_freshness"]["status"] == "No verified statements"
    assert "Verified" not in payload["data_freshness"]["data_source"]
    assert payload["annual_pl"] == []
