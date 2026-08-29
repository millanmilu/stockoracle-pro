import os
import time
import asyncio
import requests
import pyotp
import pandas as pd
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
from backend.data.database import (
    save_historical_prices, get_historical_prices,
    save_company_info, get_company_info, get_stale_company_info,
    get_live_tick_ohlcv, save_stock_universe, search_stock_universe,
    get_db_connection
)

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

# Angel One error codes that indicate an expired / invalid session
_AUTH_ERROR_CODES = {"AB1010", "AG8002", "AB1004"}


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
    global _session_active, _session_expires_at, _session_created_at
    _session_active     = False
    _session_expires_at = None
    _session_created_at = None


def _load_broker_from_database() -> bool:
    """Loads active broker credentials permanently stored in the broker_accounts table."""
    global ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET, smartApi
    try:
        from backend.data.database import get_db_connection
        with get_db_connection() as conn:
            row = conn.execute("""
                SELECT credentials_json FROM broker_accounts
                WHERE broker = 'angel_one' AND is_active = 1
                LIMIT 1
            """).fetchone()
            if row and row["credentials_json"]:
                creds = json.loads(row["credentials_json"])
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
                logger.info("Loaded active Angel One credentials from database broker_accounts.")
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

    while True:
        try:
            now = datetime.now(_IST)
            is_weekday = now.weekday() < 5
            is_pre_market = is_weekday and ((now.hour == 8 and now.minute >= 45) or (now.hour == 9 and now.minute <= 5))
            is_market_hours = is_weekday and ((now.hour == 9 and now.minute >= 15) or (9 < now.hour < 15) or (now.hour == 15 and now.minute <= 30))

            if ANGEL_API_KEY and ANGEL_CLIENT_ID and ANGEL_PASSWORD and ANGEL_TOTP_SECRET:
                # Case A: Pre-market refresh: force fresh token so the entire trading day has a clean session
                if is_pre_market:
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

                # Rate-limit error — wait longer before retrying
                if "rate" in msg.lower() or "too many" in msg.lower():
                    logger.warning("Rate limit hit — waiting %.1fs before retry...", retry_delay * 2)
                    time.sleep(retry_delay * 2)
                    if attempt < retries:
                        continue

            return result

        except Exception as e:
            err_str = str(e).lower()
            # Network-level errors — retry with backoff
            if attempt < retries:
                wait = retry_delay * (attempt + 1)
                logger.warning("API call failed (attempt %d/%d): %s. Retrying in %.1fs...", attempt + 1, retries + 1, e, wait)
                time.sleep(wait)
            else:
                logger.error("API call permanently failed after %d attempts: %s", retries + 1, e)
                return None

    return None


# ── ScripMaster Token Mapping ──
SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
_scrip_map: Dict[str, dict] = {}
_scrip_map_failed = False   # Prevents infinite retry loops on total failure


def _load_scrip_master(force: bool = False):
    """Downloads the ScripMaster JSON and indexes NSE equity symbols."""
    global _scrip_map, _scrip_map_failed

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


def get_token_info(ticker: str) -> Optional[dict]:
    """
    Returns the ScripMaster record for a ticker (e.g. 'RELIANCE' or 'RELIANCE-EQ').
    Triggers a one-time ScripMaster download if needed.
    """
    _load_scrip_master()
    t = ticker.upper().strip()
    key = t if t.endswith("-EQ") else f"{t}-EQ"
    info = _scrip_map.get(key) or _scrip_map.get(t) or _scrip_map.get(t.removesuffix("-EQ"))
    if not info:
        # Check SQLite stock_universe table
        try:
            with get_db_connection() as conn:
                row = conn.execute(
                    "SELECT ticker, name, symbol, token, exchange FROM stock_universe WHERE ticker = ? OR symbol = ? LIMIT 1",
                    (t, key)
                ).fetchone()
                if row:
                    info = {
                        "symbol": row["symbol"],
                        "token": row["token"],
                        "exch_seg": row["exchange"],
                        "name": row["name"]
                    }
                    _scrip_map[key] = info
                    _scrip_map[t] = info
        except Exception:
            pass

    if not info and _scrip_map_failed:
        _load_scrip_master(force=True)
        info = _scrip_map.get(key) or _scrip_map.get(t)
    return info


def search_nse_stocks(query: str, limit: int = 12) -> list[dict]:
    """Search every locally stored NSE listing by ticker or company name."""
    _load_scrip_master()
    return search_stock_universe(query, limit)


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


def _set_cached(key: str, data):
    _prune_cache()
    cached_data = data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
    _cache[key] = (cached_data, datetime.now() + timedelta(seconds=CACHE_TTL_SECONDS))


