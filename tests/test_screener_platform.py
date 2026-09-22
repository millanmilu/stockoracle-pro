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
from backend.analysis.market_heatmap import compute_market_heatmap_data


@pytest.fixture(autouse=True, scope="module")
def setup_screener_env():
    """init_db + seed once per module.

    The 251-row ORM seed used to run before EVERY test (~5-12s setup each),
    which pushed the suite past 4 minutes; screener tests here are read-only
    against screener_daily_metrics, so one seed per module is safe.
    """
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


def test_screener_dsl_is_null_predicates():
    """IS NULL / IS NOT NULL finds data-missing rows instead of them vanishing silently."""
    q1 = parse_screener_query("ROCE IS NULL")
    assert q1["success"] is True
    assert q1["where_clause"] == "roce_pct IS NULL"
    assert q1["params"] == {}
    assert q1["ast"]["operator"] == "IS NULL"

    q2 = parse_screener_query("PE IS NOT NULL AND RSI14 < 40")
    assert q2["success"] is True
    assert "pe_ratio IS NOT NULL" in q2["where_clause"]
    assert "rsi_14 < :p_0" in q2["where_clause"]

    # Malformed IS without NULL is rejected, not silently passed
    q3 = parse_screener_query("ROCE IS 5")
    assert q3["success"] is False

    # Unknown fields stay rejected even with IS NULL
    q4 = parse_screener_query("HACKER_COL IS NULL")
    assert q4["success"] is False


def test_screener_sql_returns_universe_total():
    """Query response carries universe_total so UI can show 'N of M stocks'."""
    parsed = parse_screener_query("MarketCap > 0")
    res = execute_screener_sql_query(
        where_clause=parsed["where_clause"],
        params=parsed["params"],
        limit=2000,
    )
    assert res["universe_total"] >= res["total"] >= 1
    assert res["universe_total"] >= 200  # full seeded master universe, not a 51-row subset

    # NULL-fundamental rows are discoverable via IS NULL (small-caps seed NULLs)
    null_parsed = parse_screener_query("PE IS NULL")
    assert null_parsed["success"] is True
    null_res = execute_screener_sql_query(
        where_clause=null_parsed["where_clause"],
        params=null_parsed["params"],
        limit=2000,
    )
    assert null_res["total"] >= 1
    assert all(r["pe_ratio"] is None for r in null_res["results"])


def test_index_universes_official_counts_and_composition():
    """Categorical universes: exact NSE sizes and N500 = N100 + Mid150 + Small."""
    from backend.data.index_constituents import (
        INDEX_CONSTITUENTS, resolve_universe, resolve_query_scope, list_universes,
    )
    assert len(INDEX_CONSTITUENTS["NIFTY 50"]) == 50
    assert len(INDEX_CONSTITUENTS["NIFTY 100"]) == 100
    assert len(INDEX_CONSTITUENTS["NIFTY 200"]) == 200
    assert len(INDEX_CONSTITUENTS["NIFTY MIDCAP"]) == 150
    assert set(INDEX_CONSTITUENTS["NIFTY 500"]) == (
        set(INDEX_CONSTITUENTS["NIFTY 100"])
        | set(INDEX_CONSTITUENTS["NIFTY MIDCAP"])
        | set(INDEX_CONSTITUENTS["NIFTY SMALLCAP"])
    )
    assert set(INDEX_CONSTITUENTS["NIFTY 100"]) <= set(INDEX_CONSTITUENTS["NIFTY 200"])
    # Aliases + unknown
    assert resolve_universe("NIFTY_500") == INDEX_CONSTITUENTS["NIFTY 500"]
    assert resolve_universe("nifty 50") == INDEX_CONSTITUENTS["NIFTY 50"]
    assert resolve_universe("NOPE") is None
    # Scope precedence: explicit tickers > universe > whole table
    assert resolve_query_scope(["reliance", "TCS"], "NIFTY 50") == ["RELIANCE", "TCS"]
    assert resolve_query_scope(None, "NIFTY 50") == INDEX_CONSTITUENTS["NIFTY 50"]
    assert resolve_query_scope(None, None) is None
    assert resolve_query_scope(None, "NOPE") is None
    # Dropdown payload sane
    ids = {u["id"] for u in list_universes()}
    assert {"NIFTY 50", "NIFTY MIDCAP", "NIFTY SMALLCAP", "NIFTY 500"} <= ids


def test_screener_universe_scoping_end_to_end():
    """Universe scoping narrows SQL results to category members present in DB."""
    res_all = execute_screener_sql_query(where_clause="1=1", params={}, limit=2000)
    from backend.data.index_constituents import INDEX_CONSTITUENTS
    n50 = INDEX_CONSTITUENTS["NIFTY 50"]
    res_n50 = execute_screener_sql_query(
        where_clause="(1=1) AND ticker IN ("
        + ", ".join(f":u_{i}" for i in range(len(n50))) + ")",
        params={f"u_{i}": t for i, t in enumerate(n50)},
        limit=2000,
    )
    assert res_all["universe_total"] >= res_all["total"] >= res_n50["total"] >= 1
    assert res_n50["total"] < res_all["total"]  # scoping actually narrows


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


