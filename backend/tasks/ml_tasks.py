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

        from backend.data.fetcher import fetch_stock_data
        from backend.analysis.trainer import train_model

        df = fetch_stock_data(ticker.upper(), period="2Y")
        if df is None or len(df) < 50:
            save_task_status(task_id, ticker, "failed", 0, error="Insufficient price history (minimum 50 days required)")
            return {"status": "FAILED", "error": "Insufficient price history"}

        save_task_status(task_id, ticker, "training", 50)
        mape = train_model(ticker.upper(), df, epochs=epochs)
        save_task_status(task_id, ticker, "completed", 100, mape=mape)

        logger.info("Celery training complete for %s. MAPE: %.4f", ticker, mape)
        return {"status": "SUCCESS", "ticker": ticker, "mape": mape}
    except Exception as exc:
        logger.error("Celery training failed for %s: %s", ticker, exc, exc_info=True)
        save_task_status(task_id, ticker, "failed", 0, error=str(exc))
        return {"status": "FAILED", "error": str(exc)}