# ── fetch_stock_data ──

def fetch_stock_data(ticker: str, period: str = "1Y", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Fetches historical OHLCV data.
    First checks local SQLite DB. If missing or stale, tries Angel One SmartAPI,
    falls back to Yahoo Finance for daily candles, updates SQLite DB, and returns.

    Sets df.attrs['data_source'] on every returned DataFrame:
      'memory_cache'  — served from in-memory LRU cache
      'sqlite'        — freshly read from local SQLite (up-to-date)
      'angel_one'     — live data from Angel One SmartAPI
      'yahoo_finance' — fallback from Yahoo Finance (stored to SQLite)
      'sqlite_stale'  — last-resort SQLite data (possibly outdated)
    """
    ticker = ticker.upper().strip()
    cache_key = f"hist_{ticker}_{period}_{interval}"

    # 1. Check in-memory fast cache first
    fresh = _get_cached(cache_key)
    if fresh is not None:
        fresh.attrs["data_source"] = "memory_cache"
        return fresh

    token_info = get_token_info(ticker)

    # Map period to days count
    period_map = {
        "2D":  2,   "7D":  7,   "10D": 10,  "1W":  7,
        "45D": 45,  "1M":  30,  "120D": 120, "3M": 90,
        "200D": 200, "6M": 180, "370D": 370, "1Y": 365,
        "2Y":  730, "5Y": 1825,
    }
    days = period_map.get(period.upper(), 120)

    # Trigger 5Y backfill if requested and missing from DB
    if period.upper() == "5Y" and not interval.lower() in ["1m", "5m", "15m", "1h"]:
        backfilled = backfill_5y_history(ticker)
        if backfilled is not None and not backfilled.empty:
            backfilled.attrs["data_source"] = "angel_one"
            return backfilled

    todate = datetime.now()
    fromdate = todate - timedelta(days=days)

    fromdate_str = fromdate.strftime("%Y-%m-%d")
    todate_str = todate.strftime("%Y-%m-%d")

    is_intraday = interval.lower() in ["1m", "5m", "15m", "1h"]

    def _expected_latest_trading_day() -> str:
        now = datetime.now(_IST)
        if now.weekday() == 5:
            target = now - timedelta(days=1)
        elif now.weekday() == 6:
            target = now - timedelta(days=2)
        elif now.hour < 9 or (now.hour == 9 and now.minute < 15):
            target = now - timedelta(days=(3 if now.weekday() == 0 else 1))
        else:
            target = now
        return target.strftime("%Y-%m-%d")

    # 2. Check SQLite local database (ONLY FOR DAILY INTERVAL '1d')
    db_df = None
    if not is_intraday:
        db_df = get_historical_prices(ticker, fromdate_str, todate_str)
        if db_df is not None and not db_df.empty:
            latest_db_date_str = str(db_df["date"].max())[:10]
            expected_date_str = _expected_latest_trading_day()
            is_up_to_date = latest_db_date_str >= expected_date_str
            expected_trading_days = int(days * (5/7))
            if is_up_to_date and len(db_df) >= expected_trading_days * 0.8:
                db_df.attrs["data_source"] = "sqlite"
                _set_cached(cache_key, db_df)
                return db_df

    # 3. Fetch from Angel One (if session available)
    ensure_session()
    if _session_active and token_info and token_info.get("token"):
        interval_map = {
            "1m": "ONE_MINUTE", "5m": "FIVE_MINUTE", "15m": "FIFTEEN_MINUTE",
            "1h": "ONE_HOUR",   "1d": "ONE_DAY",
        }
        api_interval = interval_map.get(interval.lower(), "ONE_DAY")
        max_days = 30 if is_intraday else 365
        api_fromdate = todate - timedelta(days=min(days, max_days))

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

            if is_intraday:
                df["date"] = pd.to_datetime(df["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d %H:%M:%S")
                df = df.dropna(subset=["date", "open", "high", "low", "close"]).sort_values("date")
                _set_cached(cache_key, df)
                return df
            else:
                df["date"] = pd.to_datetime(df["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d")
                df = df.dropna(subset=["date", "open", "high", "low", "close"]).sort_values("date")

                # Save daily records to local SQLite database (UPSERT)
                save_historical_prices(ticker, df)

                merged_df = get_historical_prices(ticker, fromdate_str, todate_str)
                final_df = merged_df if (merged_df is not None and not merged_df.empty) else df
                final_df.attrs["data_source"] = "angel_one"
                _set_cached(cache_key, final_df)
                return final_df

    # 4. Fallback: If Angel One API unavailable / missing data, use Yahoo Finance for daily candles
    if not is_intraday:
        try:
            import yfinance as yf
            YF_ALIAS_MAP = {
                "HUL": "HINDUNILVR.NS",
                "M&M": "M&M.NS",
                "TATAMTRDVR": "TATAMOTORS-DVR.NS",
                "TATAMOTORS": "TATAMOTORS.NS",
                "NIFTY50": "^NSEI",
                "NIFTY": "^NSEI",
                "NIFTY 50": "^NSEI",
                "SENSEX": "^BSESN",
                "BANKNIFTY": "^NSEBANK",
                "BANK NIFTY": "^NSEBANK",
                "INDIAVIX": "^INDIAVIX",
                "INDIA VIX": "^INDIAVIX",
                "USDINR": "USDINR=X",
                "USD / INR": "USDINR=X",
                "BRENT CRUDE": "BZ=F",
            }
            yf_ticker = YF_ALIAS_MAP.get(ticker, f"{ticker}.NS" if not ticker.endswith(".NS") else ticker)
            yf_period = "1y" if period.upper() in ["1Y", "370D", "200D", "6M"] else ("5y" if period.upper() == "5Y" else "6mo")
            yf_data = yf.download(yf_ticker, period=yf_period, interval="1d", progress=False, auto_adjust=True)
            if yf_data is not None and not yf_data.empty:
                yf_df = yf_data.reset_index()
                if isinstance(yf_df.columns, pd.MultiIndex):
                    yf_df.columns = [c[0].lower() for c in yf_df.columns]
                else:
                    yf_df.columns = [str(c).lower() for c in yf_df.columns]

                date_col = "date" if "date" in yf_df.columns else "datetime"
                yf_df = yf_df.rename(columns={date_col: "date"})
                yf_df["date"] = pd.to_datetime(yf_df["date"]).dt.strftime("%Y-%m-%d")
                yf_df = yf_df[["date", "open", "high", "low", "close", "volume"]].dropna()
                if not yf_df.empty:
                    save_historical_prices(ticker, yf_df)
                    _set_cached(cache_key, yf_df)
                    logger.info("Fallback: Stored %d Yahoo Finance records in SQLite for %s.", len(yf_df), ticker)
                    return yf_df
        except Exception as e:
            logger.warning("Yahoo Finance fallback failed for %s: %s", ticker, e)

    # Fallback to local database
    if db_df is not None and not db_df.empty:
        logger.warning("Returning existing SQLite data for %s.", ticker)
        return db_df

    logger.error("Failed to fetch history for %s", ticker)
    return None



# ── fetch_company_info ──

def fetch_company_info(ticker: str) -> Optional[dict]:
    """
    Fetches real-time LTP, daily stats, and 52-week data.
    Results are cached in SQLite for 5 minutes and survive server restarts.
    Falls back to SQLite historical prices when broker is unavailable.
    """
    ensure_session()
    ticker = ticker.upper().strip()

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

    # 2. Check SQLite Historical Prices table for latest close and 52W High/Low
    try:
        with get_db_connection() as conn:
            # 52-week range from SQLite
            from_52w = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
            row_52w = conn.execute(
                "SELECT MAX(high) as max_h, MIN(low) as min_l FROM historical_prices WHERE ticker = ? AND date >= ?",
                (ticker, from_52w)
            ).fetchone()
            if row_52w and row_52w["max_h"]:
                fifty_two_week_high = float(row_52w["max_h"])
                fifty_two_week_low  = float(row_52w["min_l"])

            # If current price still 0, get latest close from DB
            if current_price == 0.0:
                last_row = conn.execute(
                    "SELECT close, open, high, low, volume FROM historical_prices WHERE ticker = ? ORDER BY date DESC LIMIT 1",
                    (ticker,)
                ).fetchone()
                if last_row:
                    current_price = float(last_row["close"])
                    prev_close = float(last_row["close"])
                    day_high = float(last_row["high"])
                    day_low = float(last_row["low"])
                    open_price = float(last_row["open"])
                    volume = int(last_row["volume"] or 0)
    except Exception:
        pass

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
        fifty_two_week_high = round(current_price * 1.15, 2)
        fifty_two_week_low = round(current_price * 0.85, 2)

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

def get_combined_stock_data(ticker: str, period: str = "2Y") -> Optional[pd.DataFrame]:
    """
    Returns the most complete and current OHLCV DataFrame for a ticker by:
      1. Fetching historical data from DB / Angel One API (fetch_stock_data)
      2. Appending today's live tick data as a synthetic OHLCV candle if available
         (or updating today's candle if it already exists in history)

    This ensures prediction models always see today's price action even before
    the official end-of-day candle is available.
    """
    ticker = ticker.upper()

    # Step 1: Get base historical data
    df = fetch_stock_data(ticker, period=period, interval="1d")
    if df is None or df.empty:
        return None
    # The live-candle merge below is request-specific.
    df = df.copy(deep=True)

    # Step 2: Check live ticks only on trading days (IST)
    now = datetime.now(_IST)
    if now.weekday() >= 5:  # Saturday = 5, Sunday = 6
        return df

    today_candle = get_live_tick_ohlcv(ticker)
    if today_candle is None:
        return df  # No live ticks yet — return historical as-is

    today_str = today_candle["date"]

    # Step 3: Replace today's candle if it exists, otherwise append if during/after market hours (IST >= 09:00)
    if today_str in df["date"].values:
        idx = df.index[df["date"] == today_str][0]
        # Update close with latest live price; keep historical open; extend high/low
        df.at[idx, "close"]  = today_candle["close"]
        df.at[idx, "high"]   = max(float(df.at[idx, "high"]), today_candle["high"])
        df.at[idx, "low"]    = min(float(df.at[idx, "low"]),  today_candle["low"])
    elif now.hour >= 9:
        # Append as a new row for current session
        new_row = pd.DataFrame([today_candle])
        df = pd.concat([df, new_row], ignore_index=True)

    logger.info("Combined data for %s: %d rows (historical + live tick for %s)", ticker, len(df), today_str)
    return df


def backfill_5y_history(ticker: str) -> Optional[pd.DataFrame]:
    """
    Downloads 5 years of daily historical OHLCV data for a ticker
    using Angel One SmartAPI in 1-year chunks and bulk saves into SQLite DB.
    """
    ticker = ticker.upper().strip()
    logger.info("Fetching 5-year historical data via Angel One SmartAPI for %s...", ticker)

    todate = datetime.now()
    fromdate = todate - timedelta(days=1825)
    fromdate_str = fromdate.strftime("%Y-%m-%d")
    todate_str   = todate.strftime("%Y-%m-%d")

    # Check if DB already has 5Y history (> 1000 records)
    existing_df = get_historical_prices(ticker, fromdate_str, todate_str)
    if existing_df is not None and len(existing_df) >= 1000:
        logger.info("Found existing %d 5-year records in SQLite DB for %s.", len(existing_df), ticker)
        return existing_df

    token_info = get_token_info(ticker)
    if not token_info:
        logger.error("Token not found for '%s'.", ticker)
        return existing_df

    ensure_session()
    if not _session_active or not smartApi:
        logger.warning("Angel One session inactive — returning current DB history for %s.", ticker)
        return existing_df

    # Chunk 5 years into 365-day blocks (Angel One max per request)
    all_chunks = []
    chunk_end = todate

    for i in range(5):
        chunk_start = chunk_end - timedelta(days=365)
        if chunk_start < fromdate:
            chunk_start = fromdate

        historicParam = {
            "exchange":    token_info["exch_seg"],
            "symboltoken": token_info["token"],
            "interval":    "ONE_DAY",
            "fromdate":    chunk_start.strftime("%Y-%m-%d 00:00"),
            "todate":      chunk_end.strftime("%Y-%m-%d 23:59"),
        }

        try:
            response = _call_api(smartApi.getCandleData, historicParam)
            if response and response.get("status") and response.get("data"):
                cdf = pd.DataFrame(
                    response["data"],
                    columns=["date", "open", "high", "low", "close", "volume"]
                )
                cdf = cdf.astype({"open": float, "high": float, "low": float, "close": float, "volume": int})
                cdf["date"] = pd.to_datetime(cdf["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d")
                all_chunks.append(cdf)
        except Exception as e:
            logger.warning("Chunk fetch error (%s to %s): %s", chunk_start, chunk_end, e)

        chunk_end = chunk_start - timedelta(days=1)
        if chunk_end <= fromdate:
            break

    if all_chunks:
        merged = pd.concat(all_chunks, ignore_index=True)
        merged = merged.drop_duplicates(subset=["date"]).sort_values("date")
        clean_df = merged[["date", "open", "high", "low", "close", "volume"]].dropna()

        if not clean_df.empty:
            from backend.data.database import clear_ticker_history
            clear_ticker_history(ticker)
            save_historical_prices(ticker, clean_df)
            logger.info("Stored %d 5-year Angel One records in SQLite for %s.", len(clean_df), ticker)
            return clean_df

    return existing_df
