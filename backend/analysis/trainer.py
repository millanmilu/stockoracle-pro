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
        
    latest_row = df.iloc[[-1]].copy()
    current_price = float(latest_row['close'].iloc[0])
    
    # Apply overrides for simulation
    if override_features:
        for k, v in override_features.items():
            if k in latest_row.columns:
                latest_row[k] = v
                
    # ElasticNet features must match what it was trained on
    en_features = bundle['elasticnet']['features']
    # Filter latest_row to match training columns
    try:
        X_latest = latest_row[en_features]
    except KeyError:
        # Re-fetch features if columns mismatched, might happen if cache is old
        df = get_features(symbol)
        latest_row = df.iloc[[-1]].copy()
        if override_features:
            for k, v in override_features.items():
                if k in latest_row.columns:
                    latest_row[k] = v
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
        
    # XGBoost requires DMatrix for booster inference
    dtest = xgb.DMatrix(X_latest)
    xgb_pred = booster.predict(dtest)[0]
    
    # Predict with ElasticNet (dot product + intercept manually since we just saved coef)
    coef = np.array(bundle['elasticnet']['coef'])
    intercept = bundle['elasticnet']['intercept']
    en_pred = np.dot(X_latest.values, coef)[0] + intercept
    
    final_pred = float(xgb_pred + (0.15 * en_pred))
    
    # Simple confidence bounds (e.g. +/- 1.5% of predicted price based on typical MAPE)
    confidence_margin = final_pred * 0.015
    
    return {
        "current_price": current_price,
        "predicted_price": round(final_pred, 2),
        "high_bound": round(final_pred + confidence_margin, 2),
        "low_bound": round(final_pred - confidence_margin, 2)
    }

