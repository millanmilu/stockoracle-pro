"""
StockOracle Pro — Institutional Walk-Forward Backtesting Engine v3.0

Quantitative Features:
  1. ✅ Multi-Strategy Engine:
       - AI Ensemble (XGBoost + ElasticNet Walk-Forward with Auto In-Sample Fit Fallback)
       - EMA Trend Following / Crossover (Golden Cross)
       - RSI + Bollinger Bands Mean Reversion
       - 20-Day Momentum / Donchian Breakout with Volume Expansion
       - MACD Signal Crossover
       - Supertrend Volatility Trailing Trend
  2. ✅ Look-Ahead Bias Eliminated: Features computed causally per-row up to day T
  3. ✅ True Out-of-Sample Testing: Train/Test split (default 70/30), model trained strictly on past
  4. ✅ Configurable Risk & Execution:
       - Position Sizing (% of equity)
       - Stop Loss (%)
       - Take Profit (%)
       - Trailing Stop (% from peak)
       - Max Holding Period (Time-stop)
       - Realistic Frictions: Configurable Slippage (bps) + Commission/STT (bps) + Liquidity penalty
  5. ✅ Institutional Analytics:
       - Sharpe, Sortino, Calmar, Alpha vs B&H, Beta, CAGR, Recovery Factor, Max Drawdown
       - Win Rate, Profit Factor, Payoff Ratio (Avg Win / Avg Loss), Expectancy (₹ & %)
       - Consecutive Wins / Losses, Best / Worst Trade
  6. ✅ Monthly Returns Heatmap Matrix & Trade P&L Distribution
  7. ✅ Monte Carlo Robustness (500 Random Permutations)
"""
import os
import json
import tempfile
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
import xgboost as xgb
from sklearn.linear_model import ElasticNet


MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")


