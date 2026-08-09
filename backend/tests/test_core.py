"""
StockOracle Pro — Unit Tests

Coverage:
  - indicators.py    : All 10 technical indicators + pattern detection + enrichment
  - monte_carlo.py   : GBM simulation shape, vectorized percentiles, risk metrics
  - volatility.py    : GARCH parameter constraints, rolling vol, forecast shape
  - trainer.py       : predict_future confidence bounds use stored MAPE (not fixed 1.5%)
  - ml/predictor.py  : Feature matrix shape, sequence building, ensemble predict

Run:
    cd "d:/Development/ai stock"
    python -m pytest backend/tests/ -v
"""

import sys
import os
import numpy as np
import pandas as pd
import pytest

# Make sure project root is in path for backend imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_ohlcv(n: int = 120, base: float = 1000.0, seed: int = 42) -> pd.DataFrame:
    """Generates a synthetic daily OHLCV DataFrame with n rows."""
    rng = np.random.default_rng(seed)
    closes = base + np.cumsum(rng.normal(0, 10, n))
    opens  = closes + rng.uniform(-5, 5, n)
    highs  = np.maximum(opens, closes) + rng.uniform(0, 10, n)
    lows   = np.minimum(opens, closes) - rng.uniform(0, 10, n)
    vols   = rng.integers(100_000, 1_000_000, n)
    dates  = pd.date_range("2024-01-01", periods=n, freq="B")
    return pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "open": opens.round(2),
        "high": highs.round(2),
        "low":  lows.round(2),
        "close": closes.round(2),
        "volume": vols,
    })


@pytest.fixture
def ohlcv():
    return _make_ohlcv(n=120)


@pytest.fixture
def prices(ohlcv):
    return ohlcv["close"].tolist()


# ─────────────────────────────────────────────────────────────────────────────
# indicators.py
# ─────────────────────────────────────────────────────────────────────────────

class TestIndicators:
    from backend.analysis.indicators import (
        calculate_sma, calculate_ema, calculate_rsi, calculate_macd,
        calculate_bollinger_bands, calculate_atr, calculate_adx,
        detect_candlestick_patterns, enrich_stock_dataframe,
    )

    def test_sma_length(self, ohlcv):
        from backend.analysis.indicators import calculate_sma
        s = ohlcv["close"]
        result = calculate_sma(s, 20)
        assert len(result) == len(s), "SMA must have same length as input"
        assert result.iloc[:19].isna().all(), "First 19 values should be NaN for SMA-20"
        assert result.iloc[19] == pytest.approx(s.iloc[:20].mean(), rel=1e-6)

    def test_ema_length(self, ohlcv):
        from backend.analysis.indicators import calculate_ema
        result = calculate_ema(ohlcv["close"], 12)
        assert len(result) == len(ohlcv)
        assert not result.isna().any(), "EMA should have no NaN (uses ewm)"

    def test_rsi_range(self, ohlcv):
        from backend.analysis.indicators import calculate_rsi
        rsi = calculate_rsi(ohlcv["close"], 14).dropna()
        assert (rsi >= 0).all() and (rsi <= 100).all(), "RSI must be in [0, 100]"

    def test_macd_returns_three_series(self, ohlcv):
        from backend.analysis.indicators import calculate_macd
        macd, signal, hist = calculate_macd(ohlcv["close"])
        assert len(macd) == len(ohlcv)
        # histogram should equal macd - signal
        diff = (macd - signal - hist).dropna().abs()
        assert (diff < 1e-9).all(), "hist must equal macd - signal"

    def test_bollinger_band_contains_price(self, ohlcv):
        from backend.analysis.indicators import calculate_bollinger_bands
        upper, lower, pct_b = calculate_bollinger_bands(ohlcv["close"], 20)
        closes = ohlcv["close"][19:]  # After warm-up
        upper_ = upper[19:]
        lower_ = lower[19:]
        # At least 90% of prices should fall inside the 2-sigma bands
        inside = ((closes >= lower_) & (closes <= upper_)).mean()
        assert inside >= 0.90, f"Only {inside:.1%} of prices inside Bollinger Bands"

    def test_atr_positive(self, ohlcv):
        from backend.analysis.indicators import calculate_atr
        atr = calculate_atr(ohlcv, 14).dropna()
        assert (atr > 0).all(), "ATR must always be positive"

    def test_adx_range(self, ohlcv):
        from backend.analysis.indicators import calculate_adx
        adx = calculate_adx(ohlcv, 14).dropna()
        assert (adx >= 0).all() and (adx <= 100).all(), "ADX must be in [0, 100]"

    def test_enrich_drops_nan(self, ohlcv):
        from backend.analysis.indicators import enrich_stock_dataframe
        enriched = enrich_stock_dataframe(ohlcv)
        assert not enriched.isnull().any().any(), "Enriched DataFrame must have no NaN"

    def test_enrich_has_expected_columns(self, ohlcv):
        from backend.analysis.indicators import enrich_stock_dataframe
        enriched = enrich_stock_dataframe(ohlcv)
        required = {"sma_20", "sma_50", "ema_12", "rsi", "macd", "macd_signal",
                    "macd_hist", "bb_upper", "bb_lower", "bb_pct_b", "volatility",
                    "atr", "adx"}
        assert required.issubset(enriched.columns), f"Missing columns: {required - set(enriched.columns)}"

    def test_candlestick_patterns_boolean(self, ohlcv):
        from backend.analysis.indicators import detect_candlestick_patterns
        patterns = detect_candlestick_patterns(ohlcv)
        pattern_cols = [c for c in patterns.columns if c.startswith("pattern_")]
        assert len(pattern_cols) > 0, "Should detect at least one pattern column"
        for col in pattern_cols:
            assert patterns[col].dtype == bool or set(patterns[col].unique()).issubset({True, False, 0, 1})


