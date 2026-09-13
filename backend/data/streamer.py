"""
SmartAPI WebSocket Tick Streamer — true tick-by-tick equity streaming.

Subscribes to the Angel One SmartWebSocketV2 feed for the currently relevant
ticker universe and broadcasts price payloads directly through the same
ConnectionManager used by the REST polling loop (backend/main.py).

Design invariants:
- The streamer thread NEVER blocks the asyncio event loop: callbacks marshal
  data onto the loop via asyncio.run_coroutine_threadsafe.
- Payload shape is identical to the polling loop's, so the frontend cannot
  tell the difference between streaming and polled ticks.
- Every failure path degrades gracefully: if credentials/feed tokens/session
  are unavailable the loop idles and REST polling keeps the app alive.
"""

import asyncio
import logging
import threading
import time
from typing import Dict, Optional, Set

from backend.data.fetcher import (
    ensure_session,
    get_session_status,
    get_token_info,
    is_crypto_ticker,
    get_jwt_token,
    get_feed_token,
    smartApi,
)
from backend.data.market_calendar import is_market_open

logger = logging.getLogger("stockoracle.streamer")

_RECONNECT_BASE_DELAY = 2.0
_RECONNECT_MAX_DELAY = 60.0
_STALE_TICK_SECONDS = 10.0          # no ticks for this long → let polling take over
_TOKEN_REFRESH_SECONDS = 15.0       # how often the desired subscription set is re-checked
_MAX_STREAM_TOKENS = 200            # SmartAPI practical per-connection limit


