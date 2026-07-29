import os
import json
import numpy as np
import pandas as pd
from typing import Dict, Any
import xgboost as xgb
import tempfile
from backend.analysis.feature_engineer import get_features
from backend.analysis.trainer import train_pipeline

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

def run_backtest(df: pd.DataFrame, ticker: str, initial_capital: float = 100000.0) -> Dict[str, Any]:
    """
    Backtests the XGBoost + ElasticNet Ensemble model strategy on historical stock data.
    Simulates trades based on model forecast signals and calculates standard metrics.
    """
    # 1. Fetch full engineered features
    features_df = get_features(ticker)
    if features_df.empty:
        return {"error": "Insufficient data to run backtest."}
        
    model_path = os.path.join(MODEL_DIR, f"{ticker}.json")
    if not os.path.exists(model_path):
        print(f"⚠️ No model found for backtest of {ticker} — training XGBoost ensemble...")
        try:
            train_pipeline(ticker)
        except Exception as e:
            return {"error": f"Failed to train model for backtest: {str(e)}"}
            
    if not os.path.exists(model_path):
        return {"error": "Model training failed, cannot backtest."}

    # Load model bundle
    with open(model_path, 'r') as f:
        bundle = json.load(f)
        
    en_features = bundle['elasticnet']['features']
    
    # 2. Select backtest window (last 120 trading days)
    backtest_len = min(120, len(features_df) - 7)
    if backtest_len <= 0:
        return {"error": "Insufficient data to run backtest. Need at least 30 rows."}
        
    sub_df = features_df.iloc[-backtest_len:].copy()
    
    # 3. Vectorized Prediction
    # XGBoost
    xgb_json = bundle.get("xgboost")
    booster = xgb.Booster()
    with tempfile.NamedTemporaryFile('w', delete=False) as tf:
        json.dump(xgb_json, tf)
        temp_name = tf.name
    try:
        booster.load_model(temp_name)
    finally:
        os.remove(temp_name)
        
    X_matrix = sub_df[en_features]
    dtest = xgb.DMatrix(X_matrix)
    xgb_preds = booster.predict(dtest)
    
    # ElasticNet
    coef = np.array(bundle['elasticnet']['coef'])
    intercept = bundle['elasticnet']['intercept']
    en_preds = np.dot(X_matrix.values, coef) + intercept
    
    # Final predictions
    final_preds = xgb_preds + (0.15 * en_preds)
    
    # 4. Simulate Trades
    cash = initial_capital
    shares = 0
    portfolio_value = []
    dates = []
    close_prices = []
    
    trades = 0
    wins = 0
    buy_price = 0.0
    
    # Iterate through the window to simulate trading
    for idx in range(len(sub_df)):
        current_row = sub_df.iloc[idx]
        current_close = float(current_row["close"])
        current_date = str(current_row.name.strftime('%Y-%m-%d'))
        pred_target_price = final_preds[idx]
        
        # Predicted return
        pred_return = (pred_target_price - current_close) / current_close
            
        # Manage trade position
        if shares > 0:
            price_change = (current_close - buy_price) / buy_price
            # Stop loss at 4% loss, take profit at 8% gain, or strong bearish signal (return < -1%)
            if price_change <= -0.04 or price_change >= 0.08 or pred_return < -0.01:
                cash = shares * current_close
                shares = 0
                trades += 1
                if current_close > buy_price:
                    wins += 1
        else:
            # Buy signal: predicted return > 1.5%
            if pred_return > 0.015:
                shares = cash / current_close
                cash = 0
                buy_price = current_close
                
        equity = cash + (shares * current_close)
        portfolio_value.append(equity)
        dates.append(current_date)
        close_prices.append(current_close)

    # 5. Compute Portfolio Performance Analytics
    portfolio_value = np.array(portfolio_value)
    close_prices = np.array(close_prices)
    
    daily_rets = pd.Series(portfolio_value).pct_change().dropna()
    
    cum_return = (portfolio_value[-1] - initial_capital) / initial_capital
    bench_return = (close_prices[-1] - close_prices[0]) / close_prices[0]
    
    # Annualized return (CAGR)
    total_years = len(portfolio_value) / 252.0
    cagr = float((portfolio_value[-1] / initial_capital) ** (1.0 / max(total_years, 0.1)) - 1.0)
    
    # Sharpe Ratio (Assumed 5% risk free rate)
    std_rets = daily_rets.std()
    rf_daily = 0.05 / 252.0
    sharpe_ratio = float(((daily_rets.mean() - rf_daily) / (std_rets + 1e-9)) * np.sqrt(252)) if std_rets > 0 else 0.0

    # Max Drawdown
    peaks = np.maximum.accumulate(portfolio_value)
    drawdowns = (portfolio_value - peaks) / (peaks + 1e-9)
    max_dd = float(drawdowns.min())
    
    win_rate = float(wins / trades) if trades > 0 else 0.0
    
    # Reconstruct curves
    equity_curve = []
    benchmark_curve = []
    for i in range(len(dates)):
        equity_curve.append({
            "date": dates[i],
            "value": float(portfolio_value[i]),
            "pct_change": float((portfolio_value[i] - initial_capital) / initial_capital * 100)
        })
        benchmark_curve.append({
            "date": dates[i],
            "value": float(close_prices[i]),
            "pct_change": float((close_prices[i] - close_prices[0]) / close_prices[0] * 100)
        })
        
    return {
        "ticker": ticker,
        "initial_capital": initial_capital,
        "final_value": float(portfolio_value[-1]),
        "total_trades": trades,
        "win_rate": win_rate,
        "cagr": cagr,
        "sharpe_ratio": sharpe_ratio,
        "max_drawdown": max_dd,
        "cumulative_return": cum_return,
        "benchmark_return": bench_return,
        "equity_curve": equity_curve,
        "benchmark_curve": benchmark_curve
    }
