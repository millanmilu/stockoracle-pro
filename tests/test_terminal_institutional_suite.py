"""
StockOracle Pro — OpenBB & OpenTerminalUI Institutional Suite Regression Tests
Verifies DCF Valuation, RRG Sector Rotation, Options Strategy Payoff, Volume Profile, Macro Hub, and Quant Risk.
"""
from unittest.mock import patch
import pytest
import pandas as pd
from fastapi.testclient import TestClient

from backend.main import app
from backend.data.database import init_db
from backend.analysis.valuation import calculate_dcf_valuation
from backend.analysis.rrg_rotation import calculate_rrg_sector_rotation
from backend.analysis.options_lab import calculate_strategy_payoff
from backend.analysis.volume_profile import calculate_volume_profile, calculate_exchange_report
from backend.analysis.macro_terminal import get_sovereign_macro_dashboard
from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """TestClient(app) without a context manager never runs the app lifespan,
    so init_db() (called there in production) has to happen explicitly here —
    otherwise every DB-reading engine below fails with "no such table".
    """
    init_db()


def test_dcf_and_graham_valuation_engine():
    """Verifies DCF multi-stage cash flows and Benjamin Graham intrinsic number."""
    val = calculate_dcf_valuation("RELIANCE", growth_rate_5y=0.12, discount_rate_wacc=0.11)
    assert val["ticker"] == "RELIANCE"
    assert val["dcf_intrinsic_value"] > 0
    assert val["graham_number"] > 0
    assert val["blended_fair_value"] > 0
    assert "valuation_status" in val
    assert len(val["projected_cash_flows"]) == 5


def test_rrg_sector_rotation_engine():
    """Verifies JdK Relative Rotation Graph quadrant calculation."""
    rrg = calculate_rrg_sector_rotation()
    assert rrg["benchmark"] == "NIFTY 50"
    assert len(rrg["sectors"]) >= 9
    for s in rrg["sectors"]:
        assert s["quadrant"] in ["Leading", "Weakening", "Lagging", "Improving"]
        assert len(s["tail"]) == 4
        assert "color" in s


def test_options_strategy_payoff_and_vol_surface():
    """Verifies multi-leg options strategy payoff simulation and 3D Vol surface."""
    strat = calculate_strategy_payoff("RELIANCE", strategy_type="BULL_CALL_SPREAD", underlying_price=1300.0)
    assert strat["ticker"] == "RELIANCE"
    assert len(strat["payoff_curve"]) > 20
    assert "max_loss" in strat
    assert "max_profit" in strat
    assert len(strat["volatility_surface"]) > 0


def test_volume_profile_poc_and_value_area():
    """Verifies Volume Profile (VPVR) price bins and POC calculation deterministically."""
    fixture_df = pd.DataFrame({
        "open":   [100.0, 102.0, 101.0, 105.0, 108.0, 107.0, 110.0, 112.0, 115.0, 114.0, 116.0, 118.0],
        "high":   [103.0, 104.0, 106.0, 109.0, 111.0, 112.0, 114.0, 116.0, 118.0, 117.0, 120.0, 122.0],
        "low":    [99.0,  100.0, 100.0, 104.0, 106.0, 105.0, 109.0, 110.0, 113.0, 112.0, 115.0, 116.0],
        "close":  [102.0, 101.0, 105.0, 108.0, 107.0, 110.0, 112.0, 115.0, 114.0, 116.0, 118.0, 120.0],
        "volume": [10000, 15000, 12000, 25000, 30000, 20000, 18000, 22000, 28000, 16000, 19000, 24000],
    })

    n_bins = 20
    with patch("backend.analysis.volume_profile.fetch_stock_data", return_value=fixture_df):
        vp = calculate_volume_profile("RELIANCE", period="1M", n_bins=n_bins)

    assert "error" not in vp, f"Unexpected error in volume profile: {vp.get('error')}"

    # 1. The returned profile contains the requested number of bins
    assert "profile" in vp
    assert len(vp["profile"]) == n_bins

    # 2. POC/VAH/VAL are numerically ordered: val_price <= poc_price <= vah_price
    assert "val_price" in vp and "poc_price" in vp and "vah_price" in vp
    assert vp["val_price"] <= vp["poc_price"] <= vp["vah_price"]

    # 3. Total allocated profile volume equals fixture's volume (within expected rounding tolerance)
    fixture_volume_total = fixture_df["volume"].sum()
    profile_volume_total = sum(b["total_volume"] for b in vp["profile"])
    assert abs(profile_volume_total - fixture_volume_total) <= n_bins
    assert abs(vp["total_volume"] - fixture_volume_total) <= 1


def test_volume_profile_preserves_fractional_volume():
    """Fractional crypto volume must remain allocated across profile bins."""
    fixture_df = pd.DataFrame({
        "open": [100.0] * 10,
        "high": [102.0] * 10,
        "low": [99.0] * 10,
        "close": [101.0] * 10,
        "volume": [0.5] * 10,
    })

    with patch("backend.analysis.volume_profile.fetch_stock_data", return_value=fixture_df):
        vp = calculate_volume_profile("BTC", period="1M", n_bins=25)

    profile_volume_total = sum(row["total_volume"] for row in vp["profile"])
    buy_volume_total = sum(row["buy_volume"] for row in vp["profile"])
    sell_volume_total = sum(row["sell_volume"] for row in vp["profile"])
    assert vp["total_volume"] == pytest.approx(5.0)
    assert profile_volume_total == pytest.approx(5.0)
    assert buy_volume_total + sell_volume_total == pytest.approx(5.0)
    assert all(row["total_volume"] > 0 for row in vp["profile"])


