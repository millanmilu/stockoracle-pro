"""StockOracle Pro — walk-forward AI prediction bundle loader/trainer.


Split verbatim out of ``backend/analysis/backtester.py`` (pure code motion).
"""

import os
import json
import tempfile

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import ElasticNet

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

def _predict_ai_walk_forward(ticker: str, train_df: pd.DataFrame, test_df: pd.DataFrame) -> np.ndarray:
    """
    Walk-forward AI model prediction.
    If pre-trained model bundle exists in MODEL_DIR, loads and executes it.
    If not, trains a fresh out-of-sample model on train_df (in-sample) in ~0.15s
    so ANY ticker runs seamlessly without crashing.
    """
    model_path = os.path.join(MODEL_DIR, f"{ticker}.json")
    bundle = None

    if os.path.exists(model_path):
        try:
            with open(model_path, "r") as f:
                bundle = json.load(f)
        except Exception:
            bundle = None

    feature_cols = [
        "open", "high", "low", "close", "volume", "rsi_14", "macd", "atr_14",
        "bb_pct_b", "roll_mean_5", "roll_mean_10", "roll_mean_20", "roll_mean_50",
        "roll_std_5", "roll_std_10", "roll_std_20", "lag_1", "lag_2", "lag_3",
        "lag_4", "lag_5", "roc_1", "roc_5", "dow_sin", "dow_cos", "sentiment"
    ]

    # Available columns in test_df
    available = [c for c in feature_cols if c in test_df.columns]

    if bundle is not None and "xgboost" in bundle and "elasticnet" in bundle:
        try:
            en_features = bundle["elasticnet"].get("features", available)
            feat_match = [f for f in en_features if f in test_df.columns]
            X = test_df[feat_match].copy()

            xgb_json = bundle["xgboost"]
            booster = xgb.Booster()
            with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tf:
                json.dump(xgb_json, tf)
                temp_name = tf.name
            try:
                booster.load_model(temp_name)
            finally:
                if os.path.exists(temp_name):
                    os.remove(temp_name)

            dtest = xgb.DMatrix(X)
            xgb_preds = booster.predict(dtest)

            coef = np.array(bundle["elasticnet"]["coef"])
            intercept = bundle["elasticnet"]["intercept"]
            en_preds = np.dot(X.values, coef) + intercept
            return xgb_preds + 0.15 * en_preds
        except Exception:
            pass

    # ── Auto In-Sample Fast Training Fallback ──
    # Train strictly on train_df (past data) with 0 future leakage
    X_train_df = train_df[available].copy()
    # Target: next-day close price
    y_train = train_df["close"].shift(-1).values[:-1]
    X_train = X_train_df.values[:-1]

    # Fit fast XGBoost regressor
    reg = xgb.XGBRegressor(n_estimators=50, max_depth=3, learning_rate=0.08, random_state=42)
    reg.fit(X_train, y_train)
    X_test = test_df[available].values

    # Fit fast ElasticNet with causal standard scaling
    mean_X = np.nanmean(X_train, axis=0)
    std_X = np.nanstd(X_train, axis=0)
    std_X[std_X == 0] = 1.0
    X_train_scaled = np.nan_to_num((X_train - mean_X) / std_X)
    X_test_scaled = np.nan_to_num((X_test - mean_X) / std_X)

    en = ElasticNet(alpha=0.2, l1_ratio=0.5, max_iter=1000, random_state=42)
    en.fit(X_train_scaled, y_train)

    preds = reg.predict(X_test) + 0.05 * (en.predict(X_test_scaled) - np.mean(y_train))
    return preds
