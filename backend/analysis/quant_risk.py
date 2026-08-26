"""
StockOracle Pro — Quantitative Portfolio Risk & Econometrics Cockpit

Computes Parametric & Historical VaR 95%/99%, CVaR, Sharpe, Sortino, Calmar,
beta vs NIFTY benchmark, and correlation heatmaps.

DATA QUALITY TRANSPARENCY RULES (P1 fix):
  - When real price data is insufficient, the response includes:
      is_simulated: true
      data_quality: "simulated"
      fallback_reason: <why>
  - Beta is calculated ONLY against actual NIFTY50 returns; if benchmark
    data is unavailable, beta_vs_nifty returns null (not a hardcoded 0.94).
  - Simulated metrics are clearly labelled and must NOT be presented to the
    user as real portfolio risk numbers.
"""
import math
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

from backend.data.fetcher import fetch_stock_data

logger = logging.getLogger("StockOracle.Analysis.QuantRisk")

_NIFTY_PROXY = "NIFTY_50"   # yfinance: ^NSEI  — tried via fetch_stock_data


def _fetch_nifty_returns(period: str = "1Y") -> Optional[np.ndarray]:
    """Fetch NIFTY50 daily returns for beta calculation. Returns None if unavailable."""
    try:
        df = fetch_stock_data("NIFTY50", period=period, interval="1d")
        if df is None or df.empty or "close" not in df.columns:
            # Try alternate yfinance ticker
            import yfinance as yf
            raw = yf.download("^NSEI", period="1y", progress=False, auto_adjust=True)
            if raw is None or raw.empty:
                return None
            closes = raw["Close"].values.astype(float)
        else:
            closes = df["close"].values.astype(float)
        if len(closes) < 21:
            return None
        return (closes[1:] - closes[:-1]) / closes[:-1]
    except Exception as e:
        logger.debug("NIFTY benchmark fetch failed: %s", e)
        return None


