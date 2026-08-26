"""
StockOracle Pro — Machine Learning, Predictions & Backtesting API Router
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query

from backend.data.fetcher import fetch_stock_data, get_session_status
from backend.analysis.backtester import run_backtest
from backend.services.ai_consensus import compute_ai_consensus

logger = logging.getLogger("StockOracle.API.ML")

router = APIRouter(prefix="/api", tags=["Machine Learning & AI"])


@router.get("/stock/{symbol}/predict")
def predict_stock(symbol: str):
    """
    Returns 7-day multi-step price forecast, confidence bounds, and MAPE accuracy metrics.
    """
    sym = symbol.upper().strip()
    from backend.data.database import get_prediction_cached, save_prediction
    cached = get_prediction_cached(sym)
    if cached:
        return cached

    from backend.ml.predictor import StockPredictor
    from backend.data.fetcher import fetch_company_info

    df = fetch_stock_data(sym, period="2Y")
    if df is None or len(df) < 50:
        raise HTTPException(
            status_code=404,
            detail=f"Insufficient price history for '{sym}' to generate forecast.",
        )

    info = fetch_company_info(sym)
    ltp = info.get("ltp") if info else None

    predictor = StockPredictor()
    result = predictor.predict(sym, df, current_price=ltp)
    save_prediction(sym, result)
    return result


@router.get("/stock/{symbol}/explain")
def explain_prediction(symbol: str):
    """Returns TreeSHAP feature importance ranking and directional impact bars."""
    sym = symbol.upper().strip()
    from backend.analysis.explainer import get_shap_explanation
    df = fetch_stock_data(sym, period="2Y")
    if df is None or len(df) < 50:
        raise HTTPException(status_code=404, detail=f"Insufficient data for '{sym}'.")
    return get_shap_explanation(sym, df)


@router.post("/train/{ticker}")
def trigger_training(ticker: str, background_tasks: BackgroundTasks, epochs: int = 40):
    """Asynchronously triggers model retraining for a ticker."""
    import uuid
    t = ticker.upper().strip()
    task_id = str(uuid.uuid4())

    from backend.data.database import save_task_status
    save_task_status(task_id, t, "queued", 0)

    # Use Celery if available, else FastAPI background task
    try:
        from backend.tasks.ml_tasks import train_stock_model_task
        train_stock_model_task.delay(task_id, t, epochs)
    except Exception:
        # Fallback to local background task
        from backend.analysis.trainer import train_model
        def _run_training():
            try:
                save_task_status(task_id, t, "training", 20)
                df = fetch_stock_data(t, period="2Y")
                if df is not None:
                    mape = train_model(t, df, epochs=epochs)
                    save_task_status(task_id, t, "completed", 100, mape=mape)
            except Exception as e:
                save_task_status(task_id, t, "failed", 0, error=str(e))
        background_tasks.add_task(_run_training)

    return {"task_id": task_id, "ticker": t, "status": "queued"}


@router.get("/task/{task_id}/status")
def get_task_status_endpoint(task_id: str):
    """Polls the status, progress, and MAPE of an ongoing training job."""
    from backend.data.database import get_task_status
    status = get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found.")
    return status


@router.get("/stock/{ticker}/backtest")
def get_stock_backtest(ticker: str, initial_capital: float = 100000.0, strategy: str = "ai_signals"):
    """Runs realistic walk-forward backtest simulation with STT/brokerage fees."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="2Y")
    if df is None or len(df) < 50:
        raise HTTPException(status_code=404, detail=f"Insufficient history for '{t}'.")
    return run_backtest(t, df, initial_capital=initial_capital, strategy_type=strategy)


@router.get("/stock/{ticker}/ai-consensus")
def get_ai_consensus_endpoint(ticker: str):
    """Aggregates XGBoost, Neural Nets, Technical Signals, and Sentiment into a single consensus score."""
    t = ticker.upper().strip()
    return compute_ai_consensus(t)


@router.get("/ml/benchmark/{ticker}")
def get_model_benchmark_endpoint(ticker: str):
    """Executes 5-fold walk-forward validation and compares model MAPE vs Naive and SMA baselines."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="2Y")
    if df is None or len(df) < 50:
        raise HTTPException(status_code=404, detail=f"Insufficient historical data for '{t}'.")
    from backend.ml.benchmarking import run_walk_forward_benchmark
    return run_walk_forward_benchmark(t, df)


@router.get("/ml/models/registry")
def get_model_registry_endpoint(ticker: Optional[str] = None):
    """Returns versioned model artifacts, training timestamps, and accuracy metrics."""
    from backend.data.database import get_registered_models
    return get_registered_models(ticker)


@router.get("/stock/{ticker}/forecast-bands")
def get_forecast_bands_endpoint(ticker: str):
    """Generates 7-day multi-step price forecast with 80% and 95% GARCH conditional volatility bands."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or len(df) < 30:
        raise HTTPException(status_code=404, detail=f"Insufficient history for '{t}'.")
    from backend.ml.forecast_bands import compute_forecast_bands
    return compute_forecast_bands(t, df)

