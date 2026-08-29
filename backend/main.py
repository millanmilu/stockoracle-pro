"""
StockOracle Pro — Production-Grade AI Stock Forecasting Modular Monolith API
FastAPI + PyTorch + SQLAlchemy 2.0 (PostgreSQL/TimescaleDB/SQLite) + Celery/Redis
"""
import os
import json
import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Security, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# ── Structured Logging & Core Configuration ────────────────────────────────────
from backend.core.logging import configure_logging, get_logger
from backend.core.middleware import RequestIdMiddleware
from backend.shared.config import settings
from backend.shared.security import verify_api_key, get_current_user_id
from backend.shared.database import init_database
from backend.data.database import cleanup_old_tasks, save_live_tick, get_company_info, get_stale_company_info
from backend.data.fetcher import (
    fetch_stock_data, fetch_company_info, ensure_session,
    get_session_status, get_token_info, smartApi, run_session_keepalive_loop
)
from backend.services.alert_scheduler import run_alert_scheduler_loop

configure_logging()
logger = get_logger("stockoracle.main")

popular_tickers = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "SBIN", "BHARTIARTL", "ITC", "LT", "HUL"
]


# ── WebSocket Streaming Connection Manager ────────────────────────────────────
class ConnectionManager:
    """Manages active WebSocket client connections and per-client ticker subscriptions."""

    def __init__(self):
        self.connections: Dict[WebSocket, set] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections[websocket] = set(popular_tickers)

    def disconnect(self, websocket: WebSocket):
        self.connections.pop(websocket, None)

    def subscribe(self, websocket: WebSocket, tickers: list):
        if websocket in self.connections:
            # Max 50 subscribed tickers per client
            capped_tickers = [t.upper().strip() for t in tickers if isinstance(t, str)][:50]
            self.connections[websocket] = set(capped_tickers)

    async def broadcast(self, message: dict):
        """Sends the price tick only to clients subscribed to that ticker."""
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


# ── WebSocket Real-Time Price Broadcaster Loop ────────────────────────────────
async def websocket_price_broadcast_loop():
    prices_cache: Dict[str, float] = {}
    # Tracks last time a fallback (stale) price was sent per ticker — throttle to 1/30s
    _fallback_last_sent: Dict[str, float] = {}
    import time as _time

    while True:
        try:
            if manager.active_connections:
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
                                ltp_resp = await asyncio.to_thread(smartApi.ltpData, tok["exch_seg"], tok["symbol"], tok["token"])
                                if ltp_resp and ltp_resp.get("status") and ltp_resp.get("data"):
                                    ltp = float(ltp_resp["data"].get("ltp", 0.0))
                                    prev_close = float(ltp_resp["data"].get("close", 0.0))
                                    if ltp > 0:
                                        change_pct = ((ltp - prev_close) / prev_close) if prev_close > 0 else 0.0
                                        prices_cache[t] = ltp
                                        payload = {
                                            "ticker": t,
                                            "price": round(ltp, 2),
                                            "change_pct": round(change_pct * 100, 3),
                                            "is_live": True,
                                        }
                                        save_live_tick(t, round(ltp, 2), round(change_pct * 100, 3))
                                        await manager.broadcast(payload)
                                        fetched = True
                    except Exception as exc:
                        logger.debug("Live tick fetch failed for %s: %s", t, exc)

                    if not fetched:
                        # Throttle fallback broadcasts — send at most once every 30 seconds per ticker
                        # to avoid flooding frontend with stale/frozen prices on every loop cycle
                        now_ts = _time.monotonic()
                        last_sent = _fallback_last_sent.get(t, 0.0)
                        if now_ts - last_sent < 30.0:
                            await asyncio.sleep(0.5)
                            continue

                        base_price = prices_cache.get(t)
                        if not base_price:
                            info = await asyncio.to_thread(get_company_info, t)
                            if not info:
                                info = await asyncio.to_thread(get_stale_company_info, t)
                            if info and info.get("current_price"):
                                base_price = float(info["current_price"])
                                prices_cache[t] = base_price

                        if base_price and base_price > 0:
                            payload = {
                                "ticker": t,
                                "price": round(base_price, 2),
                                "change_pct": 0.0,
                                "is_live": False,
                            }
                            await manager.broadcast(payload)
                            _fallback_last_sent[t] = now_ts
                            logger.debug("Sent stale fallback price for %s: %.2f", t, base_price)

                    await asyncio.sleep(0.5)

        except Exception as e:
            logger.warning("Error in websocket price broadcast loop: %s", e)

        await asyncio.sleep(4.0)


