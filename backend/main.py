"""
StockOracle Pro — Production-Grade AI Stock Forecasting Modular Monolith API
FastAPI + PyTorch + SQLAlchemy 2.0 (PostgreSQL/TimescaleDB/SQLite) + Celery/Redis
"""
import os
import json
import time
import asyncio
import logging
import threading
import pandas as pd
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
from backend.data.database import (
    init_db, cleanup_old_tasks, save_live_tick, get_company_info,
    get_stale_company_info, get_historical_prices, get_live_tick_ohlcv
)
from backend.data.fetcher import (
    fetch_stock_data, fetch_company_info, ensure_session,
    get_session_status, get_token_info, smartApi, run_session_keepalive_loop,
    is_crypto_ticker, fetch_crypto_info, fetch_crypto_live_ticker,
    get_jwt_token, get_feed_token
)
from backend.data.market_calendar import is_market_open
from backend.services.alert_scheduler import run_alert_scheduler_loop

configure_logging()
logger = get_logger("stockoracle.main")

popular_tickers = [
    "BTC", "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
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


# ── Buffered Live-Tick Persistence Writer ─────────────────────────────────
class LiveTickWriter:
    """Buffers live ticks in memory and flushes them to SQLite in batches.

    Keeps synchronous DB writes OFF the asyncio event loop so WebSocket
    broadcasts are never blocked by disk I/O. Only the latest tick per
    ticker is kept — intermediate prices within a flush window are not
    needed for OHLCV day-aggregation.
    """

    def __init__(self, flush_interval: float = 3.0):
        self._latest: Dict[str, tuple] = {}   # ticker -> (price, change_pct, ts)
        self._lock = threading.Lock()
        self._flush_interval = flush_interval
        self._last_flush = 0.0

    def add(self, ticker: str, price: float, change_pct: float):
        """Called from the event loop — O(1), no I/O."""
        with self._lock:
            self._latest[ticker] = (price, change_pct, time.time())

    def maybe_flush(self, force: bool = False) -> bool:
        """Flush pending ticks to the DB if the flush interval has elapsed.
        Returns True if a flush was performed. Runs the (sync) DB write in a
        worker thread so the event loop stays responsive.
        """
        now = time.monotonic()
        if not force and now - self._last_flush < self._flush_interval:
            return False
        self._last_flush = now
        with self._lock:
            pending = self._latest
            self._latest = {}
        if not pending:
            return False
        try:
            for ticker, (price, change_pct, _ts) in pending.items():
                save_live_tick(ticker, price, change_pct)
        except Exception as exc:
            logger.debug("Live-tick batch flush failed: %s", exc)
        return True


_tick_writer = LiveTickWriter(flush_interval=3.0)

# Streamer status surfaced to /api/system endpoints for observability
_streamer_status = {
    "connected": False,
    "started": False,
    "last_error": None,
    "last_tick_at": 0.0,
}


# ── WebSocket Real-Time Price Broadcaster Loop ────────────────────────────
# Design: per-ticker fetches run CONCURRENTLY (bounded semaphores) instead of
# serially with fixed 0.5s inter-ticker sleeps. Cycle time is bounded by the
# slowest single fetch (~1-2s) rather than (num_tickers x latency + sleep),
# giving every subscribed ticker a steady ~1Hz broadcast cadence.
# All synchronous DB work (tick persistence, fallback reads) runs in worker
# threads so the event loop is never blocked during broadcasts.

_BROKER_SEMAPHORE = asyncio.Semaphore(4)   # concurrent Angel One API calls (rate-limit friendly)
_CRYPTO_SEMAPHORE = asyncio.Semaphore(6)   # concurrent Binance API calls
_FETCH_TIMEOUT = 8.0                       # hard per-ticker fetch timeout (seconds)
_TICKER_FAILURE_COOLDOWN = 20.0            # skip a ticker this long after a hard fetch error
_ticker_error_cooldowns: Dict[str, float] = {}


def _build_crypto_payload(ticker: str, c_info: dict) -> Optional[dict]:
    """Standard WS payload from a crypto live-ticker fetch result."""
    try:
        ltp = float(c_info.get("current_price", 0) or 0)
        if ltp <= 0:
            return None
        day_open = float(c_info.get("open", ltp) or ltp)
        day_high = float(c_info.get("day_high", ltp) or ltp)
        day_low = float(c_info.get("day_low", ltp) or ltp)
        prev_close = float(c_info.get("close", day_open) or day_open)
        change_pct = float(c_info.get("change_pct", 0.0))
        return {
            "ticker": ticker,
            "price": round(ltp, 2),
            "open": round(day_open, 2),
            "high": round(max(day_high, ltp), 2),
            "low": round(min(day_low, ltp), 2),
            "close": round(prev_close, 2),
            "change_pct": round(change_pct, 3),
            "is_live": True,  # Crypto is a 24/7 continuous live market
        }
    except (TypeError, ValueError):
        return None


def _build_equity_payload(ticker: str, data_obj: dict) -> Optional[dict]:
    """Standard WS payload from an Angel One ltpData response.

    Runs in a worker thread (called via asyncio.to_thread) because it may hit
    the DB for session bounds when ltpData omits day open/high/low.
    """
    try:
        ltp = float(data_obj.get("ltp", 0.0))
        if ltp <= 0:
            return None
        prev_close = float(data_obj.get("close", 0.0))
        day_open = float(data_obj.get("open", 0.0))
        day_high = float(data_obj.get("high", 0.0))
        day_low = float(data_obj.get("low", 0.0))

        change_pct = ((ltp - prev_close) / prev_close) if prev_close > 0 else 0.0
        # Persist via the buffered writer — no synchronous DB write on the event loop
        _tick_writer.add(ticker, round(ltp, 2), round(change_pct * 100, 3))

        # When SmartAPI ltpData doesn't return day open/high/low (fields are 0),
        # pull real session bounds from today's saved live ticks in SQLite
        if day_open <= 0 or day_high <= 0 or day_low <= 0:
            today_ohlcv = get_live_tick_ohlcv(ticker)
            if today_ohlcv:
                if day_open <= 0:
                    day_open = float(today_ohlcv.get("open", 0.0) or 0.0)
                if day_high <= 0:
                    day_high = max(float(today_ohlcv.get("high", ltp) or ltp), ltp)
                if day_low <= 0:
                    day_low = min(float(today_ohlcv.get("low", ltp) or ltp), ltp)

        market_live = is_market_open()
        return {
            "ticker": ticker,
            "price": round(ltp, 2),
            "open": round(day_open, 2) if day_open > 0 else 0.0,
            "high": round(max(day_high, ltp), 2) if day_high > 0 else round(ltp, 2),
            "low": round(min(day_low, ltp), 2) if day_low > 0 else round(ltp, 2),
            "close": round(prev_close, 2) if prev_close > 0 else round(ltp, 2),
            "change_pct": round(change_pct * 100, 3),
            "is_live": market_live,
        }
    except (TypeError, ValueError):
        return None


async def _fetch_ticker_payload(t: str) -> Optional[dict]:
    """Fetch a single ticker's live price and build its broadcast payload.

    Concurrency-bounded via semaphores; raises are contained per-ticker so one
    failing symbol can never stall or crash the whole broadcast cycle.
    """
    try:
        if is_crypto_ticker(t):
            async with _CRYPTO_SEMAPHORE:
                c_info = await asyncio.wait_for(
                    asyncio.to_thread(fetch_crypto_live_ticker, t), timeout=_FETCH_TIMEOUT
                )
            if not c_info:
                async with _CRYPTO_SEMAPHORE:
                    c_info = await asyncio.wait_for(
                        asyncio.to_thread(fetch_crypto_info, t), timeout=_FETCH_TIMEOUT
                    )
            return _build_crypto_payload(t, c_info) if c_info else None

        if not (get_session_status() and smartApi):
            return None

        async with _BROKER_SEMAPHORE:
            tok = await asyncio.to_thread(get_token_info, t)
            if not tok:
                return None
            ltp_resp = await asyncio.wait_for(
                asyncio.to_thread(smartApi.ltpData, tok["exch_seg"], tok["symbol"], tok["token"]),
                timeout=_FETCH_TIMEOUT,
            )
        if ltp_resp and ltp_resp.get("status") and ltp_resp.get("data"):
            return await asyncio.to_thread(_build_equity_payload, t, ltp_resp["data"])
        return None
    except Exception as exc:
        _ticker_error_cooldowns[t] = time.monotonic()
        logger.debug("Live tick fetch failed for %s: %s", t, exc)
        return None


async def _fallback_payload_for(ticker: str, cached_price: float = 0.0) -> Optional[dict]:
    """Verified last-known price payload when the live fetch produced nothing.

    Priority (mirrors the fallback contract): last cached live price >
    verified historical close > company_info (fresh) > stale company_info.
    Never broadcasts a fabricated price — returns None when nothing is known.
    All reads are synchronous DB calls, executed in worker threads.
    """
    base_price = float(cached_price or 0.0)
    base_open = 0.0
    base_high = 0.0
    base_low = 0.0

    # PRIMARY: verified historical close — company_info cache can be hours old,
    # so the historical close is the most reliable last-known price.
    if not base_price:
        hist = await asyncio.to_thread(get_historical_prices, ticker)
        if hist is not None and not (isinstance(hist, pd.DataFrame) and hist.empty):
            if isinstance(hist, pd.DataFrame):
                last_row = hist.iloc[-1]
                close_val = float(last_row.get("close", 0) or 0)
                if close_val > 0:
                    base_price = close_val
                    base_open = float(last_row.get("open", base_price) or base_price)
                    base_high = float(last_row.get("high", base_price) or base_price)
                    base_low = float(last_row.get("low", base_price) or base_price)
            elif isinstance(hist, list) and len(hist) > 0:
                last_candle = hist[-1]
                if isinstance(last_candle, dict) and last_candle.get("close"):
                    base_price = float(last_candle["close"])
                    base_open = float(last_candle.get("open", base_price) or base_price)
                    base_high = float(last_candle.get("day_high", last_candle.get("high", base_price)) or base_price)
                    base_low = float(last_candle.get("day_low", last_candle.get("low", base_price)) or base_price)

    # SECONDARY: company_info (may be stale, but better than nothing)
    if not base_price or base_price <= 0:
        info = await asyncio.to_thread(get_company_info, ticker)
        if not info:
            info = await asyncio.to_thread(get_stale_company_info, ticker)
        if info and info.get("current_price"):
            base_price = float(info["current_price"])
            if base_price > 0:
                base_open = float(info.get("open", base_price) or base_price)
                base_high = float(info.get("day_high", base_price) or base_price)
                base_low = float(info.get("day_low", base_price) or base_price)

    # Final safety: no verified price available at all
    if not base_price or base_price <= 0:
        return None

    change_pct = round(((base_price - base_open) / base_open) * 100, 3) if base_open > 0 else 0.0
    return {
        "ticker": ticker,
        "price": round(base_price, 2),
        "open": round(base_open, 2) if base_open > 0 else round(base_price, 2),
        "high": round(base_high, 2) if base_high > 0 else round(base_price, 2),
        "low": round(base_low, 2) if base_low > 0 else round(base_price, 2),
        "close": round(base_price, 2),
        "change_pct": change_pct,
        "is_live": False,
    }


async def websocket_price_broadcast_loop():
    prices_cache: Dict[str, float] = {}
    # Tracks last time a fallback (stale) price was sent per ticker — throttle to 1/30s
    _fallback_last_sent: Dict[str, float] = {}
    _cycle_target_seconds = 1.0

    while True:
        cycle_started = time.monotonic()
        try:
            # Periodic batched persistence of buffered ticks (worker thread inside)
            if _tick_writer.maybe_flush():
                await asyncio.sleep(0)

            if manager.active_connections:
                active_subscribed = set()
                for subs in manager.connections.values():
                    active_subscribed.update(subs)

                tickers_to_check = list(active_subscribed) if active_subscribed else popular_tickers

                # Only refresh broker session if equities are in the check list.
                # Skipped while the SmartAPI streamer owns a healthy connection.
                has_equities = any(not is_crypto_ticker(t) for t in tickers_to_check)
                if has_equities and not _streamer_status.get("connected"):
                    try:
                        ensure_session()
                    except Exception as e:
                        logger.debug("Session refresh check failed: %s", e)

                # Honor per-ticker cooldowns after hard fetch errors so one failing
                # ticker cannot consume the entire cycle's request budget.
                now_ts = time.monotonic()
                due_tickers = [
                    t for t in tickers_to_check
                    if now_ts - _ticker_error_cooldowns.get(t, 0.0) >= _TICKER_FAILURE_COOLDOWN
                ]

                # CONCURRENT fetch: all due tickers in flight together (semaphore-bounded)
                results = await asyncio.gather(
                    *(_fetch_ticker_payload(t) for t in due_tickers)
                )
                payloads = [p for p in results if p]

                fetched_set = set()
                for payload in payloads:
                    t = payload["ticker"]
                    fetched_set.add(t)
                    prices_cache[t] = payload["price"]
                    await manager.broadcast(payload)

                # Fallback broadcasts for tickers with no live payload — throttled to
                # at most one stale-price send per 30s per ticker so the frontend is
                # never flooded with frozen prices.
                for t in tickers_to_check:
                    if t in fetched_set:
                        continue
                    last_sent = _fallback_last_sent.get(t, 0.0)
                    if time.monotonic() - last_sent < 30.0:
                        continue
                    try:
                        payload = await _fallback_payload_for(t, prices_cache.get(t, 0.0))
                    except Exception as exc:
                        logger.debug("Fallback price lookup failed for %s: %s", t, exc)
                        continue
                    if not payload:
                        logger.debug("No verified price available for %s — skipping broadcast this cycle", t)
                        continue
                    await manager.broadcast(payload)
                    _fallback_last_sent[t] = time.monotonic()
                    logger.debug("Sent verified historical fallback price for %s: %.2f", t, payload["price"])

        except Exception as e:
            logger.warning("Error in websocket price broadcast loop: %s", e)

        # Adaptive pacing: steady ~1s cadence — long cycles don't get extra sleep
        # stacked on top, short cycles idle briefly.
        elapsed = time.monotonic() - cycle_started
        await asyncio.sleep(max(0.15, _cycle_target_seconds - elapsed))


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
    init_db()
    cleanup_old_tasks(max_age_hours=48)
    ensure_session()

    price_task = asyncio.create_task(websocket_price_broadcast_loop())
    alert_task = asyncio.create_task(run_alert_scheduler_loop())
    keepalive_task = asyncio.create_task(run_session_keepalive_loop())
    # Note: Startup background prefetch and auto-population are disabled.
    # Data is strictly fetched on-demand from Angel One when the user searches/selects that stock.

    background_tasks = [price_task, alert_task, keepalive_task]

    # SmartAPI tick streamer (Phase 3): true tick-by-tick equity feed with
    # automatic reconnect. Falls back gracefully to REST polling when broker
    # credentials / feed tokens are unavailable.
    try:
        from backend.data.streamer import run_streamer_loop
        streamer_task = asyncio.create_task(
            run_streamer_loop(manager, _streamer_status, _tick_writer)
        )
        background_tasks.append(streamer_task)
    except Exception as exc:
        logger.warning("SmartAPI streamer unavailable — REST polling only: %s", exc)

    try:
        yield
    finally:
        for task in background_tasks:
            task.cancel()
        for task in background_tasks:
            with suppress(asyncio.CancelledError):
                await task
        # Persist any ticks still sitting in the buffer before exit
        try:
            _tick_writer.maybe_flush(force=True)
        except Exception:
            pass


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
from backend.api.routers.ai_providers import router as ai_providers_router

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
app.include_router(ai_providers_router)



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
def get_market_heatmap_legacy(universe: str = "ALL", metric: str = "change_1d_pct"):
    from backend.analysis.market_heatmap import compute_market_heatmap_data
    return compute_market_heatmap_data(universe=universe, metric=metric)


@app.post("/api/settings/telegram-test")
async def telegram_test_legacy(_auth: None = Security(verify_api_key)):
    from backend.services.telegram_bot import test_telegram_connection
    return test_telegram_connection()
