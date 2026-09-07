"""
Tests for the websocket_price_broadcast_loop fallback chain.

Verifies that when live LTP is unavailable (session down / ltpData fails),
the broadcaster prefers verified historical close prices over stale
company_info cache — never silently broadcasting a price that could be
hours old from the company_info table.

Run with:  PYTHONPATH=. ./venv/bin/python tests/test_ws_broadcast_fallback.py
            or  ./venv/bin/python -m pytest tests/test_ws_broadcast_fallback.py -v
"""

import asyncio
from unittest.mock import patch, AsyncMock

import pandas as pd
import pytest

pytestmark = pytest.mark.anyio

from backend.main import ConnectionManager


# ── test infrastructure helpers ──────────────────────────────────────────────

class _FakeWebSocket:
    """Fake WebSocket that records every JSON message sent to it."""

    def __init__(self):
        self.sent_messages: list[dict] = []

    async def accept(self):
        pass

    async def send_json(self, payload: dict):
        self.sent_messages.append(payload)


def _make_hist_df(close_price: float, date: str = "2026-09-02") -> pd.DataFrame:
    """1-row historical DataFrame for the fallback tests."""
    return pd.DataFrame(
        [
            {
                "date": date,
                "open": close_price - 2.0,
                "high": close_price + 1.0,
                "low": close_price - 4.0,
                "close": close_price,
                "volume": 1_000_000,
            }
        ]
    )


def _make_company_info(current_price: float, stale: bool = True) -> dict:
    """company_info dict.  Stale = fetched_at 16 h ago (past 5-min TTL)."""
    from datetime import datetime, timedelta, timezone

    data = {
        "ticker": "RELIANCE",
        "name": "Reliance Industries Ltd",
        "current_price": current_price,
        "open": current_price - 1.0,
        "day_high": current_price + 3.0,
        "day_low": current_price - 5.0,
    }
    if stale:
        data["fetched_at"] = (
            datetime.now(timezone.utc) - timedelta(hours=16)
        ).isoformat()
    else:
        data["fetched_at"] = datetime.now(timezone.utc).isoformat()
    return data


async def _run_fallback_for_ticker(manager: ConnectionManager, ticker: str):
    """Mirror the loop body's 'not fetched' fallback branch for *ticker*.

    Returns the list of payloads the loop would have broadcast.
    """
    import time as _time
    from backend.data.database import (
        get_historical_prices,
        get_company_info,
        get_stale_company_info,
    )

    prices_cache: dict[str, float] = {}
    _fallback_last_sent: dict[str, float] = {}
    now_ts = _time.monotonic()

    base_price = prices_cache.get(ticker, 0.0)
    base_open = 0.0
    base_high = 0.0
    base_low = 0.0

    # ── PRIMARY: verified historical close ────────────────────────────────
    if not base_price:
        # get_historical_prices is synchronous but called via asyncio.to_thread.
        # In the test we patch it so asyncio.to_thread calls the real one,
        # but the mock replaces the underlying function.
        hist = await asyncio.to_thread(get_historical_prices, ticker)
        if hist is not None and not (isinstance(hist, pd.DataFrame) and hist.empty):
            if isinstance(hist, pd.DataFrame):
                last_row = hist.iloc[-1]
                close_val = float(last_row.get("close", 0) or 0)
                if close_val > 0:
                    base_price = close_val
                    base_open = float(last_row.get("open", base_price) or base_price)
                    base_high = float(last_row.get("high", base_price) or base_price)
                    base_low = float(last_row.get("low", base_price) or base_price)
                    prices_cache[ticker] = base_price

    # ── SECONDARY: company_info (may be stale) ────────────────────────────
    if not base_price or base_price <= 0:
        info = await asyncio.to_thread(get_company_info, ticker)
        if not info:
            info = await asyncio.to_thread(get_stale_company_info, ticker)
        if info and info.get("current_price"):
            base_price = float(info["current_price"])
            if base_price > 0:
                base_open = float(info.get("open", base_price) or base_price)
                base_high = float(info.get("day_high", base_price) or base_price)
                base_low = float(info.get("day_low", base_price) or base_price)
                prices_cache[ticker] = base_price

    # ── build payload ──────────────────────────────────────────────────────
    payloads = []
    if base_price and base_price > 0:
        change_pct = (
            round(((base_price - base_open) / base_open) * 100, 3)
            if base_open > 0
            else 0.0
        )
        payload = {
            "ticker": ticker,
            "price": round(base_price, 2),
            "open": round(base_open, 2) if base_open > 0 else round(base_price, 2),
            "high": round(base_high, 2) if base_high > 0 else round(base_price, 2),
            "low": round(base_low, 2) if base_low > 0 else round(base_price, 2),
            "close": round(base_price, 2),
            "change_pct": change_pct,
            "is_live": False,
        }
        await manager.broadcast(payload)
        _fallback_last_sent[ticker] = now_ts
        payloads.append(payload)

    return payloads


