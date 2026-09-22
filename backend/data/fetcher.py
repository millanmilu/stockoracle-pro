import os
import time
import asyncio
import requests
import pyotp
import pandas as pd
import numpy as np
from threading import Lock
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

_IST = ZoneInfo("Asia/Kolkata")
from typing import Optional, Dict, Tuple
from dotenv import load_dotenv
from backend.core.logging import get_logger

logger = get_logger("stockoracle.fetcher")

# Load .env file automatically
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
else:
    load_dotenv()

from SmartApi import SmartConnect
from backend.data.market_calendar import is_trading_day
from backend.data.database import (
    save_historical_prices, get_historical_prices,
    save_company_info, get_company_info, get_stale_company_info,
    get_live_tick_ohlcv, save_stock_universe, search_stock_universe,
    get_stock_universe_token, purge_stale_partial_history,
    get_intraday_candles, save_intraday_candles,
)

# Clean any 1-row or partial fragment rows from historical_prices
try:
    purge_stale_partial_history(5)
except Exception as exc:
    logger.debug("Startup partial-history purge skipped: %s", exc)


# ── Intraday slot-completion (gap-fill) ──────────────────────────────────────
# Missing minute slots render as visible whitespace gaps on the chart
# (lightweight-charts leaves time-whitespace for absent slots). Feed stalls
# (broker timeouts, missed buckets) therefore look like "broken candles".
# This fills small in-session gaps with flat carry-forward bars (volume 0)
# so every served series is slot-complete. Invariant-safe by construction:
# - only 1m/5m/15m/30m/1h (never 1s/30s/4h/1d);
# - equities: only inside 09:15–15:30 IST on weekdays, never across days,
#   never weekends/nights (those gaps must stay visible);
# - crypto (24/7): any gap within the covered range;
# - gaps larger than MAX_FILL_SLOTS are left alone (real outage, not a stall);
# - filled bars reuse the previous close (> 0) with volume 0, so OHLC and
#   positive-price invariants always hold.
FILLABLE_INTRADAY_SLOTS = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600}
MAX_FILL_SLOTS = 30
_SESSION_OPEN_MIN = 9 * 60 + 15
_SESSION_CLOSE_MIN = 15 * 60 + 30


def fill_intraday_time_gaps(df: "pd.DataFrame", interval: str, is_crypto: bool = False) -> "pd.DataFrame":
    """Forward-fills small missing time slots in an intraday OHLCV frame.

    df must carry a 'date' column of 'YYYY-MM-DD HH:MM:SS' IST wall-clock
    strings plus numeric open/high/low/close/volume. Returns a new sorted,
    duplicate-free frame; input is never mutated.
    """
    try:
        if df is None or getattr(df, "empty", True):
            return df
        slot = FILLABLE_INTRADAY_SLOTS.get(str(interval).lower().strip())
        if not slot:
            return df
        work = df.sort_values("date").drop_duplicates(subset=["date"]).copy().reset_index(drop=True)
        dts = pd.to_datetime(work["date"], format="mixed", errors="coerce")
        if dts.isna().all():
            return df
        # Epoch seconds in IST wall-clock (labels are naive IST)
        epochs = np.array([
            int(x.value // 1_000_000_000) if not pd.isna(x) else -1 for x in dts
        ])
        closes = pd.to_numeric(work["close"], errors="coerce").to_numpy()
        extra_rows = []
        for i in range(1, len(work)):
            prev_e, cur_e = int(epochs[i - 1]), int(epochs[i])
            if prev_e < 0 or cur_e < 0:
                continue
            skipped = round((cur_e - prev_e) / slot) - 1
            if skipped < 1 or skipped > MAX_FILL_SLOTS:
                continue
            prev_dt = dts.iloc[i - 1]
            cur_dt = dts.iloc[i]
            if not is_crypto:
                # Equities: same weekday session only — never bridge days/nights/weekends.
                if prev_dt.weekday() >= 5 or cur_dt.weekday() >= 5:
                    continue
                if prev_dt.date() != cur_dt.date():
                    continue
                prev_min = int(prev_dt.hour) * 60 + int(prev_dt.minute)
                cur_min = int(cur_dt.hour) * 60 + int(cur_dt.minute)
                if prev_min < _SESSION_OPEN_MIN or cur_min > _SESSION_CLOSE_MIN:
                    continue
            prev_close = float(closes[i - 1]) if i - 1 < len(closes) else 0.0
            if not np.isfinite(prev_close) or prev_close <= 0:
                continue
            for k in range(1, skipped + 1):
                fill_dt = prev_dt + timedelta(seconds=slot * k)
                extra_rows.append({
                    "date": fill_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "open": prev_close, "high": prev_close,
                    "low": prev_close, "close": prev_close, "volume": 0,
                })
        if not extra_rows:
            return df
        filled = pd.concat([work, pd.DataFrame(extra_rows)], ignore_index=True)
        filled = filled.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)
        filled.attrs.update(getattr(df, "attrs", {}))
        logger.info("[slot-fill] %s filled slots", len(extra_rows))
        return filled
    except Exception as exc:
        logger.debug("fill_intraday_time_gaps skipped: %s", exc)
        return df



# ── API & Authentication Setup ──
ANGEL_API_KEY     = os.getenv("ANGEL_API_KEY",     "").strip()
ANGEL_CLIENT_ID   = os.getenv("ANGEL_CLIENT_ID",   "").strip()
ANGEL_PASSWORD    = os.getenv("ANGEL_PASSWORD",     "").strip()
ANGEL_TOTP_SECRET = os.getenv("ANGEL_TOTP_SECRET", "").strip()

# Initialize SmartConnect if API key is present
smartApi: Optional[SmartConnect] = SmartConnect(api_key=ANGEL_API_KEY) if ANGEL_API_KEY else None

# Session state — token auto-refreshes every 8 hours
_session_active     = False
_session_expires_at: Optional[datetime] = None
_session_created_at: Optional[datetime] = None
_last_auth_attempt:  Optional[datetime] = None
_last_auth_error:    Optional[str] = None
SESSION_REFRESH_HOURS = 8

# Streaming tokens (captured at login — required by SmartWebSocketV2)
_jwt_token:  Optional[str] = None
_feed_token: Optional[str] = None

# Angel One error codes that indicate an expired / invalid session
_AUTH_ERROR_CODES = {"AB1010", "AG8002", "AB1004"}
_full_backfill_done: set = set()
_broker_rate_limited_until = 0.0
_BROKER_RATE_LIMIT_COOLDOWN = 30.0


def get_session_status() -> bool:
    """Returns the current Angel One session status (live value, not a stale import copy)."""
    return _session_active


