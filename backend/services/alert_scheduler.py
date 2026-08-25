"""
StockOracle Pro — Server-Side Alert Scheduler & Evaluator
Periodically scans all active smart alerts, computes real-time triggers,
and marks triggered alerts in SQLite with notification broadcasting.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any

from backend.data.database import get_smart_alerts, mark_alert_triggered
from backend.data.fetcher import fetch_company_info, fetch_stock_data
from backend.analysis.indicators import enrich_stock_dataframe
from backend.data.market_calendar import is_market_open

logger = logging.getLogger("StockOracle.AlertScheduler")

async def evaluate_single_alert(alert: dict) -> bool:
    """Evaluates a single active smart alert. Returns True if triggered."""
    try:
        ticker = alert.get("ticker", "").upper()
        alert_type = alert.get("alert_type", "")
        param = alert.get("param_value") or {}
        alert_id = alert.get("id")

        if not ticker or not alert_id:
            return False

        # 1. Price Target Alerts
        if alert_type in ["price_above", "price_below"]:
            info = fetch_company_info(ticker)
            if not info or not info.get("current_price"):
                return False
            cur_p = float(info["current_price"])
            target = float(param.get("target_price") or param.get("price") or 0)
            if target <= 0:
                return False

            if alert_type == "price_above" and cur_p >= target:
                mark_alert_triggered(alert_id)
                logger.info(f"🚨 Alert #{alert_id} TRIGGERED: {ticker} Price ₹{cur_p} >= Target ₹{target}")
                return True
            elif alert_type == "price_below" and cur_p <= target:
                mark_alert_triggered(alert_id)
                logger.info(f"🚨 Alert #{alert_id} TRIGGERED: {ticker} Price ₹{cur_p} <= Target ₹{target}")
                return True

        # 2. RSI Alerts
        elif alert_type in ["rsi_below", "rsi_above"]:
            df = fetch_stock_data(ticker, period="1M", interval="1d")
            if df is None or df.empty:
                return False
            enriched = enrich_stock_dataframe(df)
            if "rsi" not in enriched.columns or enriched.empty:
                return False
            cur_rsi = float(enriched["rsi"].iloc[-1])
            thresh = float(param.get("threshold") or (30.0 if alert_type == "rsi_below" else 70.0))

            if alert_type == "rsi_below" and cur_rsi <= thresh:
                mark_alert_triggered(alert_id)
                logger.info(f"🚨 Alert #{alert_id} TRIGGERED: {ticker} RSI {cur_rsi:.1f} <= {thresh}")
                return True
            elif alert_type == "rsi_above" and cur_rsi >= thresh:
                mark_alert_triggered(alert_id)
                logger.info(f"🚨 Alert #{alert_id} TRIGGERED: {ticker} RSI {cur_rsi:.1f} >= {thresh}")
                return True

        # 3. Volume Spike
        elif alert_type == "volume_spike":
            df = fetch_stock_data(ticker, period="1M", interval="1d")
            if df is None or df.empty:
                return False
            enriched = enrich_stock_dataframe(df)
            if "volume_sma_20" not in enriched.columns or len(enriched) < 2:
                return False
            vol_sma = float(enriched["volume_sma_20"].iloc[-1])
            cur_vol = float(enriched["volume"].iloc[-1])
            mult = float(param.get("multiplier") or 2.0)
            if vol_sma > 0 and (cur_vol / vol_sma) >= mult:
                mark_alert_triggered(alert_id)
                logger.info(f"🚨 Alert #{alert_id} TRIGGERED: {ticker} Volume surge {cur_vol/vol_sma:.2f}x >= {mult}x")
                return True

    except Exception as e:
        logger.error(f"Error evaluating alert #{alert.get('id')}: {e}")

    return False


async def run_alert_scheduler_loop(interval_seconds: int = 60):
    """Background task loop that evaluates all active smart alerts."""
    logger.info("🚀 Starting Background Smart Alert Scheduler Loop...")
    while True:
        try:
            alerts = get_smart_alerts()
            active_alerts = [a for a in alerts if not a.get("triggered")]
            if active_alerts:
                logger.info(f"🔔 Evaluating {len(active_alerts)} active smart alerts...")
                for alert in active_alerts:
                    await evaluate_single_alert(alert)
                    await asyncio.sleep(0.05)  # Throttle to prevent CPU spikes
        except Exception as e:
            logger.error(f"Error in alert scheduler loop: {e}")

        await asyncio.sleep(interval_seconds)