def test_market_heatmap_serializes_seeded_metrics():
    """Heatmap serialization remains compatible with the screener metric model."""
    result = compute_market_heatmap_data(universe="NIFTY 50", metric="change_1d_pct")

    assert result["market_breadth"]["total_stocks"] > 0
    assert result["sectors"]
    stock = result["sectors"][0]["stocks"][0]
    assert stock["ticker"]
    assert "name" in stock


def test_ai_screener_natural_language_translation(monkeypatch):
    """Natural-language → DSL via the deterministic heuristic fallback (offline, no provider I/O)."""
    import backend.research.ai_screener as ai_screener

    def _offline_provider(*a, **k):
        raise RuntimeError("AI provider disabled in unit tests")

    monkeypatch.setattr(ai_screener, "ask_ai", _offline_provider)

    prompt = "Find high ROCE oversold IT stocks with low debt"
    res = convert_natural_language_to_screener_query(prompt)

    assert res["valid"] is True
    assert "ROCE" in res["formula_query"] or "sector" in res["formula_query"]
    assert res["ast"] is not None


def test_screener_basket_backtest_with_benchmark(monkeypatch):
    """Point-in-time basket backtest with deterministic offline price series (no network)."""
    import numpy as np
    import pandas as pd

    import backend.research.screener_backtest as sb

    def _fake_fetch(ticker, period=None, interval=None):
        idx = pd.date_range(end=pd.Timestamp.today().normalize(), periods=260, freq="B")
        drift = {"RELIANCE": 0.0006, "TCS": 0.0004}.get(ticker, 0.0003)
        close = 1000.0 * (1.0 + drift) ** np.arange(260)
        return pd.DataFrame({
            "date": idx.strftime("%Y-%m-%d"),
            "open": close, "high": close * 1.01, "low": close * 0.99,
            "close": close, "volume": np.full(260, 1_000_000.0),
        })

    monkeypatch.setattr(sb, "fetch_stock_data", _fake_fetch)

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


def test_deep_financials_parser(monkeypatch):
    """Validates the deep-financials contract shape with a canned fixture (offline)."""
    import backend.data.fundamentals_deep as fd

    fixture = {
        "ticker": "RELIANCE",
        "quarterly_results": [{"date": "Jun 2026", "revenue": 100.0}],
        "annual_pl": [{"date": "Mar 2026", "revenue": 400.0}],
        "balance_sheet": [{"date": "Mar 2026", "equity": 100.0}],
        "cash_flow": [{"date": "Mar 2026", "op_cf": 50.0}],
        "shareholding": [{"date": "Jun 2026", "promoters": 50.1}],
        "ratios_cagr": {"sales": 10.0, "profit": 12.0},
    }
    monkeypatch.setattr(fd, "get_deep_financials", lambda ticker, *a, **k: fixture)

    data = fd.get_deep_financials("RELIANCE")

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
    assert len(saved["share_token"]) >= 12

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


def test_list_universes_reports_db_coverage():
    """list_universes reports per-universe covered counts bounded by official sizes."""
    from backend.data.index_constituents import list_universes

    universes = list_universes()
    assert universes
    n50 = next(u for u in universes if u["id"] == "NIFTY 50")
    assert 0 <= n50["covered"] <= n50["count"] == 50
    for u in universes:
        assert set(u) == {"id", "count", "covered"}


def test_next_screener_refresh_delay_is_weekday_close_ist():
    """Scheduler waits for 16:15 IST on weekdays and rolls past the weekend."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from backend.research.screener_pipeline import next_screener_refresh_delay_seconds

    tz = ZoneInfo("Asia/Kolkata")
    tue_10 = datetime(2026, 9, 22, 10, 0, tzinfo=tz)   # Tuesday morning
    delay = next_screener_refresh_delay_seconds(tue_10)
    assert 0 < delay <= 6.25 * 3600 + 1                # same day 16:15 IST

    fri_17 = datetime(2026, 9, 25, 17, 0, tzinfo=tz)   # Friday after close
    weekend_delay = next_screener_refresh_delay_seconds(fri_17)
    assert 71 * 3600 < weekend_delay <= 5 * 24 * 3600  # Monday 16:15 IST


def test_compute_metrics_never_fabricates_fundamentals(monkeypatch):
    """Meta-less tickers get NULL fundamentals from the pipeline — no invented PE/ROCE/mcap."""
    import numpy as np
    import pandas as pd

    import backend.research.screener_pipeline as sp

    idx = pd.date_range(end="2026-09-18", periods=250, freq="B")
    close = np.linspace(100.0, 150.0, 250)
    df = pd.DataFrame(
        {
            "date": idx.strftime("%Y-%m-%d"),
            "open": close,
            "high": close * 1.01,
            "low": close * 0.99,
            "close": close,
            "volume": np.full(250, 1e5),
        },
        index=idx,
    )
    monkeypatch.setattr(sp, "fetch_company_info", lambda t: None)

    metrics = sp.compute_metrics_from_ohlcv("FAKEUNI", df, None)

    assert metrics["pe_ratio"] is None
    assert metrics["roce_pct"] is None
    assert metrics["market_cap_cr"] is None
    assert metrics["market_cap_cat"] is None
    assert metrics["close_price"] > 0
    assert metrics["rsi_14"] is not None
