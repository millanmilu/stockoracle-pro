import os
import json
import tempfile
import xgboost as xgb

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

def get_top_features(symbol: str, top_n: int = 3) -> dict:
    """
    Loads the trained XGBoost model for the symbol, calculates feature importance by gain,
    and returns the top N features with their percentage contributions.
    """
    model_path = os.path.join(MODEL_DIR, f"{symbol}.json")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"No trained model found for {symbol}.")

    with open(model_path, 'r') as f:
        bundle = json.load(f)
        
    xgb_json = bundle.get("xgboost")
    if not xgb_json:
        raise ValueError("Invalid model bundle format.")

    # XGBoost requires loading from a file or bytearray, we'll use a temp file
    booster = xgb.Booster()
    with tempfile.NamedTemporaryFile('w', delete=False) as tf:
        json.dump(xgb_json, tf)
        temp_name = tf.name
        
    try:
        booster.load_model(temp_name)
    finally:
        os.remove(temp_name)
        
    # Get raw importance by gain
    importance = booster.get_score(importance_type='gain')
    if not importance:
        return {}
        
    # Convert to percentages
    total_gain = sum(importance.values())
    pct_importance = {k: round((v / total_gain) * 100, 2) for k, v in importance.items()}
    
    # Sort and take top N
    sorted_features = sorted(pct_importance.items(), key=lambda x: x[1], reverse=True)[:top_n]
    
    return {k: v for k, v in sorted_features}
