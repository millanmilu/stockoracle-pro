import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

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
    get_db_stats
)
from backend.analysis.indicators import enrich_stock_dataframe
from backend.analysis.monte_carlo import run_monte_carlo_simulation
from backend.analysis.anomaly import detect_anomalies
from backend.analysis.patterns import get_pattern_summary
from backend.analysis.levels import calculate_support_resistance
from backend.analysis.volatility_forecast import calculate_volatility_forecast
from backend.ml.predictor import StockPredictor
from backend.analysis.backtester import run_backtest

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQL database tables
    init_db()
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

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
def get_stock_history(ticker: str, timeframe: str = "3M", interval: str = "1d"):
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
        request = Request(url, headers={"User-Agent": "StockOracle/1.0"})
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
        except:
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

@app.get("/api/stock/{symbol}/predict")
def get_prediction(symbol: str):
    from backend.analysis.trainer import predict_future
    try:
        res = predict_future(symbol.upper())
        predicted_return = (res['predicted_price'] - res['current_price']) / res['current_price']
        signal = "buy" if res['predicted_price'] > res['current_price'] * 1.01 else ("sell" if res['predicted_price'] < res['current_price'] * 0.99 else "hold")
        ai_score = 80 if signal == "buy" else (20 if signal == "sell" else 50)
        
        return {
            "ticker": symbol.upper(),
            "current_price": res['current_price'],
            "predicted_price": res['predicted_price'],
            "predicted_price_7d": res['predicted_price'],
            "predicted_return_7d": predicted_return,
            "high_bound": res['high_bound'],
            "low_bound": res['low_bound'],
            "ai_confidence_score": ai_score,
            "signal": signal
        }
    except Exception as e:
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
def simulate_prediction(symbol: str, req: SimulationRequest):
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
        raise HTTPException(status_code=500, detail=str(e))

def background_train_job(task_id: str, symbol: str):
    from backend.analysis.trainer import train_pipeline
    try:
        training_tasks[task_id] = {"status": "training", "progress": 50, "mape": None}
        result = train_pipeline(symbol)
        training_tasks[task_id] = {"status": "completed", "progress": 100, "mape": result['validation_mape']}
    except Exception as e:
        training_tasks[task_id] = {"status": "failed", "error": str(e), "progress": 0}

@app.post("/api/stock/{symbol}/train")
def start_training(symbol: str, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    training_tasks[task_id] = {"status": "queued", "progress": 0, "mape": None}
    background_tasks.add_task(background_train_job, task_id, symbol.upper())
    return {"task_id": task_id, "message": "Training started"}

@app.get("/api/task/{task_id}/status")
def get_task_status(task_id: str):
    task = training_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.get("/api/stock/{ticker}/backtest")
def get_backtest(ticker: str):
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
async def get_screener_list(signal: str = "", min_score: int = 0):
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
                    pred = get_prediction(t)
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
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might have closed without clean handshake
                disconnected.append(connection)
        for connection in disconnected:
            self.disconnect(connection)

manager = ConnectionManager()

# Background price broadcaster loop
async def websocket_price_broadcast_loop():
    import random

    # Accurate fallback prices (INR) — used until real LTP is fetched
    prices_cache = {
        "RELIANCE": 1420.0, "TCS": 3900.0, "HDFCBANK": 1900.0, "INFY": 1560.0,
        "ICICIBANK": 1390.0, "SBIN": 850.0, "BHARTIARTL": 1880.0, "ITC": 430.0,
        "LT": 3600.0, "HUL": 2320.0
    }

    # Attempt to seed the cache with real LTP prices from Angel One
    try:
        from backend.data.fetcher import smartApi, get_token_info
        ensure_session()
    except Exception:
        pass

    while True:
        if manager.active_connections:
            # Pick a random ticker to update
            t = random.choice(popular_tickers)
            
            fetched = False
            try:
                from backend.data.fetcher import smartApi, get_token_info
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
                                # Save tick updates directly to SQL database in the background (real ticks only)
                                save_live_tick(t, round(ltp, 2), round(change_pct * 100, 3))
                                await manager.broadcast(payload)
                                fetched = True
            except Exception as e:
                print(f"Error fetching live tick for {t}: {e}")

            if not fetched:
                base_price = prices_cache.get(t)
                if not base_price:
                    try:
                        from backend.data.fetcher import fetch_company_info
                        info = fetch_company_info(t)
                        if info and info.get("current_price"):
                            base_price = float(info["current_price"])
                            prices_cache[t] = base_price
                    except Exception: pass
                
                if base_price and base_price > 0:
                    payload = {
                        "ticker": t,
                        "price": round(base_price, 2),
                        "change_pct": 0.0
                    }
                    await manager.broadcast(payload)

        # Broadcast interval: 5 seconds to be gentle on connections
        await asyncio.sleep(5.0)


# Startup is now handled by the lifespan context manager above.

@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep socket alive by receiving dummy messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


