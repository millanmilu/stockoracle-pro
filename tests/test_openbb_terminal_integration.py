"""
StockOracle Pro — OpenBB & OpenTerminalUI Integration Regression Tests
Verifies Unified ConfigLoader, OpenBBWrapper data adapter, and UITerminalAdapter presentation bridge.
"""
import pytest
from backend.core.config_loader import config, get_openbb_provider_keys
from backend.providers.openbb.wrapper import get_openbb_client
from terminal_ui.adapter import UITerminalAdapter


def test_unified_config_loader():
    """Verifies config loader exposes settings for host, openbb, and terminal UI."""
    assert config.APP_NAME == "StockOracle Pro"
    assert config.PORT > 0
    assert config.TERMINAL_DEFAULT_SYMBOL == "RELIANCE"
    keys = get_openbb_provider_keys()
    assert isinstance(keys, dict)


def test_openbb_wrapper_data_adapter():
    """Verifies OpenBBWrapper exposes standardized financial methods."""
    client = get_openbb_client()
    
    # 1. Equity Quote
    q = client.get_equity_quote("RELIANCE")
    assert q["symbol"] == "RELIANCE"
    assert "price" in q

    # 2. DCF Valuation
    val = client.get_dcf_valuation("RELIANCE")
    assert val["ticker"] == "RELIANCE"
    assert val["dcf_intrinsic_value"] > 0

    # 3. Macro Hub
    macro = client.get_sovereign_macro_hub()
    assert macro["india_10y_yield"] > 0
    assert macro["yield_spread_bps"] > 0

    # 4. Quant Risk
    risk = client.calculate_portfolio_risk([{"ticker": "RELIANCE", "weight": 1.0}])
    assert risk["var_95_daily_inr"] > 0


def test_ui_terminal_adapter():
    """Verifies UITerminalAdapter formats rich panels and tables for terminal rendering."""
    adapter = UITerminalAdapter()
    
    # Ticker Tape
    tape = adapter.build_ticker_tape_panel()
    assert tape is not None

    # Quote Table
    q_tbl = adapter.build_quote_table("RELIANCE")
    assert q_tbl is not None
    assert "RELIANCE" in q_tbl.title

    # DCF Table
    dcf_tbl = adapter.build_dcf_valuation_table("RELIANCE")
    assert dcf_tbl is not None

    # Macro Table
    macro_tbl = adapter.build_sovereign_macro_table()
    assert macro_tbl is not None

    # Risk Table
    risk_tbl = adapter.build_portfolio_risk_table([{"ticker": "RELIANCE", "weight": 1.0}])
    assert risk_tbl is not None
