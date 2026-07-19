import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Import our custom modules
from backend.data.fetcher import (
    fetch_stock_data, fetch_company_info, ensure_session,
    get_session_status, reset_session
)
from backend.data.database import init_db, save_live_tick
from backend.analysis.indicators import enrich_stock_dataframe
from backend.analysis.monte_carlo import run_monte_carlo_simulation
from backend.analysis.anomaly import detect_anomalies
from backend.ml.predictor import StockPredictor

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

app = FastAPI(
    title="StockOracle Pro API",
    description="Production-grade AI stock forecasting API using PyTorch and FastAPI",
    version="1.0.0"
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

# Screener results cache — refreshed every 5 minutes to avoid blocking API requests
_screener_cache: Dict[str, Any] = {"data": [], "expires": datetime(2000, 1, 1)}

# ── REST API ROUTES ──

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "StockOracle Pro Advanced AI Market Forecasting API live.",
        "version": "1.0.0"
    }

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

@app.get("/api/stock/{ticker}/montecarlo")
def get_monte_carlo(ticker: str):
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history found for '{t}' to run Monte Carlo simulation.")
    closes = df["close"].tolist()
    mc_results = run_monte_carlo_simulation(closes, simulations=150, horizon=30)
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
        
        df = fetch_stock_data(ticker, period="2y")
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
    df = fetch_stock_data(t_upper, period="2y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history found for {t_upper}.")
        
    predictor = StockPredictor(window_size=20)
    current_price = df["close"].iloc[-1]
    
    try:
        # Load saved PyTorch model and predict
        pred_return = predictor.load_and_predict(df, t_upper)
        predicted_price = current_price * (1.0 + pred_return)
        model_trained = True
    except FileNotFoundError:
        # Fallback to rule-based engine if model is not trained yet
        enriched = enrich_stock_dataframe(df)
        last_row = enriched.iloc[-1]
        
        # Rule-based return estimation
        rsi_factor = (50 - last_row["rsi"]) / 500.0  # RSI factor
        macd_factor = last_row["macd_hist"] / current_price * 0.1
        pred_return = rsi_factor + macd_factor
        predicted_price = current_price * (1.0 + pred_return)
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
    
    return {
        "ticker": t_upper,
        "current_price": float(current_price),
        "predicted_price_7d": float(predicted_price),
        "predicted_return_7d": float(pred_return),
        "ai_confidence_score": ai_score,
        "signal": signal,
        "model_trained": model_trained
    }

@app.get("/api/screener")
def get_screener_list(signal: str = "", min_score: int = 0):
    global _screener_cache

    # Refresh cache only if expired (every 5 minutes) to avoid blocking the server
    if datetime.now() > _screener_cache["expires"]:
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
        _screener_cache = {"data": fresh_results, "expires": datetime.now() + timedelta(minutes=5)}

    results = _screener_cache["data"]

    # Apply optional filters on the cached snapshot
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
        self.active_connections.remove(websocket)
        
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might have closed without clean handshake
                continue

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
        if get_session_status() and smartApi:
            for t in popular_tickers:
                try:
                    tok = get_token_info(t)
                    if tok:
                        ltp_resp = smartApi.ltpData(tok["exch_seg"], tok["symbol"], tok["token"])
                        if ltp_resp and ltp_resp.get("status") and ltp_resp.get("data"):
                            ltp = float(ltp_resp["data"].get("ltp", 0.0))
                            if ltp > 0:
                                prices_cache[t] = ltp
                except Exception:
                    pass
    except Exception:
        pass  # Fallback values remain in effect

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


# Start background broadcast loop on startup
@app.on_event("startup")
async def startup_event():
    # Initialize SQL database tables
    init_db()
    # Authenticate with Angel One on startup so all requests are ready immediately
    ensure_session()
    asyncio.create_task(websocket_price_broadcast_loop())

@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep socket alive by receiving dummy messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
