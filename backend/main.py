import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from typing import Dict, Any, List
from dotenv import load_dotenv

# Import our custom modules
from backend.data.fetcher import fetch_stock_data, fetch_company_info
from backend.analysis.indicators import enrich_stock_dataframe
from backend.analysis.monte_carlo import run_monte_carlo_simulation
from backend.analysis.anomaly import detect_anomalies
from backend.ml.predictor import StockPredictor

load_dotenv()

app = FastAPI(
    title="StockOracle Pro API",
    description="Production-grade AI stock forecasting API using PyTorch and FastAPI",
    version="1.0.0"
)

# CORS configuration
origins = ["*"] # Allow all for easy setup on AWS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory status stores
training_status: Dict[str, Dict[str, Any]] = {}
popular_tickers = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "GOOGL", "AMD", "NFLX", "JPM"]

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
    return {"status": "healthy"}

@app.get("/api/stock/{ticker}/info")
def get_stock_info(ticker: str):
    info = fetch_company_info(ticker.upper())
    if not info:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found.")
    return info

@app.get("/api/stock/{ticker}/history")
def get_stock_history(ticker: str, timeframe: str = "3M"):
    days_map = {"1W": "10d", "1M": "45d", "3M": "120d", "6M": "200d", "1Y": "370d"}
    period = days_map.get(timeframe.upper(), "120d")
    
    df = fetch_stock_data(ticker.upper(), period=period)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history found for {ticker}.")
        
    # Enrich with technical indicators
    enriched_df = enrich_stock_dataframe(df)
    return enriched_df.to_dict(orient="records")

@app.get("/api/stock/{ticker}/montecarlo")
def get_monte_carlo(ticker: str):
    df = fetch_stock_data(ticker.upper(), period="1y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history found for {ticker}.")
        
    closes = df["close"].tolist()
    mc_results = run_monte_carlo_simulation(closes, simulations=150, horizon=30)
    return mc_results

@app.get("/api/stock/{ticker}/anomalies")
def get_anomalies(ticker: str):
    df = fetch_stock_data(ticker.upper(), period="1y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history for {ticker} to compute anomalies.")
    
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
def get_screener_list(sector: str = "", signal: str = "", min_score: int = 0):
    screener_results = []
    
    # We populate the screener by running predictions on the popular tickers
    for t in popular_tickers:
        try:
            info = fetch_company_info(t)
            if not info: continue
            
            # Check sector filter early to avoid unnecessary computation
            if sector and info["sector"] != sector.lower():
                continue
                
            pred = get_prediction(t)
            
            # Apply signal filter
            if signal and pred["signal"] != signal.lower():
                continue
                
            # Apply AI Score filter
            if pred["ai_confidence_score"] < min_score:
                continue
                
            change_pct = ((info["current_price"] - info["previous_close"]) / info["previous_close"]) * 100
            
            screener_results.append({
                "ticker": t,
                "name": info["name"],
                "price": info["current_price"],
                "change": change_pct,
                "ai_score": pred["ai_confidence_score"],
                "signal": pred["signal"],
                "predicted_pct": pred["predicted_return_7d"] * 100
            })
        except Exception:
            continue
            
    return screener_results

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

    # Hardcoded base prices — avoids Yahoo Finance calls on startup (prevents 429)
    prices_cache = {
        "AAPL": 213.80, "TSLA": 247.50, "NVDA": 131.60, "MSFT": 438.30,
        "AMZN": 196.40, "META": 584.70, "GOOGL": 189.20, "AMD": 162.40,
        "NFLX": 892.30, "JPM": 234.10
    }

    while True:
        if manager.active_connections:
            # Pick a random ticker to update
            t = random.choice(popular_tickers)
            base_price = prices_cache.get(t, 150.0)

            # Simulate a small price tick (-0.2% to +0.2%)
            change_pct = random.uniform(-0.002, 0.002)
            new_price = base_price * (1.0 + change_pct)
            prices_cache[t] = new_price  # update cache for next tick

            payload = {
                "ticker": t,
                "price": round(new_price, 2),
                "change_pct": round(change_pct * 100, 3)
            }
            await manager.broadcast(payload)

        # Broadcast interval: 5 seconds to be gentle on connections
        await asyncio.sleep(5.0)

# Start background broadcast loop on startup
@app.on_event("startup")
async def startup_event():
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