# ── Background Prefetch Task ──────────────────────────────────────────────────
async def prefetch_all_tickers():
    """Downloads 2-year historical OHLCV for popular universe on startup."""
    logger.info("Starting background prefetch of historical data for popular tickers...")
    loop = asyncio.get_running_loop()
    for ticker in popular_tickers:
        try:
            df = await loop.run_in_executor(None, lambda t=ticker: fetch_stock_data(t, period="2Y"))
            if df is not None and not df.empty:
                logger.info("Prefetched %d rows for %s", len(df), ticker)
        except Exception as e:
            logger.error("Prefetch failed for %s: %s", ticker, e)
        await asyncio.sleep(1.5)
    logger.info("Historical prefetch complete.")


# ── Application Lifespan ──────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize unified database layer (SQLAlchemy 2.0 / PostgreSQL / TimescaleDB / SQLite)
    init_database()
    cleanup_old_tasks(max_age_hours=48)
    ensure_session()

    price_task = asyncio.create_task(websocket_price_broadcast_loop())
    alert_task = asyncio.create_task(run_alert_scheduler_loop())
    prefetch_task = asyncio.create_task(prefetch_all_tickers())
    keepalive_task = asyncio.create_task(run_session_keepalive_loop())

    try:
        yield
    finally:
        for task in (price_task, alert_task, prefetch_task, keepalive_task):
            task.cancel()
        for task in (price_task, alert_task, prefetch_task, keepalive_task):
            with suppress(asyncio.CancelledError):
                await task


# ── FastAPI App Instance ──────────────────────────────────────────────────────
app = FastAPI(
    title="StockOracle Pro API",
    description="Production-grade AI stock forecasting modular monolith API",
    version="2.0.0",
    lifespan=lifespan,
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://main.d3qrmvw6hu9g61.amplifyapp.com",
    "https://stockoracle.duckdns.org",
]
if settings.ALLOWED_ORIGINS:
    origins.extend([o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()])

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Enforces essential security headers across all HTTP responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ── WebSocket Endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if "subscribe" in msg and isinstance(msg["subscribe"], list):
                    manager.subscribe(websocket, msg["subscribe"])
            except Exception as exc:
                logger.debug("WebSocket incoming message parse failed: %s (raw: %r)", exc, raw)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Mount Modular Domain Routers ──────────────────────────────────────────────
from backend.api.routers.system import router as system_router
from backend.api.routers.market import router as market_router
from backend.api.routers.research import router as research_router
from backend.api.routers.portfolio import router as portfolio_router
from backend.api.routers.paper import router as paper_router
from backend.api.routers.alerts import router as alerts_router
from backend.api.routers.ml import router as ml_router
from backend.api.routers.ai_chat import router as aichat_router
from backend.api.routers.sentiment_ta import router as sentiment_ta_router
from backend.api.routers.broker import router as broker_router

app.include_router(system_router)
app.include_router(market_router)
app.include_router(research_router)
app.include_router(portfolio_router)
app.include_router(paper_router)
app.include_router(alerts_router)
app.include_router(ml_router)
app.include_router(aichat_router)
app.include_router(sentiment_ta_router)
app.include_router(broker_router)



# ── Legacy & Compatibility Endpoints ──────────────────────────────────────────
@app.get("/api/sentiment/market")
async def get_market_sentiment_legacy():
    from backend.analysis.sentiment_market import get_market_sentiment
    _default_tickers = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK", "LT", "AXISBANK", "BAJFINANCE", "MARUTI", "TITAN"]
    return get_market_sentiment(_default_tickers)


@app.get("/api/screener/advanced")
def get_screener_advanced_legacy():
    from backend.data.database import get_screener_results
    return get_screener_results() or []


@app.get("/api/market/heatmap")
def get_market_heatmap_legacy():
    from backend.data.database import get_screener_results
    return get_screener_results() or []


@app.post("/api/settings/telegram-test")
async def telegram_test_legacy(_auth: None = Security(verify_api_key)):
    from backend.services.telegram_bot import test_telegram_connection
    return test_telegram_connection()
