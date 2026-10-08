"""StockOracle Pro — institutional walk-forward backtest simulation engine.


Split verbatim out of ``backend/analysis/backtester.py`` (pure code motion).
"""

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from .backtest_registry import (
    BUILTIN_STRATEGIES,
    STRATEGY_REGISTRY,
    _try_load_custom_strategies,
    logger,
)
from .backtest_features import _build_features_row_by_row, _compute_supertrend
from .backtest_ai import _predict_ai_walk_forward
from .backtest_analytics import (
    _compute_monthly_analytics,
    _compute_pnl_distribution,
    _run_monte_carlo,
)
from .backtest_execution import _calculate_friction, _strategy_ctx, _strategy_params

def run_backtest(
    df: pd.DataFrame,
    ticker: str,
    strategy: str = "ai_ensemble",
    initial_capital: float = 100000.0,
    position_size_pct: float = 100.0,
    entry_threshold: float = 0.015,
    stop_loss: float = 0.04,
    take_profit: float = 0.08,
    trailing_stop_pct: float = 0.0,
    bearish_exit_threshold: float = -0.01,
    train_test_split: float = 0.70,
    max_holding_days: int = 20,
    fast_period: int = 9,
    slow_period: int = 21,
    rsi_oversold: float = 30.0,
    rsi_overbought: float = 70.0,
    atr_multiplier: float = 2.0,
    slippage_bps: float = 10.0,
    commission_bps: float = 5.0,
    risk_per_trade_pct: float = 1.0,
    run_monte_carlo_sims: bool = True,
    interval: str = "1d",
    period: str = "ALL",
) -> Dict[str, Any]:
    """
    StockOracle Pro Institutional Walk-Forward Multi-Strategy Backtesting Engine.
    Executes out-of-sample backtests with no look-ahead bias across built-in strategies.
    """
    if str(strategy or "").lower().strip() == "smc_pro":
        from .backtest_smc import run_smc_backtest
        return run_smc_backtest(
            df, ticker, interval=interval, initial_capital=initial_capital,
            position_size_pct=position_size_pct, train_test_split=train_test_split,
            max_holding_days=max_holding_days, slippage_bps=slippage_bps,
            commission_bps=commission_bps, run_monte_carlo_sims=run_monte_carlo_sims,
            period=period, risk_per_trade_pct=risk_per_trade_pct,
        )

    # 1. Causal Feature Engineering
    features_df = _build_features_row_by_row(df)
    if len(features_df) < 60:
        return {"error": "Insufficient history to backtest. Need at least 60 daily trading sessions."}

    # 2. Out-of-Sample Split
    train_test_split = max(0.50, min(0.85, float(train_test_split)))
    split_idx = int(len(features_df) * train_test_split)
    train_df = features_df.iloc[:split_idx].copy().reset_index(drop=True)
    test_df = features_df.iloc[split_idx:].copy().reset_index(drop=True)
    train_end_date = str(train_df.iloc[-1]["date"])

    if len(test_df) < 15:
        return {"error": "Out-of-sample testing period is too short. Select a longer historical range."}

    strat_raw = str(strategy or "ai_ensemble")
    strat_norm = strat_raw.lower().strip()
    # Backward-compat alias
    if strat_norm == "ai_predictive":
        strat_norm = "ai_ensemble"

    # Custom strategies file ho to load karo (server restart bina nayi strategy pick ho)
    _try_load_custom_strategies()
    custom_spec = STRATEGY_REGISTRY.get(strat_norm)
    if strat_norm not in BUILTIN_STRATEGIES and custom_spec is None:
        known = sorted(list(BUILTIN_STRATEGIES.keys()) + list(STRATEGY_REGISTRY.keys()))
        return {"error": f"Unknown strategy '{strat_raw}'. Available: {', '.join(known)}"}
    is_custom = custom_spec is not None and strat_norm not in BUILTIN_STRATEGIES

    # Custom strategy ka entry/exit fn (builtin ids par custom override nahi — builtin jeet-ta hai)
    custom_entry = custom_spec.get("entry") if is_custom else None
    custom_exit_fn = custom_spec.get("exit") if is_custom else None
    if is_custom and not callable(custom_entry):
        return {"error": f"Custom strategy '{strat_norm}' me @register_strategy entry rule missing hai."}

    # 3. Compute Strategy Signals
    preds: Optional[np.ndarray] = None
    if strat_norm == "ai_ensemble":
        preds = _predict_ai_walk_forward(ticker, train_df, test_df)

    # Technical indicators for rule-based strategies
    fast_period = max(2, int(fast_period))
    slow_period = max(fast_period + 1, int(slow_period))

    ema_fast = pd.Series(test_df["close"]).ewm(span=fast_period, adjust=False).mean().values
    ema_slow = pd.Series(test_df["close"]).ewm(span=slow_period, adjust=False).mean().values

    # Donchian Breakout
    high_series = pd.Series(test_df["high"])
    low_series = pd.Series(test_df["low"])
    donchian_high = high_series.shift(1).rolling(fast_period, min_periods=1).max().values
    donchian_low = low_series.shift(1).rolling(slow_period, min_periods=1).min().values

    # Supertrend
    st_vals, st_dir = _compute_supertrend(test_df, period=10, multiplier=atr_multiplier)

    # 4. Simulation Execution State
    cash = float(initial_capital)
    shares = 0.0
    invested_capital = 0.0
    peak_price_since_entry = 0.0
    buy_price = 0.0
    buy_date = ""
    holding_days = 0

    total_slippage_paid = 0.0
    total_commissions_paid = 0.0

    portfolio_value = []
    equity_curve = []
    drawdown_curve = []
    trade_journal = []
    peak_equity = initial_capital

    n_test = len(test_df)
    pos_pct = max(0.1, min(1.0, position_size_pct / 100.0))

    for i in range(n_test):
        row = test_df.iloc[i]
        curr_close = float(row["close"])
        curr_date = str(row["date"])
        vol_ratio = float(row.get("volume_ratio", 1.0))
        rsi_val = float(row.get("rsi_14", 50.0))
        bb_low = float(row.get("bb_lower", curr_close * 0.95))
        bb_high = float(row.get("bb_upper", curr_close * 1.05))
        macd_val = float(row.get("macd", 0.0))
        macd_s = float(row.get("macd_signal", 0.0))

        day_action = "HOLD"

        if shares > 0:
            # ── In Position: Evaluate Exits ──
            holding_days += 1
            peak_price_since_entry = max(peak_price_since_entry, curr_close)
            pct_return_from_buy = (curr_close - buy_price) / buy_price

            # Check Exit Conditions
            stop_loss_hit = stop_loss > 0 and (pct_return_from_buy <= -stop_loss)
            take_profit_hit = take_profit > 0 and (pct_return_from_buy >= take_profit)
            trailing_stop_hit = (
                trailing_stop_pct > 0 and
                peak_price_since_entry > buy_price and
                ((peak_price_since_entry - curr_close) / peak_price_since_entry >= (trailing_stop_pct / 100.0))
            )
            time_stop_hit = holding_days >= max_holding_days

            # Strategy Signal Exit
            signal_exit_hit = False
            if is_custom and callable(custom_exit_fn):
                try:
                    signal_exit_hit = bool(custom_exit_fn(
                        _strategy_ctx(test_df, preds, ema_fast, ema_slow,
                                      donchian_high, donchian_low, st_vals, st_dir,
                                      curr_close, i),
                        i, _strategy_params(
                            fast_period, slow_period, rsi_oversold, rsi_overbought,
                            entry_threshold, bearish_exit_threshold, atr_multiplier,
                            stop_loss, take_profit, trailing_stop_pct, max_holding_days,
                            position_size_pct, slippage_bps, commission_bps)))
                except Exception:
                    logger.exception("custom exit '%s' failed — treated as no-exit", strat_norm)
                    signal_exit_hit = False
            elif strat_norm == "ai_ensemble" and preds is not None:
                pred_ret = (preds[i] - curr_close) / (curr_close + 1e-9)
                signal_exit_hit = pred_ret < bearish_exit_threshold
            elif strat_norm == "ema_crossover":
                signal_exit_hit = ema_fast[i] < ema_slow[i]
            elif strat_norm == "rsi_mean_reversion":
                signal_exit_hit = rsi_val >= rsi_overbought or curr_close >= bb_high
            elif strat_norm == "momentum_breakout":
                signal_exit_hit = curr_close < donchian_low[i]
            elif strat_norm == "macd_crossover":
                signal_exit_hit = macd_val < macd_s
            elif strat_norm == "supertrend":
                signal_exit_hit = st_dir[i] == -1

            exit_triggered = stop_loss_hit or take_profit_hit or trailing_stop_hit or signal_exit_hit or time_stop_hit

            if exit_triggered:
                gross_value = shares * curr_close
                slip, comm = _calculate_friction(gross_value, vol_ratio, slippage_bps, commission_bps)
                total_slippage_paid += slip
                total_commissions_paid += comm
                net_proceeds = gross_value - (slip + comm)

                pnl = net_proceeds - invested_capital
                pnl_pct = (pnl / invested_capital) * 100.0 if invested_capital > 0 else 0.0

                exit_reason = (
                    "Trailing Stop" if trailing_stop_hit else
                    "Stop Loss" if stop_loss_hit else
                    "Take Profit" if take_profit_hit else
                    "Max Hold" if time_stop_hit else
                    "Signal Exit"
                )

                trade_journal.append({
                    "trade_id": len(trade_journal) + 1,
                    "entry_date": buy_date,
                    "exit_date": curr_date,
                    "entry_price": round(buy_price, 2),
                    "exit_price": round(curr_close, 2),
                    "holding_days": holding_days,
                    "invested_capital": round(invested_capital, 2),
                    "pnl": round(pnl, 2),
                    "pnl_pct": round(pnl_pct, 2),
                    "exit_reason": exit_reason,
                    "result": "WIN" if pnl > 0 else "LOSS",
                    "frictions_paid": round(slip + comm, 2),
                })

                cash += net_proceeds
                shares = 0.0
                invested_capital = 0.0
                holding_days = 0
                peak_price_since_entry = 0.0
                day_action = "SELL"

        else:
            # ── Not in Position: Evaluate Entry Signals ──
            entry_signal = False

            if is_custom:
                try:
                    entry_signal = bool(custom_entry(
                        _strategy_ctx(test_df, preds, ema_fast, ema_slow,
                                      donchian_high, donchian_low, st_vals, st_dir,
                                      curr_close, i),
                        i, _strategy_params(
                            fast_period, slow_period, rsi_oversold, rsi_overbought,
                            entry_threshold, bearish_exit_threshold, atr_multiplier,
                            stop_loss, take_profit, trailing_stop_pct, max_holding_days,
                            position_size_pct, slippage_bps, commission_bps)))
                except Exception:
                    logger.exception("custom entry '%s' failed — treated as no-entry", strat_norm)
                    entry_signal = False
            elif strat_norm == "ai_ensemble" and preds is not None:
                pred_ret = (preds[i] - curr_close) / (curr_close + 1e-9)
                entry_signal = pred_ret > entry_threshold
            elif strat_norm == "ema_crossover":
                prev_fast = ema_fast[i-1] if i > 0 else ema_fast[0]
                prev_slow = ema_slow[i-1] if i > 0 else ema_slow[0]
                entry_signal = (ema_fast[i] > ema_slow[i]) and (prev_fast <= prev_slow)
            elif strat_norm == "rsi_mean_reversion":
                entry_signal = (rsi_val < rsi_oversold) and (curr_close <= bb_low * 1.01)
            elif strat_norm == "momentum_breakout":
                entry_signal = (curr_close > donchian_high[i]) and (vol_ratio >= 1.15)
            elif strat_norm == "macd_crossover":
                prev_m = macd_val if i == 0 else float(test_df.iloc[i-1]["macd"])
                prev_s = macd_s if i == 0 else float(test_df.iloc[i-1]["macd_signal"])
                entry_signal = (macd_val > macd_s) and (prev_m <= prev_s) and (macd_val > -0.5)
            elif strat_norm == "supertrend":
                prev_dir = st_dir[i-1] if i > 0 else st_dir[0]
                entry_signal = (st_dir[i] == 1) and (prev_dir == -1)

            if entry_signal and cash > 100:
                capital_to_allocate = cash * pos_pct
                slip, comm = _calculate_friction(capital_to_allocate, vol_ratio, slippage_bps, commission_bps)
                total_slippage_paid += slip
                total_commissions_paid += comm

                effective_capital = capital_to_allocate - (slip + comm)
                shares = effective_capital / (curr_close + 1e-9)
                cash -= capital_to_allocate
                invested_capital = capital_to_allocate
                buy_price = curr_close
                buy_date = curr_date
                holding_days = 1
                peak_price_since_entry = curr_close
                day_action = "BUY"

        # Daily Equity Accounting
        current_equity = cash + (shares * curr_close)
        portfolio_value.append(current_equity)
        peak_equity = max(peak_equity, current_equity)
        dd_pct = ((current_equity - peak_equity) / peak_equity) * 100.0

        equity_curve.append({
            "date": curr_date,
            "value": round(current_equity, 2),
            "pct_change": round(((current_equity - initial_capital) / initial_capital) * 100.0, 2),
            "action": day_action,
            "price": round(curr_close, 2),
            "cash": round(cash, 2),
            "invested": round(shares * curr_close, 2),
        })

        drawdown_curve.append({
            "date": curr_date,
            "drawdown_pct": round(dd_pct, 2),
        })

    # 5. Liquidate any open position at simulation termination
    if shares > 0:
        final_close = float(test_df.iloc[-1]["close"])
        final_date = str(test_df.iloc[-1]["date"])
        gross_value = shares * final_close
        slip, comm = _calculate_friction(gross_value, 1.0, slippage_bps, commission_bps)
        total_slippage_paid += slip
        total_commissions_paid += comm
        net_proceeds = gross_value - (slip + comm)
        pnl = net_proceeds - invested_capital
        pnl_pct = (pnl / invested_capital) * 100.0 if invested_capital > 0 else 0.0

        trade_journal.append({
            "trade_id": len(trade_journal) + 1,
            "entry_date": buy_date,
            "exit_date": final_date,
            "entry_price": round(buy_price, 2),
            "exit_price": round(final_close, 2),
            "holding_days": holding_days,
            "invested_capital": round(invested_capital, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "exit_reason": "Period End",
            "result": "WIN" if pnl > 0 else "LOSS",
            "frictions_paid": round(slip + comm, 2),
        })

        cash += net_proceeds
        shares = 0.0
        portfolio_value[-1] = cash
        equity_curve[-1]["value"] = round(cash, 2)
        equity_curve[-1]["pct_change"] = round(((cash - initial_capital) / initial_capital) * 100.0, 2)

    # 6. Performance & Quantitative Risk KPIs
    pv = np.array(portfolio_value)
    close_prices = test_df["close"].values.astype(float)
    daily_rets = pd.Series(pv).pct_change().fillna(0.0)
    bench_daily_rets = pd.Series(close_prices).pct_change().fillna(0.0)

    cum_return = (pv[-1] - initial_capital) / initial_capital
    bench_return = (close_prices[-1] - close_prices[0]) / close_prices[0]
    total_years = len(pv) / 252.0
    cagr = float((pv[-1] / initial_capital) ** (1.0 / max(total_years, 0.05)) - 1.0)

    rf_daily = 0.065 / 252.0
    std_rets = float(daily_rets.std())
    sharpe = float(((daily_rets.mean() - rf_daily) / (std_rets + 1e-9)) * np.sqrt(252)) if std_rets > 0 else 0.0

    peaks = np.maximum.accumulate(pv)
    drawdowns = (pv - peaks) / (peaks + 1e-9)
    max_dd = float(np.min(drawdowns))

    calmar = float(cagr / abs(max_dd)) if abs(max_dd) > 1e-9 else 0.0

    downside = daily_rets[daily_rets < rf_daily]
    downside_std = float(downside.std()) if len(downside) > 1 else 1e-9
    sortino = float(((daily_rets.mean() - rf_daily) / (downside_std + 1e-9)) * np.sqrt(252))

    # Beta vs Buy & Hold
    cov = np.cov(daily_rets.values, bench_daily_rets.values)
    bench_var = np.var(bench_daily_rets.values)
    beta = float(cov[0, 1] / (bench_var + 1e-9)) if bench_var > 0 else 1.0

    # Trade Statistics
    wins = [t for t in trade_journal if t["result"] == "WIN"]
    losses = [t for t in trade_journal if t["result"] == "LOSS"]
    total_trades = len(trade_journal)
    win_rate = (len(wins) / max(1, total_trades))

    gross_profit = float(sum(t["pnl"] for t in wins))
    gross_loss = float(abs(sum(t["pnl"] for t in losses)))
    profit_factor = round(gross_profit / max(1.0, gross_loss), 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)

    avg_win_pct = float(np.mean([t["pnl_pct"] for t in wins])) if wins else 0.0
    avg_loss_pct = float(np.mean([t["pnl_pct"] for t in losses])) if losses else 0.0
    payoff_ratio = round(avg_win_pct / max(0.01, abs(avg_loss_pct)), 2) if avg_loss_pct != 0 else 0.0

    # Mathematical Expectancy
    expectancy_pct = (win_rate * avg_win_pct) - ((1.0 - win_rate) * abs(avg_loss_pct))
    avg_win_val = float(np.mean([t["pnl"] for t in wins])) if wins else 0.0
    avg_loss_val = float(abs(np.mean([t["pnl"] for t in losses]))) if losses else 0.0
    expectancy_val = (win_rate * avg_win_val) - ((1.0 - win_rate) * avg_loss_val)

    avg_hold = float(np.mean([t["holding_days"] for t in trade_journal])) if trade_journal else 0.0
    best_trade_pct = float(max([t["pnl_pct"] for t in trade_journal])) if trade_journal else 0.0
    worst_trade_pct = float(min([t["pnl_pct"] for t in trade_journal])) if trade_journal else 0.0

    # Consecutive streak tracking
    max_consec_wins = 0
    max_consec_losses = 0
    cur_wins = 0
    cur_losses = 0
    for t in trade_journal:
        if t["result"] == "WIN":
            cur_wins += 1
            cur_losses = 0
            max_consec_wins = max(max_consec_wins, cur_wins)
        else:
            cur_losses += 1
            cur_wins = 0
            max_consec_losses = max(max_consec_losses, cur_losses)

    recovery_factor = float(cum_return / abs(max_dd)) if abs(max_dd) > 1e-9 else 0.0

    # 7. Benchmark Curves (Asset Buy & Hold)
    benchmark_curve = []
    first_close = close_prices[0]
    for i, row in enumerate(equity_curve):
        c_px = float(close_prices[i]) if i < len(close_prices) else close_prices[-1]
        benchmark_curve.append({
            "date": row["date"],
            "value": round(initial_capital * (c_px / first_close), 2),
            "pct_change": round(((c_px - first_close) / first_close) * 100.0, 2),
        })

    # 8. Monthly Analytics & Heatmap Matrix
    monthly_returns, monthly_matrix = _compute_monthly_analytics(equity_curve)

    # 9. P&L Histogram Distribution
    pnl_dist = _compute_pnl_distribution(trade_journal)

    # 10. Monte Carlo 500 Shuffle Simulations
    mc_results = _run_monte_carlo(daily_rets, n_sims=500, initial_capital=initial_capital) if run_monte_carlo_sims else {}

    # 11. Exit Reason Breakdown
    exit_reasons = {}
    for t in trade_journal:
        er = t.get("exit_reason", "Unknown")
        exit_reasons[er] = exit_reasons.get(er, 0) + 1

    strategy_names = {
        "ai_ensemble": "AI Walk-Forward ML Ensemble",
        "ema_crossover": "EMA Trend Following / Golden Cross",
        "rsi_mean_reversion": "RSI + Bollinger Mean Reversion",
        "momentum_breakout": "20-Day Momentum / Donchian Breakout",
        "macd_crossover": "MACD Signal Momentum Cross",
        "supertrend": "Supertrend Volatility Trail",
    }
    # Custom labels registry se (builtin override nahi hota)
    for _sid, _spec in STRATEGY_REGISTRY.items():
        if _sid not in strategy_names and _spec.get("label"):
            strategy_names[_sid] = str(_spec["label"])

    return {
        "ticker": ticker.upper(),
        "strategy": strat_norm,
        "strategy_label": strategy_names.get(strat_norm, strat_norm.upper()),
        "is_custom": bool(is_custom),
        "custom_description": str((custom_spec or {}).get("description") or ""),
        "initial_capital": initial_capital,
        "final_value": round(float(pv[-1]), 2),
        "out_of_sample_start": train_end_date,
        "backtest_days": len(test_df),
        "train_test_split_pct": round(train_test_split * 100, 0),

        # Strategy Parameters Used
        "strategy_params": {
            "strategy": strat_norm,
            "initial_capital": initial_capital,
            "position_size_pct": round(position_size_pct, 1),
            "stop_loss_pct": round(stop_loss * 100, 2),
            "take_profit_pct": round(take_profit * 100, 2),
            "trailing_stop_pct": round(trailing_stop_pct, 2),
            "max_holding_days": max_holding_days,
            "fast_period": fast_period,
            "slow_period": slow_period,
            "rsi_oversold": rsi_oversold,
            "rsi_overbought": rsi_overbought,
            "atr_multiplier": atr_multiplier,
            "entry_threshold_pct": round(entry_threshold * 100, 2),
            "slippage_bps": slippage_bps,
            "commission_bps": commission_bps,
        },

        # Returns & Benchmark
        "cumulative_return": round(cum_return, 4),
        "benchmark_return": round(bench_return, 4),
        "cagr": round(cagr, 4),
        "alpha": round(cum_return - bench_return, 4),
        "beta": round(beta, 2),

        # Risk-Adjusted KPIs
        "sharpe_ratio": round(sharpe, 3),
        "sortino_ratio": round(sortino, 3),
        "calmar_ratio": round(calmar, 3),
        "max_drawdown": round(max_dd, 4),
        "recovery_factor": round(recovery_factor, 3),
        "profit_factor": profit_factor,

        # Trade Analytics
        "total_trades": total_trades,
        "win_rate": round(win_rate, 4),
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "payoff_ratio": payoff_ratio,
        "expectancy_pct": round(expectancy_pct, 2),
        "expectancy_val": round(expectancy_val, 2),
        "avg_holding_days": round(avg_hold, 1),
        "avg_win_pct": round(avg_win_pct, 2),
        "avg_loss_pct": round(avg_loss_pct, 2),
        "best_trade_pct": round(best_trade_pct, 2),
        "worst_trade_pct": round(worst_trade_pct, 2),
        "max_consecutive_wins": max_consec_wins,
        "max_consecutive_losses": max_consec_losses,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "total_slippage_paid": round(total_slippage_paid, 2),
        "total_commissions_paid": round(total_commissions_paid, 2),
        "total_frictions_paid": round(total_slippage_paid + total_commissions_paid, 2),
        "exit_reason_breakdown": exit_reasons,

        # Time Series & Data Structures
        "equity_curve": equity_curve,
        "benchmark_curve": benchmark_curve,
        "drawdown_curve": drawdown_curve,
        "monthly_returns": monthly_returns,
        "monthly_matrix": monthly_matrix,
        "trade_pnl_distribution": pnl_dist,
        "trade_journal": trade_journal,

        # Monte Carlo Robustness
        "monte_carlo": mc_results,
    }
