"""StockOracle Pro — backtest analytics (monthly matrix, P&L histogram, Monte Carlo).


Split verbatim out of ``backend/analysis/backtester.py`` (pure code motion).
"""

from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

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


def _run_monte_carlo(daily_rets: pd.Series, n_sims: int = 500,
                     initial_capital: float = 100000.0,
                     periods_per_year: int = 252) -> Dict:
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
    periods_per_year = max(1, int(periods_per_year))
    rf_daily = 0.065 / periods_per_year
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
        sharpe = float(((np.mean(shuffled) - rf_daily) / (std + 1e-9)) * np.sqrt(periods_per_year)) if std > 0 else 0.0
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
