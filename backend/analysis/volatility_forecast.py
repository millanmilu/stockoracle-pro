import numpy as np
import pandas as pd
from typing import Dict, Any, List


def calculate_volatility_forecast(df: pd.DataFrame, forecast_days: int = 30) -> Dict[str, Any]:
    """
    Computes historical volatility analysis and GARCH(1,1)-style forecast.
    Returns rolling volatility history + forward forecast with confidence bands.
    """
    closes = df["close"].values.astype(float)
    dates  = df["date"].values.tolist()

    # ── Log returns ──────────────────────────────────────────────────────────
    log_rets = np.log(closes[1:] / (closes[:-1] + 1e-9))
    ret_dates = dates[1:]

    # ── Rolling 20-day Historical Volatility (annualised %) ──────────────────
    window = 20
    rolling_vol: List[Dict[str, Any]] = []
    for i in range(window, len(log_rets) + 1):
        window_rets = log_rets[i - window: i]
        vol_daily   = float(np.std(window_rets))
        vol_annual  = vol_daily * np.sqrt(252) * 100  # annualised %
        rolling_vol.append({
            "date": str(ret_dates[i - 1]),
            "vol":  round(float(vol_annual), 3),
        })

    # Keep last 60 points for chart readability
    rolling_vol = rolling_vol[-60:]

    # ── GARCH(1,1) Parameter Estimation (Method of Moments) ──────────────────
    # Simple MoM estimator: omega, alpha, beta from return autocorrelation
    recent_rets = log_rets[-120:]  # Use last 6 months
    sigma2 = np.var(recent_rets)

    # Estimate alpha + beta via squared-return autocorrelation at lag 1
    sq_rets   = recent_rets ** 2
    mean_sq   = np.mean(sq_rets)
    autocov   = np.mean((sq_rets[1:] - mean_sq) * (sq_rets[:-1] - mean_sq))
    autovar   = np.var(sq_rets)
    alpha_beta = float(np.clip(autocov / (autovar + 1e-9), 0.05, 0.95))

    # Typical split: alpha ~ 0.1 of persistence, beta gets the rest
    alpha  = float(np.clip(alpha_beta * 0.15, 0.05, 0.20))
    beta   = float(np.clip(alpha_beta - alpha, 0.05, 0.85))
    omega  = float(sigma2 * (1 - alpha - beta))
    if omega <= 0:
        omega = sigma2 * 0.01

    # ── GARCH Forward Forecast ────────────────────────────────────────────────
    h_t = sigma2  # Start from current variance
    last_ret_sq = float(recent_rets[-1] ** 2)

    forecast: List[Dict[str, Any]] = []
    last_date = pd.to_datetime(dates[-1])
    for day in range(1, forecast_days + 1):
        h_t = omega + alpha * last_ret_sq + beta * h_t
        vol_forecast_annual = float(np.sqrt(h_t) * np.sqrt(252) * 100)

        # Confidence band widens with horizon uncertainty
        uncertainty = vol_forecast_annual * 0.15 * np.sqrt(day / forecast_days)
        fcast_date = (last_date + pd.Timedelta(days=day)).strftime("%Y-%m-%d")

        forecast.append({
            "date":  fcast_date,
            "vol":   round(vol_forecast_annual, 3),
            "upper": round(vol_forecast_annual + uncertainty, 3),
            "lower": round(max(vol_forecast_annual - uncertainty, 0.0), 3),
        })

        # Update for next step: expected squared return = h_t under GARCH
        last_ret_sq = h_t

    # ── Summary Stats ─────────────────────────────────────────────────────────
    current_vol   = rolling_vol[-1]["vol"] if rolling_vol else 0.0
    avg_vol_1y    = float(np.mean([v["vol"] for v in rolling_vol]))
    vol_percentile = float(
        np.mean([1 if v["vol"] <= current_vol else 0 for v in rolling_vol]) * 100
    )
    regime = (
        "High Volatility" if current_vol > avg_vol_1y * 1.3 else
        "Low Volatility"  if current_vol < avg_vol_1y * 0.7 else
        "Normal"
    )

    return {
        "current_vol_pct":     round(current_vol, 2),
        "avg_vol_pct":         round(avg_vol_1y,  2),
        "vol_percentile":      round(vol_percentile, 1),
        "regime":              regime,
        "garch_params":        {"alpha": round(alpha, 4), "beta": round(beta, 4), "omega": round(omega, 8)},
        "rolling_history":     rolling_vol,
        "forecast":            forecast,
    }
