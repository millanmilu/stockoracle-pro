"""
StockOracle Pro — cursor-based older-history window tests (chart left-pan backfill).

Offline-safe: seeds SQLite directly and never touches broker/Binance paths
(DB-full fast paths serve without network).
"""
import pytest
from datetime import datetime, timedelta

from backend.data.database import init_db, save_intraday_candles, save_historical_prices
from backend.data.fetcher import (
    fetch_history_window,
    cursor_chunk_limit,
    parse_cursor_before,
    CURSOR_MIN_LIMIT,
    CURSOR_MAX_LIMIT,
)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Stub broker session so short-window paths never touch the network."""
    import backend.data.fetcher as fetcher_mod
    monkeypatch.setattr(fetcher_mod, "ensure_session", lambda *a, **k: None)
    monkeypatch.setattr(fetcher_mod, "_session_active", False)
    monkeypatch.setattr(fetcher_mod, "get_token_info", lambda *a, **k: None)


def _seed_intraday(ticker, start="2026-09-01 09:15:00", n=100, step_min=5):
    import pandas as pd
    base = datetime.strptime(start, "%Y-%m-%d %H:%M:%S")
    rows = []
    for i in range(n):
        ts = (base + timedelta(minutes=i * step_min)).strftime("%Y-%m-%d %H:%M:%S")
        o = 100.0 + i * 0.1
        rows.append({"date": ts, "open": o, "high": o + 1, "low": o - 1,
                     "close": o + 0.5, "volume": 1000 + i})
    save_intraday_candles(ticker, "5m", pd.DataFrame(rows))
    return [r["date"] for r in rows]


def _seed_daily(ticker, start="2026-01-01", n=120):
    import pandas as pd
    base = datetime.strptime(start, "%Y-%m-%d")
    rows = []
    for i in range(n):
        d = (base + timedelta(days=i)).strftime("%Y-%m-%d")
        o = 200.0 + i
        rows.append({"date": d, "open": o, "high": o + 2, "low": o - 2,
                     "close": o + 1, "volume": 5000})
    save_historical_prices(ticker, pd.DataFrame(rows))
    return [r["date"] for r in rows]


def test_chunk_limits_timeframe_aware():
    assert cursor_chunk_limit("1s") == 300
    assert cursor_chunk_limit("1m") == 3000
    assert cursor_chunk_limit("5m") == 3000
    assert cursor_chunk_limit("1h") == 2000
    assert cursor_chunk_limit("4h") == 1500
    assert cursor_chunk_limit("1d") == 1000
    assert cursor_chunk_limit("1m", 10) == CURSOR_MIN_LIMIT
    assert cursor_chunk_limit("1m", 99999) == CURSOR_MAX_LIMIT
    assert cursor_chunk_limit("1m", 750) == 750


def test_parse_cursor_before():
    dt = parse_cursor_before("2026-09-01")
    assert dt is not None and (dt.year, dt.month, dt.day) == (2026, 9, 1)
    dt2 = parse_cursor_before("2026-09-01 09:15:00")
    assert dt2 is not None and dt2.hour == 9 and dt2.minute == 15
    dt3 = parse_cursor_before(1756684800)
    assert dt3 is not None and dt3.tzinfo is not None
    assert parse_cursor_before("bogus") is None
    assert parse_cursor_before(None) is None
    assert parse_cursor_before("1d") is None  # timeframe labels are not cursors


def test_intraday_window_strictly_older_ordered_capped():
    ticker = "CURSORTEST"
    stamps = _seed_intraday(ticker)
    before = stamps[80]
    win = fetch_history_window(ticker, interval="5m", before=before, limit=60)
    assert win is not None and len(win) == 60
    dates = list(win["date"])
    assert dates == sorted(dates)  # oldest → newest
    assert all(d < before for d in dates)  # strictly older, no dupes of edge
    assert dates[-1] == stamps[79]
    assert dates[0] == stamps[20]


def test_intraday_window_short_when_history_runs_out():
    ticker = "CURSORTEST2"
    stamps = _seed_intraday(ticker, n=30)
    win = fetch_history_window(ticker, interval="5m", before=stamps[10], limit=60)
    assert win is not None and len(win) == 10  # only 10 older exist → caller marks exhausted
    assert all(d < stamps[10] for d in win["date"])


def test_intraday_window_empty_before_oldest():
    ticker = "CURSORTEST3"
    stamps = _seed_intraday(ticker, n=30)
    assert fetch_history_window(ticker, interval="5m", before=stamps[0], limit=60) is None


def test_daily_window_strictly_older():
    ticker = "CURSORDAILY"
    stamps = _seed_daily(ticker)
    before = stamps[100]
    win = fetch_history_window(ticker, interval="1d", before=before, limit=50)
    assert win is not None and len(win) == 50
    dates = list(win["date"])
    assert dates == sorted(dates)
    assert all(len(d) == 10 for d in dates)  # IST daily invariant: YYYY-MM-DD
    assert all(d < before for d in dates)
    assert dates[-1] == stamps[99]
    assert dates[0] == stamps[50]


def test_window_rejects_bad_input():
    assert fetch_history_window("ANY", interval="5m", before="bogus", limit=20) is None
    assert fetch_history_window("ANY", interval="3m", before="2026-09-01", limit=20) is None
    assert fetch_history_window("ANY", interval="5m", before=None, limit=20) is None
