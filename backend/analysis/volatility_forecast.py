import numpy as np
import pandas as pd
import logging
from typing import Dict, Any, List

logger = logging.getLogger("stockoracle.volatility")


def _fit_garch_arch(recent_rets: np.ndarray) -> Dict[str, float]:
    """
    Fits a GARCH(1,1) model using Maximum Likelihood Estimation via the `arch` library.
    Returns dict with alpha, beta, omega. Raises on failure so caller can fall back.
    """
    from arch import arch_model
    # Scale returns to percentage points for numerical stability in arch library
    scaled = recent_rets * 100.0
    am = arch_model(scaled, vol="GARCH", p=1, q=1, dist="normal", rescale=False)
    res = am.fit(disp="off", show_warning=False)
    params = res.params
    omega_scaled = float(params.get("omega", params.iloc[1]))
    alpha        = float(params.get("alpha[1]", params.iloc[2]))
    beta         = float(params.get("beta[1]",  params.iloc[3]))
    # omega was estimated on percentage-point returns; convert back to decimal variance
    omega = omega_scaled / (100.0 ** 2)
    return {"omega": omega, "alpha": alpha, "beta": beta,
            "last_variance": float(res.conditional_volatility.iloc[-1] / 100.0) ** 2}


def _fit_garch_mom(recent_rets: np.ndarray) -> Dict[str, float]:
    """
    Fallback GARCH(1,1) parameter estimation using Method of Moments.
    Used when the `arch` library is unavailable or fails.
    """
    sigma2 = float(np.var(recent_rets))
    sq_rets  = recent_rets ** 2
    mean_sq  = np.mean(sq_rets)
    autocov  = np.mean((sq_rets[1:] - mean_sq) * (sq_rets[:-1] - mean_sq))
    autovar  = np.var(sq_rets)
    alpha_beta = float(np.clip(autocov / (autovar + 1e-9), 0.05, 0.95))
    alpha = float(np.clip(alpha_beta * 0.15, 0.05, 0.20))
    beta  = float(np.clip(alpha_beta - alpha, 0.05, 0.85))
    omega = float(sigma2 * (1 - alpha - beta))
    if omega <= 0:
        omega = sigma2 * 0.01
    return {"omega": omega, "alpha": alpha, "beta": beta, "last_variance": sigma2}


def calculate_volatility_forecast(df: pd.DataFrame, forecast_days: int = 30) -> Dict[str, Any]:
    """
    Computes historical volatility analysis and GARCH(1,1) forward forecast.

    GARCH parameters are estimated using MLE via the `arch` library (preferred).
    Falls back gracefully to a Method-of-Moments estimator if `arch` is unavailable.

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

    # ── GARCH(1,1) Parameter Estimation ──────────────────────────────────────
    recent_rets = log_rets[-120:]  # Use last 6 months (~120 trading days)

    garch_source = "arch_mle"
    try:
        garch_params = _fit_garch_arch(recent_rets)
        logger.info("GARCH(1,1) fitted via arch MLE (alpha=%.4f, beta=%.4f)",
                    garch_params["alpha"], garch_params["beta"])
    except Exception as e:
        logger.warning("arch library GARCH fitting failed (%s) — falling back to Method of Moments.", e)
        garch_params = _fit_garch_mom(recent_rets)
        garch_source = "mom_fallback"

    omega = garch_params["omega"]
    alpha = garch_params["alpha"]
    beta  = garch_params["beta"]

    # ── GARCH Forward Forecast ────────────────────────────────────────────────
    # Start from the last fitted conditional variance
    h_t = garch_params["last_variance"]
    last_ret_sq = float(recent_rets[-1] ** 2)

    forecast: List[Dict[str, Any]] = []
    last_date = pd.to_datetime(dates[-1])
    for day in range(1, forecast_days + 1):
        h_t = omega + alpha * last_ret_sq + beta * h_t
        vol_forecast_annual = float(np.sqrt(max(h_t, 0.0)) * np.sqrt(252) * 100)

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
        "current_vol_pct":  round(current_vol, 2),
        "avg_vol_pct":      round(avg_vol_1y, 2),
        "vol_percentile":   round(vol_percentile, 1),
        "regime":           regime,
        "garch_params":     {"alpha": round(alpha, 4), "beta": round(beta, 4),
                             "omega": round(omega, 8)},
        "garch_source":     garch_source,
        "rolling_history":  rolling_vol,
        "forecast":         forecast,
    }
