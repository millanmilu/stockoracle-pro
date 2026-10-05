"""
StockOracle Pro — intraday stale-SQLite fallback regression tests.

Reproduces the "previous data 404" bug: when the Angel One session is down
(login/DNS failure) or the fetch returns nothing, fetch_stock_data() used to
fall through to `return None` for intraday intervals — because the step-4
daily `db_df` fallback is never populated on the intraday path — and the
history endpoint 404'd even though intraday_candles held verified rows.
Step 4b now serves that data with data_source='sqlite_stale' (mirrors the
cursor path's base_win last resort).

Offline-safe: stubs the broker session, seeds SQLite directly, never touches
the network.
"""
import pandas as pd
import pytest
from datetime import datetime, timedelta

from backend.data.database import init_db, save_intraday_candles
from backend.data.fetcher import fetch_stock_data


@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    import backend.data.fetcher as fetcher_mod
    fetcher_mod._cache.clear()
    yield
    fetcher_mod._cache.clear()


@pytest.fixture(autouse=True)
def no_broker(monkeypatch):
    """Broker session permanently down — the exact outage that caused the 404."""
    import backend.data.fetcher as fetcher_mod
    monkeypatch.setattr(fetcher_mod, "ensure_session", lambda *a, **k: None)
    monkeypatch.setattr(fetcher_mod, "_session_active", False)
    monkeypatch.setattr(fetcher_mod, "get_token_info", lambda *a, **k: None)


def _seed_stale_intraday(ticker, interval="1m", n=12, age_minutes=120):
    """Seed `n` candles ending `age_minutes` in the past (stale: 1m threshold is 5 min)."""
    end = datetime.now() - timedelta(minutes=age_minutes)
    base = end - timedelta(minutes=n - 1)
    rows = []
    for i in range(n):
        ts = (base + timedelta(minutes=i)).strftime("%Y-%m-%d %H:%M:%S")
        o = 100.0 + i
        rows.append({
            "date": ts, "open": o, "high": o + 1, "low": o - 1,
            "close": o + 0.5, "volume": 1000 + i,
        })
    save_intraday_candles(ticker, interval, pd.DataFrame(rows))
    return [r["date"] for r in rows]


def _cleanup(ticker, interval="1m"):
    import sqlite3
    import os
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "backend", "data", "stockoracle.db")
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            "DELETE FROM intraday_candles WHERE ticker = ? AND interval = ?",
            (ticker, interval),
        )
        conn.commit()
    finally:
        conn.close()


def test_stale_db_served_when_broker_session_down():
    """Broker down + verified SQLite rows => 200 with sqlite_stale, never None (404)."""
    ticker = "STALEFALLBACKTEST"
    try:
        seeded = _seed_stale_intraday(ticker, "1m", n=12, age_minutes=120)

        df = fetch_stock_data(ticker, period="5D", interval="1m")

        assert df is not None, (
            "fetch_stock_data returned None despite intraday_candles holding rows — "
            "the stale-DB fallback (step 4b) is broken"
        )
        assert not df.empty
        assert len(df) >= 5
        assert df.attrs.get("data_source") == "sqlite_stale"
        # Verified rows, not synthetic: the seeded timestamps survive intact.
        assert list(df["date"]) == seeded
        # OHLCV preserved (no candle dropping — AGENTS.md invariant §2)
        assert (df["volume"] > 0).all()
        assert ((df["low"] <= df[["open", "close"]].min(axis=1)).all())
        assert ((df["high"] >= df[["open", "close"]].max(axis=1)).all())
    finally:
        _cleanup(ticker, "1m")


def test_none_still_returned_when_no_data_anywhere():
    """No broker + no SQLite rows => None so callers keep their honest 404/503."""
    ticker = "STALEFALLBACKEMPTY"
    try:
        df = fetch_stock_data(ticker, period="5D", interval="1m")
        assert df is None
    finally:
        _cleanup(ticker, "1m")


def test_fresh_db_still_served_as_sqlite_not_stale():
    """Fresh rows (< 5 min old for 1m) keep taking the fast DB path — unaffected."""
    ticker = "STALEFALLBACKFRESH"
    try:
        seeded = _seed_stale_intraday(ticker, "1m", n=8, age_minutes=1)

        df = fetch_stock_data(ticker, period="5D", interval="1m")

        assert df is not None
        assert df.attrs.get("data_source") == "sqlite"
        assert list(df["date"]) == seeded
    finally:
        _cleanup(ticker, "1m")
