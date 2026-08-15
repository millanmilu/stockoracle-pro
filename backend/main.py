import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
from urllib.request import Request as UrllibRequest, urlopen
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

logger = logging.getLogger("stockoracle")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# Load the local development credentials before importing ``fetcher``: that
# module constructs the Angel One client at import time. In production,
# systemd also supplies these variables through EnvironmentFile.
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Import our custom modules
from backend.data.fetcher import (
    fetch_stock_data, fetch_company_info, ensure_session,
    get_session_status, reset_session, get_combined_stock_data, search_nse_stocks
)
from backend.data.database import (
    init_db, save_live_tick,
    save_prediction, get_prediction_cached,
    save_monte_carlo, get_monte_carlo_cached,
    save_screener_results, get_screener_results,
    get_db_stats,
    save_task_status, get_task_status, cleanup_old_tasks
)
from backend.analysis.indicators import enrich_stock_dataframe
from backend.analysis.monte_carlo import run_monte_carlo_simulation
from backend.analysis.anomaly import detect_anomalies
from backend.analysis.patterns import get_pattern_summary
from backend.analysis.levels import calculate_support_resistance
from backend.analysis.volatility_forecast import calculate_volatility_forecast
from backend.ml.predictor import StockPredictor
from backend.analysis.backtester import run_backtest
from backend.analysis.sentiment_market import get_market_sentiment
from backend.analysis.macro import get_macro_data
from backend.analysis.supply_chain import get_supply_chain

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQL database tables (including new task_status table)
    init_db()
    # Clean up stale task records from previous runs
    cleanup_old_tasks(max_age_hours=48)
    # Authenticate with Angel One on startup
    ensure_session()
    # Start live price broadcast
    price_task = asyncio.create_task(websocket_price_broadcast_loop())
    # Prefetch historical data for all popular tickers in background
    prefetch_task = asyncio.create_task(prefetch_all_tickers())
    try:
        yield
    finally:
        for task in (price_task, prefetch_task):
            task.cancel()
        for task in (price_task, prefetch_task):
            with suppress(asyncio.CancelledError):
                await task


async def prefetch_all_tickers():
    """
    Downloads 2-year historical OHLCV data for all popular tickers on startup
    and saves it to the SQLite database. Runs once in the background so the
    first prediction requests are served from DB (no API wait).
    """
    import asyncio as _asyncio
    print("⏳ Starting background prefetch of historical data for all tickers...")
    loop = _asyncio.get_running_loop()
    for ticker in popular_tickers:
        try:
            # Run blocking fetch in thread pool to not block event loop
            df = await loop.run_in_executor(None, lambda t=ticker: fetch_stock_data(t, period="2Y"))
            if df is not None and not df.empty:
                print(f"✅ Prefetched {len(df)} rows for {ticker}")
            else:
                print(f"⚠️  No data returned for {ticker} during prefetch")
        except Exception as e:
            print(f"❌ Prefetch failed for {ticker}: {e}")
        # Small delay to be gentle on the Angel One rate limit
        await _asyncio.sleep(1.5)
    print("✅ Historical prefetch complete for all tickers.")


app = FastAPI(
    title="StockOracle Pro API",
    description="Production-grade AI stock forecasting API using PyTorch and FastAPI",
    version="1.0.0",
    lifespan=lifespan
)

# Rate limiter (uses client IP by default)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Optional API key auth — only enforced when API_KEY env var is set
_API_KEY_NAME = "X-API-Key"
_api_key_header = APIKeyHeader(name=_API_KEY_NAME, auto_error=False)
SERVER_API_KEY = os.getenv("API_KEY", "").strip()

def verify_api_key(key: str = Security(_api_key_header)):
    """If SERVER_API_KEY is set, reject requests that don't include the correct key."""
    if SERVER_API_KEY and key != SERVER_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing X-API-Key header.")

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://main.d3qrmvw6hu9g61.amplifyapp.com",
    "https://stockoracle.duckdns.org",
]
env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # Fixed: was ["*"] — now uses the configured origins list
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory status stores
training_status: Dict[str, Dict[str, Any]] = {}
popular_tickers = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "HUL"]

# ── REST API ROUTES ──

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "StockOracle Pro Advanced AI Market Forecasting API live.",
        "version": "1.0.0"
    }

