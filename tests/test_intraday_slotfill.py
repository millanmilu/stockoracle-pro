"""
StockOracle Pro — intraday slot-completion (gap-fill) regression tests.

Missing minute slots render as visible whitespace gaps ("broken candles").
fill_intraday_time_gaps() forward-fills small in-session stalls with flat
carry-forward bars while leaving weekends/nights/outages visibly gapped.
Pure-pandas tests: no DB, no network.
"""
import pandas as pd

from backend.data.fetcher import fill_intraday_time_gaps


def _frame(times, close=100.0):
    return pd.DataFrame([{
        "date": t, "open": close, "high": close + 1,
        "low": close - 1, "close": close, "volume": 10,
    } for t in times])


def _minutes(day, hm_list):
    return [f"{day} {hm}:00" for hm in hm_list]


def test_fills_small_intraday_stall_crypto():
    df = _frame(_minutes("2026-09-19", ["12:00", "12:01", "12:04", "12:05"]))
    out = fill_intraday_time_gaps(df, "1m", is_crypto=True)
    assert list(out["date"]) == _minutes("2026-09-19", ["12:00", "12:01", "12:02", "12:03", "12:04", "12:05"])
    filled = out[out["date"].isin(["2026-09-19 12:02:00", "2026-09-19 12:03:00"])]
    assert (filled["volume"] == 0).all()
    assert (filled["open"] == filled["close"]).all()
    # OHLC + positive-price invariants hold on filled bars
    assert ((filled["low"] <= filled[["open", "close"]].min(axis=1)).all())
    assert ((filled["high"] >= filled[["open", "close"]].max(axis=1)).all())
    assert ((filled[["open", "high", "low", "close"]] > 0).all().all())


def test_leaves_large_outage_visible():
    times = _minutes("2026-09-19", ["12:00"]) + _minutes("2026-09-19", ["14:00"])
    out = fill_intraday_time_gaps(_frame(times), "1m", is_crypto=True)
    assert len(out) == 2  # 119 skipped slots > cap 30 -> untouched


def test_equity_never_bridges_days_or_weekends():
    # Friday close -> Monday open must stay gapped
    df = _frame(["2026-08-07 15:29:00", "2026-08-10 09:16:00"], close=50.0)
    out = fill_intraday_time_gaps(df, "1m", is_crypto=False)
    assert len(out) == 2
    # Saturday rows are never filled around
    df2 = _frame(["2026-08-08 10:00:00", "2026-08-08 10:05:00"], close=50.0)
    assert len(fill_intraday_time_gaps(df2, "1m", is_crypto=False)) == 2


def test_equity_fills_inside_session_only():
    # Inside 09:15-15:30 on a weekday -> filled (10:01 and 10:02)
    df = _frame(_minutes("2026-08-07", ["10:00", "10:03"]), close=50.0)
    out = fill_intraday_time_gaps(df, "1m", is_crypto=False)
    assert list(out["date"]) == _minutes("2026-08-07", ["10:00", "10:01", "10:02", "10:03"])
    # Outside session (night) -> left alone
    df2 = _frame(_minutes("2026-08-07", ["20:00", "20:03"]), close=50.0)
    assert len(fill_intraday_time_gaps(df2, "1m", is_crypto=False)) == 2


def test_unsupported_intervals_and_empty_pass_through():
    df = _frame(_minutes("2026-09-19", ["12:00", "12:05"]))
    assert len(fill_intraday_time_gaps(df, "1s", is_crypto=True)) == 2
    assert len(fill_intraday_time_gaps(df, "1d", is_crypto=True)) == 2
    assert fill_intraday_time_gaps(pd.DataFrame(), "1m", is_crypto=True).empty


def test_5m_slot_grid():
    df = _frame(["2026-09-19 09:15:00", "2026-09-19 09:30:00"], close=10.0)
    out = fill_intraday_time_gaps(df, "5m", is_crypto=True)
    assert list(out["date"]) == ["2026-09-19 09:15:00", "2026-09-19 09:20:00",
                                 "2026-09-19 09:25:00", "2026-09-19 09:30:00"]
