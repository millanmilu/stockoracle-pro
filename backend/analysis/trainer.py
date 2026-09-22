import os
import json
import time
from datetime import datetime
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.linear_model import ElasticNet
from sklearn.metrics import mean_absolute_percentage_error
from backend.analysis.feature_engineer import get_features
from backend.analysis.tuning import tune_xgboost

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

def train_pipeline(symbol: str) -> dict:
    """
    End-to-end CPU training pipeline:
    1. Fetches features
    2. Tunes XGBoost
    3. Trains XGBoost
    4. Trains ElasticNet on residuals
    5. Saves models
    6. Returns metrics and top features
    """
    start_time = time.time()
    
    # 1. Get features
    df = get_features(symbol)
    if df.empty or len(df) < 100:
        raise ValueError(f"Not enough data to train model for {symbol}.")
        
    # Prepare X and y (predicting next day's close)
    df['target'] = df['close'].shift(-1)
    df = df.dropna()
    
    X = df.select_dtypes(include=[np.number]).drop(columns=['target'], errors='ignore')
    y = df['target']
    
    # Train/Val split (80/20 time series split)
    split_idx = int(len(df) * 0.8)
    X_train, X_val = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_val = y.iloc[:split_idx], y.iloc[split_idx:]
    
    # 2. Tune XGBoost
    best_params = tune_xgboost(X_train, y_train)
    
    # 3. Train Main XGBoost
    xgb_model = xgb.XGBRegressor(
        **best_params,
        n_estimators=100,
        objective='reg:squarederror',
        random_state=42
    )
    xgb_model.fit(X_train, y_train)
    
    # 4. Calculate residuals and Train ElasticNet
    train_preds = xgb_model.predict(X_train)
    residuals = y_train - train_preds
    
    en_model = ElasticNet(random_state=42)
    en_model.fit(X_train, residuals)
    
    # 5. Validation and Final Prediction
    val_xgb_preds = xgb_model.predict(X_val)
    val_en_preds = en_model.predict(X_val)
    
    # Final prediction = XGBoost + (0.15 * ElasticNet)
    val_final_preds = val_xgb_preds + (0.15 * val_en_preds)
    
    val_mape = mean_absolute_percentage_error(y_val, val_final_preds)
    
    # Explainability: Top 5 features using gain
    importance = xgb_model.get_booster().get_score(importance_type='gain')
    sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:5]
    top_features = {k: float(v) for k, v in sorted_importance}
    
    # Save XGBoost natively to a temp file then bundle with EN params
    import uuid
    temp_xgb_path = os.path.join(MODEL_DIR, f"{symbol}_temp_{uuid.uuid4().hex}.json")
    xgb_model.save_model(temp_xgb_path)
    
    with open(temp_xgb_path, 'r') as f:
        xgb_json_str = f.read()
    os.remove(temp_xgb_path)
    
    # Bundle into a single JSON, including training metadata
    model_bundle = {
        "trained_at": datetime.now().isoformat(),
        "symbol": symbol,
        "validation_mape": float(val_mape),
        "xgboost": json.loads(xgb_json_str),
        "elasticnet": {
            "coef": en_model.coef_.tolist(),
            "intercept": float(en_model.intercept_),
            "features": X_train.columns.tolist()
        }
    }
    
    final_path = os.path.join(MODEL_DIR, f"{symbol}.json")
    with open(final_path, 'w') as f:
        json.dump(model_bundle, f)
        
    training_time = time.time() - start_time
    
    return {
        "symbol": symbol,
        "training_time_seconds": round(training_time, 2),
        "validation_mape": float(val_mape),
        "top_features": top_features
    }

