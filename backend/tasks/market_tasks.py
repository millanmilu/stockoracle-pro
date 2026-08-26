"""
StockOracle Pro — Market Data Background Tasks
"""
import logging
from backend.tasks.celery_app import celery_app

logger = logging.getLogger("StockOracle.Tasks.Market")


@celery_app.task(name="tasks.backfill_5y_history", bind=True, max_retries=3)
def backfill_history_task(self, ticker: str):
    """Asynchronously downloads 5-year OHLCV candles for a ticker and stores in DB."""
    try:
        logger.info("Starting background 5Y backfill for %s", ticker)
        from backend.data.fetcher import backfill_5y_history
        df = backfill_5y_history(ticker.upper())
        count = len(df) if df is not None else 0
        logger.info("Completed 5Y backfill for %s: %d records stored", ticker, count)
        return {"status": "SUCCESS", "ticker": ticker, "records": count}
    except Exception as exc:
        logger.error("Error in backfill task for %s: %s", ticker, exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="tasks.prefetch_popular_tickers")
def prefetch_popular_tickers_task():
    """Warms up local cache and DB for key NSE universe stocks."""
    popular = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "HUL"]
    results = {}
    from backend.data.fetcher import fetch_stock_data, fetch_company_info
    for sym in popular:
        try:
            fetch_company_info(sym)
            fetch_stock_data(sym, period="1Y")
            results[sym] = "OK"
        except Exception as e:
            results[sym] = f"ERROR: {e}"
    return results
