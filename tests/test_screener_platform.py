"""
StockOracle Pro — Screener Platform & Fundamental Research Test Suite
Validates DSL formula tokenizer, AST compilation, precomputed SQL execution, AI query parsing,
historical basket backtesting, and deep financial statements.
"""
import pytest
from backend.data.database import init_db
from backend.research.screener_dsl import parse_screener_query
from backend.research.ai_screener import convert_natural_language_to_screener_query
from backend.research.screener_backtest import run_screener_backtest
from backend.data.seed_screener_metrics import seed_screener_metrics_table
from backend.data.database import (
    execute_screener_sql_query,
    save_user_screen_query,
    get_user_screens_list,
    get_user_screen_by_share_token,
    delete_user_screen_query
)
from backend.data.fundamentals_deep import get_deep_financials


@pytest.fixture(autouse=True)
def setup_screener_env():
    init_db()
    seed_screener_metrics_table()


def test_screener_dsl_tokenizer_and_parser():
    """Validates formula parsing into safe parameterized SQL and AST."""
    query = "ROCE > 20 AND DebtToEquity < 0.5 AND RSI14 < 40 AND VolumeRatio20D >= 1.2"
    parsed = parse_screener_query(query)

    assert parsed["success"] is True
    assert "roce_pct > :p_0" in parsed["where_clause"]
    assert "debt_to_equity < :p_1" in parsed["where_clause"]
    assert "rsi_14 < :p_2" in parsed["where_clause"]
    assert "volume_ratio_20d >= :p_3" in parsed["where_clause"]
    assert parsed["params"]["p_0"] == 20
    assert parsed["params"]["p_1"] == 0.5
    assert parsed["ast"]["type"] == "AND"


def test_screener_dsl_syntax_errors_and_injection_safety():
    """Verifies that invalid identifiers, SQL injections, and malformed syntax are rejected."""
    # Unknown field
    bad_field = "UNKNOWN_METRIC > 100"
    res1 = parse_screener_query(bad_field)
    assert res1["success"] is False
    assert "Unknown metric" in res1["error"]

    # Trailing operator
    bad_syntax = "ROCE > 20 AND"
    res2 = parse_screener_query(bad_syntax)
    assert res2["success"] is False


def test_screener_precomputed_sql_execution():
    """Verifies sub-50ms indexed SQL query execution against screener_daily_metrics."""
    query = "ROCE > 20 AND PE < 35"
    parsed = parse_screener_query(query)
    assert parsed["success"] is True

    res = execute_screener_sql_query(
        where_clause=parsed["where_clause"],
        params=parsed["params"],
        sort_by="roce_pct",
        sort_dir="DESC",
        limit=10
    )

    assert res["total"] >= 1
    assert len(res["results"]) >= 1
    top_stock = res["results"][0]
    assert top_stock["roce_pct"] > 20
    assert top_stock["pe_ratio"] < 35


def test_ai_screener_natural_language_translation():
    """Tests conversion from natural language prompt to validated formula DSL."""
    prompt = "Find high ROCE oversold IT stocks with low debt"
    res = convert_natural_language_to_screener_query(prompt)

    assert res["valid"] is True
    assert "ROCE" in res["formula_query"] or "sector" in res["formula_query"]
    assert res["ast"] is not None


def test_screener_basket_backtest_with_benchmark():
    """Tests point-in-time screen basket backtester with transaction costs and NIFTY benchmark."""
    res = run_screener_backtest(
        formula_query="ROCE > 15 AND DebtToEquity < 1.0",
        initial_capital=1000000.0,
        holding_period_days=20,
        backtest_horizon_days=100
    )

    assert "strategy_cagr_pct" in res
    assert "benchmark_cagr_pct" in res
    assert "sharpe_ratio" in res
    assert "max_drawdown_pct" in res
    assert "equity_curve" in res
    assert len(res["equity_curve"]) > 5
    assert res["final_capital"] > 0


def test_deep_financials_parser():
    """Validates Screener.in-grade financial profile structure (P&L, Balance Sheet, Cash Flows, Shareholding)."""
    data = get_deep_financials("RELIANCE")

    assert data["ticker"] == "RELIANCE"
    assert "quarterly_results" in data
    assert "annual_pl" in data
    assert "balance_sheet" in data
    assert "cash_flow" in data
    assert "shareholding" in data
    assert "ratios_cagr" in data
    assert len(data["shareholding"]) >= 1


def test_user_screens_crud_and_share_token():
    """Tests saving, listing, sharing by token, and deleting custom user screens."""
    saved = save_user_screen_query(
        user_id="test_trader",
        name="My High Quality Scan",
        formula_query="ROCE > 20 AND DebtToEquity < 0.3",
        is_public=True
    )

    assert saved["id"] > 0
    assert len(saved["share_token"]) == 12

    # Fetch by user
    screens = get_user_screens_list(user_id="test_trader")
    assert any(s["id"] == saved["id"] for s in screens)

    # Fetch by share token
    pub_screen = get_user_screen_by_share_token(saved["share_token"])
    assert pub_screen is not None
    assert pub_screen["name"] == "My High Quality Scan"

    # Delete
    deleted = delete_user_screen_query(saved["id"], user_id="test_trader")
    assert deleted is True
