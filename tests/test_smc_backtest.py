import numpy as np
import pandas as pd
import pytest
from fastapi import HTTPException

from backend.analysis import backtest_smc
from backend.analysis.backtester import list_strategies
from backend.api.routers import ml as ml_router


def _bars(count=240, trend=0.03):
    rows = []
    for index in range(count):
        center = 200 + index * trend + np.sin(index / 5) * 2
        opened = center - 0.2
        closed = center + 0.2
        rows.append({
            "date": pd.Timestamp("2025-01-01", tz="Asia/Kolkata") + pd.Timedelta(minutes=15 * index),
            "open": opened,
            "high": center + 1,
            "low": center - 1,
            "close": closed,
            "volume": 1000 + index,
        })
    return pd.DataFrame(rows)


def _structured_bars(count=240, bearish=False):
    pattern = [1.0, 1.2, 0.7, 1.1, 1.3, -1.4, -0.9, 1.5]
    if bearish:
        pattern = [-move for move in pattern]
    rows = []
    base = 200.0 if bearish else 100.0
    for index in range(count):
        opened = base
        close = base + pattern[index % len(pattern)]
        rows.append({
            "date": pd.Timestamp("2025-01-01", tz="Asia/Kolkata") + pd.Timedelta(minutes=15 * index),
            "open": opened,
            "high": max(opened, close) + 0.25,
            "low": min(opened, close) - 0.25,
            "close": close,
            "volume": 1000 + index,
        })
        base = close
    return pd.DataFrame(rows)


def test_smc_signals_are_causal_and_reject_bare_trends():
    candles = _structured_bars()
    prefix = backtest_smc.build_smc_setups(candles.iloc[:200])
    full = backtest_smc.build_smc_setups(candles)
    assert full[:200] == prefix
    assert not any(full)  # A trend alone does not supply a sweep + full confluence.
    for signal in full:
        if signal is None:
            continue
        if signal["direction"] == "bullish":
            assert signal["stop"] < signal["entry"] < signal["target"]
        else:
            assert signal["target"] < signal["entry"] < signal["stop"]


@pytest.mark.parametrize('direction', ['bullish', 'bearish'])
def test_smc_full_confluence_emits_valid_causal_levels(monkeypatch, direction):
    rng = np.random.default_rng(5)
    close = 1000 + np.cumsum(rng.normal(0, 3, 2000))
    opened = np.r_[1000, close[:-1]] + rng.normal(0, 1, 2000)
    wick = rng.uniform(.1, 2, 2000)
    frame = pd.DataFrame(dict(
        date=pd.date_range('2025-01-01', periods=2000, freq='15min'),
        open=opened, close=close, high=np.maximum(opened, close) + wick,
        low=np.minimum(opened, close) - wick, volume=1000,
    ))
    # Supply HTF context; actual sweep/structure/zone/PD/displacement detectors run.
    monkeypatch.setattr(backtest_smc, '_aggregate_trend', lambda *_: (direction, 80))
    signals = backtest_smc.build_smc_setups(frame)
    assert signals[:1000] == backtest_smc.build_smc_setups(frame.iloc[:1000])
    assert any(signals)
    for signal in filter(None, signals):
        assert signal['direction'] == direction
        sign = 1 if direction == 'bullish' else -1
        assert sign * (signal['entry'] - signal['stop']) > 0
        assert sign * (signal['target'] - signal['entry']) >= abs(signal['entry'] - signal['stop']) * 1.25 - 1e-8