def _num(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class StreamerBridge:
    """Receives SmartWebSocketV2 callbacks on the websocket's own thread and
    marshals them onto the asyncio event loop."""

    def __init__(self, manager, status: dict, tick_writer, loop: asyncio.AbstractEventLoop):
        self._manager = manager
        self._status = status
        self._tick_writer = tick_writer
        self._loop = loop
        self._latest_ohlc: Dict[str, dict] = {}   # token -> last known OHLC context
        self._connected = False
        self._wsapp = None
        self._subscribe_payload = None
        self._correlation_id = "stockoracle_stream"
        self._mode = 1  # LTP mode (lightweight, tick-by-tick last-traded-price)

    # -- lifecycle (called from the websocket thread) -------------------------
    def on_open(self, wsapp):
        self._connected = True
        self._status["connected"] = True
        self._status["last_error"] = None
        logger.info("SmartAPI streamer connected — tick-by-tick feed active.")
        # Subscribe must be issued from the open callback per SmartAPI docs
        if self._wsapp and self._subscribe_payload:
            try:
                self._wsapp.subscribe(self._correlation_id, self._mode, self._subscribe_payload)
                logger.info("Streamer subscribed %d token groups (mode=LTP).", len(self._subscribe_payload))
            except Exception as exc:
                logger.debug("Initial subscribe failed: %s", exc)

    def on_error(self, wsapp, error):
        self._status["last_error"] = str(error)[:200]
        logger.debug("SmartAPI streamer error: %s", error)

    def on_close(self, wsapp):
        self._connected = False
        self._status["connected"] = False
        logger.info("SmartAPI streamer disconnected.")

    def on_data(self, wsapp, message):
        try:
            if not isinstance(message, dict):
                return
            # Heartbeats / control frames carry no price
            if message.get("task") == "heartbeat":
                return

            token = str(message.get("token") or message.get("tk") or "")
            exchange = str(message.get("exchange_type") or message.get("exchange") or "NSE")
            if not token:
                return

            ticker = self._token_to_ticker.get((exchange, token))
            if not ticker:
                return

            ltp = _num(message.get("ltp") or message.get("last_price") or message.get("lp"))
            if ltp <= 0:
                return

            # OHLC context: prefer fields carried on the tick, else last known
            ctx = self._latest_ohlc.setdefault((exchange, token), {})
            close_p = _num(message.get("cl") or message.get("close") or message.get("cp") or message.get("close_price")) or _num(ctx.get("close"))
            open_p = _num(message.get("op") or message.get("open")) or _num(ctx.get("open")) or ltp
            high_p = _num(message.get("h") or message.get("high")) or _num(ctx.get("high")) or ltp
            low_p = _num(message.get("lo") or message.get("low")) or _num(ctx.get("low")) or ltp
            volume = _num(message.get("vol") or message.get("volume") or message.get("vlt")) or _num(ctx.get("volume"))

            ctx.update({"close": close_p, "open": open_p, "high": high_p, "low": low_p, "volume": volume})

            change_pct = ((ltp - close_p) / close_p) if close_p > 0 else 0.0

            # Cheap in-memory persistence buffer (no I/O here)
            try:
                self._tick_writer.add(ticker, round(ltp, 2), round(change_pct * 100, 3))
            except Exception:
                pass

            payload = {
                "ticker": ticker,
                "price": round(ltp, 2),
                "open": round(open_p, 2) if open_p > 0 else round(ltp, 2),
                "high": round(max(high_p, ltp), 2),
                "low": round(min(low_p, ltp), 2),
                "close": round(close_p, 2) if close_p > 0 else round(ltp, 2),
                "change_pct": round(change_pct * 100, 3),
                "is_live": is_market_open(),
            }

            self._status["last_tick_at"] = time.time()
            asyncio.run_coroutine_threadsafe(self._manager.broadcast(payload), self._loop)
        except Exception as exc:
            logger.debug("Streamer on_data parse failure: %s", exc)

    # -- token resolution -----------------------------------------------------
    _token_to_ticker: Dict[tuple, str] = {}

    def set_token_map(self, token_map: Dict[tuple, str]):
        self._token_to_ticker = dict(token_map)


async def _resolve_tokens(manager) -> Dict[tuple, dict]:
    """Union of all client-subscribed equity tickers → SmartAPI token records.
    Runs token lookups in a worker thread (scrip master may hit disk/network)."""
    subscribed: Set[str] = set()
    for subs in manager.connections.values():
        subscribed.update(subs)
    if not subscribed:
        return {}

    token_records: Dict[tuple, dict] = {}
    for t in subscribed:
        if is_crypto_ticker(t):
            continue  # crypto is streamed client-side via Binance
        try:
            tok = await asyncio.to_thread(get_token_info, t)
            if tok and tok.get("token"):
                token_records[(tok.get("exch_seg", "NSE"), str(tok["token"]))] = tok
        except Exception:
            continue
    return token_records


async def run_streamer_loop(manager, status: dict, tick_writer):
    """Persistent streamer lifecycle loop.

    Connects the SmartWebSocketV2 feed whenever a broker session is active,
    resubscribes automatically when clients subscribe to new tickers, and
    reconnects with exponential backoff on failure. Sets status["connected"]
    so the REST polling loop can throttle itself while streaming is healthy.
    """
    status["started"] = True
    reconnect_delay = _RECONNECT_BASE_DELAY
    last_token_refresh = 0.0
    bridge: Optional[StreamerBridge] = None

    while True:
        try:
            from SmartApi import SmartWebSocketV2  # deferred: optional at import time

            token_records = await _resolve_tokens(manager)
            if not token_records:
                status["connected"] = False
                await asyncio.sleep(5.0)
                continue

            if not (await asyncio.to_thread(ensure_session)) or not smartApi:
                status["connected"] = False
                await asyncio.sleep(10.0)
                continue

            jwt_token = get_jwt_token()
            feed_token = get_feed_token()
            if not (jwt_token and feed_token):
                status["last_error"] = "jwt/feed token unavailable"
                status["connected"] = False
                await asyncio.sleep(10.0)
                continue

            loop = asyncio.get_running_loop()
            bridge = StreamerBridge(manager, status, tick_writer, loop)

            # Map token -> ticker for on_data routing
            ticker_map = {}
            desired = []
            for (exch, token), rec in list(token_records.items())[:_MAX_STREAM_TOKENS]:
                ticker_map[(exch, token)] = rec.get("symbol", "").replace("-EQ", "")
                desired.append({"exchangeType": exch, "tokens": [token]})
            bridge.set_token_map(ticker_map)
            bridge._subscribe_payload = desired

            sw = SmartWebSocketV2(jwt_token, feed_token, "stockoracle_client")
            bridge._wsapp = sw
            sw.on_open = bridge.on_open
            sw.on_data = bridge.on_data
            sw.on_error = bridge.on_error
            sw.on_close = bridge.on_close

            # SmartWebSocketV2 spawns its own reader thread inside .connect();
            # subscription is issued from the on_open callback.
            await asyncio.to_thread(sw.connect)

            reconnect_delay = _RECONNECT_BASE_DELAY
            logger.info("Streamer feed running (%d token groups).", len(desired))

            # Supervision loop: refresh token set, detect stale feed
            while True:
                await asyncio.sleep(_TOKEN_REFRESH_SECONDS)

                # Re-resolve subscriptions when clients add tickers
                fresh_records = await _resolve_tokens(manager)
                fresh_keys = set(fresh_records.keys())
                if fresh_keys and fresh_keys != set(token_records.keys()):
                    token_records = fresh_records
                    desired = []
                    ticker_map = {}
                    for (exch, token), rec in list(token_records.items())[:_MAX_STREAM_TOKENS]:
                        ticker_map[(exch, token)] = rec.get("symbol", "").replace("-EQ", "")
                        desired.append({"exchangeType": exch, "tokens": [token]})
                    bridge.set_token_map(ticker_map)
                    bridge._subscribe_payload = desired
                    try:
                        await asyncio.to_thread(sw.subscribe, bridge._correlation_id, bridge._mode, desired)
                        logger.info("Streamer resubscribed: %d token groups.", len(desired))
                    except Exception as exc:
                        logger.debug("Resubscribe failed — forcing reconnect: %s", exc)
                        break

                # Stale feed detection: let polling take over quietly
                last_tick = status.get("last_tick_at", 0.0)
                market_open = is_market_open()
                if status.get("connected") and market_open and last_tick and (time.time() - last_tick) > _STALE_TICK_SECONDS * 6:
                    logger.warning("Streamer feed stale (%.0fs without ticks) — reconnecting.", time.time() - last_tick)
                    try:
                        await asyncio.to_thread(sw.close_connection)
                    except Exception:
                        pass
                    break

                if not status.get("connected") and market_open:
                    break  # socket dropped — reconnect from outer loop

        except asyncio.CancelledError:
            status["connected"] = False
            raise
        except Exception as exc:
            status["last_error"] = str(exc)[:200]
            status["connected"] = False
            logger.debug("Streamer connection attempt failed: %s", exc)

        status["connected"] = False
        await asyncio.sleep(reconnect_delay)
        reconnect_delay = min(reconnect_delay * 1.6, _RECONNECT_MAX_DELAY)
