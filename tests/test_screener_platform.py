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
    delete_user_screen_query,
    upsert_screener_daily_metric,
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
    # A meta-less row must not invent a sector taxonomy either: "Diversified"
    # used to be stamped on 382 of 633 rows and became the rotation chart's
    # largest "sector" while mixing unrelated industries.
    assert metrics["sector"] is None


# ── No-op sentinel & card/click consistency ─────────────────────────────────

def test_screener_no_op_sentinel_means_everything():
    """`ALL` / `1=1` / empty must compile to a true no-op and return the whole table.

    "Show everything" used to be faked with `MarketCap > 0`, which silently
    dropped every row whose market cap is unknown (382 of 633 in practice) while
    the UI advertised "All NSE Equities".
    """
    from backend.research.screener_dsl import is_no_op_query

    for literal in ("", "   ", "1=1", "ALL", "all", "ANY", "*"):
        parsed = parse_screener_query(literal)
        assert parsed["success"] is True, literal
        assert parsed["where_clause"] == "1=1", literal
        assert parsed["ast"] == {"type": "ALL"}, literal
        assert is_no_op_query(literal) is True, literal

    # A no-op composes, and a real filter is never mistaken for one.
    assert parse_screener_query("ALL AND ROCE > 20")["success"] is True
    assert is_no_op_query("MarketCap > 0") is False

    whole = execute_screener_sql_query("1=1", {}, limit=5000)
    assert whole["total"] == whole["universe_total"]
    assert whole["total"] >= 200

    # The old fake no-op really was a filter — this is the regression guard.
    capped = parse_screener_query("MarketCap > 0")
    capped_res = execute_screener_sql_query(capped["where_clause"], capped["params"], limit=5000)
    assert capped_res["total"] <= whole["total"]


def test_total_card_count_matches_its_own_click():
    """The TOTAL card must not display a different number than clicking it returns.

    It showed 633 while clicking ran `MarketCap > 0` and returned 251.
    compute_overview_cards documents this invariant for every card; this pins the
    one card whose DSL was null.
    """
    from backend.data.database import get_screener_overview_stats

    stats = get_screener_overview_stats()
    total_card = stats["cards"]["total"]

    parsed = parse_screener_query("ALL")
    res = execute_screener_sql_query(parsed["where_clause"], parsed["params"], limit=5000)

    assert total_card == res["total"] == res["universe_total"]
    assert stats["coverage"]["total"] == total_card


# ── Never fabricate a price / coverage flag ────────────────────────────────

def test_upsert_never_writes_a_placeholder_price():
    """A row with no known price stores NULL, and its data_status says so.

    The upsert used to do `close_price or 100.0` against a NOT NULL column, so
    200 seeded rows rendered a fabricated ₹100.00 quote in the Price column.
    """
    from sqlalchemy import text as _text

    from backend.data.database import upsert_screener_daily_metric
    from backend.shared.database import get_db_session

    ticker = "__ZTEST_NO_PRICE__"

    def _read():
        with get_db_session() as session:
            return session.execute(
                _text("SELECT close_price, data_status FROM screener_daily_metrics WHERE ticker = :t"),
                {"t": ticker},
            ).mappings().first()

    try:
        upsert_screener_daily_metric({"ticker": ticker, "name": "Placeholder Test", "sector": "Testing"})
        row = _read()
        assert row is not None
        assert row["close_price"] is None, "missing price must stay NULL, never a placeholder"
        assert row["data_status"] == "NO_DATA"

        # A non-positive price is not a quote either.
        upsert_screener_daily_metric({"ticker": ticker, "name": "Placeholder Test", "close_price": 0})
        assert _read()["close_price"] is None
    finally:
        with get_db_session() as session:
            session.execute(_text("DELETE FROM screener_daily_metrics WHERE ticker = :t"), {"t": ticker})

    # And no legacy placeholder price survives anywhere in the table.
    with get_db_session() as session:
        legacy = session.execute(
            _text(
                "SELECT COUNT(*) FROM screener_daily_metrics "
                "WHERE close_price = 100.0 AND rsi_14 IS NULL"
            )
        ).scalar()
    assert int(legacy or 0) == 0


def test_derive_screener_data_status_distinguishes_all_three_states():
    """OK / PARTIAL / NO_DATA follow real coverage, not a hardcoded "OK".

    data_status used to read "OK" on all 633 rows, including 200 with a
    fabricated price and no indicators at all.
    """
    from backend.research.screener_engines import derive_screener_data_status as derive

    full = {
        "close_price": 100.0, "rsi_14": 50.0, "sma_20": 99.0, "sma_50": 98.0,
        "sma_200": 90.0, "volume_ratio_20d": 1.2,
        "pe_ratio": 20.0, "roe_pct": 15.0, "roce_pct": 18.0, "debt_to_equity": 0.4,
    }
    assert derive(full) == "OK"
    assert derive({**full, "pe_ratio": None}) == "PARTIAL"
    assert derive({**full, "close_price": None}) == "NO_DATA"
    assert derive({**full, "rsi_14": None}) == "NO_DATA"
    assert derive({}) == "NO_DATA"