# Legacy feature names expected by bundles trained before the feature-engineering
# rewrite (bb_pct_b -> bb_percent, roll_* removed, atr_14 removed). Maps each
# legacy column to (source_column, is_multiplier): compat values are derived
# from the same OHLCV history so old bundles keep working until retrained.
LEGACY_FEATURE_MAP = {
    "bb_pct_b": ("bb_percent", False),
    "roll_mean_5": ("_roll_mean_5", False),
    "roll_mean_10": ("_roll_mean_10", False),
    "roll_mean_20": ("_roll_mean_20", False),
    "roll_mean_50": ("_roll_mean_50", False),
    "roll_std_5": ("_roll_std_5", False),
    "roll_std_10": ("_roll_std_10", False),
    "roll_std_20": ("roll_std_20", False),
    "atr_14": ("_atr_14", False),
}

# Scenario-simulator override aliases: old override key ->
# (live column, apply_as_multiplier). Multipliers scale the live value
# (e.g. volatility 1.2x); plain values overwrite it.
OVERRIDE_ALIASES = {
    "sentiment_score": ("sentiment", False),
    "sentiment": ("sentiment", False),
    "volume_ratio": ("volume_sma_ratio", False),
    "volume_sma_ratio": ("volume_sma_ratio", False),
    "volatility": ("roll_std_20", True),
}


def _apply_legacy_feature_shim(df: pd.DataFrame) -> pd.DataFrame:
    """Derives legacy bundle-era columns from current OHLCV history (in place-safe copy)."""
    df = df.copy()
    close = pd.to_numeric(df["close"], errors="coerce")
    if "_roll_mean_5" not in df.columns:
        for n in (5, 10, 20, 50):
            df[f"_roll_mean_{n}"] = close.rolling(window=n, min_periods=1).mean()
            if n != 20:
                df[f"_roll_std_{n}"] = close.rolling(window=n, min_periods=1).std().fillna(0.0)
    if "_atr_14" not in df.columns and {"high", "low", "close"} <= set(df.columns):
        high = pd.to_numeric(df["high"], errors="coerce")
        low = pd.to_numeric(df["low"], errors="coerce")
        prev_close = close.shift(1)
        tr = pd.concat([
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ], axis=1).max(axis=1)
        df["_atr_14"] = tr.rolling(window=14, min_periods=1).mean().fillna(0.0)
    for legacy, (source, _) in LEGACY_FEATURE_MAP.items():
        if legacy not in df.columns and source in df.columns:
            df[legacy] = df[source]
    return df


def _apply_overrides(
    latest_row: pd.DataFrame, override_features: dict, bundle_features=None
) -> dict:
    """Applies scenario overrides via OVERRIDE_ALIASES.

    Returns {"applied": [...], "ignored": [...]} where ignored lists override
    keys that mapped nowhere in the trained bundle's feature set (e.g. a
    constant-history column the model gave zero weight, or an unknown key) —
    so the UI can honestly show which sliders moved the prediction.
    """
    result = {"applied": [], "ignored": []}
    if not override_features:
        return result
    bundle_set = set(bundle_features or [])
    for k, v in override_features.items():
        try:
            target, as_multiplier = OVERRIDE_ALIASES.get(k, (k, False))
        except Exception:
            result["ignored"].append(str(k))
            continue
        if target not in latest_row.columns or (bundle_set and target not in bundle_set):
            result["ignored"].append(str(k))
            continue
        try:
            fval = float(v)
        except (TypeError, ValueError):
            result["ignored"].append(str(k))
            continue
        if not np.isfinite(fval):
            result["ignored"].append(str(k))
            continue
        if as_multiplier:
            latest_row.loc[:, target] = latest_row[target] * fval
        else:
            latest_row.loc[:, target] = fval
        result["applied"].append(str(k))
    return result