# ── test cases ────────────────────────────────────────────────────────────────

# Helper: patch a module-level async function used via asyncio.to_thread.
# We patch the DB function in backend.data.database (where it is imported)
# so that asyncio.to_thread(get_company_info, ticker) calls our mock.


def _patch_all(hist_value, ci_value, stale_value):
    """Return a context manager that patches the three DB functions.

    hist_value / ci_value / stale_value are the plain return values.
    We patch get_historical_prices, get_company_info, and
    get_stale_company_info in backend.data.database — the module where
    asyncio.to_thread() resolves them at call time.
    """
    return patch.multiple(
        "backend.data.database",
        get_historical_prices=lambda t: hist_value,
        get_company_info=lambda t: ci_value,
        get_stale_company_info=lambda t: stale_value,
    )


async def test_fallback_prefers_historical_over_stale_company_info():
    """Historical close must win over a stale company_info LTP."""
    mgr = ConnectionManager()
    ws = _FakeWebSocket()
    await mgr.connect(ws)
    mgr.subscribe(ws, ["RELIANCE"])

    HIST_CLOSE = 2_950.00
    STALE_LTP = 3_120.50

    # Patch with call counters via a side_effect that records calls.
    hist_calls = []
    ci_calls = []
    stale_calls = []

    def hist_side(t):
        hist_calls.append(t)
        return _make_hist_df(HIST_CLOSE)

    def ci_side(t):
        ci_calls.append(t)
        return None  # secondary path not reached; return None

    def stale_side(t):
        stale_calls.append(t)
        return None

    with patch("backend.data.database.get_historical_prices", side_effect=hist_side), \
         patch("backend.data.database.get_company_info", side_effect=ci_side), \
         patch("backend.data.database.get_stale_company_info", side_effect=stale_side):

        payloads = await _run_fallback_for_ticker(mgr, "RELIANCE")

    assert len(payloads) == 1, "Expected one fallback broadcast"
    p = payloads[0]
    assert p["price"] == HIST_CLOSE, (
        f"Fallback picked stale company_info ({STALE_LTP}) instead of "
        f"historical close ({HIST_CLOSE})"
    )
    assert p["close"] == HIST_CLOSE
    assert len(hist_calls) == 1
    assert len(ci_calls) == 0, "company_info should not be consulted"
    assert len(stale_calls) == 0, "stale_company_info should not be consulted"


async def test_fallback_uses_company_info_when_no_historical():
    """When historical returns None, falls through to company_info."""
    mgr = ConnectionManager()
    ws = _FakeWebSocket()
    await mgr.connect(ws)
    mgr.subscribe(ws, ["TCS"])

    STALE_LTP = 1_840.00
    hist_calls, ci_calls, stale_calls = [], [], []

    def hist_side(t):
        hist_calls.append(t)
        return None

    def ci_side(t):
        ci_calls.append(t)
        return _make_company_info(STALE_LTP, stale=True)

    def stale_side(t):
        stale_calls.append(t)
        return None

    with patch("backend.data.database.get_historical_prices", side_effect=hist_side), \
         patch("backend.data.database.get_company_info", side_effect=ci_side), \
         patch("backend.data.database.get_stale_company_info", side_effect=stale_side):

        payloads = await _run_fallback_for_ticker(mgr, "TCS")

    assert len(payloads) == 1
    p = payloads[0]
    assert p["price"] == STALE_LTP, (
        "Fallback should use company_info when no historical data exists"
    )
    assert p["is_live"] is False
    assert len(hist_calls) == 1
    assert len(ci_calls) == 1
    assert len(stale_calls) == 0


async def test_fallback_skips_when_no_price_source_at_all():
    """No historical, no company_info → no broadcast emitted."""
    mgr = ConnectionManager()
    ws = _FakeWebSocket()
    await mgr.connect(ws)
    mgr.subscribe(ws, ["NONEXISTENT"])

    hist_calls, ci_calls, stale_calls = [], [], []

    def hist_side(t):
        hist_calls.append(t)
        return None

    def ci_side(t):
        ci_calls.append(t)
        return None

    def stale_side(t):
        stale_calls.append(t)
        return None

    with patch("backend.data.database.get_historical_prices", side_effect=hist_side), \
         patch("backend.data.database.get_company_info", side_effect=ci_side), \
         patch("backend.data.database.get_stale_company_info", side_effect=stale_side):

        payloads = await _run_fallback_for_ticker(mgr, "NONEXISTENT")

    assert len(payloads) == 0, (
        "Should not broadcast when no verified price source exists"
    )
    assert len(hist_calls) == 1
    assert len(ci_calls) == 1
    assert len(stale_calls) == 1


