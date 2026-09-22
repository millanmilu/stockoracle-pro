"""
StockOracle Pro — predict_future / Scenario Simulator regression tests.

Covers the AI Predictions tab bug where /simulate returned HTTP 200
{"error": "['atr_14', 'bb_pct_b', ...] not in index"} because model bundles
trained on the legacy feature set no longer match get_features() output.
Pure unit tests: no network, no DB, no model files (tmp MODEL_DIR).
"""
import json
import os

import numpy as np
import pandas as pd
import pytest

from backend.analysis import trainer


def _ohlcv(n=60, seed=7):
    rng = np.random.default_rng(seed)
    close = 100 + np.cumsum(rng.normal(0, 1, n))
    return pd.DataFrame({
        "open": close - 0.5,
        "high": close + 1.0,
        "low": close - 1.0,
        "close": close,
        "volume": np.full(n, 1_000_000.0),
        "rsi_14": np.full(n, 55.0),
        "macd": np.zeros(n),
        "bb_percent": np.full(n, 0.5),
        "roll_std_20": np.full(n, 1.5),
        "sentiment": np.zeros(n),
        "sma_20": close,
        "lag_1": close,
        "roc_1": np.zeros(n),
        "dow_sin": np.zeros(n),
        "dow_cos": np.ones(n),
    })


def test_legacy_feature_shim_derives_old_columns():
    df = _apply_shim(_ohlcv())
    for col in ("bb_pct_b", "roll_mean_5", "roll_mean_10", "roll_mean_20",
                "roll_mean_50", "roll_std_5", "roll_std_10", "atr_14"):
        assert col in df.columns, col
    # Renamed quantity preserved
    assert (df["bb_pct_b"] == df["bb_percent"]).all()
    # Rolling mean matches close history
    assert df["roll_mean_20"].iloc[-1] == pytest.approx(df["close"].iloc[-20:].mean())
    assert np.isfinite(df["atr_14"].iloc[-1])


def _apply_shim(df):
    return trainer._apply_legacy_feature_shim(df)


def test_override_aliases_set_and_multiply():
    df = _ohlcv()
    row = df.iloc[[-1]].copy()
    report = trainer._apply_overrides(
        row,
        {"sentiment_score": 0.8, "volatility": 2.0, "bogus_key": 1.0,
         "volume_ratio": 1.5, "nan_key": float("nan")},
        bundle_features=["sentiment", "roll_std_20"],
    )
    assert row["sentiment"].iloc[0] == pytest.approx(0.8)
    assert row["roll_std_20"].iloc[0] == pytest.approx(3.0)  # 1.5 * 2.0
    assert "sentiment_score" in report["applied"]
    assert "volatility" in report["applied"]
    # volume_ratio -> volume_sma_ratio not in bundle -> ignored
    assert "volume_ratio" in report["ignored"]
    assert "bogus_key" in report["ignored"]
    assert "nan_key" in report["ignored"]


def test_predict_future_missing_bundle_raises(tmp_path, monkeypatch):
    monkeypatch.setattr(trainer, "MODEL_DIR", str(tmp_path))
    with pytest.raises(FileNotFoundError):
        trainer.predict_future("NOBUNDLE_XYZ")


def test_predict_future_unresolvable_features_raise_value_error(tmp_path, monkeypatch):
    monkeypatch.setattr(trainer, "MODEL_DIR", str(tmp_path))
    bundle = {"elasticnet": {"features": ["close", "nope_xyz_absent"],
                             "coef": [1.0, 0.0], "intercept": 0.0},
              "xgboost": {}}
    with open(os.path.join(str(tmp_path), "FAKE.json"), "w") as f:
        json.dump(bundle, f)
    monkeypatch.setattr(trainer, "get_features", lambda symbol: _ohlcv())
    with pytest.raises(ValueError, match="Retrain"):
        trainer.predict_future("FAKE")