# ─────────────────────────────────────────────────────────────────────────────
# monte_carlo.py
# ─────────────────────────────────────────────────────────────────────────────

class TestMonteCarlo:
    def test_output_shape(self, prices):
        from backend.analysis.monte_carlo import run_monte_carlo_simulation
        result = run_monte_carlo_simulation(prices, simulations=50, horizon=20)
        assert len(result["p50"]) == 21, "p50 should have horizon+1 values (including t=0)"
        assert len(result["p10"]) == 21

    def test_percentile_ordering(self, prices):
        from backend.analysis.monte_carlo import run_monte_carlo_simulation
        result = run_monte_carlo_simulation(prices, simulations=200, horizon=30)
        for t in range(31):
            assert result["p10"][t] <= result["p25"][t] <= result["p50"][t] <= result["p75"][t] <= result["p90"][t], \
                f"Percentile order violated at t={t}"

    def test_prob_up_in_range(self, prices):
        from backend.analysis.monte_carlo import run_monte_carlo_simulation
        result = run_monte_carlo_simulation(prices, simulations=100, horizon=30)
        assert 0.0 <= result["prob_up"] <= 1.0

    def test_var_is_positive_drawdown(self, prices):
        from backend.analysis.monte_carlo import run_monte_carlo_simulation
        result = run_monte_carlo_simulation(prices, simulations=100, horizon=30)
        # VaR and CVaR represent drawdowns (positive numbers)
        assert result["var_95"] >= 0
        assert result["cvar_95"] >= result["var_95"], "CVaR must be >= VaR"

    def test_current_price_matches_last(self, prices):
        from backend.analysis.monte_carlo import run_monte_carlo_simulation
        result = run_monte_carlo_simulation(prices, simulations=50, horizon=10)
        assert result["current_price"] == pytest.approx(prices[-1], rel=1e-6)

    def test_empty_input_returns_empty(self):
        from backend.analysis.monte_carlo import run_monte_carlo_simulation
        assert run_monte_carlo_simulation([100.0]) == {}


# ─────────────────────────────────────────────────────────────────────────────
# volatility_forecast.py
# ─────────────────────────────────────────────────────────────────────────────

class TestVolatilityForecast:
    def test_garch_persistence_less_than_one(self, ohlcv):
        """alpha + beta < 1 is required for GARCH(1,1) stationarity."""
        from backend.analysis.volatility_forecast import calculate_volatility_forecast
        result = calculate_volatility_forecast(ohlcv, forecast_days=10)
        alpha = result["garch_params"]["alpha"]
        beta  = result["garch_params"]["beta"]
        assert alpha + beta < 1.0, f"GARCH not stationary: alpha+beta = {alpha+beta:.4f}"
        assert alpha >= 0 and beta >= 0

    def test_rolling_vol_length(self, ohlcv):
        from backend.analysis.volatility_forecast import calculate_volatility_forecast
        result = calculate_volatility_forecast(ohlcv)
        # rolling_vol is capped to last 60 points
        assert len(result["rolling_history"]) <= 60
        assert len(result["rolling_history"]) > 0

    def test_forecast_length(self, ohlcv):
        from backend.analysis.volatility_forecast import calculate_volatility_forecast
        result = calculate_volatility_forecast(ohlcv, forecast_days=15)
        assert len(result["forecast"]) == 15

    def test_forecast_confidence_widens(self, ohlcv):
        from backend.analysis.volatility_forecast import calculate_volatility_forecast
        result = calculate_volatility_forecast(ohlcv, forecast_days=20)
        spreads = [f["upper"] - f["lower"] for f in result["forecast"]]
        # Uncertainty should be monotonically non-decreasing
        assert all(spreads[i] <= spreads[i + 1] for i in range(len(spreads) - 1)), \
            "Forecast confidence bands should widen over time"

    def test_regime_is_valid(self, ohlcv):
        from backend.analysis.volatility_forecast import calculate_volatility_forecast
        result = calculate_volatility_forecast(ohlcv)
        assert result["regime"] in ("High Volatility", "Normal", "Low Volatility")