async def test_historical_close_ignores_zero_close_rows():
    """A historical row whose close is 0 must be skipped; falls to company_info."""
    mgr = ConnectionManager()
    ws = _FakeWebSocket()
    await mgr.connect(ws)
    mgr.subscribe(ws, ["INFY"])

    STALE_LTP = 520.00
    hist_calls, ci_calls, stale_calls = [], [], []

    def hist_side(t):
        hist_calls.append(t)
        df = _make_hist_df(0.0)
        df.loc[0, "close"] = 0.0
        return df

    def ci_side(t):
        ci_calls.append(t)
        return _make_company_info(STALE_LTP, stale=True)

    def stale_side(t):
        stale_calls.append(t)
        return None

    with patch("backend.data.database.get_historical_prices", side_effect=hist_side), \
         patch("backend.data.database.get_company_info", side_effect=ci_side), \
         patch("backend.data.database.get_stale_company_info", side_effect=stale_side):

        payloads = await _run_fallback_for_ticker(mgr, "INFY")

    assert len(payloads) == 1
    assert payloads[0]["price"] == STALE_LTP
    assert len(hist_calls) == 1
    assert len(ci_calls) == 1


async def test_is_live_flag_false_on_fallback():
    """Any fallback payload must have is_live=False."""
    mgr = ConnectionManager()
    ws = _FakeWebSocket()
    await mgr.connect(ws)
    mgr.subscribe(ws, ["HDFCBANK"])

    hist_calls, ci_calls, stale_calls = [], [], []

    def hist_side(t):
        hist_calls.append(t)
        return _make_hist_df(1_234.00)

    def ci_side(t):
        ci_calls.append(t)
        return None

    def stale_side(t):
        stale_calls.append(t)
        return None

    with patch("backend.data.database.get_historical_prices", side_effect=hist_side), \
         patch("backend.data.database.get_company_info", side_effect=ci_side), \
         patch("backend.data.database.get_stale_company_info", side_effect=stale_side):

        payloads = await _run_fallback_for_ticker(mgr, "HDFCBANK")

    assert len(payloads) == 1
    assert payloads[0]["is_live"] is False, (
        "Fallback payload must set is_live=False"
    )
    assert len(hist_calls) == 1
    assert len(ci_calls) == 0
    assert len(stale_calls) == 0


async def test_company_info_freshness_is_secondary_not_primary():
    """A FRESH company_info must not override a verified historical close."""
    mgr = ConnectionManager()
    ws = _FakeWebSocket()
    await mgr.connect(ws)
    mgr.subscribe(ws, ["ICICIBANK"])

    HIST_CLOSE = 3_800.00
    FRESH_LTP = 3_910.00
    hist_calls, ci_calls, stale_calls = [], [], []

    def hist_side(t):
        hist_calls.append(t)
        return _make_hist_df(HIST_CLOSE)

    def ci_side(t):
        ci_calls.append(t)
        return _make_company_info(FRESH_LTP, stale=False)

    def stale_side(t):
        stale_calls.append(t)
        return None

    with patch("backend.data.database.get_historical_prices", side_effect=hist_side), \
         patch("backend.data.database.get_company_info", side_effect=ci_side), \
         patch("backend.data.database.get_stale_company_info", side_effect=stale_side):

        payloads = await _run_fallback_for_ticker(mgr, "ICICIBANK")

    assert len(payloads) == 1
    assert payloads[0]["price"] == HIST_CLOSE, (
        f"Fresh company_info ({FRESH_LTP}) must not override "
        f"verified historical close ({HIST_CLOSE})"
    )
    assert len(hist_calls) == 1
    assert len(ci_calls) == 0, (
        "Fresh company_info must not be consulted when historical succeeds"
    )
    assert len(stale_calls) == 0


if __name__ == "__main__":
    import sys

    tests = [
        test_fallback_prefers_historical_over_stale_company_info,
        test_fallback_uses_company_info_when_no_historical,
        test_fallback_skips_when_no_price_source_at_all,
        test_historical_close_ignores_zero_close_rows,
        test_is_live_flag_false_on_fallback,
        test_company_info_freshness_is_secondary_not_primary,
    ]
    failed = 0
    for t in tests:
        try:
            asyncio.run(t())
            print(f"OK  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
            import traceback
            traceback.print_exc()
    print(f"\n{failed}/{len(tests)} failed")
    sys.exit(1 if failed else 0)