def calculate_portfolio_risk_cockpit(
    positions: List[Dict[str, Any]] = None,
    portfolio_value: float = 1_000_000.0,
    risk_free_rate_pct: float = 6.50,        # India 91-Day T-Bill Rate
) -> Dict[str, Any]:
    """
    Computes institutional VaR, CVaR, Sharpe, Sortino, and correlation matrix.

    Returns data_quality metadata so the caller always knows whether the
    metrics are derived from real market data or a clearly-labelled simulation.
    """
    if not positions or len(positions) == 0:
        positions = [
            {"ticker": "RELIANCE",   "weight": 0.25, "sector": "Energy"},
            {"ticker": "TCS",        "weight": 0.25, "sector": "IT"},
            {"ticker": "HDFCBANK",   "weight": 0.25, "sector": "Banking"},
            {"ticker": "TATAMOTORS", "weight": 0.25, "sector": "Auto"},
        ]

    tickers = [p["ticker"].upper().strip() for p in positions]
    raw_weights = np.array([float(p.get("weight", 1.0 / len(tickers))) for p in positions])
    weights = raw_weights / np.sum(raw_weights)

    # ── 1. Fetch 1Y daily price series ───────────────────────────────────────
    returns_dict: Dict[str, np.ndarray] = {}
    missing_tickers: List[str] = []

    for t in tickers:
        df = fetch_stock_data(t, period="1Y")
        if df is not None and not df.empty and "close" in df.columns:
            closes = df["close"].values.astype(float)
            if len(closes) > 20:
                daily_rets = (closes[1:] - closes[:-1]) / closes[:-1]
                returns_dict[t] = daily_rets[-200:]
                continue
        missing_tickers.append(t)

    # ── 2. Data quality assessment ───────────────────────────────────────────
    min_len       = min((len(v) for v in returns_dict.values()), default=0)
    has_real_data = (len(missing_tickers) == 0 and min_len >= 20)
    is_simulated  = not has_real_data
    fallback_reason: Optional[str] = None

    if is_simulated:
        fallback_reason = (
            f"Insufficient real price data: missing={missing_tickers}, min_days={min_len}. "
            "Parametric metrics are estimated from stylised normal distribution. "
            "DO NOT present these as real portfolio risk figures."
        )
        logger.warning("quant_risk SIMULATION MODE: %s", fallback_reason)
        np.random.seed(42)
        sim_days = max(min_len, 60)
        returns_matrix = np.random.normal(0.0006, 0.012, (sim_days, len(tickers)))
    else:
        returns_matrix = np.column_stack([returns_dict[t][-min_len:] for t in tickers])

    # ── 3. Portfolio daily returns ───────────────────────────────────────────
    portfolio_returns = np.dot(returns_matrix, weights)

    mean_daily_ret    = float(np.mean(portfolio_returns))
    std_daily_ret     = float(np.std(portfolio_returns))
    annualized_return = round(mean_daily_ret * 252 * 100, 2)
    annualized_vol    = round(std_daily_ret * math.sqrt(252) * 100, 2)

    # ── 4. Parametric VaR  (Z95=1.645, Z99=2.326) ───────────────────────────
    var_95_pct    = round(1.645 * std_daily_ret * 100, 2)
    var_99_pct    = round(2.326 * std_daily_ret * 100, 2)
    var_95_inr    = round(portfolio_value * var_95_pct / 100, 2)
    var_99_inr    = round(portfolio_value * var_99_pct / 100, 2)
    var_95_10d    = round(var_95_inr * math.sqrt(10), 2)
    var_99_10d    = round(var_99_inr * math.sqrt(10), 2)

    # ── 5. Historical VaR & CVaR ─────────────────────────────────────────────
    sorted_rets   = np.sort(portfolio_returns)
    idx_95        = max(0, int(0.05 * len(sorted_rets)) - 1)
    idx_99        = max(0, int(0.01 * len(sorted_rets)) - 1)
    hist_var_95   = round(abs(float(sorted_rets[idx_95])) * 100, 2)
    hist_var_99   = round(abs(float(sorted_rets[idx_99])) * 100, 2)
    cvar_95_pct   = round(abs(float(np.mean(sorted_rets[:idx_95 + 1]))) * 100, 2)
    cvar_95_inr   = round(portfolio_value * cvar_95_pct / 100, 2)

    # ── 6. Sharpe, Sortino, Calmar ───────────────────────────────────────────
    rf_daily       = (risk_free_rate_pct / 100.0) / 252
    excess_returns = portfolio_returns - rf_daily
    sharpe  = round((np.mean(excess_returns) / (std_daily_ret + 1e-9)) * math.sqrt(252), 2)
    down_r  = portfolio_returns[portfolio_returns < 0]
    down_std= np.std(down_r) if len(down_r) > 0 else std_daily_ret
    sortino = round((np.mean(excess_returns) / (down_std + 1e-9)) * math.sqrt(252), 2)

    equity_curve   = np.cumprod(1.0 + portfolio_returns)
    peak           = np.maximum.accumulate(equity_curve)
    drawdown       = (equity_curve - peak) / peak
    max_dd         = round(abs(float(np.min(drawdown))) * 100, 2)
    calmar          = round(annualized_return / max(1.0, max_dd), 2)

    # ── 7. Beta vs NIFTY (real benchmark only) ───────────────────────────────
    beta_vs_nifty: Optional[float] = None
    beta_source = "unavailable"

    if not is_simulated:
        nifty_rets = _fetch_nifty_returns(period="1Y")
        if nifty_rets is not None:
            align_len = min(len(portfolio_returns), len(nifty_rets))
            if align_len >= 20:
                pr = portfolio_returns[-align_len:]
                nr = nifty_rets[-align_len:]
                cov   = float(np.cov(pr, nr)[0, 1])
                var_n = float(np.var(nr))
                if var_n > 1e-12:
                    beta_vs_nifty = round(cov / var_n, 3)
                    beta_source   = "NIFTY50_actual"
                else:
                    beta_source = "benchmark_zero_variance"
            else:
                beta_source = "insufficient_overlap"
        else:
            beta_source = "benchmark_unavailable"

    # ── 8. Correlation heatmap ───────────────────────────────────────────────
    if len(tickers) == 1:
        corr_matrix = np.array([[1.0]])
    else:
        corr_matrix = np.corrcoef(returns_matrix, rowvar=False)
        if corr_matrix.ndim == 0:
            corr_matrix = np.array([[float(corr_matrix)]])

    heatmap = []
    for i, t1 in enumerate(tickers):
        for j, t2 in enumerate(tickers):
            val = 1.0 if t1 == t2 else (float(corr_matrix[i, j]) if corr_matrix.ndim == 2 else 0.5)
            heatmap.append({"ticker_a": t1, "ticker_b": t2, "correlation": round(val, 2)})

    return {
        # Core metrics
        "portfolio_value":         portfolio_value,
        "tickers":                 tickers,
        "annualized_return_pct":   annualized_return,
        "annualized_volatility_pct": annualized_vol,
        # Parametric VaR
        "var_95_daily_pct":  var_95_pct,
        "var_95_daily_inr":  var_95_inr,
        "var_99_daily_pct":  var_99_pct,
        "var_99_daily_inr":  var_99_inr,
        "var_95_10d_inr":    var_95_10d,
        "var_99_10d_inr":    var_99_10d,
        # Historical / CVaR
        "hist_var_95_pct":   hist_var_95,
        "hist_var_99_pct":   hist_var_99,
        "cvar_95_pct":       cvar_95_pct,
        "cvar_95_inr":       cvar_95_inr,
        # Ratios
        "sharpe_ratio":      sharpe,
        "sortino_ratio":     sortino,
        "calmar_ratio":      calmar,
        "max_drawdown_pct":  max_dd,
        # Beta — null when real benchmark data unavailable
        "beta_vs_nifty":     beta_vs_nifty,
        "beta_source":       beta_source,
        # Heatmap
        "correlation_heatmap": heatmap,
        # ── Data quality metadata ──────────────────────────────────────────
        "data_quality":    "simulated" if is_simulated else "real",
        "is_simulated":    is_simulated,
        "source":          "styled_normal_simulation" if is_simulated else "actual_market_returns",
        "fallback_reason": fallback_reason,
        "missing_tickers": missing_tickers,
    }