def test_volume_profile_range_includes_open_and_close():
    """Price bins must cover OHLC even when source high/low bounds are malformed."""
    fixture_df = pd.DataFrame({
        "open": [103.0] * 10,
        "high": [102.0] * 10,
        "low": [99.0] * 10,
        "close": [101.0] * 10,
        "volume": [1.0] * 10,
    })

    with patch("backend.analysis.volume_profile.fetch_stock_data", return_value=fixture_df):
        vp = calculate_volume_profile("BTC", period="1M", n_bins=25)

    assert vp["profile"][0]["price_level"] > 99.0
    assert vp["profile"][-1]["price_level"] < 103.0
    assert sum(row["total_volume"] for row in vp["profile"]) == pytest.approx(10.0)


def test_exchange_report_uses_binance_trade_volume():
    """Trade-level exchange report must preserve price-range volume and show Binance source."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.read.return_value = (
            b'[{"p":"100.00","q":"1.0","m":true},{"p":"101.00","q":"2.0","m":false},{"p":"100.50","q":"3.0","m":true}]'
        )
        rep = calculate_exchange_report("BTC", period="1D", n_bins=10)

    assert rep["source"] == "binance_aggtrade"
    assert rep["pair"] == "BTCUSDT"
    assert rep["total_volume"] == pytest.approx(6.0)
    assert rep["buy_volume"] + rep["sell_volume"] == pytest.approx(6.0)
    assert rep["poc_price"] >= rep["val_price"]
    assert rep["vah_price"] >= rep["poc_price"]


def test_sovereign_macro_dashboard():
    """Verifies sovereign yield spread and cross-asset correlations."""
    macro = get_sovereign_macro_dashboard()
    assert macro["india_10y_yield"] > 0
    assert macro["us_10y_yield"] > 0
    assert macro["yield_spread_bps"] > 0
    assert len(macro["correlations"]) >= 5
    assert len(macro["yield_curve_history"]) == 12
    assert macro["as_of"]
    assert all(set(r) >= {"symbol", "price", "status"} for r in macro["indices"])


def test_sovereign_macro_live_path(monkeypatch):
    """Live Stooq/Angel inputs flip statuses to LIVE and recompute the spread."""
    import pandas as pd

    import backend.analysis.macro_terminal as mt

    mt._CACHE.clear()
    mt._CACHE_TS = None
    monkeypatch.setattr(mt, "_live_stooq", lambda s: {"10USY.B": 4.50, "usdiny.fx": 88.10, "^INVIX": 16.25}.get(s))
    df = pd.DataFrame({"close": [25000.0, 25100.0]})
    monkeypatch.setattr(mt, "_live_nifty_row",
                        lambda: {"symbol": "NIFTY 50", "name": "NSE Benchmark", "price": 25100.0, "change_pct": 0.4, "status": "LIVE"})

    macro = mt.get_sovereign_macro_dashboard()

    assert macro["us_10y_yield"] == 4.50 and macro["us_10y_live"] is True
    assert macro["yield_spread_bps"] == round((7.02 - 4.50) * 100, 1) > 0
    by_sym = {r["symbol"]: r for r in macro["indices"]}
    assert by_sym["NIFTY 50"]["status"] == "LIVE"
    assert by_sym["INDIA VIX"] == {"symbol": "INDIA VIX", "name": "Volatility Index", "price": 16.25, "change_pct": None, "status": "LIVE"}
    assert by_sym["USD / INR"]["price"] == 88.10
    assert by_sym["BANK NIFTY"]["status"] == "STATIC"
    assert "BTC" in by_sym and "GOLD" in by_sym

    mt._CACHE.clear()
    mt._CACHE_TS = None


def test_portfolio_quant_risk_cockpit():
    """Verifies Parametric/Historical VaR, CVaR, Sharpe, and correlation heatmap."""
    risk = calculate_portfolio_risk_cockpit(
        positions=[{"ticker": "RELIANCE", "weight": 0.5}, {"ticker": "TCS", "weight": 0.5}],
        portfolio_value=1000000.0
    )
    assert risk["var_95_daily_inr"] > 0
    assert risk["var_99_daily_inr"] >= risk["var_95_daily_inr"]
    assert risk["cvar_95_inr"] > 0
    assert "sharpe_ratio" in risk
    assert len(risk["correlation_heatmap"]) == 4


def test_institutional_api_endpoints():
    """Verifies FastAPI router endpoints return HTTP 200 OK."""
    # 1. Valuation
    res = client.get("/api/stock/RELIANCE/valuation")
    assert res.status_code == 200
    assert res.json()["ticker"] == "RELIANCE"

    # 2. RRG Sectors
    res = client.get("/api/market/rrg-sectors")
    assert res.status_code == 200
    assert "sectors" in res.json()

    # 3. Options Payoff
    res = client.post("/api/options/strategy-payoff", json={"ticker": "RELIANCE", "strategy_type": "IRON_CONDOR"})
    assert res.status_code == 200
    assert "payoff_curve" in res.json()

    # 4. Sovereign Macro
    res = client.get("/api/macro/sovereign-yields")
    assert res.status_code == 200
    assert "yield_spread_bps" in res.json()

    # 5. Quant Risk Cockpit
    res = client.post("/api/portfolio/risk-cockpit", json={"portfolio_value": 500000.0})
    assert res.status_code == 200
    assert "var_95_daily_inr" in res.json()

    # 6. Bloomberg Ticker Tape
    res = client.get("/api/terminal/ticker-tape")
    assert res.status_code == 200
    assert len(res.json()["indices"]) >= 5