# ── Aggregators must not read NULL as a neutral observation ─────────────────

def test_sector_rotation_refuses_to_plot_unmeasured_sectors():
    """Empty sectors produce no bar and no identical composite fingerprint.

    Substituting 0.0 / 50.0 / 1.0 for missing inputs made 24 of 40 sectors report
    the exact same `-11.8` composite.
    """
    from backend.research.screener_engines import compute_sector_rotation, compute_sector_exclusions

    blank = {
        "close_price": None, "rsi_14": None, "change_1d_pct": None,
        "ai_consensus_score": None, "ai_signal": None,
        "volume_ratio_20d": None, "sma_50": None,
    }
    rows = (
        [{"ticker": f"C{i}", "sector": "Chemicals", **blank} for i in range(4)]
        + [{"ticker": f"T{i}", "sector": "Textiles", **blank} for i in range(4)]
        + [{"ticker": f"D{i}", "sector": "Diversified", **blank} for i in range(4)]
    )

    assert compute_sector_rotation(rows) == []
    excluded = compute_sector_exclusions(rows)
    # Chemicals and Textiles are real sectors of measurable size that simply
    # have nothing computed — excluded, and counted so the UI can say so.
    assert excluded["no_data_sectors"] == 2
    assert excluded["no_data_stocks"] == 8
    # "Diversified" is a placeholder label, not a sector: those rows are
    # unclassified rather than forming a 4-stock "sector".
    assert excluded["unclassified"] == 4
    assert excluded["unclassified_placeholder_label"] == 4

    # Opting in surfaces the unmeasured sectors with an explicit no-data status
    # instead of a neutral composite.
    verbose = compute_sector_rotation(rows, include_unmeasured=True)
    assert len(verbose) == 2
    assert all(s["composite"] is None and s["quadrant"] == "No Data" for s in verbose)
    assert all(s["data_status"] == "NO_DATA" for s in verbose)

    # With measured data the sector appears, and two disjoint sectors never
    # share the identical neutral composite.
    measured = {
        "close_price": 110.0, "sma_50": 100.0, "change_1d_pct": 1.5,
        "ai_consensus_score": 62.0, "ai_signal": "BUY", "volume_ratio_20d": 1.4,
    }
    rows2 = [{"ticker": f"A{i}", "sector": "Auto", **measured} for i in range(3)] + [
        {"ticker": f"P{i}", "sector": "Pharma", **measured} for i in range(3)
    ]
    out = compute_sector_rotation(rows2)
    assert {s["sector"] for s in out} == {"Auto", "Pharma"}
    assert len({s["composite"] for s in out}) == 1  # identical inputs -> identical output
    assert all(s["composite"] is not None for s in out)

    # A sector too small to read is excluded and counted.
    tiny = [{"ticker": "Z1", "sector": "Paper", **measured}]
    assert compute_sector_rotation(tiny) == []
    assert compute_sector_exclusions(tiny)["below_min_sectors"] == 1


def test_market_breadth_reports_missing_change_as_no_data():
    """Rows without a computed change are `no_data`, not `unchanged`."""
    from backend.research.screener_engines import compute_market_breadth

    rows = [
        {"change_1d_pct": 1.0, "rsi_14": 55.0, "close_price": 100.0, "sma_20": 90.0,
         "sma_50": 90.0, "sma_200": 90.0, "ai_signal": "BUY", "ai_consensus_score": 60.0},
        {"change_1d_pct": -1.0, "rsi_14": 45.0, "close_price": 100.0, "sma_20": 110.0,
         "sma_50": 110.0, "sma_200": 110.0, "ai_signal": "AVOID", "ai_consensus_score": 40.0},
        {"change_1d_pct": None, "rsi_14": None, "close_price": None,
         "ai_signal": None, "ai_consensus_score": None},
    ]
    b = compute_market_breadth(rows)

    assert b["advancing"] == 1
    assert b["declining"] == 1
    assert b["unchanged"] == 0, "a NULL change must not be counted as unchanged"
    assert b["no_data"] == 1
    assert b["advancing"] + b["declining"] + b["unchanged"] + b["no_data"] == b["total"]
    # Percentages are over rows that have a signal, not over the tracked universe.
    assert b["bullish_pct"] == 50.0
    assert b["signals_available"] == 2
    assert b["above_ema20_pct"] == 50.0   # 1 of 2 rows with both price and SMA


