"""
StockOracle Pro — OpenBB & OpenTerminalUI Institutional Suite Regression Tests
Verifies DCF Valuation, RRG Sector Rotation, Options Strategy Payoff, Volume Profile, Macro Hub, and Quant Risk.
"""
from unittest.mock import patch
import pytest
import pandas as pd
from fastapi.testclient import TestClient

from backend.main import app
from backend.analysis.valuation import calculate_dcf_valuation
from backend.analysis.rrg_rotation import calculate_rrg_sector_rotation
from backend.analysis.options_lab import calculate_strategy_payoff
from backend.analysis.volume_profile import calculate_volume_profile
from backend.analysis.macro_terminal import get_sovereign_macro_dashboard
from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit

client = TestClient(app)


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


def test_sovereign_macro_dashboard():
    """Verifies sovereign yield spread and cross-asset correlations."""
    macro = get_sovereign_macro_dashboard()
    assert macro["india_10y_yield"] > 0
    assert macro["us_10y_yield"] > 0
    assert macro["yield_spread_bps"] > 0
    assert len(macro["correlations"]) >= 5
    assert len(macro["yield_curve_history"]) == 12


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
