"""
StockOracle Pro — Server-Side Alert Scheduler & Consolidated Evaluator
Single source of truth for alert evaluation:
- Used by the background FastAPI lifespan scheduler.
- Used by client endpoints (/api/smart-alerts/evaluate).
- Respects NSE market hours, holidays, and weekends to avoid wasteful broker calls.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from backend.data.database import get_smart_alerts, mark_alert_triggered
from backend.data.fetcher import fetch_company_info, fetch_stock_data
from backend.analysis.indicators import enrich_stock_dataframe
from backend.data.market_calendar import is_market_open, get_market_session_phase

logger = logging.getLogger("StockOracle.AlertScheduler")

# Global lifecycle tracker
_scheduler_running = False
_last_run_timestamp: Optional[datetime] = None


def is_scheduler_running() -> bool:
    """Returns True if the background alert scheduler task is currently active."""
    return _scheduler_running


def get_scheduler_status() -> dict:
    """Returns detailed status of the alert scheduler."""
    return {
        "running": _scheduler_running,
        "last_run": _last_run_timestamp.isoformat() if _last_run_timestamp else None,
        "market_open": is_market_open(),
        "market_phase": get_market_session_phase()
    }


async def evaluate_single_alert(alert: dict, auto_trigger: bool = True) -> dict:
    """
    Evaluates a single smart alert against live data and indicators.
    Returns standard DTO: { id, ticker, alert_type, param_value, is_triggered, reason, current_value }
    """
    ticker = str(alert.get("ticker", "")).upper().strip()
    alert_type = str(alert.get("alert_type", "")).strip()
    param = alert.get("param_value") or {}
    alert_id = alert.get("id")

    triggered = False
    reason = "Condition not met"
    current_val = "—"

    if not ticker or not alert_id:
        return {**alert, "is_triggered": False, "reason": "Invalid alert structure", "current_value": current_val}

    try:
        # 1. Price Target Alerts
        if alert_type in ["price_above", "price_below"]:
            info = fetch_company_info(ticker)
            if info and info.get("current_price"):
                cur_p = float(info["current_price"])
                # Canonical field is "threshold"; fall back to legacy "target_price" / "price"
                target = float(
                    param.get("threshold")
                    or param.get("target_price")
                    or param.get("price")
                    or 0
                )
                current_val = f"₹{cur_p:,.2f}"

                if target > 0:
                    if alert_type == "price_above" and cur_p >= target:
                        triggered = True
                        reason = f"Price crossed ABOVE target ₹{target:,.2f} (Current: ₹{cur_p:,.2f})"
                    elif alert_type == "price_below" and cur_p <= target:
                        triggered = True
                        reason = f"Price dropped BELOW target ₹{target:,.2f} (Current: ₹{cur_p:,.2f})"


        # 2. RSI Alerts
        elif alert_type in ["rsi_below", "rsi_above"]:
            df = fetch_stock_data(ticker, period="1M", interval="1d")
            if df is not None and not df.empty:
                enriched = enrich_stock_dataframe(df)
                if "rsi" in enriched.columns and not enriched.empty:
                    cur_rsi = float(enriched["rsi"].iloc[-1])
                    cur_p = float(enriched["close"].iloc[-1])
                    current_val = f"{cur_rsi:.1f}"
                    thresh = float(param.get("threshold") or (30.0 if alert_type == "rsi_below" else 70.0))

                    if alert_type == "rsi_below" and cur_rsi <= thresh:
                        triggered = True
                        reason = f"RSI is oversold at {cur_rsi:.1f} (<= {thresh})"
                    elif alert_type == "rsi_above" and cur_rsi >= thresh:
                        triggered = True
                        reason = f"RSI is overbought at {cur_rsi:.1f} (>= {thresh})"

        # 3. Volume Spike Alerts (Single standard: volume_sma_20)
        elif alert_type == "volume_spike":
            df = fetch_stock_data(ticker, period="1M", interval="1d")
            if df is not None and not df.empty:
                enriched = enrich_stock_dataframe(df)
                if "volume_sma_20" in enriched.columns and len(enriched) >= 2:
                    vol_sma = float(enriched["volume_sma_20"].iloc[-1])
                    cur_vol = float(enriched["volume"].iloc[-1])
                    ratio = (cur_vol / vol_sma) if vol_sma > 0 else 1.0
                    multiplier = float(param.get("multiplier") or 2.0)
                    current_val = f"{ratio:.1f}x"

                    if ratio >= multiplier:
                        triggered = True
                        reason = f"Volume surge of {ratio:.1f}x above 20-day SMA"

        # 4. AI Signal Alerts
        elif alert_type == "ai_signal":
            try:
                from backend.analysis.trainer import predict_future
                pred = predict_future(ticker)
                actual_sig = str(pred.get("signal", "")).upper()
                target_sig = str(param.get("signal", "buy")).upper()
                current_val = actual_sig

                if target_sig in actual_sig:
                    triggered = True
                    reason = f"AI Prediction model issued {actual_sig} signal"
            except Exception:
                pass

        # If triggered and auto_trigger is enabled, update DB and dispatch Telegram notification
        if triggered and auto_trigger and not alert.get("triggered"):
            mark_alert_triggered(alert_id)
            logger.info(f"🚨 Alert #{alert_id} TRIGGERED: {ticker} ({alert_type}) — {reason}")
            try:
                from backend.services.telegram_bot import send_telegram_alert
                send_telegram_alert(ticker, alert_type, reason, price=float(current_val.replace('₹', '').replace(',', '')) if '₹' in current_val else None)
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Error evaluating alert #{alert_id} ({ticker}): {e}")
        reason = f"Evaluation error: {e}"

    return {
        **alert,
        "is_triggered": triggered,
        "reason": reason,
        "current_value": current_val,
    }


async def evaluate_all_alerts(user_id: Optional[str] = None, auto_trigger: bool = True) -> List[Dict[str, Any]]:
    """
    Evaluates all active smart alerts.
    Can be filtered by user_id.
    """
    alerts = get_smart_alerts(user_id=user_id) if user_id else get_smart_alerts()
    results = []
    for alert in alerts:
        res = await evaluate_single_alert(alert, auto_trigger=auto_trigger)
        results.append(res)
        await asyncio.sleep(0.02)
    return results


async def run_alert_scheduler_loop():
    """
    Background worker loop managed by FastAPI lifespan.
    Evaluates alerts frequently during market hours, and sleeps during off-market hours.
    """
    global _scheduler_running, _last_run_timestamp
    _scheduler_running = True
    logger.info("🚀 Background Smart Alert Scheduler Loop started.")

    try:
        while _scheduler_running:
            _last_run_timestamp = datetime.now()

            # Check NSE Market Session
            if not is_market_open():
                phase = get_market_session_phase()
                logger.debug(f"⏸️ Alert scheduler: Market is {phase}. Sleeping for 300s...")
                await asyncio.sleep(300)
                continue

            try:
                alerts = get_smart_alerts()
                active = [a for a in alerts if not a.get("triggered")]
                if active:
                    logger.info(f"🔔 Market Live: Evaluating {len(active)} active smart alerts...")
                    for a in active:
                        await evaluate_single_alert(a, auto_trigger=True)
                        await asyncio.sleep(0.05)
            except Exception as e:
                logger.error(f"Alert scheduler loop error: {e}")

            await asyncio.sleep(60)

    except asyncio.CancelledError:
        logger.info("🛑 Smart Alert Scheduler task cancelled during shutdown.")
    finally:
        _scheduler_running = False