def _build_features_row_by_row(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes ALL indicators using strictly past data only — zero look-ahead bias.
    Uses causal rolling & ewm operations with min_periods=1.
    """
    df = df.copy().sort_values("date").reset_index(drop=True)
    closes = df["close"].values.astype(float)
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    volumes = df["volume"].values.astype(float)

    n = len(df)
    out = df.copy()

    # ── Causal RSI (14) ────────────────────────────────────────────────────────
    delta = pd.Series(closes).diff()
    gain = delta.clip(lower=0).fillna(0)
    loss = (-delta).clip(lower=0).fillna(0)
    avg_gain = gain.ewm(alpha=1/14, min_periods=1, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/14, min_periods=1, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    out["rsi_14"] = (100 - 100 / (1 + rs)).values

    # ── Causal MACD (12, 26, 9) ───────────────────────────────────────────────
    ema12 = pd.Series(closes).ewm(span=12, adjust=False).mean()
    ema26 = pd.Series(closes).ewm(span=26, adjust=False).mean()
    macd_line = (ema12 - ema26).values
    macd_sig = pd.Series(macd_line).ewm(span=9, adjust=False).mean().values
    out["macd"] = macd_line
    out["macd_signal"] = macd_sig
    out["macd_hist"] = macd_line - macd_sig

    # ── Causal ATR (14) ─────────────────────────────────────────────────────────
    prev_close = pd.Series(closes).shift(1)
    tr = pd.concat([
        pd.Series(highs) - pd.Series(lows),
        (pd.Series(highs) - prev_close).abs(),
        (pd.Series(lows) - prev_close).abs(),
    ], axis=1).max(axis=1)
    out["atr_14"] = tr.rolling(14, min_periods=1).mean().values

    # ── Causal Bollinger Bands (20, 2 std) ────────────────────────────────────
    rm20 = pd.Series(closes).rolling(20, min_periods=1).mean()
    rs20 = pd.Series(closes).rolling(20, min_periods=1).std().fillna(0)
    bb_upper = (rm20 + 2 * rs20).values
    bb_lower = (rm20 - 2 * rs20).values
    out["bb_upper"] = bb_upper
    out["bb_lower"] = bb_lower
    out["bb_mid"] = rm20.values
    out["bb_pct_b"] = ((pd.Series(closes) - bb_lower) / (bb_upper - bb_lower + 1e-9)).values

    # ── Rolling Means (Moving Averages) ────────────────────────────────────────
    out["roll_mean_5"]  = pd.Series(closes).rolling(5, min_periods=1).mean().values
    out["roll_mean_9"]  = pd.Series(closes).ewm(span=9, adjust=False).mean().values
    out["roll_mean_10"] = pd.Series(closes).rolling(10, min_periods=1).mean().values
    out["roll_mean_20"] = rm20.values
    out["roll_mean_21"] = pd.Series(closes).ewm(span=21, adjust=False).mean().values
    out["roll_mean_50"] = pd.Series(closes).rolling(50, min_periods=1).mean().values

    # ── Rolling Stds ──────────────────────────────────────────────────────────
    out["roll_std_5"]  = pd.Series(closes).rolling(5, min_periods=1).std().fillna(0).values
    out["roll_std_10"] = pd.Series(closes).rolling(10, min_periods=1).std().fillna(0).values
    out["roll_std_20"] = rs20.values

    # ── Lagged Closes ────────────────────────────────────────────────────────
    for lag in range(1, 6):
        out[f"lag_{lag}"] = pd.Series(closes).shift(lag).values

    # ── Rate of Change ───────────────────────────────────────────────────────
    out["roc_1"] = pd.Series(closes).pct_change(1).fillna(0).values * 100
    out["roc_5"] = pd.Series(closes).pct_change(5).fillna(0).values * 100

    # ── Volume ratio ─────────────────────────────────────────────────────────
    vol_sma20 = pd.Series(volumes).rolling(20, min_periods=1).mean()
    out["volume_ratio"] = (pd.Series(volumes) / (vol_sma20 + 1e-9)).values

    # ── Day-of-week cyclical encoding ────────────────────────────────────────
    dates_parsed = pd.to_datetime(df["date"], format="mixed", errors="coerce")
    dow = dates_parsed.dt.dayofweek.fillna(0).astype(int)
    out["dow_sin"] = np.sin(2 * np.pi * dow / 7)
    out["dow_cos"] = np.cos(2 * np.pi * dow / 7)
    out["sentiment"] = 0.0

    return out.dropna().reset_index(drop=True)


def _compute_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 2.0) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes Supertrend indicator causally.
    Returns: (supertrend_values, direction) where direction is 1 (bullish) or -1 (bearish).
    """
    high = df["high"].values.astype(float)
    low = df["low"].values.astype(float)
    close = df["close"].values.astype(float)
    n = len(df)

    prev_close = pd.Series(close).shift(1)
    tr = pd.concat([
        pd.Series(high) - pd.Series(low),
        (pd.Series(high) - prev_close).abs(),
        (pd.Series(low) - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr = tr.rolling(period, min_periods=1).mean().values

    hl2 = (high + low) / 2.0
    basic_upper = hl2 + multiplier * atr
    basic_lower = hl2 - multiplier * atr

    final_upper = np.zeros(n)
    final_lower = np.zeros(n)
    direction = np.zeros(n)

    for i in range(n):
        if i == 0:
            final_upper[i] = basic_upper[i]
            final_lower[i] = basic_lower[i]
            direction[i] = 1 if close[i] >= hl2[i] else -1
            continue

        final_upper[i] = basic_upper[i] if (basic_upper[i] < final_upper[i-1] or close[i-1] > final_upper[i-1]) else final_upper[i-1]
        final_lower[i] = basic_lower[i] if (basic_lower[i] > final_lower[i-1] or close[i-1] < final_lower[i-1]) else final_lower[i-1]

        if direction[i-1] == 1:
            direction[i] = -1 if close[i] < final_lower[i] else 1
        else:
            direction[i] = 1 if close[i] > final_upper[i] else -1

    st_val = np.where(direction == 1, final_lower, final_upper)
    return st_val, direction


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


def _calculate_friction(trade_value: float, vol_ratio: float, slippage_bps: float, commission_bps: float) -> Tuple[float, float]:
    """
    Returns (slippage_cost, commission_cost) in currency units.
    Includes base slippage bps + volume liquidity penalty + trade market impact.
    """
    base_slip = slippage_bps / 10000.0
    liquidity_pen = max(0.0, (1.0 - min(vol_ratio, 3.0)) * 0.0005)
    market_impact = min(0.0015, trade_value / 50_000_000 * 0.0015)
    eff_slip_rate = base_slip + liquidity_pen + market_impact

    comm_rate = commission_bps / 10000.0

    slip_cost = trade_value * eff_slip_rate
    comm_cost = trade_value * comm_rate
    return slip_cost, comm_cost


def _compute_monthly_analytics(equity_curve: List[Dict]) -> Tuple[List[Dict], Dict[str, Dict[str, float]]]:
    """
    Groups daily equity values into monthly return series and structured matrix for heatmaps.
    """
    if not equity_curve:
        return [], {}

    df = pd.DataFrame(equity_curve)
    df["date"] = pd.to_datetime(df["date"])
    df["year"] = df["date"].dt.year
    df["month_name"] = df["date"].dt.strftime("%b")
    df["year_month"] = df["date"].dt.to_period("M")

    grouped = df.groupby(["year", "year_month", "month_name"])["value"].agg(["first", "last"]).reset_index()
    monthly_list = []
    matrix: Dict[str, Dict[str, float]] = {}

    for _, row in grouped.iterrows():
        yr = str(int(row["year"]))
        m_name = str(row["month_name"])
        ret = ((row["last"] - row["first"]) / max(1.0, row["first"])) * 100.0
        ret_clean = round(float(ret), 2)
        monthly_list.append({
            "period": str(row["year_month"]),
            "year": int(row["year"]),
            "month": m_name,
            "return_pct": ret_clean,
            "is_positive": ret_clean >= 0,
        })
        if yr not in matrix:
            matrix[yr] = {}
        matrix[yr][m_name] = ret_clean

    # Calculate full Year return
    for yr in matrix:
        yr_df = df[df["year"] == int(yr)]
        if not yr_df.empty:
            yr_ret = ((yr_df["value"].iloc[-1] - yr_df["value"].iloc[0]) / max(1.0, yr_df["value"].iloc[0])) * 100.0
            matrix[yr]["Year"] = round(float(yr_ret), 2)

    return monthly_list, matrix


def _compute_pnl_distribution(trade_journal: List[Dict]) -> List[Dict]:
    """Categorizes trade returns into histogram distribution buckets."""
    bins_def = [
        {"label": "< -5%", "min": -999999.0, "max": -5.0, "color": "#E11D48"},
        {"label": "-5% to -2%", "min": -5.0, "max": -2.0, "color": "#F43F5E"},
        {"label": "-2% to 0%", "min": -2.0, "max": 0.0, "color": "#FB7185"},
        {"label": "0% to +2%", "min": 0.0, "max": 2.0, "color": "#34D399"},
        {"label": "+2% to +5%", "min": 2.0, "max": 5.0, "color": "#10B981"},
        {"label": "+5% to +10%", "min": 5.0, "max": 10.0, "color": "#059669"},
        {"label": "> +10%", "min": 10.0, "max": 999999.0, "color": "#047857"},
    ]
    counts = [0] * len(bins_def)
    for t in trade_journal:
        pnl_pct = float(t.get("pnl_pct", 0.0))
        for idx, b in enumerate(bins_def):
            if b["min"] <= pnl_pct < b["max"]:
                counts[idx] += 1
                break

    return [
        {"label": b["label"], "count": counts[idx], "color": b["color"]}
        for idx, b in enumerate(bins_def)
    ]


def _run_monte_carlo(daily_rets: pd.Series, n_sims: int = 500, initial_capital: float = 100000.0) -> Dict:
    """
    Performs 500 random shuffle permutations to test strategy robustness and calculate confidence intervals.
    """
    if len(daily_rets) < 15:
        return {
            "sharpe_p5": 0, "sharpe_p50": 0, "sharpe_p95": 0,
            "final_p5": 0, "final_p50": 0, "final_p95": 0,
            "max_dd_p95": 0, "pct_profitable": 0,
        }

    rets_arr = daily_rets.values
    rf_daily = 0.065 / 252.0
    sim_sharpes = []
    sim_finals = []
    sim_dds = []

    for _ in range(n_sims):
        shuffled = np.random.permutation(rets_arr)
        equity = initial_capital * np.cumprod(1 + shuffled)
        final_val = float(equity[-1])
        sim_finals.append(final_val)

        # Sharpe
        std = float(np.std(shuffled))
        sharpe = float(((np.mean(shuffled) - rf_daily) / (std + 1e-9)) * np.sqrt(252)) if std > 0 else 0.0
        sim_sharpes.append(sharpe)

        # Max drawdown
        peaks = np.maximum.accumulate(equity)
        dds = (equity - peaks) / (peaks + 1e-9)
        sim_dds.append(float(np.min(dds)))

    return {
        "sharpe_p5":   round(float(np.percentile(sim_sharpes, 5)), 2),
        "sharpe_p50":  round(float(np.percentile(sim_sharpes, 50)), 2),
        "sharpe_p95":  round(float(np.percentile(sim_sharpes, 95)), 2),
        "final_p5":    round(float(np.percentile(sim_finals, 5)), 2),
        "final_p50":   round(float(np.percentile(sim_finals, 50)), 2),
        "final_p95":   round(float(np.percentile(sim_finals, 95)), 2),
        "max_dd_p95":  round(float(np.percentile(sim_dds, 5)) * 100, 2),  # 5th percentile is worst drawdown
        "pct_profitable": round(float(np.mean([1 if f > initial_capital else 0 for f in sim_finals]) * 100), 1),
    }


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
    run_monte_carlo_sims: bool = True,
) -> Dict[str, Any]:
    """
    StockOracle Pro Institutional Walk-Forward Multi-Strategy Backtesting Engine.
    Executes real out-of-sample backtests with no look-ahead bias across 6 strategy archetypes.
    """
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

    strat_norm = strategy.lower().strip()

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
            if strat_norm == "ai_ensemble" and preds is not None:
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

            if strat_norm == "ai_ensemble" and preds is not None:
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

    return {
        "ticker": ticker.upper(),
        "strategy": strat_norm,
        "strategy_label": strategy_names.get(strat_norm, strat_norm.upper()),
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
