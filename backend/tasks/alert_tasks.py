"""
StockOracle Pro — Alert Evaluation Background Tasks
"""
import asyncio
import logging
from backend.tasks.celery_app import celery_app

logger = logging.getLogger("StockOracle.Tasks.Alerts")


@celery_app.task(name="tasks.evaluate_all_alerts")
def evaluate_alerts_task(user_id: str = None):
    """Executes asynchronous evaluation of all smart technical and price alerts."""
    try:
        from backend.services.alert_scheduler import evaluate_all_alerts
        # Run async evaluator in new event loop for Celery worker
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        results = loop.run_until_complete(evaluate_all_alerts(user_id=user_id, auto_trigger=True))
        loop.close()
        triggered_count = sum(1 for r in results if r.get("is_triggered"))
        logger.info("Celery alert evaluation complete: %d evaluated, %d triggered", len(results), triggered_count)
        return {"total": len(results), "triggered": triggered_count}
    except Exception as exc:
        logger.error("Celery alert evaluation failed: %s", exc, exc_info=True)
        return {"error": str(exc)}