def test_screener_stale_flag_uses_median_covered_row():
    """Freshness is judged on the median covered row, not the newest one.

    A single row rewritten by the seeder used to make a nine-day-old table look
    current.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from backend.research.screener_pipeline import (
        expected_last_screener_refresh, screener_metrics_are_stale,
    )

    tz = ZoneInfo("Asia/Kolkata")
    monday_evening = datetime(2026, 9, 28, 20, 0, tzinfo=tz)   # Monday, past 16:15
    monday_morning = datetime(2026, 9, 28, 10, 0, tzinfo=tz)   # Monday, before 16:15
    sunday = datetime(2026, 9, 27, 12, 0, tzinfo=tz)

    assert expected_last_screener_refresh(monday_evening) == "2026-09-28"
    assert expected_last_screener_refresh(monday_morning) == "2026-09-25"  # Friday
    assert expected_last_screener_refresh(sunday) == "2026-09-25"          # Friday

    assert screener_metrics_are_stale("2026-09-19", monday_evening) is True
    assert screener_metrics_are_stale("2026-09-28", monday_evening) is False
    assert screener_metrics_are_stale(None, monday_evening) is True


def test_sector_needs_enough_MEASURED_stocks_not_just_rows():
    """A sector's bar must not be ranked from a handful of its rows.

    `"Finance"` had 15 tracked rows but only 2 with data, and those 2 were enough
    to rank the whole sector — a bar labelled 15 stocks whose composite came from
    2 of them. The threshold has to count measured rows.
    """
    from backend.research.screener_engines import (
        compute_sector_rotation, compute_sector_exclusions,
    )

    def row(i, measured):
        base = {"ticker": f"F{i}", "sector": "Finance"}
        if measured:
            base.update({"close_price": 100.0 + i, "sma_50": 95.0,
                         "change_1d_pct": 1.0, "ai_consensus_score": 70.0,
                         "volume_ratio_20d": 1.2, "ai_signal": "BUY"})
        return base

    # 15 tracked rows, only 2 of them measured.
    thin = [row(i, measured=i < 2) for i in range(15)]
    assert compute_sector_rotation(thin) == [], \
        "a 2-of-15 sector is noise, not rotation"

    # It must also be ACCOUNTED for, never silently dropped from the chart.
    exclusions = compute_sector_exclusions(thin)
    assert exclusions["below_measured_sectors"] == 1
    assert exclusions["below_measured_stocks"] == 15

    # Four measured rows do clear the bar, and the count is exposed.
    enough = [row(i, measured=i < 4) for i in range(15)]
    plotted = compute_sector_rotation(enough)
    assert len(plotted) == 1
    assert plotted[0]["stocks"] == 15
    assert plotted[0]["stocks_measured"] == 4


def test_overview_reports_coverage_and_exclusions():
    """The overview payload states coverage and what the sector chart refuses to plot."""
    from backend.data.database import get_screener_overview_stats

    stats = get_screener_overview_stats()
    cov = stats["coverage"]

    assert cov["total"] == cov["ok"] + cov["partial"] + cov["no_data"]
    assert cov["priced"] <= cov["total"]
    assert cov["with_fundamentals"] <= cov["priced"]
    assert stats["metrics_as_of"] is not None

    excluded = stats["sectors_excluded"]
    assert excluded is not None
    assert excluded["min_stocks"] >= 2
    # Sectors drawn + rows explicitly excluded can never exceed the table.
    assert sum(s["stocks"] for s in stats["sectors"]) + excluded["unclassified"] <= cov["total"]
    # Every plotted sector is measured; none carries the old neutral default.
    for sec in stats["sectors"]:
        assert sec["composite"] is not None
        assert sec["quadrant"] != "No Data"


# ── Screener upsert must not be destructive ──────────────────────────────────
#
# The upsert used to blind-overwrite every base column with whatever the caller
# passed, and every base column is always present in the payload (None when the
# caller had no value). Any partial write therefore erased good stored data.

_MERGE_TEST_TICKER = "ZZMERGETEST"


@pytest.fixture
def merge_row():
    """A throwaway row so the real universe is never touched."""
    from backend.shared.database import get_db_session
    from backend.shared.models import ScreenerDailyMetric
    from sqlalchemy import delete

    def _drop():
        with get_db_session() as session:
            session.execute(delete(ScreenerDailyMetric).where(
                ScreenerDailyMetric.ticker == _MERGE_TEST_TICKER))

    _drop()
    yield _MERGE_TEST_TICKER
    _drop()


def _read_screener_row(ticker):
    from backend.shared.database import get_db_session
    from backend.shared.models import ScreenerDailyMetric
    from sqlalchemy import select

    with get_db_session() as session:
        row = session.execute(select(ScreenerDailyMetric).where(
            ScreenerDailyMetric.ticker == ticker)).scalar_one_or_none()
        if row is None:
            return None
        return {c.name: getattr(row, c.name) for c in ScreenerDailyMetric.__table__.columns}


def test_partial_write_never_erases_stored_fundamentals(merge_row):
    """A payload that only carries price must not NULL the pe/roe/roce already stored.

    This is what made every backfill destructive: refreshing a row whose
    fundamentals could not be fetched wiped the fundamentals it already had.
    """
    upsert_screener_daily_metric({
        "ticker": merge_row, "name": "Merge Test Ltd", "sector": "Chemicals",
        "close_price": 500.0, "pe_ratio": 25.0, "pb_ratio": 4.0,
        "roe_pct": 18.0, "roce_pct": 22.0, "debt_to_equity": 0.3,
        "market_cap_cr": 12000.0,
    })
    before = _read_screener_row(merge_row)
    assert before["pe_ratio"] == 25.0 and before["roce_pct"] == 22.0

    # OHLCV-only refresh: no fundamentals in the payload at all.
    upsert_screener_daily_metric({
        "ticker": merge_row, "name": merge_row, "close_price": 510.0,
        "rsi_14": 55.0,
    })
    after = _read_screener_row(merge_row)

    assert after["close_price"] == 510.0, "a real new value must land"
    assert after["rsi_14"] == 55.0, "a real new value must land"
    assert after["pe_ratio"] == 25.0, "missing pe must not erase the stored one"
    assert after["roce_pct"] == 22.0
    assert after["roe_pct"] == 18.0
    assert after["debt_to_equity"] == 0.3
    assert after["market_cap_cr"] == 12000.0
    assert after["sector"] == "Chemicals", "sector must survive a payload without one"
    assert after["name"] == "Merge Test Ltd", "ticker-as-name must not overwrite a real name"


def test_placeholder_sector_never_overwrites_a_real_one(merge_row):
    """'Diversified' is what the pipeline writes when it has no classification."""
    upsert_screener_daily_metric({
        "ticker": merge_row, "name": "Merge Test Ltd", "sector": "Pharmaceuticals",
        "close_price": 100.0,
    })
    upsert_screener_daily_metric({
        "ticker": merge_row, "name": "Merge Test Ltd", "sector": "Diversified",
        "close_price": 101.0,
    })
    row = _read_screener_row(merge_row)
    assert row["sector"] == "Pharmaceuticals"
    assert row["close_price"] == 101.0


def test_clear_fields_is_the_only_way_to_remove_a_value(merge_row):
    """Absent and known-wrong are different: a gap-fill must not remove, and a
    repair pass must be able to.

    Without this, a label an earlier pass wrote on a wrong basis stayed on the
    row forever, so the sector chart kept drawing a bar from a stale guess.
    """
    upsert_screener_daily_metric({
        "ticker": merge_row, "name": "Merge Test Ltd", "sector": "Chemicals",
        "close_price": 100.0,
    })

    # A payload without a sector may not remove it...
    upsert_screener_daily_metric({"ticker": merge_row, "close_price": 101.0})
    assert _read_screener_row(merge_row)["sector"] == "Chemicals"

    # ...but naming it explicitly may.
    upsert_screener_daily_metric({"ticker": merge_row},
                                 clear_fields=["sector"])
    row = _read_screener_row(merge_row)
    assert row["sector"] is None
    assert row["close_price"] == 101.0, "clearing one field must not touch another"
    assert row["name"] == "Merge Test Ltd"


def test_data_status_reflects_the_merged_row(merge_row):
    """Status is derived after merging, so a gap-fill write can only improve it."""
    full_fundamentals = {
        "close_price": 500.0, "rsi_14": 50.0, "sma_20": 495.0, "sma_50": 490.0,
        "sma_200": 470.0, "volume_ratio_20d": 1.1,
        "pe_ratio": 20.0, "roe_pct": 15.0, "roce_pct": 18.0, "debt_to_equity": 0.4,
    }
    upsert_screener_daily_metric({
        "ticker": merge_row, "name": "Merge Test Ltd", "sector": "Chemicals",
        **full_fundamentals,
    })
    assert _read_screener_row(merge_row)["data_status"] == "OK"

    # Fundamentals-only refresh after losing the price: the stored price must be
    # reused, so the row stays OK instead of dropping to NO_DATA.
    upsert_screener_daily_metric({
        "ticker": merge_row, "name": "Merge Test Ltd", "sector": "Chemicals",
        "close_price": None, "pe_ratio": 21.0,
    })
    row = _read_screener_row(merge_row)
    assert row["pe_ratio"] == 21.0
    assert row["close_price"] == 500.0
    assert row["data_status"] == "OK"