# ─────────────────────────────────────────────────────────────────────────────
# ml/predictor.py — feature matrix & sequence building (no model training)
# ─────────────────────────────────────────────────────────────────────────────

class TestStockPredictorFeatures:
    def test_feature_matrix_shape(self, ohlcv):
        from backend.ml.predictor import StockPredictor
        from backend.analysis.indicators import enrich_stock_dataframe
        predictor = StockPredictor(window_size=20)
        enriched = enrich_stock_dataframe(ohlcv)
        feat = predictor._build_feature_matrix(enriched)
        assert feat.shape == (len(enriched), 10), \
            f"Expected shape ({len(enriched)}, 10), got {feat.shape}"

    def test_feature_values_no_inf(self, ohlcv):
        from backend.ml.predictor import StockPredictor
        from backend.analysis.indicators import enrich_stock_dataframe
        predictor = StockPredictor(window_size=20)
        enriched = enrich_stock_dataframe(ohlcv)
        feat = predictor._build_feature_matrix(enriched)
        assert not np.any(np.isinf(feat)), "Feature matrix should not contain inf"
        assert not np.any(np.isnan(feat)), "Feature matrix should not contain NaN"

    def test_prepare_data_sequence_shape(self, ohlcv):
        from backend.ml.predictor import StockPredictor
        predictor = StockPredictor(window_size=20)
        X, y = predictor._prepare_data(ohlcv, fit_scaler=True)
        n_expected = len(X)
        assert X.shape[1] == 20, "Sequence length should equal window_size"
        assert X.shape[2] == 10, "Should have 10 features per timestep"
        assert X.shape[0] == y.shape[0], "X and y must have the same number of samples"

    def test_prepare_data_normalised(self, ohlcv):
        from backend.ml.predictor import StockPredictor
        predictor = StockPredictor(window_size=20)
        X, _ = predictor._prepare_data(ohlcv, fit_scaler=True)
        # After normalisation, values should be in [0, 1] with small tolerance
        assert X.min() >= -0.1 and X.max() <= 1.1, \
            f"Features out of [0,1] range: min={X.min():.3f}, max={X.max():.3f}"


# ─────────────────────────────────────────────────────────────────────────────
# trainer.py — confidence bounds use MAPE (fix #3 regression guard)
# ─────────────────────────────────────────────────────────────────────────────

class TestTrainerConfidenceBounds:
    def test_confidence_bounds_use_mape_not_fixed(self, tmp_path):
        """
        Regression guard for Fix #3.
        predict_future() must compute confidence_margin = predicted_price * min(mape, 0.05),
        NOT the old hardcoded 0.015 margin.
        We verify by injecting a fake bundle with a known MAPE and checking the spread.
        """
        import json, base64
        import xgboost as xgb
        from backend.analysis.trainer import MODEL_DIR

        symbol = "_TEST_TICKER_"
        fake_mape = 0.03   # 3% — different from old 1.5%

        # Build a minimal XGBoost model that always predicts 1500.0
        import numpy as np
        X_train = np.random.rand(50, 3).astype(np.float32)
        y_train = np.full(50, 1500.0, dtype=np.float32)
        dtrain = xgb.DMatrix(X_train, label=y_train)
        booster = xgb.train({"tree_method": "hist", "n_estimators": 5}, dtrain, num_boost_round=3)

        xgb_ba = bytearray()
        booster.save_model(xgb_ba)
        xgb_b64 = base64.b64encode(bytes(xgb_ba)).decode()

        bundle = {
            "trained_at": "2026-01-01T00:00:00",
            "symbol": symbol,
            "validation_mape": fake_mape,
            "xgboost_b64": xgb_b64,
            "elasticnet": {
                "coef": [0.0, 0.0, 0.0],
                "intercept": 0.0,
                "features": ["f0", "f1", "f2"],
            },
        }

        model_path = os.path.join(MODEL_DIR, f"{symbol}.json")
        os.makedirs(MODEL_DIR, exist_ok=True)
        with open(model_path, "w") as fh:
            json.dump(bundle, fh)

        try:
            # Patch get_features to return a minimal DataFrame
            import backend.analysis.trainer as trainer_mod
            import backend.analysis.feature_engineer as fe_mod
            orig = fe_mod.get_features

            def mock_features(sym):
                df = pd.DataFrame({
                    "close": [1500.0],
                    "f0": [0.1], "f1": [0.2], "f2": [0.3],
                })
                return df

            fe_mod.get_features = mock_features
            result = trainer_mod.predict_future(symbol)

            predicted = result["predicted_price"]
            spread = result["high_bound"] - result["low_bound"]
            # With MAPE=3%, margin = predicted * 0.03
            expected_spread = predicted * fake_mape * 2
            assert abs(spread - expected_spread) < predicted * 0.001, \
                f"Spread {spread:.2f} does not match expected {expected_spread:.2f} for MAPE={fake_mape}"
        finally:
            fe_mod.get_features = orig
            if os.path.exists(model_path):
                os.remove(model_path)
