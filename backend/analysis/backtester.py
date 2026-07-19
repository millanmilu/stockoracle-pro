import numpy as np
import pandas as pd
from typing import Dict, Any, List
from backend.ml.predictor import StockPredictor

def run_backtest(df: pd.DataFrame, ticker: str, initial_capital: float = 100000.0) -> Dict[str, Any]:
    """
    Backtests the AI Ensemble model strategy on historical stock data.
    Simulates trades based on model forecast signals and calculates standard metrics:
    Win Rate, CAGR, Sharpe Ratio, Max Drawdown, and Cumulative Returns.
    """
    # 1. Initialize predictor
    predictor = StockPredictor(window_size=20)
    
    # 2. Check if a trained model exists; if not, train a quick model (15 epochs) for backtesting
    try:
        # Load model and verify by running on a small sub-slice
        _ = predictor.load_and_predict(df.iloc[:predictor.window_size + 10], ticker)
    except Exception:
        print(f"⚠️ No model found for backtest of {ticker} — training a quick ensemble...")
        # Train model with 15 epochs to initialize weights
        predictor.train_model(df, ticker, epochs=15)

    # 3. Calculate sliding window predictions over the backtest period
    # To keep execution under reasonable limits, we test on the last 120 trading days
    backtest_len = min(120, len(df) - predictor.window_size - 7)
    if backtest_len <= 0:
        return {"error": "Insufficient data to run backtest. Need at least 30 rows."}
        
    start_idx = len(df) - backtest_len
    
    # Trade tracking states
    cash = initial_capital
    shares = 0
    portfolio_value = []
    dates = []
    close_prices = []
    
    trades = 0
    wins = 0
    buy_price = 0.0
    
    for idx in range(start_idx, len(df)):
        current_row = df.iloc[idx]
        current_close = float(current_row["close"])
        current_date = str(current_row["date"])
        
        # Build historical slice up to this day to prevent look-ahead bias
        sub_df = df.iloc[:idx + 1]
        
        try:
            pred_return = predictor.load_and_predict(sub_df, ticker)
        except Exception:
            pred_return = 0.0
            
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

    # 4. Compute Portfolio Performance Analytics
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
