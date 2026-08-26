"""
StockOracle Pro — 7-Day Quantitative Forecast Bands & GARCH(1,1) Volatility Cones
Generates multi-step price trajectories with 80% and 95% confidence intervals.
"""
import math
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List

logger = logging.getLogger("StockOracle.ML.ForecastBands")


def compute_forecast_bands(ticker: str, df: pd.DataFrame, horizon_days: int = 7) -> Dict[str, Any]:
    """
    Computes 7-day forward price forecasts accompanied by 80% and 95% confidence intervals
    derived from forward GARCH(1,1) conditional volatility.
    """
    ticker = ticker.upper().strip()
    if df is None or len(df) < 30:
        return {
            "ticker": ticker,
            "error": "Insufficient history for forecast bands (min 30 days).",
            "forecast_days": [],
        }

    closes = df["close"].values.astype(float)
    last_price = float(closes[-1])
    log_returns = np.diff(np.log(closes))

    # 1. Estimate Daily Volatility via GARCH(1,1) or Rolling EWMA
    daily_vol = float(np.std(log_returns[-30:]))
    garch_active = False

    try:
        from arch import arch_model
        am = arch_model(log_returns * 100, vol="Garch", p=1, q=1, rescale=False)
        res = am.fit(disp="off", show_warning=False)
        forecast = res.forecast(horizon=horizon_days)
        var_proj = forecast.variance.iloc[-1].values  # Project daily variance
        daily_vol_series = [math.sqrt(max(v, 0.01)) / 100.0 for v in var_proj]
        garch_active = True
    except Exception:
        # Fallback to square-root-of-time standard volatility cone
        daily_vol_series = [daily_vol for _ in range(horizon_days)]

    # 2. Get Point Forecast Trajectory
    drift = float(np.mean(log_returns[-20:]))
    drift = float(np.clip(drift, -0.015, 0.015))  # Cap daily drift to ±1.5%

    forecast_days = []
    base_date = datetime.now()
    cur_point = last_price
    cum_vol_var = 0.0

    for step in range(1, horizon_days + 1):
        target_date = (base_date + timedelta(days=step)).strftime("%Y-%m-%d")
        d_vol = daily_vol_series[step - 1] if step <= len(daily_vol_series) else daily_vol
        cum_vol_var += d_vol ** 2
        step_vol = math.sqrt(cum_vol_var)

        # Dampen trend over horizon
        cur_point = cur_point * math.exp(drift * (0.92 ** step))

        # 95% Confidence Bounds (Z = 1.96)
        upper_95 = round(cur_point * math.exp(1.96 * step_vol), 2)
        lower_95 = round(cur_point * math.exp(-1.96 * step_vol), 2)

        # 80% Confidence Bounds (Z = 1.28)
        upper_80 = round(cur_point * math.exp(1.28 * step_vol), 2)
        lower_80 = round(cur_point * math.exp(-1.28 * step_vol), 2)

        forecast_days.append({
            "day": step,
            "date": target_date,
            "predicted_price": round(cur_point, 2),
            "upper_95": upper_95,
            "lower_95": lower_95,
            "upper_80": upper_80,
            "lower_80": lower_80,
            "spread_pct": round(((upper_95 - lower_95) / cur_point) * 100, 2),
        })

    ann_vol = round(daily_vol * math.sqrt(252) * 100, 2)
    expected_7d_return = round(((forecast_days[-1]["predicted_price"] - last_price) / last_price) * 100, 2)

    return {
        "ticker": ticker,
        "current_price": round(last_price, 2),
        "annualized_volatility_pct": ann_vol,
        "garch_model_status": "FITTED" if garch_active else "EWMA_FALLBACK",
        "predicted_7d_return_pct": expected_7d_return,
        "signal": "BULLISH" if expected_7d_return > 0.5 else ("BEARISH" if expected_7d_return < -0.5 else "NEUTRAL"),
        "forecast_days": forecast_days,
    }