@pytest.mark.parametrize('direction', ['bullish', 'bearish'])
def test_risk_budget_includes_costs_and_unfilled_orders_preserve_equity(monkeypatch, direction):
    frame = _bars()
    frame[['open', 'close']] = 200.0
    frame['high'], frame['low'] = 200.5, 199.5
    sign = 1 if direction == 'bullish' else -1
    def signals(rows):
        result = [None] * len(rows)
        result[120] = dict(direction=direction, entry=200, stop=200-sign,
                           target=200+10*sign, score=80, session='london')
        return result
    monkeypatch.setattr(backtest_smc, 'build_smc_setups', signals)
    frame.loc[122, 'low' if sign == 1 else 'high'] = 200-sign
    result = backtest_smc.run_smc_backtest(frame, 'TEST', train_test_split=.5, run_monte_carlo_sims=False)
    assert len(result['equity_curve']) == 120
    assert result['total_trades'] == 1
    assert -1000 <= result['trade_journal'][0]['pnl'] < 0
    frame.loc[121, ['open', 'close', 'low', 'high']] = [205, 205, 204, 206] if sign == 1 else [195, 195, 194, 196]
    result = backtest_smc.run_smc_backtest(frame, 'TEST', train_test_split=.5, run_monte_carlo_sims=False)
    assert result['total_trades'] == 0
    assert len(result['equity_curve']) == 120


def test_smc_strategy_is_listed_for_backtest_studio():
    strategy = next(item for item in list_strategies() if item["id"] == "smc_pro")
    assert strategy["builtin"] is True
    assert "structural" in strategy["description"]


def test_smc_backtest_executes_and_accounts_for_short_trades(monkeypatch):
    candles = _bars(trend=-0.1)

    def one_short_setup(frame):
        signals = [None] * len(frame)
        signals[int(len(frame) * 0.5)] = {
            "direction": "bearish",
            "entry": float(frame.iloc[int(len(frame) * 0.5)]["close"]),
            "stop": float(frame.iloc[int(len(frame) * 0.5)]["close"]) + 5,
            "target": float(frame.iloc[int(len(frame) * 0.5)]["close"]) - 5,
            "score": 80,
            "session": "london",
        }
        return signals

    monkeypatch.setattr(backtest_smc, "build_smc_setups", one_short_setup)
    result = backtest_smc.run_smc_backtest(
        candles, "TEST", interval="15m", train_test_split=0.5,
        max_holding_days=100, run_monte_carlo_sims=False,
    )

    assert result["strategy"] == "smc_pro"
    assert result["interval"] == "15m"
    assert result["total_trades"] == 1
    trade = result["trade_journal"][0]
    assert trade["direction"] == "SHORT"
    assert trade["exit_reason"] == "Structural Target"
    assert trade["pnl"] > 0
    assert result["final_value"] > result["initial_capital"]


def test_smc_position_is_not_closed_by_an_opposite_signal(monkeypatch):
    candles = _bars(trend=0.02)

    def alternating_setups(frame):
        signals = [None] * len(frame)
        anchor = int(len(frame) * 0.5)
        signals[anchor] = {
            "direction": "bullish", "entry": 200, "stop": 190, "target": 220,
            "score": 80, "session": "london",
        }
        signals[anchor + 1] = {
            "direction": "bearish", "entry": 200, "stop": 220, "target": 190,
            "score": 80, "session": "london",
        }
        return signals

    monkeypatch.setattr(backtest_smc, "build_smc_setups", alternating_setups)
    result = backtest_smc.run_smc_backtest(
        candles, "TEST", interval="15m", train_test_split=0.5,
        max_holding_days=100, run_monte_carlo_sims=False,
    )

    assert result["total_trades"] == 1
    assert result["trade_journal"][0]["exit_reason"] != "Opposite SMC Signal"


def test_smc_endpoint_validates_and_forwards_intraday_selection(monkeypatch):
    with pytest.raises(HTTPException) as error:
        ml_router.get_stock_backtest("TEST", strategy="smc_pro", interval="1d")
    assert error.value.status_code == 422

    rows = _bars(180)
    forwarded = {}
    monkeypatch.setattr(ml_router, "fetch_stock_data", lambda ticker, period, interval: rows)
    monkeypatch.setattr(ml_router, "require_real_data", lambda *_args: None)

    def fake_run_backtest(frame, ticker, **kwargs):
        forwarded.update(kwargs)
        return {"strategy": "smc_pro"}

    monkeypatch.setattr(ml_router, "run_backtest", fake_run_backtest)
    result = ml_router.get_stock_backtest("TEST", strategy="smc_pro", interval="5m", period="45D")
    assert result["strategy"] == "smc_pro"
    assert forwarded["interval"] == "5m"
    assert forwarded["period"] == "45D"