def predict_future(symbol: str, override_features: dict = None) -> dict:
    """
    Loads the trained bundle (XGBoost + ElasticNet).
    Fetches the latest row of features.
    Applies any override_features (for simulation).
    Returns the predicted price and high/low confidence bounds.
    """
    model_path = os.path.join(MODEL_DIR, f"{symbol}.json")
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model for {symbol} not trained. Start training with POST /api/stock/{symbol}/train and retry later."
        )
    with open(model_path, 'r') as f:
        bundle = json.load(f)

    # Get latest features
    df = get_features(symbol)
    if df.empty:
        raise ValueError("Could not fetch latest data.")

    df = _apply_legacy_feature_shim(df)
    latest_row = df.iloc[[-1]].copy()
    current_price = float(latest_row['close'].iloc[0])

    # ElasticNet features must match what it was trained on
    en_features = bundle['elasticnet']['features']
    missing = [c for c in en_features if c not in latest_row.columns]
    if missing:
        raise ValueError(
            f"Trained bundle expects features {missing} that cannot be derived "
            f"from current data. Retrain with POST /api/train/{symbol}."
        )

    # Snapshot the un-overridden row so the scenario delta is measurable.
    X_base = latest_row[en_features].copy()

    # Apply overrides for simulation
    override_report = _apply_overrides(latest_row, override_features, en_features)

    X_latest = latest_row[en_features]
        
    # Predict with XGBoost
    xgb_json = bundle.get("xgboost")
    booster = xgb.Booster()
    
    import tempfile
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as tf:
        json.dump(xgb_json, tf)
        temp_name = tf.name
    try:
        booster.load_model(temp_name)
    finally:
        try:
            os.remove(temp_name)
        except Exception:
            pass
        
    def _infer(frame: pd.DataFrame) -> float:
        # XGBoost requires DMatrix for booster inference
        dtest = xgb.DMatrix(frame)
        xgb_pred = booster.predict(dtest)[0]

        # Predict with ElasticNet (dot product + intercept manually since we just saved coef)
        coef = np.array(bundle['elasticnet']['coef'])
        intercept = bundle['elasticnet']['intercept']
        en_pred = np.dot(frame.values, coef)[0] + intercept

        return float(xgb_pred + (0.15 * en_pred))

    final_pred = _infer(X_latest)

    # Simple confidence bounds (e.g. +/- 1.5% of predicted price based on typical MAPE)
    confidence_margin = final_pred * 0.015

    # ── Consensus-compatible derived fields ──
    # Horizon honesty: this bundle predicts the NEXT trading day (target =
    # close.shift(-1) in train_pipeline), not 7 days. `predicted_return_7d`
    # is kept as a compat alias so AI-consensus callers work, but equals the
    # 1-day return — callers must not treat magnitude as a 7-day move.
    predicted_return = (
        (final_pred - current_price) / current_price if current_price else 0.0
    )
    pct_return = predicted_return * 100.0
    if pct_return >= 2.0:
        ml_signal = "STRONG BUY"
    elif pct_return >= 0.5:
        ml_signal = "BUY"
    elif pct_return <= -2.0:
        ml_signal = "STRONG SELL"
    elif pct_return <= -0.5:
        ml_signal = "SELL"
    else:
        ml_signal = "HOLD"
    # Certified confidence from out-of-sample validation MAPE:
    # ~2% MAPE → ~90, ~5% → ~75, ~7% → ~66, ≥15% → floored at 20.
    mape = bundle.get("validation_mape")
    try:
        mape_f = float(mape)
        confidence_score = (
            round(max(20.0, min(95.0, 100.0 - mape_f * 500.0)), 1)
            if np.isfinite(mape_f) and mape_f >= 0
            else None
        )
    except (TypeError, ValueError):
        confidence_score = None

    out = {
        "current_price": current_price,
        "predicted_price": round(final_pred, 2),
        "high_bound": round(final_pred + confidence_margin, 2),
        "low_bound": round(final_pred - confidence_margin, 2),
        "predicted_return": round(float(predicted_return), 4),
        "predicted_return_7d": round(float(predicted_return), 4),
        "predicted_return_pct": round(float(pct_return), 2),
        "signal": ml_signal,
        "confidence_score": confidence_score,
        "ai_confidence_score": confidence_score,
        "validation_mape": float(mape_f) if confidence_score is not None else None,
        "mape": float(mape_f) if confidence_score is not None else None,
        "model_trained": True,
        "horizon_bars": 1,
    }
    if override_features:
        out["base_predicted_price"] = round(_infer(X_base), 2)
        out["applied_overrides"] = override_report["applied"]
        out["ignored_overrides"] = override_report["ignored"]
    return out

