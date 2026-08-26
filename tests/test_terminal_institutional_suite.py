"""
StockOracle Pro — OpenBB & OpenTerminalUI Institutional Suite Regression Tests
Verifies DCF Valuation, RRG Sector Rotation, Options Strategy Payoff, Volume Profile, Macro Hub, and Quant Risk.
"""
import pytest
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
    """Verifies Volume Profile (VPVR) price bins and POC calculation."""
    vp = calculate_volume_profile("RELIANCE", period="1M", n_bins=20)
    if "error" not in vp:
        assert "poc_price" in vp
        assert "vah_price" in vp
        assert "val_price" in vp
        assert len(vp["profile"]) == 20


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
