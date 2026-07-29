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
    allow_origins=origins,
    allow_credentials=True,
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
def get_stock_history(ticker: str, timeframe: str = "3M"):
    t = ticker.upper().strip()
    days_map = {"1W": "10D", "1M": "45D", "3M": "120D", "6M": "200D", "1Y": "370D"}
    period = days_map.get(timeframe.upper())
    if not period:
        raise HTTPException(status_code=422, detail=f"Invalid timeframe '{timeframe}'. Valid: 1W, 1M, 3M, 6M, 1Y.")

    df = fetch_stock_data(t, period=period)
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
        return {"ticker": t, "company": company, "items": items}
    except Exception as exc:
        return {"ticker": t, "company": company, "items": [], "warning": f"News temporarily unavailable: {exc}"}


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

@app.post("/api/train/{ticker}")
def start_training(ticker: str, background_tasks: BackgroundTasks):
    t_upper = ticker.upper()
    status = training_status.get(t_upper, {}).get("status")
    
    if status == "training":
        return {"status": "already_running", "message": f"Model training is already in progress for {t_upper}."}
        
    background_tasks.add_task(background_train_task, t_upper)
    return {"status": "started", "message": f"Background training job queued for {t_upper}."}

@app.get("/api/train/{ticker}/status")
def get_training_status(ticker: str):
    status = training_status.get(ticker.upper())
    if not status:
        return {"status": "idle", "message": "No model has been trained yet in this session."}
    return status

@app.get("/api/stock/{ticker}/predict")
def get_prediction(ticker: str):
    t_upper = ticker.upper()

    # Serve from DB cache (10-min TTL) if available
    cached = get_prediction_cached(t_upper)
    if cached is not None:
        return cached

    # Use combined historical + live tick data for most current prediction
    df = get_combined_stock_data(t_upper, period="2Y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history found for {t_upper}.")
        
    predictor = StockPredictor(window_size=20)
    current_price = float(df["close"].iloc[-1])
    
    model_weights = {"bilstm": 0.333, "transformer": 0.333, "gbdt": 0.334}
    predicted_upper_price = current_price
    predicted_lower_price = current_price
    confidence_std = 0.05

    try:
        # Load saved PyTorch model and predict with full details
        details = predictor.load_and_predict(df, t_upper, return_details=True)
        pred_return = float(details["expected_return"])
        predicted_price = current_price * (1.0 + pred_return)
        predicted_upper_price = current_price * (1.0 + float(details["upper_return"]))
        predicted_lower_price = current_price * (1.0 + float(details["lower_return"]))
        confidence_std = float(details["confidence_std"])
        model_weights = details["weights"]
        model_trained = True
    except FileNotFoundError:
        # Fallback to rule-based engine if model is not trained yet
        enriched = enrich_stock_dataframe(df)
        last_row = enriched.iloc[-1]

        rsi_factor = (50 - float(last_row["rsi"])) / 500.0
        macd_factor = float(last_row["macd_hist"]) / current_price * 0.1
        pred_return = rsi_factor + macd_factor
        predicted_price = current_price * (1.0 + pred_return)
        predicted_upper_price = current_price * (1.0 + pred_return + 0.05)
        predicted_lower_price = current_price * (1.0 + pred_return - 0.05)
        model_trained = False
    except (KeyError, RuntimeError) as e:
        # Stale / incompatible .pt file — delete it so next call hits rule-based cleanly
        import os as _os
        from backend.ml.predictor import MODELS_DIR
        stale_path = _os.path.join(MODELS_DIR, f"{t_upper}.pt")
        if _os.path.exists(stale_path):
            _os.remove(stale_path)
            print(f"🗑️  Deleted stale model file for {t_upper}: {e}")
        enriched = enrich_stock_dataframe(df)
        last_row = enriched.iloc[-1]

        rsi_factor = (50 - float(last_row["rsi"])) / 500.0
        macd_factor = float(last_row["macd_hist"]) / current_price * 0.1
        pred_return = rsi_factor + macd_factor
        predicted_price = current_price * (1.0 + pred_return)
        predicted_upper_price = current_price * (1.0 + pred_return + 0.05)
        predicted_lower_price = current_price * (1.0 + pred_return - 0.05)
        model_trained = False
        
    # Standard technical analysis signals
    df_enriched = enrich_stock_dataframe(df)
    last = df_enriched.iloc[-1]
    
    bullish_signals = 0
    bearish_signals = 0
    
    if last["rsi"] < 30: bullish_signals += 2
    elif last["rsi"] > 70: bearish_signals += 2
    if last["macd_hist"] > 0: bullish_signals += 1
    else: bearish_signals += 1
    if last["close"] > last["sma_20"]: bullish_signals += 1
    else: bearish_signals += 1
    
    bull_ratio = bullish_signals / (bullish_signals + bearish_signals)
    ai_score = int(60 + (bull_ratio - 0.5) * 40)
    
    signal = "hold"
    if bull_ratio >= 0.75: signal = "strong-buy"
    elif bull_ratio >= 0.58: signal = "buy"
    elif bull_ratio <= 0.25: signal = "strong-sell"
    elif bull_ratio <= 0.42: signal = "sell"
    
    result = {
        "ticker": t_upper,
        "current_price": current_price,
        "predicted_price_7d": float(predicted_price),
        "predicted_upper_price_7d": float(predicted_upper_price),
        "predicted_lower_price_7d": float(predicted_lower_price),
        "predicted_return_7d": float(pred_return),
        "confidence_std": float(confidence_std),
        "model_weights": model_weights,
        "ai_confidence_score": ai_score,
        "signal": signal,
        "model_trained": model_trained
    }
    # Persist prediction to DB (10-min TTL)
    save_prediction(t_upper, result)
    return result

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
                # Broadcast static cached price without simulated changes or database writes
                base_price = prices_cache.get(t, 1000.0)
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

@app.post("/api/stock/{symbol}/train")
def train_model_endpoint(symbol: str):
    """Runs the lightweight CPU-only feature generation, tuning, and XGBoost/ElasticNet ensemble training pipeline."""
    try:
        from backend.analysis.predictor import train_pipeline
        result = train_pipeline(symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
