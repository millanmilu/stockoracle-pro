"""
StockOracle Pro — ML Training & Forecast Background Tasks
"""
import logging
from backend.tasks.celery_app import celery_app

logger = logging.getLogger("StockOracle.Tasks.ML")


@celery_app.task(name="tasks.train_stock_model", bind=True)
def train_stock_model_task(self, task_id: str, ticker: str, epochs: int = 40):
    """Executes heavy PyTorch / XGBoost training in Celery background worker."""
    from backend.data.database import save_task_status
    try:
        logger.info("Celery starting training for %s (task_id=%s)", ticker, task_id)
        save_task_status(task_id, ticker, "training", 10)

        from backend.analysis.trainer import train_pipeline

        save_task_status(task_id, ticker, "training", 50)
        result = train_pipeline(ticker.upper())
        mape = result.get("validation_mape", 0.0)
        save_task_status(task_id, ticker, "completed", 100, mape=mape)

        logger.info("Celery training complete for %s. MAPE: %.4f", ticker, mape)
        return {"status": "SUCCESS", "ticker": ticker, "mape": mape}
    except Exception as exc:
        logger.error("Celery training failed for %s: %s", ticker, exc, exc_info=True)
        save_task_status(task_id, ticker, "failed", 0, error=str(exc))
        return {"status": "FAILED", "error": str(exc)}