@app.get("/api/db/status")
def db_status():
    """Returns a live snapshot of all SQLite table sizes and per-ticker historical coverage."""
    return {"status": "ok", "database": get_db_stats(), "timestamp": datetime.now().isoformat()}


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "angel_one_session": get_session_status(),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/stock/{ticker}/info")
def get_stock_info(ticker: str):
    t = ticker.upper().strip()
    if not t.replace("-", "").isalpha() or len(t) > 20:
        raise HTTPException(status_code=422, detail=f"Invalid ticker format: '{ticker}'. Use NSE symbol like RELIANCE, TCS.")
    info = fetch_company_info(t)
    if not info:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API is unavailable. Server is authenticating — try again in a moment.")
        raise HTTPException(status_code=404, detail=f"Ticker '{t}' not found on NSE or data unavailable.")
    return info

@app.get("/api/stock/{ticker}/history")
def get_stock_history(ticker: str, timeframe: str = "5Y", interval: str = "1d"):
    t = ticker.upper().strip()

    # Map frontend timeframe label → internal period string
    days_map = {
        "1D":  "2D",   # intraday: fetch 2 days worth so we get today fully
        "5D":  "7D",
        "1W":  "10D",
        "1M":  "45D",
        "3M":  "120D",
        "6M":  "200D",
        "1Y":  "370D",
        "2Y":  "2Y",
        "5Y":  "5Y",
    }
    period = days_map.get(timeframe.upper())
    if not period:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid timeframe '{timeframe}'. Valid: 1D, 5D, 1W, 1M, 3M, 6M, 1Y, 2Y, 5Y."
        )

    # Validate interval
    valid_intervals = {"1m", "5m", "15m", "1h", "1d"}
    iv = interval.lower()
    if iv not in valid_intervals:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid interval '{interval}'. Valid: 1m, 5m, 15m, 1h, 1d."
        )

    df = fetch_stock_data(t, period=period, interval=iv)
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history found for '{t}'. Market may be closed or ticker invalid.")

    enriched_df = enrich_stock_dataframe(df)
    return enriched_df.to_dict(orient="records")


@app.get("/api/stock/search/{query}")
def search_stock(query: str):
    """
    Validates an NSE ticker and returns basic info so the frontend can open
    any stock — not just the hardcoded popular 10.
    Returns {found: bool, ticker: str, name: str} so the UI can decide.
    """
    t = query.upper().strip()
    if not t or len(t) > 20:
        raise HTTPException(status_code=422, detail="Invalid ticker format.")

    # Try to resolve via ScripMaster first (no API call needed)
    from backend.data.fetcher import get_token_info
    tok = get_token_info(t)
    if tok:
        return {"found": True, "ticker": t, "name": tok.get("name", t), "exchange": tok.get("exch_seg", "NSE")}

    # ScripMaster not loaded yet — try fetching info directly
    info = fetch_company_info(t)
    if info:
        return {"found": True, "ticker": t, "name": info.get("name", t), "exchange": info.get("exchange", "NSE")}

    return {"found": False, "ticker": t, "name": t, "exchange": "NSE"}


@app.get("/api/stocks/search")
def search_stocks(query: str, limit: int = 12):
    """Autocomplete across the full NSE ScripMaster cached in SQLite."""
    if not query.strip():
        return []
    return search_nse_stocks(query, limit)


@app.get("/api/stock/{ticker}/news")
def get_stock_news(ticker: str, limit: int = 8):
    """Returns recent public news headlines without requiring a paid news API key."""
    t = ticker.upper().strip()
    token = __import__("backend.data.fetcher", fromlist=["get_token_info"]).get_token_info(t)
    company = token.get("name", t) if token else t
    url = f"https://news.google.com/rss/search?q={quote_plus(company + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en"
    try:
        request = UrllibRequest(url, headers={"User-Agent": "StockOracle/1.0"})
        with urlopen(request, timeout=8) as response:
            root = ET.fromstring(response.read())
        items = []
        for item in root.findall("./channel/item")[:max(1, min(limit, 15))]:
            source = item.find("source")
            items.append({
                "title": item.findtext("title", ""),
                "link": item.findtext("link", ""),
                "published_at": item.findtext("pubDate", ""),
                "source": source.text if source is not None else "News",
            })
            
        try:
            from backend.analysis.sentiment import fetch_and_score_sentiment
            sentiment_score = fetch_and_score_sentiment(t)
        except Exception as e:
            logger.warning("Sentiment scoring failed for %s: %s", t, e)
            sentiment_score = 0.0
            
        return {"ticker": t, "company": company, "items": items, "sentiment": sentiment_score}
    except Exception as exc:
        return {"ticker": t, "company": company, "items": [], "sentiment": 0.0, "warning": f"News temporarily unavailable: {exc}"}


