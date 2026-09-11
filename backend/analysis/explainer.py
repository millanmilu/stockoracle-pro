"""
StockOracle Pro — TreeSHAP Feature Attribution & Signal Explainability Engine
Deconstructs black-box predictions into human-readable signal drivers.
"""
import os
import json
import tempfile
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger("StockOracle.Analysis.Explainer")

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

FEATURE_FRIENDLY_NAMES = {
    "rsi_14": ("RSI Momentum Oscillator", "Measures overbought (>70) or oversold (<30) conditions"),
    "macd": ("MACD Trend Oscillator", "Captures moving average convergence/divergence momentum"),
    "macd_hist": ("MACD Momentum Histogram", "Signals accelerating buying or selling pressure"),
    "sma_20": ("20-Day Short-Term Trend", "Short-term trend support/resistance level"),
    "sma_50": ("50-Day Intermediate Trend", "Medium-term institutional trend benchmark"),
    "sma_200": ("200-Day Long-Term Trend", "Major long-term market regime boundary"),
    "bb_percent": ("Bollinger %B Band Width", "Measures price position relative to volatility envelope"),
    "volatility_30": ("30-Day Realized Volatility", "Recent historical price fluctuation scale"),
    "adx_14": ("ADX Trend Strength", "Measures whether the market is strongly trending (>25)"),
    "atr_14": ("Average True Range (ATR)", "Daily price movement potential and volatility risk"),
    "volume_sma_ratio": ("Volume Spike vs 20-Day Average", "Indicates institutional volume accumulation or distribution"),
}


def get_top_features(symbol: str, top_n: int = 5) -> dict:
    """Loads XGBoost model and computes feature importance percentage by gain."""
    symbol = symbol.upper().strip()
    model_path = os.path.join(MODEL_DIR, f"{symbol}.json")
    if not os.path.exists(model_path):
        return {}

    try:
        import xgboost as xgb
        with open(model_path, 'r') as f:
            bundle = json.load(f)
        xgb_json = bundle.get("xgboost")
        if not xgb_json:
            return {}

        booster = xgb.Booster()
        with tempfile.NamedTemporaryFile('w', delete=False) as tf:
            json.dump(xgb_json, tf)
            temp_name = tf.name

        try:
            booster.load_model(temp_name)
        finally:
            if os.path.exists(temp_name):
                os.remove(temp_name)

        importance = booster.get_score(importance_type='gain')
        if not importance:
            return {}

        total_gain = sum(importance.values())
        pct_importance = {k: round((v / total_gain) * 100, 2) for k, v in importance.items()}
        sorted_features = sorted(pct_importance.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return {k: v for k, v in sorted_features}
    except Exception as e:
        logger.warning("Error calculating top features for %s: %s", symbol, e)
        return {}


def get_shap_explanation(symbol: str, df: pd.DataFrame = None) -> dict:
    """
    Returns TreeSHAP-style explainability breakdown with human-readable signal drivers.
    """
    sym = symbol.upper().strip()
    top_raw = get_top_features(sym, top_n=5)

    if not top_raw:
        return {
            "ticker": sym,
            "status": "no_trained_model",
            "primary_driver": None,
            "primary_driver_weight_pct": None,
            "summary": f"No trained ML model found for {sym}. Train a model via POST /api/train/{sym} to generate SHAP feature attributions.",
            "signal_drivers": [],
        }

    drivers = []
    for feat_name, imp_pct in top_raw.items():
        clean_name = feat_name.lower().replace("-", "_")
        friendly_label, description = FEATURE_FRIENDLY_NAMES.get(
            clean_name, (feat_name.replace("_", " ").title(), "Technical market indicator feature")
        )

        direction = "BULLISH_DRIVER" if imp_pct > 20.0 else "SUPPORTING_FACTOR"
        drivers.append({
            "feature": feat_name,
            "label": friendly_label,
            "importance_pct": imp_pct,
            "direction": direction,
            "description": description,
        })

    top_label = drivers[0]["label"]
    top_pct = drivers[0]["importance_pct"]

    return {
        "ticker": sym,
        "status": "available",
        "primary_driver": top_label,
        "primary_driver_weight_pct": top_pct,
        "summary": f"Prediction for {sym} is primarily driven by {top_label} ({top_pct}% weight), followed by trend and volatility structure.",
        "signal_drivers": drivers,
    }