def get_session_details() -> dict:
    """Returns comprehensive session metadata for monitoring & UI display."""
    now = datetime.now(_IST)
    remaining_minutes = None
    if _session_active and _session_expires_at:
        diff = (_session_expires_at - now).total_seconds()
        remaining_minutes = max(0, int(diff // 60))

    return {
        "session_active": _session_active,
        "expires_at_ist": _session_expires_at.strftime("%Y-%m-%d %H:%M:%S IST") if _session_expires_at else None,
        "created_at_ist": _session_created_at.strftime("%Y-%m-%d %H:%M:%S IST") if _session_created_at else None,
        "remaining_minutes": remaining_minutes,
        "last_auth_attempt_ist": _last_auth_attempt.strftime("%Y-%m-%d %H:%M:%S IST") if _last_auth_attempt else None,
        "last_auth_error": _last_auth_error,
    }


def reset_session():
    """Force re-authentication on the next API call."""
    global _session_active, _session_expires_at, _session_created_at, _jwt_token, _feed_token
    _session_active     = False
    _session_expires_at = None
    _session_created_at = None
    _jwt_token  = None
    _feed_token = None


def get_jwt_token() -> Optional[str]:
    """JWT auth token captured at last successful login (for the tick streamer)."""
    return _jwt_token


def get_feed_token() -> Optional[str]:
    """Feed token captured at last successful login (for the tick streamer)."""
    return _feed_token


def _load_broker_from_database() -> bool:
    """Loads active broker credentials permanently stored in the broker_accounts table (via ORM)."""
    global ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET, smartApi
    try:
        from backend.data.database import get_broker_account_orm
        acc = get_broker_account_orm("angel_one")
        if acc and acc.get("is_active") and acc.get("credentials"):
            creds = acc["credentials"]
            ANGEL_API_KEY = creds.get("api_key", "").strip()
            ANGEL_CLIENT_ID = creds.get("client_id", "").strip()
            ANGEL_PASSWORD = creds.get("password", "").strip()
            ANGEL_TOTP_SECRET = creds.get("totp_secret", "").strip()

            os.environ["ANGEL_API_KEY"] = ANGEL_API_KEY
            os.environ["ANGEL_CLIENT_ID"] = ANGEL_CLIENT_ID
            os.environ["ANGEL_PASSWORD"] = ANGEL_PASSWORD
            os.environ["ANGEL_TOTP_SECRET"] = ANGEL_TOTP_SECRET

            if not smartApi and ANGEL_API_KEY:
                from SmartApi import SmartConnect
                smartApi = SmartConnect(api_key=ANGEL_API_KEY)
            logger.info("Loaded active Angel One credentials from database broker_accounts via ORM.")
            return True
    except Exception as exc:
        logger.debug("Could not load broker credentials from DB: %s", exc)
    return False



def ensure_session() -> bool:
    """
    Authenticates with Angel One SmartAPI using TOTP.
    Safe to call multiple times — re-authenticates automatically when the
    session is about to expire (SESSION_REFRESH_HOURS threshold).
    Returns True if session is active after the call.
    """
    global _session_active, _session_expires_at, _session_created_at, _last_auth_attempt, _last_auth_error, smartApi
    now = datetime.now(_IST)
    _last_auth_attempt = now

    # Auto-refresh if session is expired
    if _session_active and _session_expires_at and now >= _session_expires_at:
        logger.warning("Angel One session expired — refreshing...")
        reset_session()

    if _session_active:
        return True

    # If in-memory credentials missing, load from database
    if not (ANGEL_API_KEY and ANGEL_CLIENT_ID and ANGEL_PASSWORD and ANGEL_TOTP_SECRET):
        _load_broker_from_database()

    if not smartApi:
        _last_auth_error = "ANGEL_API_KEY is missing."
        logger.warning("Angel One SmartAPI not initialized: ANGEL_API_KEY is missing.")
        return False

    if not (ANGEL_CLIENT_ID and ANGEL_PASSWORD and ANGEL_TOTP_SECRET):
        _last_auth_error = "Incomplete Angel One credentials."
        logger.warning("Angel One credentials incomplete. Check database or .env for ANGEL_CLIENT_ID / ANGEL_PASSWORD / ANGEL_TOTP_SECRET.")
        return False

    try:
        totp = pyotp.TOTP(ANGEL_TOTP_SECRET.strip()).now()
        data = smartApi.generateSession(ANGEL_CLIENT_ID.strip(), ANGEL_PASSWORD.strip(), totp)

        if data and data.get("status"):
            _session_active     = True
            _session_created_at = now
            _session_expires_at = now + timedelta(hours=SESSION_REFRESH_HOURS)
            _last_auth_error    = None
            # Capture streaming tokens for SmartWebSocketV2 (tick-by-tick feed)
            login_data = data.get("data") or {}
            _jwt_token  = login_data.get("jwtToken") or None
            _feed_token = login_data.get("feedToken") or None
            if not (_jwt_token and _feed_token):
                logger.warning("Angel One login succeeded but jwt/feed tokens missing — streaming disabled, REST polling active.")
            logger.info("Angel One SmartAPI login successful. Valid until %s", _session_expires_at.strftime("%H:%M:%S IST"))
            return True
        else:
            msg = data.get("message", "No response") if data else "No response"
            _last_auth_error = str(msg)
            logger.error("Angel One login failed: %s", msg)
            return False

    except Exception as e:
        _last_auth_error = str(e)
        logger.error("Exception during Angel One login: %s", e, exc_info=True)
        return False


async def run_session_keepalive_loop():
    """
    Proactive keepalive background loop:
    1. Re-authenticates proactively if session is expiring in < 45 minutes.
    2. Enforces fresh pre-market authentication between 08:45 AM and 09:05 AM IST on trading weekdays.
    3. Auto-retries with exponential backoff if session drops during market hours.
    4. Dispatches a system warning if session remains inactive during trading hours.
    """
    logger.info("Starting broker session keepalive loop...")
    fail_count = 0
    last_alert_time = 0.0

    # Proactive initial refresh: if server starts during market hours with no active session,
    # attempt authentication immediately rather than waiting up to 60s for the first loop iteration.
    now = datetime.now(_IST)
    is_market_hours = now.weekday() < 5 and (
        (now.hour == 9 and now.minute >= 15) or (9 < now.hour < 15) or (now.hour == 15 and now.minute <= 30)
    )
    if ANGEL_API_KEY and ANGEL_CLIENT_ID and ANGEL_PASSWORD and ANGEL_TOTP_SECRET:
        if is_market_hours and not _session_active:
            logger.info("Server started during market hours with no active session — attempting immediate auth...")
            ensure_session()

    while True:
        try:
            now = datetime.now(_IST)
            is_weekday = now.weekday() < 5
            is_pre_market = is_weekday and ((now.hour == 8 and now.minute >= 45) or (now.hour == 9 and now.minute <= 5))
            is_market_hours = is_weekday and ((now.hour == 9 and now.minute >= 15) or (9 < now.hour < 15) or (now.hour == 15 and now.minute <= 30))

            if ANGEL_API_KEY and ANGEL_CLIENT_ID and ANGEL_PASSWORD and ANGEL_TOTP_SECRET:
                # Case A: Pre-market refresh: force fresh token so the entire trading day has a clean session
                # Widen window to 08:40–09:15 IST to reduce race-condition misses on startup
                if is_pre_market or (is_weekday and now.hour == 8 and now.minute >= 40):
                    if not _session_active or (_session_created_at and (now - _session_created_at).total_seconds() > 3600):
                        logger.info("Pre-market session keepalive: Refreshing Angel One session for upcoming trading session...")
                        reset_session()
                        ensure_session()

                # Case B: Check if active session is near expiry (< 45 minutes remaining)
                elif _session_active and _session_expires_at:
                    remaining_sec = (_session_expires_at - now).total_seconds()
                    if remaining_sec < 2700:  # < 45 minutes
                        logger.info("Angel One session expiring soon (%.0f min remaining) — proactively refreshing...", remaining_sec / 60)
                        reset_session()
                        ensure_session()

                # Case C: If inactive during market hours, attempt reconnection
                elif not _session_active and is_market_hours:
                    logger.warning("Angel One session is INACTIVE during market hours. Attempting auto-reconnect...")
                    success = ensure_session()
                    if not success:
                        fail_count += 1
                        if fail_count >= 3:
                            curr_ts = time.time()
                            if curr_ts - last_alert_time > 7200:  # at most once every 2 hours
                                try:
                                    from backend.services.telegram_bot import send_telegram_alert
                                    send_telegram_alert(
                                        ticker="SYSTEM",
                                        alert_type="broker_session_down",
                                        reason="⚠️ Angel One SmartAPI session disconnected during market hours. Live price feed may be degraded. Please verify TOTP/credentials in Broker Settings.",
                                    )
                                    last_alert_time = curr_ts
                                except Exception:
                                    pass
                    else:
                        fail_count = 0
                else:
                    fail_count = 0

        except Exception as e:
            logger.warning("Exception in session keepalive loop: %s", e)

        await asyncio.sleep(60.0)


# ── API call wrapper with retry + session-expiry detection ──

def _call_api(fn, *args, retries: int = 2, retry_delay: float = 1.5, **kwargs):
    """
    Calls an Angel One API function with:
      • Automatic retry on transient network errors (up to `retries` times).
      • Session reset + re-login on authentication errors (AB1010, AG8002, etc.).
    Returns the raw API response dict, or None on failure.
    """
    global _broker_rate_limited_until

    if time.time() < _broker_rate_limited_until:
        return None

    for attempt in range(retries + 1):
        try:
            result = fn(*args, **kwargs)

            if result and not result.get("status"):
                err_code = result.get("errorcode", "") or ""
                msg      = result.get("message",   "") or ""

                # Detect session/auth errors and trigger re-login
                if (err_code in _AUTH_ERROR_CODES
                        or "token" in msg.lower()
                        or "session" in msg.lower()
                        or "unauthorized" in msg.lower()):
                    logger.warning("Auth error detected (%s: %s) — re-authenticating...", err_code, msg)
                    reset_session()
                    if ensure_session() and attempt < retries:
                        time.sleep(retry_delay)
                        continue

                # Stop immediately on rate limits; retries amplify broker throttling.
                if _is_rate_limit_error(msg):
                    _broker_rate_limited_until = time.time() + _BROKER_RATE_LIMIT_COOLDOWN
                    logger.warning("Angel One rate limit hit; pausing broker calls for %.0fs.", _BROKER_RATE_LIMIT_COOLDOWN)
                    return None

            return result

        except Exception as e:
            err_str = str(e).lower()
            if _is_rate_limit_error(err_str):
                _broker_rate_limited_until = time.time() + _BROKER_RATE_LIMIT_COOLDOWN
                logger.warning("Angel One rate limit hit; pausing broker calls for %.0fs.", _BROKER_RATE_LIMIT_COOLDOWN)
                return None
            # Network-level errors — retry with backoff
            if attempt < retries:
                wait = retry_delay * (attempt + 1)
                logger.warning("API call failed (attempt %d/%d): %s. Retrying in %.1fs...", attempt + 1, retries + 1, e, wait)
                time.sleep(wait)
            else:
                logger.error("API call permanently failed after %d attempts: %s", retries + 1, e)
                return None

    return None


def _is_rate_limit_error(message: str) -> bool:
    normalized = str(message).lower()
    return any(term in normalized for term in ("rate", "too many", "access denied", "exceeding access rate"))


# ── ScripMaster Token Mapping ──
SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
_scrip_map: Dict[str, dict] = {}
_scrip_map_failed = False   # Prevents infinite retry loops on total failure
_scrip_load_lock = Lock()


def _load_scrip_master(force: bool = False):
    """Downloads the ScripMaster JSON and indexes NSE equity symbols."""
    global _scrip_map, _scrip_map_failed

    with _scrip_load_lock:
        if _scrip_map and not force:          # Already loaded
            return
        if _scrip_map_failed and not force:
            return              # Already failed, wait for explicit retry

        logger.info("Downloading Angel One ScripMaster ...")
        try:
            response = requests.get(SCRIP_MASTER_URL, timeout=30)
            response.raise_for_status()
            data = response.json()
            records_to_save = []
            for item in data:
                if item.get("exch_seg") == "NSE":
                    sym = item.get("symbol", "").strip()
                    name = item.get("name", "").strip()
                    t_clean = sym.removesuffix("-EQ").strip()

                    _scrip_map[sym] = item
                    _scrip_map[t_clean] = item
                    if name:
                        _scrip_map[name] = item

                    records_to_save.append({
                        "ticker": t_clean,
                        "name": name or t_clean,
                        "symbol": sym,
                        "token": item.get("token", ""),
                        "exchange": item.get("exch_seg", "NSE"),
                    })

            save_stock_universe(records_to_save)
            logger.info("ScripMaster loaded — %d NSE equity symbols indexed.", len(records_to_save))
            _scrip_map_failed = False
        except Exception as e:
            logger.error("Error downloading ScripMaster: %s", e, exc_info=True)
            _scrip_map_failed = True


ALIAS_TOKEN_MAP = {
    "TATAMOTORS": {"symbol": "TMPV-EQ", "token": "3456", "exch_seg": "NSE", "name": "Tata Motors Ltd"},
    "TATAMTRDVR": {"symbol": "TMPV-EQ", "token": "3456", "exch_seg": "NSE", "name": "Tata Motors Ltd"},
    "TMPV": {"symbol": "TMPV-EQ", "token": "3456", "exch_seg": "NSE", "name": "Tata Motors Ltd"},
    # Index aliases — frontend uses NIFTY50 but Angel ScripMaster lists it as NIFTY (token 26000)
    "NIFTY50": {"symbol": "NIFTY", "token": "26000", "exch_seg": "NSE", "name": "NIFTY 50"},
    "NIFTY_50": {"symbol": "NIFTY", "token": "26000", "exch_seg": "NSE", "name": "NIFTY 50"},
    "NIFTY-50": {"symbol": "NIFTY", "token": "26000", "exch_seg": "NSE", "name": "NIFTY 50"},
    # Renamed equity symbols — old tickers kept working for screener universe,
    # watchlists and chart search (tokens verified against Angel ScripMaster).
    "HUL": {"symbol": "HINDUNILVR-EQ", "token": "1394", "exch_seg": "NSE", "name": "Hindustan Unilever Ltd"},
    "HINDUNI": {"symbol": "HINDUNILVR-EQ", "token": "1394", "exch_seg": "NSE", "name": "Hindustan Unilever Ltd"},
    "ZOMATO": {"symbol": "ETERNAL-EQ", "token": "5097", "exch_seg": "NSE", "name": "Eternal Ltd"},
}


def get_token_info(ticker: str) -> Optional[dict]:
    """
    Returns the ScripMaster record for a ticker (e.g. 'RELIANCE' or 'RELIANCE-EQ').
    Triggers a one-time ScripMaster download if needed.
    """
    t = ticker.upper().strip()
    if t in ALIAS_TOKEN_MAP:
        return ALIAS_TOKEN_MAP[t]

    _load_scrip_master()
    key = t if t.endswith("-EQ") else f"{t}-EQ"
    info = _scrip_map.get(key) or _scrip_map.get(t) or _scrip_map.get(t.removesuffix("-EQ"))
    if not info:
        # Check stock_universe table via ORM
        try:
            db_row = get_stock_universe_token(t)
            if db_row:
                info = db_row
                _scrip_map[key] = info
                _scrip_map[t] = info
        except Exception as exc:
            logger.debug("stock_universe token lookup failed for %s: %s", t, exc)

    if not info and _scrip_map_failed:
        _load_scrip_master(force=True)
        info = _scrip_map.get(key) or _scrip_map.get(t)
    return info



_CRYPTO_TICKERS = {"BTC", "BTC-USD", "BTCUSDT", "BITCOIN", "ETH", "ETHUSDT"}
# International gold aliases — routed through Binance PAXGUSDT (tokenized 1-oz
# gold, ~1:1 XAU/USD tracking, 24/7) so XAUUSD/GOLD reuse the crypto pipeline.
_GOLD_TICKERS = {"XAUUSD", "XAU", "GOLD", "PAXG"}


def _is_gold_ticker(ticker: str) -> bool:
    """True for international-gold aliases (exact 'GOLD' only, so NSE ETFs like GOLDBEES stay equities)."""
    t = str(ticker).upper().strip()
    return t in _GOLD_TICKERS or t.startswith("XAU") or t.startswith("PAXG")


def _binance_crypto_symbol(ticker: str) -> str:
    """Maps a ticker to its Binance trading symbol (BTC, gold aliases, or *USDT)."""
    t = str(ticker).upper().strip()
    if "BTC" in t or "BITCOIN" in t:
        return "BTCUSDT"
    if _is_gold_ticker(t):
        return "PAXGUSDT"
    return t if t.endswith("USDT") else f"{t}USDT"


def is_crypto_ticker(ticker: str) -> bool:
    """Returns True if the ticker is a 24/7 digital/asset symbol (crypto or international gold)."""
    if not ticker:
        return False
    t = str(ticker).upper().strip()
    if _is_gold_ticker(t):
        return True
    return t in _CRYPTO_TICKERS or t.startswith("BTC") or t.startswith("ETH")


def _generate_crypto_seed_data(ticker: str, interval: str, is_intraday: bool) -> Optional[pd.DataFrame]:
    """Generates realistic baseline crypto OHLCV data if external APIs are completely unreachable.

    Returns None for gold aliases — fabricated XAU/USD prices are never acceptable
    (zero-fake-data rule); callers fall through to DB/None paths instead.
    """
    if _is_gold_ticker(ticker):
        return None
    now = datetime.now(_IST)
    n_bars = 180 if not is_intraday else 120
    base_price = 64250.0
    
    dates = []
    opens, highs, lows, closes, volumes = [], [], [], [], []
    curr = base_price
    
    step_minutes = {
        "1s": 1/60, "30s": 0.5, "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240
    }.get(interval, 1440)
    
    start_time = now - timedelta(minutes=n_bars * step_minutes)
    
    for i in range(n_bars):
        t = start_time + timedelta(minutes=i * step_minutes)
        d_str = t.strftime("%Y-%m-%d") if not is_intraday else t.strftime("%Y-%m-%d %H:%M:%S")
        
        # Realistic slight random walk
        drift = np.sin(i / 10.0) * 80.0 + np.cos(i / 5.0) * 60.0
        bar_open = round(curr, 2)
        change = (np.sin(i * 1.7) * 150.0) + drift
        bar_close = round(max(1000.0, bar_open + change), 2)
        bar_high = round(max(bar_open, bar_close) + abs(np.sin(i * 3.1) * 90.0) + 10.0, 2)
        bar_low = round(min(bar_open, bar_close) - abs(np.cos(i * 2.3) * 80.0) - 10.0, 2)
        bar_vol = round(abs(np.sin(i)) * 500.0 + 100.0, 2)
        
        dates.append(d_str)
        opens.append(bar_open)
        highs.append(bar_high)
        lows.append(bar_low)
        closes.append(bar_close)
        volumes.append(bar_vol)
        curr = bar_close

    df = pd.DataFrame({
        "date": dates,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    })
    return df


def fetch_crypto_data(ticker: str, period: str = "ALL", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Fetches cryptocurrency OHLCV data (e.g. BTC) via public Binance / Coinbase endpoints.
    Stores daily in SQLite historical_prices (strictly YYYY-MM-DD IST per DB invariant 1)
    and intraday in intraday_candles table.
    """
    import json
    import urllib.request

    ticker = ticker.upper().strip()
    cache_key = f"hist_{ticker}_{period}_{interval}"

    fresh = _get_cached(cache_key)
    if fresh is not None:
        fresh.attrs["data_source"] = "memory_cache"
        return fresh

    interval_clean = interval.lower().strip()
    is_intraday = interval_clean in ["1s", "30s", "1m", "5m", "15m", "30m", "1h", "4h"]

    # 1. Check local DB first
    if not is_intraday:
        db_df = get_historical_prices(ticker)
        if db_df is not None and not db_df.empty and len(db_df) >= 30:
            latest_date = str(db_df["date"].max())[:10]
            cutoff = (datetime.now(_IST) - timedelta(days=2)).strftime("%Y-%m-%d")
            if latest_date >= cutoff:
                db_df.attrs["data_source"] = "sqlite"
                _set_cached(cache_key, db_df)
                return db_df
    else:
        intra_db = get_intraday_candles(ticker, interval_clean)
        if intra_db is not None and not intra_db.empty and len(intra_db) >= 10:
            latest_ts = str(intra_db["date"].max())
            try:
                latest_dt = datetime.fromisoformat(latest_ts.replace(" ", "T"))
                if latest_dt.tzinfo is None:
                    latest_dt = latest_dt.replace(tzinfo=_IST)
                # Max tolerance strictly matches timeframe so historical data seamlessly connects to live stream:
                tolerance_sec = {
                    "1s": 3, "30s": 30, "1m": 60, "5m": 240, "15m": 600, "30m": 1200, "1h": 2400, "4h": 7200
                }.get(interval_clean, 60)
                if (datetime.now(_IST) - latest_dt).total_seconds() < tolerance_sec:
                    # Heal any stored holes at serve time (rows saved before slot-fill existed)
                    intra_db = fill_intraday_time_gaps(intra_db, interval_clean, is_crypto=True)
                    intra_db.attrs["data_source"] = "sqlite"
                    _set_cached(cache_key, intra_db, ttl_seconds=tolerance_sec // 2 or 2)
                    return intra_db
            except Exception as exc:
                logger.debug("Intraday cache freshness check failed for %s: %s", ticker, exc)

    # 2. Fetch from Binance public klines API
    binance_interval_map = {
        "1s": "1s", "30s": "1m", "1m": "1m", "5m": "5m",
        "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d"
    }
    b_interval = binance_interval_map.get(interval_clean, "1d")
    symbol = _binance_crypto_symbol(ticker)

    limit = 1000
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={b_interval}&limit={limit}"

    rows = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if isinstance(data, list) and len(data) > 0:
                for k in data:
                    open_time_ms = int(k[0])
                    dt = datetime.fromtimestamp(open_time_ms / 1000.0, tz=timezone.utc).astimezone(_IST)
                    date_str = dt.strftime("%Y-%m-%d") if not is_intraday else dt.strftime("%Y-%m-%d %H:%M:%S")
                    rows.append({
                        "date": date_str,
                        "open": float(k[1]),
                        "high": float(k[2]),
                        "low": float(k[3]),
                        "close": float(k[4]),
                        "volume": float(k[5]),
                    })
    except Exception as exc:
        logger.debug("Binance crypto fetch failed for %s: %s", ticker, exc)

    # 3. Fallback to Coinbase public candles
    if not rows and ("BTC" in ticker or "BITCOIN" in ticker):
        try:
            granularity_map = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 21600, "1d": 86400}
            gran = granularity_map.get(interval_clean, 86400)
            cb_url = f"https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity={gran}"
            req = urllib.request.Request(cb_url, headers={"User-Agent": "StockOracle/2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                if isinstance(data, list) and len(data) > 0:
                    for k in reversed(data):
                        dt = datetime.fromtimestamp(int(k[0]), tz=timezone.utc).astimezone(_IST)
                        date_str = dt.strftime("%Y-%m-%d") if not is_intraday else dt.strftime("%Y-%m-%d %H:%M:%S")
                        rows.append({
                            "date": date_str,
                            "open": float(k[3]),
                            "high": float(k[2]),
                            "low": float(k[1]),
                            "close": float(k[4]),
                            "volume": float(k[5]),
                        })
        except Exception as exc2:
            logger.debug("Coinbase crypto fetch failed for %s: %s", ticker, exc2)

    # 3b. Gold aliases: yfinance XAUUSD=X fallback (Binance PAXG primary unreachable)
    if not rows and _is_gold_ticker(ticker):
        try:
            import yfinance as yf
            _yf_iv = {"1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "1h", "1d": "1d"}.get(interval_clean, "1d")
            _yf_df = yf.download("XAUUSD=X", period=("5d" if is_intraday else "2y"), interval=_yf_iv, progress=False, auto_adjust=False)
            if _yf_df is not None and not _yf_df.empty:
                if isinstance(_yf_df.columns, pd.MultiIndex):
                    _yf_df.columns = _yf_df.columns.get_level_values(0)
                _yf_df = _yf_df.reset_index()
                _ts_col = "Datetime" if "Datetime" in _yf_df.columns else ("Date" if "Date" in _yf_df.columns else _yf_df.columns[0])
                for _, _r in _yf_df.iterrows():
                    _dt = pd.to_datetime(_r[_ts_col])
                    if _dt.tzinfo is None:
                        _dt = _dt.replace(tzinfo=timezone.utc)
                    _ds = _dt.astimezone(_IST).strftime("%Y-%m-%d" if not is_intraday else "%Y-%m-%d %H:%M:%S")
                    rows.append({
                        "date": _ds,
                        "open": float(_r.get("Open", 0) or 0),
                        "high": float(_r.get("High", 0) or 0),
                        "low": float(_r.get("Low", 0) or 0),
                        "close": float(_r.get("Close", 0) or 0),
                        "volume": float(_r.get("Volume", 0) or 0),
                    })
        except Exception as yf_exc:
            logger.debug("yfinance XAUUSD fallback failed for %s: %s", ticker, yf_exc)

    if rows:
        df = pd.DataFrame(rows)
        # Enforce OHLC consistency
        df["high"] = np.maximum(df["high"], np.maximum(df["open"], df["close"]))
        df["low"] = np.minimum(df["low"], np.minimum(df["open"], df["close"]))
        df = df[(df["open"] > 0) & (df["close"] > 0) & (df["high"] > 0) & (df["low"] > 0)]
        df = df.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
        # Slot-complete series: fill stall holes so charts never show whitespace gaps
        df = fill_intraday_time_gaps(df, interval_clean, is_crypto=True)

        if not is_intraday:
            save_historical_prices(ticker, df)
            _set_cached(cache_key, df)
        else:
            save_intraday_candles(ticker, interval_clean, df)
            crypto_ttl = 2 if interval_clean in ["1s", "30s"] else (8 if interval_clean == "1m" else 25)
            _set_cached(cache_key, df, ttl_seconds=crypto_ttl)
        df.attrs["data_source"] = "binance_crypto"
        return df

    # 4. Check DB fallback if network was unavailable
    if not is_intraday:
        db_df = get_historical_prices(ticker)
        if db_df is not None and not db_df.empty:
            db_df.attrs["data_source"] = "sqlite"
            return db_df
    else:
        intra_db = get_intraday_candles(ticker, interval_clean)
        if intra_db is not None and not intra_db.empty:
            intra_db.attrs["data_source"] = "sqlite"
            return intra_db

    # 5. Baseline seed data fallback (for isolated environments without internet)
    # Charts-only: seed is NEVER persisted to historical_prices/intraday_candles.
    # Daily seed dates are len-10 strings, so persisting them would launder
    # synthetic bars into future "sqlite" reads and poison ML/backtest inputs.
    seed_df = _generate_crypto_seed_data(ticker, interval_clean, is_intraday)
    if seed_df is not None and not seed_df.empty:
        logger.warning(
            "Serving crypto_seed baseline for %s (%s) — charts only, "
            "blocked from ML/backtest by require_real_data.",
            ticker, interval_clean,
        )
        seed_df.attrs["data_source"] = "crypto_seed"
        _set_cached(cache_key, seed_df)
        return seed_df

    return None


def fetch_crypto_live_ticker(ticker: str) -> Optional[dict]:
    """Fetches real-time live ticker for cryptocurrencies without stale DB cache."""
    import json
    import urllib.request

    ticker = ticker.upper().strip()
    symbol = _binance_crypto_symbol(ticker)
    url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            ltp = float(data.get("lastPrice", 0.0))
            if ltp > 0:
                open_p = float(data.get("openPrice", ltp))
                high_p = float(data.get("highPrice", ltp))
                low_p = float(data.get("lowPrice", ltp))
                prev_c = float(data.get("prevClosePrice", open_p) or open_p)
                vol = float(data.get("volume", 0.0))
                chg_pct = float(data.get("priceChangePercent", 0.0))

                return {
                    "ticker": ticker,
                    "company_name": "Gold (XAU/USD)" if _is_gold_ticker(ticker) else "Bitcoin (BTC / USD)",
                    "current_price": ltp,
                    "open": open_p,
                    "day_high": high_p,
                    "day_low": low_p,
                    "close": prev_c,
                    "change_pct": chg_pct,
                    "volume": vol,
                    "is_live": True,
                }
    except Exception as exc:
        logger.debug("Failed to fetch live crypto ticker for %s: %s", ticker, exc)

    return None


def fetch_crypto_info(ticker: str) -> Optional[dict]:
    """Fetches real-time 24h ticker info for cryptocurrencies."""
    import json
    import urllib.request

    ticker = ticker.upper().strip()
    fresh = get_company_info(ticker)
    if fresh is not None:
        return fresh

    symbol = _binance_crypto_symbol(ticker)
    url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}"

    info = None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            ltp = float(data.get("lastPrice", 0.0))
            if ltp > 0:
                open_p = float(data.get("openPrice", ltp))
                high_p = float(data.get("highPrice", ltp))
                low_p = float(data.get("lowPrice", ltp))
                prev_c = float(data.get("prevClosePrice", open_p) or open_p)
                vol = float(data.get("volume", 0.0))
                chg_pct = float(data.get("priceChangePercent", 0.0))

                info = {
                    "ticker": ticker,
                    "company_name": "Gold (XAU/USD)" if _is_gold_ticker(ticker) else "Bitcoin (BTC / USD)",
                    "current_price": ltp,
                    "open": open_p,
                    "day_high": high_p,
                    "day_low": low_p,
                    "close": prev_c,
                    "change_pct": chg_pct,
                    "volume": vol,
                    "fifty_two_week_high": (high_p * 1.15) if not _is_gold_ticker(ticker) else None,
                    "fifty_two_week_low": (low_p * 0.70) if not _is_gold_ticker(ticker) else None,
                    "market_cap": None if _is_gold_ticker(ticker) else ltp * 19700000,
                    "pe_ratio": None,
                    "dividend_yield": None,
                    "sector": "Commodity" if _is_gold_ticker(ticker) else "Cryptocurrency",
                }
                save_company_info(ticker, info)
                return info
    except Exception as exc:
        logger.debug("Failed to fetch crypto info from Binance for %s: %s", ticker, exc)

    # Fallback to last known historical close
    hist = get_historical_prices(ticker)
    if hist is not None and not hist.empty:
        last = hist.iloc[-1]
        c = float(last.get("close", 64250.0))
        o = float(last.get("open", c))
        h = float(last.get("high", c))
        l = float(last.get("low", c))
        v = float(last.get("volume", 0))
        info = {
            "ticker": ticker,
            "company_name": "Gold (XAU/USD)" if _is_gold_ticker(ticker) else "Bitcoin (BTC / USD)",
            "current_price": c,
            "open": o,
            "day_high": h,
            "day_low": l,
            "close": c,
            "change_pct": round(((c - o) / o) * 100, 2) if o > 0 else 0.0,
            "volume": v,
            "fifty_two_week_high": (h * 1.15) if not _is_gold_ticker(ticker) else None,
            "fifty_two_week_low": (l * 0.70) if not _is_gold_ticker(ticker) else None,
            "market_cap": None if _is_gold_ticker(ticker) else c * 19700000,
            "pe_ratio": None,
            "dividend_yield": None,
            "sector": "Commodity" if _is_gold_ticker(ticker) else "Cryptocurrency",
        }
        save_company_info(ticker, info)
        return info

    return None


def search_nse_stocks(query: str, limit: int = 12) -> list[dict]:
    """Search locally stored NSE listings by ticker or company name from SQLite, plus Crypto and Commodity assets."""
    results = search_stock_universe(query, limit)
    q = query.upper().strip()
    if any(term in q for term in ["BTC", "BITCOIN", "CRYPTO"]):
        btc_entry = {
            "ticker": "BTC",
            "name": "Bitcoin (BTC / USD)",
            "exchange": "CRYPTO",
            "token": "BTC",
            "exch_seg": "CRYPTO",
        }
        if not any(r.get("ticker") == "BTC" for r in results):
            results.insert(0, btc_entry)
    if any(term in q for term in ["XAU", "GOLD", "PAXG", "COMMODITY", "FOREX", "XAUUSD"]):
        gold_entry = {
            "ticker": "XAUUSD",
            "name": "Gold Spot / US Dollar (XAU/USD)",
            "exchange": "COMMODITY",
            "token": "XAUUSD",
            "exch_seg": "COMMODITY",
        }
        if not any(r.get("ticker") == "XAUUSD" for r in results):
            results.insert(0, gold_entry)
    return results[:limit]


# ── Bounded TTL & LRU In-Memory Cache ──
_cache: dict = {}
CACHE_TTL_SECONDS = 120  # 2 minutes
MAX_CACHE_ENTRIES = 500  # Cap maximum items to prevent unbounded memory growth


def _prune_cache():
    """Removes expired items and enforces maximum cache capacity."""
    now = datetime.now()
    # 1. Evict expired entries
    expired_keys = [k for k, (_, expiry) in _cache.items() if now >= expiry]
    for k in expired_keys:
        _cache.pop(k, None)

    # 2. If still over capacity, evict oldest entries (FIFO/LRU insertion order)
    while len(_cache) > MAX_CACHE_ENTRIES:
        oldest_key = next(iter(_cache))
        _cache.pop(oldest_key, None)


def _get_cached(key: str):
    if key in _cache:
        data, expiry = _cache[key]
        if datetime.now() < expiry:
            return data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
        _cache.pop(key, None)
    return None


def _get_stale(key: str):
    """Returns cached data even if expired (used as fallback when API is unavailable)."""
    if key in _cache:
        data, _ = _cache[key]
        return data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
    return None


def _set_cached(key: str, data, ttl_seconds: Optional[int] = None):
    _prune_cache()
    cached_data = data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
    ttl = ttl_seconds if ttl_seconds is not None else CACHE_TTL_SECONDS
    _cache[key] = (cached_data, datetime.now() + timedelta(seconds=ttl))



# ── fetch_stock_data ──

def fetch_stock_data(ticker: str, period: str = "ALL", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Fetches historical OHLCV data.
    First checks database. If missing or stale, fetches from Angel One SmartAPI,
    updates DB, and returns. (Yahoo Finance fallback is disabled).

    Supports intervals: '1s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'.
    When interval is '1d' (Daily), fetches and returns complete multi-year data
    from stock inception/beginning.

    Sets df.attrs['data_source'] on every returned DataFrame:
      'memory_cache'  — served from in-memory LRU cache
      'sqlite'        — freshly read from local database (up-to-date)
      'angel_one'     — live data from Angel One SmartAPI
      'sqlite_stale'  — last-resort database data (possibly outdated)
    """
    ticker = ticker.upper().strip()
    if is_crypto_ticker(ticker):
        return fetch_crypto_data(ticker, period=period, interval=interval)

    cache_key = f"hist_{ticker}_{period}_{interval}"

    # 1. Check in-memory fast cache first
    fresh = _get_cached(cache_key)
    if fresh is not None:
        fresh.attrs["data_source"] = "memory_cache"
        return fresh

    token_info = get_token_info(ticker)
    interval_clean = interval.lower().strip()

    # 4h interval: constructed by grouping 1-hour candles into two NSE session buckets:
    #   Morning bucket  -> 09:15–12:59 (covers 09:15, 10:15, 11:15, 12:15)
    #   Afternoon bucket -> 13:15–15:30 (covers 13:15, 14:15, 15:15)
    # Each bucket is labelled with its session start time (09:15 or 13:15).
    if interval_clean == "4h":
        df_1h = fetch_stock_data(ticker, period="365D" if period in ["ALL", "MAX", None, "1Y", "5Y"] else period, interval="1h")
        if df_1h is not None and not df_1h.empty:
            dt = pd.to_datetime(df_1h["date"], format="mixed", errors="coerce")
            # Assign each 1h candle to the session bucket it belongs to
            is_morning = dt.dt.hour < 13
            bucket_label = is_morning.map({True: "09:15:00", False: "13:15:00"})
            df_1h_copy = df_1h.copy()
            df_1h_copy["bucket_date"] = dt.dt.strftime("%Y-%m-%d")
            df_1h_copy["bucket"] = df_1h_copy["bucket_date"] + " " + bucket_label
            df_4h = df_1h_copy.groupby("bucket", as_index=False).agg({
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
                "volume": "sum",
            }).rename(columns={"bucket": "date"}).sort_values("date")
            # Retag as 4h so upstream consumers know the interval
            df_4h.attrs["data_source"] = df_1h.attrs.get("data_source", "angel_one")
            df_4h.attrs["interval"] = "4h"
            _set_cached(cache_key, df_4h)
            return df_4h
        return None

    # 1s and 30s intervals: base high-resolution 1m candles for live tick seconds bucketing
    if interval_clean in ["1s", "30s"]:
        df_1m = fetch_stock_data(ticker, period="7D" if period in ["ALL", "MAX", None, "1Y", "5Y"] else period, interval="1m")
        if df_1m is not None and not df_1m.empty:
            df_sec = df_1m.copy()
            df_sec.attrs["data_source"] = df_1m.attrs.get("data_source", "angel_one")
            _set_cached(cache_key, df_sec)
            return df_sec
        return None

    # Map period to days count
    period_map = {
        "2D":  2,   "7D":  7,   "10D": 10,  "1W":  7,
        "45D": 45,  "1M":  30,  "120D": 120, "3M": 90,
        "200D": 200, "6M": 180, "370D": 370, "1Y": 365,
        "2Y":  730, "5Y": 1825, "ALL": 9000, "MAX": 9000,
    }
    days = period_map.get(period.upper() if period else "ALL", 9000 if interval_clean == "1d" else 120)

    todate = datetime.now(_IST)
    fromdate = todate - timedelta(days=days)
    fromdate_str = fromdate.strftime("%Y-%m-%d")
    todate_str = todate.strftime("%Y-%m-%d")

    is_intraday = interval_clean in ["1m", "5m", "15m", "30m", "1h"]

    def _expected_latest_trading_day() -> str:
        now = datetime.now(_IST)
        if now.hour < 9 or (now.hour == 9 and now.minute < 15):
            target = now - timedelta(days=1)
        else:
            target = now
        while not is_trading_day(target):
            target = target - timedelta(days=1)
        return target.strftime("%Y-%m-%d")

    # 2. Check local database (ONLY FOR DAILY INTERVAL '1d')
    db_df = None
    if not is_intraday:
        if period in ["ALL", "MAX", None, "5Y"]:
            db_df = get_historical_prices(ticker)
        else:
            db_df = get_historical_prices(ticker, fromdate_str, todate_str)

        if db_df is not None and not db_df.empty:
            if len(db_df) < 5:
                from backend.data.database import clear_ticker_history
                clear_ticker_history(ticker)
                db_df = None
            else:
                latest_db_date_str = str(db_df["date"].max())[:10]
                expected_date_str = _expected_latest_trading_day()
                is_up_to_date = latest_db_date_str >= expected_date_str

                # Check if full inception backfill has been performed
                has_full_history = (ticker in _full_backfill_done) or (len(db_df) >= 2500)

                if has_full_history:
                    if is_up_to_date:
                        db_df.attrs["data_source"] = "sqlite"
                        _set_cached(cache_key, db_df)
                        return db_df
                    else:
                        # Database has extensive history but missing today's/yesterday's session
                        ensure_session()
                        if _session_active and token_info and token_info.get("token"):
                            recent_param = {
                                "exchange":    token_info["exch_seg"],
                                "symboltoken": token_info["token"],
                                "interval":    "ONE_DAY",
                                "fromdate":    (todate - timedelta(days=30)).strftime("%Y-%m-%d 00:00"),
                                "todate":      todate.strftime("%Y-%m-%d 23:59"),
                            }
                            resp = _call_api(smartApi.getCandleData, recent_param)
                            if resp and resp.get("status") and resp.get("data"):
                                recent_df = pd.DataFrame(resp["data"], columns=["date", "open", "high", "low", "close", "volume"])
                                recent_df = recent_df.astype({"open": float, "high": float, "low": float, "close": float, "volume": int})
                                dt_raw = pd.to_datetime(recent_df["date"], format='mixed', errors='coerce')
                                recent_df = recent_df[dt_raw.dt.dayofweek < 5].copy()
                                recent_df["date"] = pd.to_datetime(recent_df["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d")
                                save_historical_prices(ticker, recent_df)
                                updated_df = get_historical_prices(ticker)
                                if updated_df is not None and not updated_df.empty:
                                    updated_df.attrs["data_source"] = "angel_one"
                                    _set_cached(cache_key, updated_df)
                                    return updated_df

        # If DB has fewer than 300 records or is empty, trigger full backfill from inception
        if period in ["ALL", "MAX", None, "5Y"]:
            full_df = backfill_full_history(ticker)
            if full_df is not None and not full_df.empty:
                full_df.attrs["data_source"] = "angel_one"
                _set_cached(cache_key, full_df)
                return full_df

    # 2b. Intraday DB-first path: check intraday_candles before going to Angel One.
    # AGENTS.md invariant: intraday candles are NEVER stored in historical_prices.
    # The intraday_candles table is the persistence layer; in-memory cache sits on top.
    if is_intraday:
        # Staleness thresholds: how many seconds back the newest candle may be before we refresh
        _intraday_stale_secs = {
            "1m": 5 * 60,
            "5m": 15 * 60,
            "15m": 30 * 60,
            "30m": 45 * 60,
            "1h": 90 * 60,
        }
        stale_threshold_secs = _intraday_stale_secs.get(interval_clean, 30 * 60)

        intra_db = get_intraday_candles(ticker, interval_clean, from_ts=fromdate_str)
        if intra_db is not None and not intra_db.empty and len(intra_db) >= 5:
            # Determine freshness of newest stored candle
            latest_ts_str = str(intra_db["date"].max())
            try:
                latest_dt = datetime.fromisoformat(latest_ts_str.replace(" ", "T"))
                if latest_dt.tzinfo is None:
                    latest_dt = latest_dt.replace(tzinfo=_IST)
                age_secs = (datetime.now(_IST) - latest_dt).total_seconds()
            except Exception:
                age_secs = stale_threshold_secs + 1  # treat parse failure as stale

            if age_secs <= stale_threshold_secs:
                # DB data is fresh — serve directly, skip broker
                logger.info("[intraday-db] %s/%s served from DB (%d candles, age %.0fs)", ticker, interval_clean, len(intra_db), age_secs)
                intra_db.attrs["data_source"] = "sqlite"
                _set_cached(cache_key, intra_db)
                return intra_db
            else:
                # DB is stale — only fetch the incremental delta from Angel One
                logger.info("[intraday-db] %s/%s DB stale (age %.0fs), fetching incremental from %s", ticker, interval_clean, age_secs, latest_ts_str)
                # Clamp fromdate to last stored timestamp minus one interval (for candle completeness safety)
                _interval_seconds = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600}
                _delta = timedelta(seconds=_interval_seconds.get(interval_clean, 3600))
                try:
                    incr_from = datetime.fromisoformat(latest_ts_str.replace(" ", "T"))
                    if incr_from.tzinfo is None:
                        incr_from = incr_from.replace(tzinfo=_IST)
                    incr_from = incr_from - _delta  # step back one interval for safety
                except Exception:
                    incr_from = api_fromdate if 'api_fromdate' in dir() else fromdate
                # We will pass this adjusted fromdate to the Angel One fetch below; store it
                _incr_fromdate = incr_from
                _intra_db_base = intra_db  # will merge after fetch
        else:
            _incr_fromdate = None
            _intra_db_base = None
    else:
        _incr_fromdate = None
        _intra_db_base = None

    # 3. Fetch from Angel One for intraday (or daily fallback)
    ensure_session()

    if _session_active and token_info and token_info.get("token"):
        interval_map = {
            "1m":  "ONE_MINUTE",
            "5m":  "FIVE_MINUTE",
            "15m": "FIFTEEN_MINUTE",
            "30m": "THIRTY_MINUTE",
            "1h":  "ONE_HOUR",
            "1d":  "ONE_DAY",
        }
        api_interval = interval_map.get(interval_clean, "ONE_DAY")
        if interval_clean == "1h":
            max_days = 365
        elif interval_clean in ["15m", "30m"]:
            max_days = 90
        elif interval_clean == "5m":
            max_days = 60
        elif interval_clean in ["1s", "30s", "1m"]:
            max_days = 30
        else:
            max_days = 9000
        # If we have a stale intraday DB base, use the incremental fromdate to minimise API call window
        api_fromdate = _incr_fromdate if (_incr_fromdate is not None) else (todate - timedelta(days=min(days, max_days)))

        historicParam = {
            "exchange":    token_info["exch_seg"],
            "symboltoken": token_info["token"],
            "interval":    api_interval,
            "fromdate":    api_fromdate.strftime("%Y-%m-%d %H:%M"),
            "todate":      todate.strftime("%Y-%m-%d %H:%M"),
        }

        response = _call_api(smartApi.getCandleData, historicParam)

        if response and response.get("status") and response.get("data"):
            df = pd.DataFrame(
                response["data"],
                columns=["date", "open", "high", "low", "close", "volume"]
            )
            df = df.astype({"open": float, "high": float, "low": float,
                            "close": float, "volume": int})
            df.attrs["data_source"] = "angel_one"

            # Filter out weekend dates (Saturday=5, Sunday=6) to discard exchange mock/DR testing sessions
            dt_raw = pd.to_datetime(df["date"], format='mixed', errors='coerce')
            df = df[dt_raw.dt.dayofweek < 5].copy()

            if is_intraday:
                df["date"] = pd.to_datetime(df["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d %H:%M:%S")
                df = df.dropna(subset=["date", "open", "high", "low", "close"]).sort_values("date")
                # Slot-complete series: fill stall holes so charts never show whitespace gaps
                df = fill_intraday_time_gaps(df, interval_clean, is_crypto=False)

                # Upsert fetched intraday candles to DB (AGENTS.md: only intraday_candles table, never historical_prices)
                try:
                    save_intraday_candles(ticker, interval_clean, df)
                except Exception as _e:
                    logger.warning("[intraday-db] save_intraday_candles failed for %s/%s: %s", ticker, interval_clean, _e)

                # If we did an incremental fetch, merge with existing DB base for a full dataset
                if _intra_db_base is not None and not _intra_db_base.empty:
                    combined = pd.concat([_intra_db_base, df], ignore_index=True)
                    combined = combined.drop_duplicates(subset=["date"], keep="last").sort_values("date").reset_index(drop=True)
                    # Heal holes straddling the merge boundary (old stored rows may predate slot-fill)
                    combined = fill_intraday_time_gaps(combined, interval_clean, is_crypto=False)
                    combined.attrs["data_source"] = "angel_one"
                    _set_cached(cache_key, combined)
                    return combined

                _set_cached(cache_key, df)
                return df
            else:
                df["date"] = pd.to_datetime(df["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d")
                df = df.dropna(subset=["date", "open", "high", "low", "close"]).sort_values("date")

                # Save daily records to local database (UPSERT)
                save_historical_prices(ticker, df)

                merged_df = get_historical_prices(ticker) if period in ["ALL", "MAX", None] else get_historical_prices(ticker, fromdate_str, todate_str)
                final_df = merged_df if (merged_df is not None and not merged_df.empty) else df
                final_df.attrs["data_source"] = "angel_one"
                _set_cached(cache_key, final_df)
                return final_df

    # 4. Fallback: Yahoo Finance fallback is completely disabled per broker-only data policy.
    # We strictly rely on Angel One or verified existing SQLite records.
    if db_df is not None and not db_df.empty and len(db_df) >= 5:
        logger.info("Returning verified SQLite data for %s (Yahoo Finance fallback disabled).", ticker)
        db_df.attrs["data_source"] = "sqlite"
        return db_df


    # All verified sources exhausted. Return None so callers propagate a 404/503
    # rather than silently serving random-walk data.
    logger.warning(
        "fetch_stock_data: all sources exhausted for %s (period=%s, interval=%s). "
        "Returning None — no synthetic data will be generated.",
        ticker, period, interval,
    )
    return None




# ── fetch_company_info ──

def fetch_company_info(ticker: str) -> Optional[dict]:
    """
    Fetches real-time LTP, daily stats, and 52-week data.
    Results are cached in SQLite for 5 minutes and survive server restarts.
    Falls back to SQLite historical prices when broker is unavailable.
    """
    ticker = ticker.upper().strip()
    if is_crypto_ticker(ticker):
        return fetch_crypto_info(ticker)

    ensure_session()

    # Check fresh DB cache
    fresh = get_company_info(ticker)
    if fresh is not None:
        return fresh

    token_info = get_token_info(ticker)

    current_price = 0.0
    day_high = 0.0
    day_low = 0.0
    open_price = 0.0
    prev_close = 0.0
    volume = 0
    fifty_two_week_high = 0.0
    fifty_two_week_low = 0.0

    # 1. Real-time LTP from Angel One if active
    if _session_active and token_info and token_info.get("token"):
        ltp_response = _call_api(
            smartApi.ltpData,
            token_info["exch_seg"],
            token_info["symbol"],
            token_info["token"]
        )
        if ltp_response and ltp_response.get("status") and ltp_response.get("data"):
            ltp_data      = ltp_response["data"]
            current_price = float(ltp_data.get("ltp",   0.0))
            open_price    = float(ltp_data.get("open",  0.0))
            day_high      = float(ltp_data.get("high",  0.0))
            day_low       = float(ltp_data.get("low",   0.0))
            prev_close    = float(ltp_data.get("close", 0.0))

    # 2. Check Historical Prices table for latest close and 52W High/Low via ORM
    try:
        from backend.shared.database import get_db_session
        from backend.shared.models import HistoricalPrice
        from sqlalchemy import func, select
        with get_db_session() as session:
            # 52-week range
            from_52w = (datetime.now(_IST) - timedelta(days=365)).strftime("%Y-%m-%d")
            stmt_52w = select(
                func.max(HistoricalPrice.high),
                func.min(HistoricalPrice.low)
            ).where(
                HistoricalPrice.ticker == ticker,
                HistoricalPrice.date >= from_52w
            )
            row_52w = session.execute(stmt_52w).first()
            if row_52w and row_52w[0] is not None:
                fifty_two_week_high = float(row_52w[0])
                fifty_two_week_low  = float(row_52w[1])

            # If current price still 0, get latest close from DB
            if current_price == 0.0:
                stmt_last = select(
                    HistoricalPrice.close,
                    HistoricalPrice.open,
                    HistoricalPrice.high,
                    HistoricalPrice.low,
                    HistoricalPrice.volume
                ).where(
                    HistoricalPrice.ticker == ticker
                ).order_by(HistoricalPrice.date.desc()).limit(1)
                last_row = session.execute(stmt_last).first()
                if last_row and last_row[0] is not None:
                    current_price = float(last_row[0])
                    prev_close = float(last_row[0])
                    open_price = float(last_row[1] or last_row[0])
                    day_high = float(last_row[2] or last_row[0])
                    day_low = float(last_row[3] or last_row[0])
                    volume = int(last_row[4] or 0)
    except Exception as e:
        logger.debug("Error reading fallback company info from ORM for %s: %s", ticker, e)

    # 3. If still missing, check stale company info
    if current_price == 0.0:
        stale = get_stale_company_info(ticker)
        if stale is not None:
            return stale
        # Try fetching 1M daily history to populate price
        hist = fetch_stock_data(ticker, period="1M", interval="1d")
        if hist is not None and not hist.empty:
            last = hist.iloc[-1]
            current_price = float(last["close"])
            prev_close = float(last["close"])
            day_high = float(last["high"])
            day_low = float(last["low"])
            open_price = float(last["open"])
            volume = int(last["volume"] or 0)
            fifty_two_week_high = float(hist["high"].max())
            fifty_two_week_low = float(hist["low"].min())

    if current_price == 0.0:
        return None

    if fifty_two_week_high == 0.0:
        # Zero-fake-data rule: unknown 52w range stays null (JSON) instead of
        # a fabricated ±15% band. No frontend reads these fields directly;
        # screener/heatmap use server-computed distance metrics with null guards.
        fifty_two_week_high = None
        fifty_two_week_low = None

    change = round(current_price - prev_close, 2) if prev_close > 0 else 0.0
    change_pct = round((change / prev_close) * 100, 2) if prev_close > 0 else 0.0
    company_name = token_info.get("name", ticker) if token_info else ticker

    info = {
        "ticker":              ticker,
        "symbol":              ticker,
        "name":                company_name,
        "companyName":         company_name,
        "sector":              "Indian Equities",
        "industry":            token_info.get("exch_seg", "NSE") if token_info else "NSE",
        "exchange":            token_info.get("exch_seg", "NSE") if token_info else "NSE",
        "currency":            "INR",
        "market_cap":          0,
        "price":               current_price,
        "current_price":       current_price,
        "ltp":                 current_price,
        "change":              change,
        "change_pct":          change_pct,
        "changePercent":       change_pct,
        "day_high":            day_high,
        "day_low":             day_low,
        "open":                open_price,
        "previous_close":      prev_close,
        "volume":              volume,
        "fifty_two_week_low":  fifty_two_week_low,
        "fifty_two_week_high": fifty_two_week_high,
    }
    save_company_info(ticker, info)
    _set_cached(f"info_{ticker}", info)
    return info



# ── Combined Historical + Live Data ───────────────────────────────────────────

def get_combined_stock_data(ticker: str, period: str = "ALL") -> Optional[pd.DataFrame]:
    """
    Returns the complete OHLCV DataFrame for a ticker from stock inception/beginning:
      1. Fetching historical daily data from DB / Angel One API (fetch_stock_data)
      2. Appending today's live tick data as a synthetic OHLCV candle if available
         (or updating today's candle if it already exists in history)

    This ensures prediction models and charts always see today's price action even before
    the official end-of-day candle is available.
    """
    ticker = ticker.upper()

    # Step 1: Get base historical data
    df = fetch_stock_data(ticker, period=period, interval="1d")
    if df is None or df.empty:
        return None
    # The live-candle merge below is request-specific.
    df = df.copy(deep=True)

    # Step 2: Check live ticks only on trading days (IST) (Crypto trades 24/7)
    now = datetime.now(_IST)
    if not is_crypto_ticker(ticker) and not is_trading_day(now):
        return df

    today_candle = get_live_tick_ohlcv(ticker)
    if today_candle is None:
        return df  # No live ticks yet — return historical as-is

    today_str = today_candle["date"]

    # Step 3: Replace today's candle if it exists, otherwise append if during/after market hours (or 24/7 for crypto)
    if today_str in df["date"].values:
        idx = df.index[df["date"] == today_str][0]
        # Update close with latest live price; keep historical open; extend high/low
        df.at[idx, "close"]  = today_candle["close"]
        df.at[idx, "high"]   = max(float(df.at[idx, "high"]), today_candle["high"])
        df.at[idx, "low"]    = min(float(df.at[idx, "low"]),  today_candle["low"])
    elif is_crypto_ticker(ticker) or now.hour >= 9:
        # Append as a new row for current session
        new_row = pd.DataFrame([today_candle])
        df = pd.concat([df, new_row], ignore_index=True)

    logger.info("Combined data for %s: %d rows (historical + live tick for %s)", ticker, len(df), today_str)
    return df


def backfill_full_history(ticker: str) -> Optional[pd.DataFrame]:
    """
    Downloads complete historical daily OHLCV data from stock inception/beginning
    using Angel One SmartAPI in 1400-day chunks (approx 4 years per request) backwards
    up to 25+ years (or until no more candles are returned), and bulk saves into DB.
    """
    ticker = ticker.upper().strip()
    if is_crypto_ticker(ticker):
        return fetch_crypto_data(ticker, period="ALL", interval="1d")

    logger.info("Fetching full historical data from inception via Angel One SmartAPI for %s...", ticker)

    # Check if DB already has extensive history (> 2500 records)
    existing_df = get_historical_prices(ticker)
    if existing_df is not None and len(existing_df) >= 2500:
        _full_backfill_done.add(ticker)
        logger.info("Found extensive existing %d records in DB for %s.", len(existing_df), ticker)
        return existing_df

    token_info = get_token_info(ticker)
    if not token_info:
        logger.error("Token not found for '%s'.", ticker)
        return existing_df if (existing_df is not None and len(existing_df) >= 50) else None

    ensure_session()
    if not _session_active or not smartApi:
        logger.warning("Angel One session inactive — returning current DB history for %s.", ticker)
        return existing_df if (existing_df is not None and len(existing_df) >= 50) else None

    cur_date = datetime.now(_IST)
    all_chunks = []
    consecutive_empty = 0

    for i in range(8):  # 8 * 1400 days = ~30 years (covers 1995 to present)
        to_d = cur_date - timedelta(days=i * 1400)
        from_d = to_d - timedelta(days=1400)

        historicParam = {
            "exchange":    token_info["exch_seg"],
            "symboltoken": token_info["token"],
            "interval":    "ONE_DAY",
            "fromdate":    from_d.strftime("%Y-%m-%d 00:00"),
            "todate":      to_d.strftime("%Y-%m-%d 23:59"),
        }

        try:
            response = _call_api(smartApi.getCandleData, historicParam)
            if response and response.get("status") and response.get("data"):
                cdf = pd.DataFrame(
                    response["data"],
                    columns=["date", "open", "high", "low", "close", "volume"]
                )
                cdf = cdf.astype({"open": float, "high": float, "low": float, "close": float, "volume": int})
                # Filter weekend mock/DR sessions
                dt_raw = pd.to_datetime(cdf["date"], format='mixed', errors='coerce')
                cdf = cdf[dt_raw.dt.dayofweek < 5].copy()
                cdf["date"] = pd.to_datetime(cdf["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d")
                if not cdf.empty:
                    all_chunks.append(cdf)
                    consecutive_empty = 0
                else:
                    consecutive_empty += 1
            else:
                consecutive_empty += 1
        except Exception as e:
            logger.warning("Chunk fetch error (%s to %s) for %s: %s", from_d, to_d, ticker, e)
            consecutive_empty += 1

        if consecutive_empty >= 2 and i >= 2:
            # Reached before stock inception (IPO)
            break

    if all_chunks:
        merged = pd.concat(all_chunks, ignore_index=True)
        merged = merged.drop_duplicates(subset=["date"]).sort_values("date")
        clean_df = merged[["date", "open", "high", "low", "close", "volume"]].dropna()

        if not clean_df.empty:
            from backend.data.database import clear_ticker_history
            clear_ticker_history(ticker)
            save_historical_prices(ticker, clean_df)
            _full_backfill_done.add(ticker)
            logger.info("Stored %d full-history Angel One records in DB for %s (from %s to %s).",
                        len(clean_df), ticker, clean_df["date"].min(), clean_df["date"].max())
            return clean_df

    return existing_df if (existing_df is not None and len(existing_df) >= 50) else None


def backfill_5y_history(ticker: str) -> Optional[pd.DataFrame]:
    """Backward-compatible wrapper pointing to full history backfill."""
    return backfill_full_history(ticker)


_preloaded_stocks = set()
_preloading_stocks = set()

def preload_all_stock_timeframes(ticker: str) -> dict:
    """
    Background preloader:
    1. Downloads & stores complete multi-year daily history from inception into SQLite DB (historical_prices).
    2. Pre-fetches and in-memory caches full history for 1h, 4h, 15m, 5m, 30m, 1m intervals.
    """
    t = ticker.upper().strip()
    if t in _preloaded_stocks or t in _preloading_stocks:
        return {"status": "already_preloaded", "ticker": t}
    _preloading_stocks.add(t)

    logger.info("Preloading all timeframes and backfilling DB for %s...", t)

    try:
        # 1. Daily full backfill into database (SQLite historical_prices)
        try:
            backfill_full_history(t)
        except Exception as exc:
            logger.warning("Error backfilling daily history for %s: %s", t, exc)

        # 2. Intraday timeframes (cached in-memory for instant switching)
        timeframes_to_cache = [("365D", "1h"), ("90D", "15m"), ("60D", "5m"), ("30D", "1m")]
        for period, iv in timeframes_to_cache:
            try:
                fetch_stock_data(t, period=period, interval=iv)
            except Exception as exc:
                logger.debug("Error pre-caching %s %s for %s: %s", iv, period, t, exc)

        _preloaded_stocks.add(t)
        logger.info("✅ Finished preloading all timeframes for %s.", t)
        return {"status": "success", "ticker": t}
    finally:
        _preloading_stocks.discard(t)

