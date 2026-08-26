"""
StockOracle Pro — Phase 5 AI & Quantitative Upgrade Regression Tests
"""
import pytest
import numpy as np
import pandas as pd
from backend.data.database import (
    init_db, register_model_version, get_registered_models
)
from backend.ml.benchmarking import run_walk_forward_benchmark
from backend.ml.forecast_bands import compute_forecast_bands
from backend.analysis.explainer import get_shap_explanation


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def _generate_synthetic_stock_df(days: int = 150) -> pd.DataFrame:
    """Generates realistic synthetic OHLCV dataframe for testing."""
    np.random.seed(42)
    dates = pd.date_range(end="2026-08-25", periods=days, freq="B").strftime("%Y-%m-%d")
    returns = np.random.normal(0.0005, 0.015, days)
    price = 1400.0 * np.exp(np.cumsum(returns))

    df = pd.DataFrame({
        "date": dates,
        "open": price * (1 + np.random.uniform(-0.005, 0.005, days)),
        "high": price * (1 + np.random.uniform(0.005, 0.015, days)),
        "low": price * (1 - np.random.uniform(0.005, 0.015, days)),
        "close": price,
        "volume": np.random.randint(100000, 2000000, days),
    })
    return df


def test_walk_forward_benchmark():
    """Verify 5-fold walk-forward cross-validation calculation."""
    df = _generate_synthetic_stock_df(150)
    result = run_walk_forward_benchmark("TEST_STOCK", df, n_folds=5, test_days=10)

    assert result["ticker"] == "TEST_STOCK"
    assert result["n_folds"] >= 3
    assert result["avg_model_mape"] > 0
    assert result["avg_naive_mape"] > 0
    assert result["directional_accuracy_pct"] >= 0.0
    assert "folds" in result
    assert len(result["folds"]) >= 3


def test_forecast_confidence_bands():
    """Verify 7-day forecast bands with 95% and 80% confidence envelopes."""
    df = _generate_synthetic_stock_df(100)
    bands = compute_forecast_bands("TEST_STOCK", df, horizon_days=7)

    assert bands["ticker"] == "TEST_STOCK"
    assert len(bands["forecast_days"]) == 7

    for d in bands["forecast_days"]:
        # Envelope ordering: lower_95 <= lower_80 <= predicted <= upper_80 <= upper_95
        assert d["lower_95"] <= d["lower_80"]
        assert d["lower_80"] <= d["predicted_price"]
        assert d["predicted_price"] <= d["upper_80"]
        assert d["upper_80"] <= d["upper_95"]
        assert d["spread_pct"] > 0


def test_model_registry_crud():
    """Verify model version registration and lineage query."""
    v_id = register_model_version(
        ticker="TEST_REGISTRY_TICKER",
        model_type="xgboost",
        version="v2.1.0",
        artifact_path="/var/models/test_stock.json",
        mape=1.45,
        rmse=12.30,
        metrics={"r2_score": 0.88, "features_count": 10},
    )

    assert v_id > 0
    models = get_registered_models("TEST_REGISTRY_TICKER")

    assert len(models) >= 1
    m = models[0]
    assert m["ticker"] == "TEST_REGISTRY_TICKER"
    assert m["version"] == "v2.1.0"
    assert m["mape"] == 1.45
    assert m["is_active"] == 1
    assert m["metrics"]["r2_score"] == 0.88


def test_treeshap_explainability():
    """Verify TreeSHAP signal driver explanation breakdown."""
    explanation = get_shap_explanation("RELIANCE")

    assert explanation["ticker"] == "RELIANCE"
    assert "primary_driver" in explanation
    assert "signal_drivers" in explanation
    assert len(explanation["signal_drivers"]) >= 1

    top_driver = explanation["signal_drivers"][0]
    assert "feature" in top_driver
    assert "label" in top_driver
    assert "importance_pct" in top_driver
    assert top_driver["importance_pct"] > 0