@app.get("/api/stock/{ticker}/patterns")
def get_patterns(ticker: str, days: int = 45):
    """Returns detected candlestick patterns for the last `days` sessions."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="6M")
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history for '{t}'.")
    return get_pattern_summary(df, lookback=min(days, len(df)))


@app.get("/api/stock/{ticker}/levels")
def get_levels(ticker: str):
    """Returns support, resistance, pivot points, and Fibonacci retracement levels."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history for '{t}'.")
    if len(df) < 15:
        raise HTTPException(status_code=400, detail="Insufficient data to compute levels.")
    return calculate_support_resistance(df)


@app.get("/api/stock/{ticker}/volatility")
def get_volatility(ticker: str):
    """Returns GARCH(1,1) volatility forecast and rolling historical volatility."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history for '{t}'.")
    if len(df) < 25:
        raise HTTPException(status_code=400, detail="Insufficient data for volatility forecast.")
    return calculate_volatility_forecast(df)

@app.get("/api/stock/{ticker}/montecarlo")
def get_monte_carlo(ticker: str):
    t = ticker.upper().strip()

    # Serve from DB cache (30-min TTL) if available
    cached = get_monte_carlo_cached(t)
    if cached is not None:
        return cached

    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history found for '{t}' to run Monte Carlo simulation.")
    closes = df["close"].tolist()
    if len(closes) < 30:
        raise HTTPException(status_code=400, detail="Insufficient price history to run Monte Carlo simulation. Need at least 30 sessions of data.")
    mc_results = run_monte_carlo_simulation(closes, simulations=150, horizon=30)
    save_monte_carlo(t, mc_results)
    return mc_results

@app.get("/api/stock/{ticker}/anomalies")
def get_anomalies(ticker: str):
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history found for '{t}' to compute anomalies.")
    anoms = detect_anomalies(df, window=20, threshold=2.2)
    return anoms

# Background task for model training
def background_train_task(ticker: str):
    try:
        training_status[ticker] = {"status": "training", "epoch": 0, "total_epochs": 60, "loss": 0.0, "val_loss": 0.0}
        
        df = fetch_stock_data(ticker, period="2Y")
        if df is None or df.empty:
            training_status[ticker] = {"status": "failed", "error": "No historical data to train."}
            return
            
        predictor = StockPredictor(window_size=20)
        
        def progress_callback(epoch, total, loss, val_loss):
            training_status[ticker] = {
                "status": "training",
                "epoch": epoch,
                "total_epochs": total,
                "loss": loss,
                "val_loss": val_loss
            }
            
        results = predictor.train_model(df, ticker, epochs=60, callback=progress_callback)
        training_status[ticker] = {
            "status": "completed",
            "metrics": results
        }
    except Exception as e:
        training_status[ticker] = {"status": "failed", "error": str(e)}

from pydantic import BaseModel
import uuid
import asyncio

class SimulationRequest(BaseModel):
    sentiment: float = 0.0
    volatility_multiplier: float = 1.0
    volume_multiplier: float = 1.0

# Global tracking for training tasks
training_tasks = {}

def _get_prediction_logic(symbol: str) -> dict:
    from backend.analysis.trainer import predict_future
    try:
        res = predict_future(symbol.upper())
        model_trained = True
    except FileNotFoundError:
        # Fallback rule-based prediction if model is not trained yet
        from backend.data.fetcher import fetch_stock_data
        df = fetch_stock_data(symbol.upper(), period="45D")
        if df is not None and not df.empty and len(df) >= 20:
            cur_price = float(df["close"].iloc[-1])
            ma20 = float(df["close"].rolling(20).mean().iloc[-1])
            predicted_price = cur_price * 1.005 if cur_price > ma20 else cur_price * 0.995
            high_bound = predicted_price * 1.02
            low_bound = predicted_price * 0.98
        else:
            cur_price = 100.0
            predicted_price = 100.0
            high_bound = 105.0
            low_bound = 95.0

        res = {
            "current_price": cur_price,
            "predicted_price": round(predicted_price, 2),
            "high_bound": round(high_bound, 2),
            "low_bound": round(low_bound, 2)
        }
        model_trained = False

    cur_price = res.get('current_price', 0.0) or 1.0
    predicted_return = (res['predicted_price'] - cur_price) / cur_price if cur_price > 0 else 0.0
    signal = "buy" if res['predicted_price'] > cur_price * 1.01 else ("sell" if res['predicted_price'] < cur_price * 0.99 else "hold")

    # Real confidence score: based on prediction spread width relative to price.
    # Narrow spread = high confidence. Formula: 100 - (spread% * 10), clamped 0-100.
    spread_pct = (res['high_bound'] - res['low_bound']) / (cur_price + 1e-9) * 100.0
    ai_score = int(max(0, min(100, round(100.0 - spread_pct * 10.0))))

    return {
        "ticker": symbol.upper(),
        "current_price": res['current_price'],
        "predicted_price": res['predicted_price'],
        "predicted_price_7d": res['predicted_price'],
        "predicted_return_7d": predicted_return,
        "high_bound": res['high_bound'],
        "low_bound": res['low_bound'],
        "ai_confidence_score": ai_score,
        "signal": signal,
        "model_trained": model_trained
    }

@app.get("/api/stock/{symbol}/predict")
@limiter.limit("10/minute")
def get_prediction(request: Request, symbol: str, background_tasks: BackgroundTasks):
    try:
        # Check staleness or existence of model
        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", f"{symbol.upper()}.json")
        if os.path.exists(model_path):
            try:
                with open(model_path, 'r') as f:
                    bundle = json.load(f)
                trained_at_str = bundle.get("trained_at")
                if trained_at_str:
                    trained_at = datetime.fromisoformat(trained_at_str)
                    if datetime.now() - trained_at > timedelta(days=7):
                        logger.info("Model for %s is stale (> 7 days old). Triggering auto-retrain.", symbol)
                        task_id = str(uuid.uuid4())
                        save_task_status(task_id, symbol.upper(), "queued", 0)
                        background_tasks.add_task(background_train_job, task_id, symbol.upper())
            except Exception as se:
                logger.warning("Failed to check model staleness: %s", se)
        else:
            # Trigger automatic initial training since model doesn't exist
            logger.info("Model for %s does not exist. Triggering automatic initial training.", symbol)
            task_id = str(uuid.uuid4())
            save_task_status(task_id, symbol.upper(), "queued", 0)
            background_tasks.add_task(background_train_job, task_id, symbol.upper())

        return _get_prediction_logic(symbol)
    except Exception as e:
        logger.error("Prediction failed for %s: %s", symbol, e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{symbol}/explain")
def get_explainability(symbol: str):
    from backend.analysis.explainer import get_top_features
    try:
        top_features = get_top_features(symbol.upper(), top_n=3)
        return top_features
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stock/{symbol}/simulate")
@limiter.limit("15/minute")
def simulate_prediction(request: Request, symbol: str, req: SimulationRequest):
    from backend.analysis.trainer import predict_future
    try:
        from backend.analysis.feature_engineer import get_features
        df = get_features(symbol.upper())
        if df.empty:
            raise ValueError("No data")
        latest = df.iloc[-1]

        overrides = {
            "sentiment": req.sentiment,
            "volume": latest['volume'] * req.volume_multiplier,
            "atr_14": latest['atr_14'] * req.volatility_multiplier,
            "roll_std_20": latest['roll_std_20'] * req.volatility_multiplier
        }

        res = predict_future(symbol.upper(), override_features=overrides)
        return {
            "predicted_price": res['predicted_price'],
            "high_bound": res['high_bound'],
            "low_bound": res['low_bound']
        }
    except Exception as e:
        logger.error("Simulation failed for %s: %s", symbol, e)
        raise HTTPException(status_code=500, detail=str(e))

def background_train_job(task_id: str, symbol: str):
    from backend.analysis.trainer import train_pipeline
    try:
        # Persist initial state to DB so it survives server restarts
        save_task_status(task_id, symbol, "training", 50)
        training_tasks[task_id] = {"status": "training", "progress": 50, "mape": None}
        result = train_pipeline(symbol)
        save_task_status(task_id, symbol, "completed", 100, mape=result['validation_mape'])
        training_tasks[task_id] = {"status": "completed", "progress": 100, "mape": result['validation_mape']}
    except Exception as e:
        logger.error("Training job failed for %s: %s", symbol, e)
        save_task_status(task_id, symbol, "failed", 0, error=str(e))
        training_tasks[task_id] = {"status": "failed", "error": str(e), "progress": 0}

@app.post("/api/stock/{symbol}/train")
@limiter.limit("3/minute")
def start_training(request: Request, symbol: str, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    save_task_status(task_id, symbol.upper(), "queued", 0)
    training_tasks[task_id] = {"status": "queued", "progress": 0, "mape": None}
    background_tasks.add_task(background_train_job, task_id, symbol.upper())
    return {"task_id": task_id, "message": "Training started"}

@app.get("/api/task/{task_id}/status")
def get_task_status_endpoint(task_id: str):
    # Check in-memory first (fastest), then fall back to DB (survives restarts)
    task = training_tasks.get(task_id)
    if not task:
        task = get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.get("/api/stock/{ticker}/backtest")
@limiter.limit("5/minute")
def get_backtest(request: Request, ticker: str):
    t_upper = ticker.upper().strip()
    # Use combined data so backtest includes today's live prices
    df = get_combined_stock_data(t_upper, period="2Y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history found for {t_upper} to run backtest.")

    results = run_backtest(df, t_upper)
    if "error" in results:
        raise HTTPException(status_code=400, detail=results["error"])
    return results

@app.get("/api/screener")
@limiter.limit("20/minute")
async def get_screener_list(request: Request, signal: str = "", min_score: int = 0):
    # Try DB cache first (5-min TTL — persists across restarts)
    cached_results = get_screener_results(ttl_minutes=5)

    if cached_results is None:
        # Cache miss — rebuild in thread pool so we don't block the event loop
        def _build_screener_cache():
            fresh_results = []
            for t in popular_tickers:
                try:
                    info = fetch_company_info(t)
                    if not info:
                        continue
                    pred = _get_prediction_logic(t)
                    prev = info["previous_close"] or 1.0
                    change_pct = ((info["current_price"] - prev) / prev) * 100
                    fresh_results.append({
                        "ticker":        t,
                        "name":          info["name"],
                        "price":         info["current_price"],
                        "change":        round(change_pct, 3),
                        "ai_score":      pred["ai_confidence_score"],
                        "signal":        pred["signal"],
                        "predicted_pct": round(pred["predicted_return_7d"] * 100, 3),
                    })
                except Exception:
                    continue
            return fresh_results

        loop = asyncio.get_running_loop()
        cached_results = await loop.run_in_executor(None, _build_screener_cache)
        save_screener_results(cached_results)

    # Apply optional filters
    results = cached_results
    if signal:
        results = [r for r in results if r["signal"] == signal.lower()]
    if min_score:
        results = [r for r in results if r["ai_score"] >= min_score]

    return results

# ── WEBSOCKET LIVE PRICE FEED MANAGER ──

class ConnectionManager:
    """WebSocket manager with per-client ticker subscriptions."""
    def __init__(self):
        # Map of websocket -> set of subscribed ticker symbols
        self.connections: Dict[WebSocket, set] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        # Default: subscribe to all popular tickers on connect
        self.connections[websocket] = set(popular_tickers)

    def disconnect(self, websocket: WebSocket):
        self.connections.pop(websocket, None)

    def subscribe(self, websocket: WebSocket, tickers: List[str]):
        """Update the set of tickers a specific client is interested in."""
        if websocket in self.connections:
            self.connections[websocket] = {t.upper() for t in tickers}

    async def broadcast(self, message: dict):
        """Sends the message only to clients subscribed to that ticker."""
        ticker = message.get("ticker", "")
        disconnected = []
        for ws, subscriptions in list(self.connections.items()):
            if ticker not in subscriptions:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)

    @property
    def active_connections(self) -> List[WebSocket]:
        return list(self.connections.keys())

manager = ConnectionManager()

# Background price broadcaster loop
async def websocket_price_broadcast_loop():
    from backend.data.fetcher import smartApi, get_token_info, fetch_company_info
    from backend.data.database import get_company_info, get_stale_company_info

    # Local price cache seeded with authentic prices
    prices_cache: Dict[str, float] = {}

    while True:
        try:
            if manager.active_connections:
                # Collect all tickers currently subscribed by active clients
                active_subscribed = set()
                for subs in manager.connections.values():
                    active_subscribed.update(subs)

                tickers_to_check = list(active_subscribed) if active_subscribed else popular_tickers

                for t in tickers_to_check:
                    fetched = False
                    try:
                        ensure_session()
                        if get_session_status() and smartApi:
                            tok = get_token_info(t)
                            if tok:
                                ltp_resp = smartApi.ltpData(tok["exch_seg"], tok["symbol"], tok["token"])
                                if ltp_resp and ltp_resp.get("status") and ltp_resp.get("data"):
                                    ltp = float(ltp_resp["data"].get("ltp", 0.0))
                                    prev_close = float(ltp_resp["data"].get("close", 0.0))
                                    if ltp > 0:
                                        change_pct = ((ltp - prev_close) / prev_close) if prev_close > 0 else 0.0
                                        prices_cache[t] = ltp
                                        payload = {
                                            "ticker": t,
                                            "price": round(ltp, 2),
                                            "change_pct": round(change_pct * 100, 3)
                                        }
                                        save_live_tick(t, round(ltp, 2), round(change_pct * 100, 3))
                                        await manager.broadcast(payload)
                                        fetched = True
                    except Exception as exc:
                        logger.debug("Live tick fetch failed for %s: %s", t, exc)

                    if not fetched:
                        # Fallback: check cached company info or previous verified price
                        base_price = prices_cache.get(t)
                        if not base_price:
                            info = get_company_info(t) or get_stale_company_info(t)
                            if info and info.get("current_price"):
                                base_price = float(info["current_price"])
                                prices_cache[t] = base_price

                        if base_price and base_price > 0:
                            payload = {
                                "ticker": t,
                                "price": round(base_price, 2),
                                "change_pct": 0.0
                            }
                            await manager.broadcast(payload)
                    
                    # Yield slightly between tickers
                    await asyncio.sleep(0.5)

        except Exception as e:
            logger.warning("Error in websocket price broadcast loop: %s", e)

        # Broadcast interval between rounds
        await asyncio.sleep(4.0)


# Startup is now handled by the lifespan context manager above.

@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Listen for subscription control messages from client
            # Expected format: {"subscribe": ["RELIANCE", "TCS", ...]}
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if "subscribe" in msg and isinstance(msg["subscribe"], list):
                    manager.subscribe(websocket, msg["subscribe"])
            except (json.JSONDecodeError, Exception):
                pass  # Ignore non-JSON keep-alive pings
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── NEW FEATURE ENDPOINTS ──────────────────────────────────────────────────

@app.get("/api/sentiment/market")
@limiter.limit("10/minute")
async def get_market_sentiment_endpoint(request: Request):
    """
    Aggregates news sentiment for all popular tickers and returns a
    composite Fear & Greed index plus per-ticker sentiment breakdown.
    NOTE: This runs FinBERT/VADER for each ticker → can take 20-60s on cold start.
    Results are served from a 30-minute in-memory cache on subsequent calls.
    """
    _cache_key = "_market_sentiment_cache"
    _cache_ts_key = "_market_sentiment_ts"
    from datetime import timedelta

    # 30-minute in-memory cache
    cached_val = getattr(app.state, _cache_key, None)
    cached_ts  = getattr(app.state, _cache_ts_key, None)
    if cached_val is not None and cached_ts is not None:
        if datetime.now() - cached_ts < timedelta(minutes=30):
            return cached_val

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, lambda: get_market_sentiment(popular_tickers))
    setattr(app.state, _cache_key, result)
    setattr(app.state, _cache_ts_key, datetime.now())
    return result


@app.get("/api/screener/advanced")
@limiter.limit("200/minute")
async def get_advanced_screener(
    request: Request,
    sector: str = "",
    min_rsi: float = 0.0,
    max_rsi: float = 100.0,
    signal: str = "",
    volume_spike: bool = False,
    near_52w_high: bool = False,
    near_52w_low: bool = False,
    min_score: int = 0,
    sort_by: str = "ai_score",
    sort_dir: str = "desc",
):
    """
    Advanced multi-filter screener. Extends the basic screener with:
    RSI range, MACD signal, volume spike detection, 52W proximity, sector, sorting.
    """
    # Re-use or build screener base results
    cached_results = get_screener_results(ttl_minutes=5)

    if cached_results is None:
        def _build():
            screener_universe = [
                "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "HUL",
                "TATAMOTORS", "MARUTI", "AXISBANK", "WIPRO", "HCLTECH", "SUNPHARMA", "BAJFINANCE", "KOTAKBANK",
                "TATASTEEL", "NTPC", "POWERGRID", "ONGC", "COALINDIA", "TITAN", "ULTRACEMCO", "ADANIENT",
                "JSWSTEEL", "HDFCLIFE", "BPCL", "HEROMOTOCO"
            ]
            fresh = []
            for t in screener_universe:
                try:
                    info = fetch_company_info(t)
                    if not info:
                        continue
                    pred = _get_prediction_logic(t)
                    df = fetch_stock_data(t, period="1Y")
                    enriched = enrich_stock_dataframe(df) if df is not None and not df.empty else None

                    prev = info.get("previous_close") or 1.0
                    change_pct = ((info["current_price"] - prev) / prev) * 100

                    # RSI & MACD from enriched dataframe
                    rsi_val = None
                    macd_sig = None
                    volume_ratio = None
                    high_52w = None
                    low_52w = None
                    trend = "NEUTRAL"

                    if enriched is not None and len(enriched) > 0:
                        last_row = enriched.iloc[-1]
                        rsi_val = float(last_row.get("rsi", 50)) if "rsi" in last_row else None
                        macd_sig = float(last_row.get("macd_signal", 0)) if "macd_signal" in last_row else None

                        # EMA20 vs SMA50 Trend Crossover
                        ema_20 = float(last_row.get("ema_20", 0)) if "ema_20" in last_row else 0
                        sma_50 = float(last_row.get("sma_50", 0)) if "sma_50" in last_row else 0
                        if ema_20 > 0 and sma_50 > 0:
                            trend = "BULLISH" if ema_20 >= sma_50 else "BEARISH"

                        # Volume ratio: last volume / 20-day avg volume
                        if "volume" in enriched.columns and len(enriched) >= 20:
                            avg_vol = float(enriched["volume"].rolling(20).mean().iloc[-1])
                            cur_vol = float(enriched["volume"].iloc[-1])
                            volume_ratio = round(cur_vol / avg_vol, 2) if avg_vol > 0 else 1.0
                        if "close" in enriched.columns and len(enriched) >= 50:
                            high_52w = float(enriched["close"].rolling(min(252, len(enriched))).max().iloc[-1])
                            low_52w  = float(enriched["close"].rolling(min(252, len(enriched))).min().iloc[-1])

                    # Expanded Sector Mapping
                    sector_map = {
                        "RELIANCE": "Energy", "ONGC": "Energy", "IOC": "Energy", "BPCL": "Energy", "NTPC": "Energy", "POWERGRID": "Energy", "COALINDIA": "Energy",
                        "TCS": "IT", "INFY": "IT", "WIPRO": "IT", "HCLTECH": "IT", "TECHM": "IT",
                        "HDFCBANK": "Banking", "ICICIBANK": "Banking", "SBIN": "Banking", "AXISBANK": "Banking", "KOTAKBANK": "Banking", "BAJFINANCE": "Banking", "HDFCLIFE": "Banking",
                        "BHARTIARTL": "Telecom",
                        "ITC": "FMCG", "HUL": "FMCG", "NESTLEIND": "FMCG",
                        "LT": "Infrastructure", "ULTRACEMCO": "Infrastructure", "ADANIENT": "Infrastructure",
                        "MARUTI": "Auto", "TATAMOTORS": "Auto", "HEROMOTOCO": "Auto", "M&M": "Auto",
                        "SUNPHARMA": "Pharma", "DRREDDY": "Pharma", "CIPLA": "Pharma",
                        "TATASTEEL": "Metals", "JSWSTEEL": "Metals", "HINDALCO": "Metals",
                        "TITAN": "Consumer",
                    }

                    cur_price = info["current_price"]
                    target_7d = pred.get("predicted_price_7d") or round(cur_price * (1.0 + pred.get("predicted_return_7d", 0.02)), 2)
                    stop_loss = round(cur_price * 0.96, 2)

                    fresh.append({
                        "ticker":          t,
                        "name":            info["name"],
                        "price":           cur_price,
                        "change":          round(change_pct, 3),
                        "ai_score":        pred["ai_confidence_score"],
                        "signal":          pred["signal"],
                        "predicted_pct":   round(pred["predicted_return_7d"] * 100, 3),
                        "target_price_7d": round(target_7d, 2),
                        "stop_loss":       stop_loss,
                        "trend":           trend,
                        "rsi":             round(rsi_val, 2) if rsi_val is not None else None,
                        "macd_signal":     round(macd_sig, 4) if macd_sig is not None else None,
                        "volume_ratio":    volume_ratio,
                        "high_52w":        round(high_52w, 2) if high_52w else None,
                        "low_52w":         round(low_52w, 2) if low_52w else None,
                        "sector":          sector_map.get(t, "Other"),
                    })
                except Exception:
                    continue
            return fresh

        loop = asyncio.get_running_loop()
        cached_results = await loop.run_in_executor(None, _build)
        save_screener_results(cached_results)

    results = cached_results

    # Apply filters
    if sector:
        results = [r for r in results if r.get("sector", "").lower() == sector.lower()]
    if signal:
        results = [r for r in results if r.get("signal", "") == signal.lower()]
    if min_score:
        results = [r for r in results if r.get("ai_score", 0) >= min_score]
    if min_rsi > 0 or max_rsi < 100:
        results = [r for r in results if r.get("rsi") is not None and min_rsi <= r["rsi"] <= max_rsi]
    if volume_spike:
        results = [r for r in results if (r.get("volume_ratio") or 0) >= 1.5]
    if near_52w_high:
        results = [r for r in results if r.get("high_52w") and abs(r["price"] - r["high_52w"]) / r["high_52w"] <= 0.05]
    if near_52w_low:
        results = [r for r in results if r.get("low_52w") and abs(r["price"] - r["low_52w"]) / r["price"] <= 0.05]

    # Sorting
    valid_sort_keys = {"ai_score", "change", "predicted_pct", "rsi", "volume_ratio", "price"}
    sk = sort_by if sort_by in valid_sort_keys else "ai_score"
    reverse = sort_dir.lower() != "asc"
    results = sorted(results, key=lambda r: (r.get(sk) or 0), reverse=reverse)

    return results


@app.get("/api/market/heatmap")
@limiter.limit("20/minute")
async def get_market_heatmap(request: Request):
    """
    Returns sector-grouped heatmap data: ticker, price, change%, sector, market cap tier.
    All popular tickers enriched with sector and live price change.
    """
    # Extended ticker list with sector metadata
    heatmap_tickers = [
        {"t": "RELIANCE",   "sector": "Energy",          "mcap_tier": 3},
        {"t": "TCS",        "sector": "IT",              "mcap_tier": 3},
        {"t": "HDFCBANK",   "sector": "Banking",         "mcap_tier": 3},
        {"t": "INFY",       "sector": "IT",              "mcap_tier": 3},
        {"t": "ICICIBANK",  "sector": "Banking",         "mcap_tier": 3},
        {"t": "SBIN",       "sector": "Banking",         "mcap_tier": 2},
        {"t": "BHARTIARTL", "sector": "Telecom",         "mcap_tier": 2},
        {"t": "ITC",        "sector": "FMCG",            "mcap_tier": 2},
        {"t": "LT",         "sector": "Infrastructure",  "mcap_tier": 2},
        {"t": "HUL",        "sector": "FMCG",            "mcap_tier": 2},
    ]

    def _build_heatmap():
        rows = []
        for item in heatmap_tickers:
            t = item["t"]
            try:
                info = fetch_company_info(t)
                if not info:
                    continue
                prev = info.get("previous_close") or 1.0
                change_pct = ((info["current_price"] - prev) / prev) * 100
                rows.append({
                    "ticker":     t,
                    "name":       info["name"],
                    "price":      info["current_price"],
                    "change_pct": round(change_pct, 3),
                    "sector":     item["sector"],
                    "mcap_tier":  item["mcap_tier"],
                })
            except Exception:
                rows.append({
                    "ticker":    t,
                    "name":      t,
                    "price":     0,
                    "change_pct":0,
                    "sector":    item["sector"],
                    "mcap_tier": item["mcap_tier"],
                })
        return rows

    loop = asyncio.get_running_loop()
    rows = await loop.run_in_executor(None, _build_heatmap)

    # Group by sector
    sectors: Dict[str, List] = {}
    for row in rows:
        s = row["sector"]
        sectors.setdefault(s, []).append(row)

    # Sector summary
    sector_summaries = []
    for sname, items in sectors.items():
        avg_change = sum(i["change_pct"] for i in items) / len(items) if items else 0
        sector_summaries.append({
            "sector": sname,
            "avg_change_pct": round(avg_change, 3),
            "stocks": items,
        })

    sector_summaries.sort(key=lambda x: x["avg_change_pct"], reverse=True)
    return {"sectors": sector_summaries, "timestamp": datetime.now().isoformat()}


@app.get("/api/macro")
@limiter.limit("30/minute")
async def get_macro_endpoint(request: Request):
    """
    Returns live macro-economic indicators:
    RBI Repo Rate, India CPI, USD/INR, US10Y Yield, India VIX, FII/DII net flows.
    Data is cached for 3 hours server-side.
    """
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, get_macro_data)
    return data


@app.get("/api/stock/{ticker}/supply-chain")
@limiter.limit("15/minute")
async def get_supply_chain_endpoint(request: Request, ticker: str):
    """
    Returns the supply chain network for the given NSE ticker:
    upstream suppliers, downstream customers, and rolling 60-day price correlations.
    """
    t = ticker.upper().strip()
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, lambda: get_supply_chain(t))
    return result
