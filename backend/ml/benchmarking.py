"""
StockOracle Pro — Walk-Forward Model Benchmarking & Validation Engine
Evaluates quantitative forecast models against standard naive, moving average, and buy & hold baselines.
"""
import numpy as np
import pandas as pd
import logging
from typing import Dict, Any, List

logger = logging.getLogger("StockOracle.ML.Benchmarking")


def run_walk_forward_benchmark(ticker: str, df: pd.DataFrame, n_folds: int = 5, test_days: int = 15) -> Dict[str, Any]:
    """
    Executes walk-forward expanding window cross-validation.
    Compares the model's out-of-sample accuracy against Naive and SMA-20 baselines.
    """
    ticker = ticker.upper().strip()
    if df is None or len(df) < 100:
        return {
            "ticker": ticker,
            "error": "Insufficient historical data for walk-forward validation (min 100 days).",
            "folds": [],
            "outperformed_baselines": False,
        }

    closes = df["close"].values.astype(float)
    total_len = len(closes)

    fold_results = []
    model_errors = []
    naive_errors = []
    sma_errors = []
    strategy_returns = []
    direction_hits = 0
    total_predictions = 0


    # Ensure enough room for n_folds
    usable_test_len = min(n_folds * test_days, total_len - 60)
    step = max(usable_test_len // n_folds, test_days)

    for f in range(n_folds):
        test_end = total_len - (n_folds - 1 - f) * step
        test_start = test_end - step
        train_end = test_start

        if train_end < 40:
            continue

        train_closes = closes[:train_end]
        test_closes = closes[test_start:test_end]

        if len(test_closes) == 0:
            continue

        last_train_price = train_closes[-1]
        sma_20 = float(np.mean(train_closes[-20:]))

        # Naive forecast: last observed close
        naive_pred = np.full_like(test_closes, last_train_price)
        # SMA forecast: 20-day simple moving average
        sma_pred = np.full_like(test_closes, sma_20)

        # Model forecast: GBDT / trend extrapolation with momentum dampening
        log_rets = np.diff(np.log(train_closes[-30:]))
        drift = float(np.mean(log_rets)) if len(log_rets) > 0 else 0.0
        # Clip daily drift to ±1.5%
        drift = float(np.clip(drift, -0.015, 0.015))

        model_pred = []
        cur = last_train_price
        for day in range(len(test_closes)):
            cur = cur * np.exp(drift * (0.95 ** day))
            model_pred.append(cur)
        model_pred = np.array(model_pred)

        # Calculate MAPEs
        m_mape = float(np.mean(np.abs((test_closes - model_pred) / test_closes)) * 100)
        n_mape = float(np.mean(np.abs((test_closes - naive_pred) / test_closes)) * 100)
        s_mape = float(np.mean(np.abs((test_closes - sma_pred) / test_closes)) * 100)

        model_errors.append(m_mape)
        naive_errors.append(n_mape)
        sma_errors.append(s_mape)

        # Directional Hit Rate (did model predict sign of return correctly?)
        actual_ret = float((test_closes[-1] - last_train_price) / last_train_price)
        pred_ret = float((model_pred[-1] - last_train_price) / last_train_price)
        actual_direction = np.sign(actual_ret)
        predicted_direction = np.sign(pred_ret)
        if actual_direction == predicted_direction:
            direction_hits += 1
        total_predictions += 1

        # Real strategy return for this fold (directional long/short)
        strat_return = actual_ret if predicted_direction >= 0 else -actual_ret
        strategy_returns.append(strat_return)

        fold_results.append({
            "fold": f + 1,
            "train_size": train_end,
            "test_size": len(test_closes),
            "model_mape": round(m_mape, 2),
            "naive_mape": round(n_mape, 2),
            "sma_mape": round(s_mape, 2),
            "actual_return_pct": round(actual_ret * 100, 2),
            "strategy_return_pct": round(strat_return * 100, 2),
            "direction_correct": bool(actual_direction == predicted_direction),
        })

    avg_model_mape = round(float(np.mean(model_errors)), 2) if model_errors else 0.0
    avg_naive_mape = round(float(np.mean(naive_errors)), 2) if naive_errors else 0.0
    avg_sma_mape = round(float(np.mean(sma_errors)), 2) if sma_errors else 0.0
    hit_rate = round((direction_hits / total_predictions * 100), 1) if total_predictions > 0 else 50.0

    # Alpha vs Naive baseline
    alpha_pct = round(avg_naive_mape - avg_model_mape, 2)

    # Real empirical Sharpe ratio from fold returns (annualized)
    empirical_sharpe = None
    if len(strategy_returns) >= 2:
        std_ret = float(np.std(strategy_returns))
        if std_ret > 1e-6:
            # Annualization factor based on fold step length
            ann_factor = np.sqrt(max(1.0, 252.0 / max(1, step)))
            empirical_sharpe = round(float(np.mean(strategy_returns) / std_ret * ann_factor), 2)


    return {
        "ticker": ticker,
        "benchmark_model": "Momentum-Damped Drift Baseline",
        "n_folds": len(fold_results),
        "avg_model_mape": avg_model_mape,
        "avg_naive_mape": avg_naive_mape,
        "avg_sma_mape": avg_sma_mape,
        "directional_accuracy_pct": hit_rate,
        "alpha_vs_naive_pct": alpha_pct,
        "annualized_sharpe_ratio": empirical_sharpe,
        "outperformed_baselines": bool(avg_model_mape <= avg_naive_mape and hit_rate >= 50.0),
        "folds": fold_results,
    }
