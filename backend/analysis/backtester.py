import os
import json
import base64
import numpy as np
import pandas as pd
from typing import Dict, Any
import xgboost as xgb
from backend.analysis.feature_engineer import get_features
from backend.analysis.trainer import train_pipeline

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

# Transaction cost per trade (buy + sell round trip includes STT, brokerage, stamp duty)
TRANSACTION_COST_PCT = 0.002   # 0.2% per trade (conservative NSE estimate)

def run_backtest(df: pd.DataFrame, ticker: str, initial_capital: float = 100000.0) -> Dict[str, Any]:
    """
    Backtests the XGBoost + ElasticNet Ensemble model strategy on historical stock data.
    Uses a walk-forward approach over the full available history (not just last 120 days).
    Includes transaction costs (0.2% per trade) and computes extended analytics.
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

    # 2. Walk-forward: use ALL available features_df, minimum 30 rows needed
    backtest_len = len(features_df) - 7
    if backtest_len < 30:
        return {"error": "Insufficient data to run backtest. Need at least 30 rows."}

    sub_df = features_df.iloc[-backtest_len:].copy()

    # 3. Vectorized Prediction — load XGBoost from in-memory base64 bytes (thread-safe)
    booster = xgb.Booster()
    if "xgboost_b64" in bundle:
        xgb_bytes = base64.b64decode(bundle["xgboost_b64"])
        booster.load_model(bytearray(xgb_bytes))
    else:
        # Legacy fallback: old bundles stored raw JSON — use temp file once
        import tempfile, uuid
        xgb_json = bundle.get("xgboost")
        tmp = os.path.join(MODEL_DIR, f"{ticker}_backtest_legacy_{uuid.uuid4().hex}.json")
        try:
            with open(tmp, 'w') as tf:
                json.dump(xgb_json, tf)
            booster.load_model(tmp)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    X_matrix = sub_df[en_features]
    dtest = xgb.DMatrix(X_matrix)
    xgb_preds = booster.predict(dtest)

    # ElasticNet
    coef = np.array(bundle['elasticnet']['coef'])
    intercept = bundle['elasticnet']['intercept']
    en_preds = np.dot(X_matrix.values, coef) + intercept

    # Final predictions
    final_preds = xgb_preds + (0.15 * en_preds)

    # 4. Simulate Trades with transaction costs
    cash = initial_capital
    shares = 0.0
    portfolio_value = []
    dates = []
    close_prices = []

    trades = 0
    wins = 0
    buy_price = 0.0

    for idx in range(len(sub_df)):
        current_row = sub_df.iloc[idx]
        current_close = float(current_row["close"])
        current_date = str(current_row.name.strftime('%Y-%m-%d'))
        pred_target_price = final_preds[idx]

        pred_return = (pred_target_price - current_close) / (current_close + 1e-9)

        if shares > 0:
            price_change = (current_close - buy_price) / (buy_price + 1e-9)
            # Exit on stop-loss (4%), take-profit (8%), or bearish signal
            if price_change <= -0.04 or price_change >= 0.08 or pred_return < -0.01:
                # Deduct sell-side transaction cost
                cash = shares * current_close * (1.0 - TRANSACTION_COST_PCT)
                shares = 0.0
                trades += 1
                if current_close > buy_price:
                    wins += 1
        else:
            # Buy signal: predicted return > 1.5%
            if pred_return > 0.015:
                # Deduct buy-side transaction cost
                shares = (cash * (1.0 - TRANSACTION_COST_PCT)) / (current_close + 1e-9)
                cash = 0.0
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

    # Sharpe Ratio (5% risk-free rate)
    std_rets = daily_rets.std()
    rf_daily = 0.05 / 252.0
    sharpe_ratio = float(((daily_rets.mean() - rf_daily) / (std_rets + 1e-9)) * np.sqrt(252)) if std_rets > 0 else 0.0

    # Max Drawdown
    peaks = np.maximum.accumulate(portfolio_value)
    drawdowns = (portfolio_value - peaks) / (peaks + 1e-9)
    max_dd = float(drawdowns.min())

    # Calmar Ratio: CAGR / |Max Drawdown|
    calmar_ratio = float(cagr / abs(max_dd)) if abs(max_dd) > 1e-9 else 0.0

    # Sortino Ratio: only penalises downside volatility
    downside_rets = daily_rets[daily_rets < rf_daily]
    downside_std = downside_rets.std() if len(downside_rets) > 1 else 1e-9
    sortino_ratio = float(((daily_rets.mean() - rf_daily) / (downside_std + 1e-9)) * np.sqrt(252))

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
        "sortino_ratio": sortino_ratio,
        "calmar_ratio": calmar_ratio,
        "max_drawdown": max_dd,
        "cumulative_return": cum_return,
        "benchmark_return": bench_return,
        "transaction_cost_pct": TRANSACTION_COST_PCT,
        "backtest_days": backtest_len,
        "equity_curve": equity_curve,
        "benchmark_curve": benchmark_curve
    }
