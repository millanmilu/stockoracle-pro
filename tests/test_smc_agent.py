import pandas as pd

from backend.smc import engine


def _frame(count=80):
    return pd.DataFrame({
        "date": pd.date_range("2025-01-01", periods=count, freq="15min", tz="UTC"),
        "open": [100 + index for index in range(count)],
        "high": [101 + index for index in range(count)],
        "low": [99 + index for index in range(count)],
        "close": [100.5 + index for index in range(count)],
    })


def test_agent_rejects_synthetic_and_forming_candles():
    frame = _frame()
    frame.attrs["data_source"] = "crypto_seed"
    decision = engine.evaluate_smc_setup("BTCUSDT", frame, frame, frame, now=pd.Timestamp("2025-01-02", tz="UTC"))
    assert decision.status == "unavailable"

    real = _frame()
    decision = engine.evaluate_smc_setup("BTCUSDT", real, real, real, now=pd.Timestamp("2025-01-01 00:20", tz="UTC"))
    assert decision.status == "unavailable"


def test_agent_uses_closed_timeframes_and_enforces_two_r(monkeypatch):
    frame = _frame()
    monkeypatch.setattr(engine, "_closed", lambda value, *_args, **_kwargs: value)
    monkeypatch.setattr(engine, "_trend_4h", lambda _: "bullish")
    monkeypatch.setattr(engine, "_structure_1h", lambda *_: (True, 125.0, 100.0))
    monkeypatch.setattr(engine, "_active_order_block_1h", lambda *_: True)
    monkeypatch.setattr(engine, "_entry_15m", lambda *_: (True, 110.0, 100.0, "sweep + displacement + FVG"))

    decision = engine.evaluate_smc_setup("BTCUSDT", frame, frame, frame)
    assert decision.status == "confirmed"
    assert decision.setup.target == 130.0
    assert decision.setup.risk_reward == 2.0
