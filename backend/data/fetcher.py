import os
import time
import requests
import pyotp
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from SmartApi import SmartConnect
from backend.data.database import (
    save_historical_prices, get_historical_prices,
    save_company_info, get_company_info, get_stale_company_info,
    get_live_tick_ohlcv, save_stock_universe, search_stock_universe
)

# ── API & Authentication Setup ──
ANGEL_API_KEY     = os.getenv("ANGEL_API_KEY",     "").strip()
ANGEL_CLIENT_ID   = os.getenv("ANGEL_CLIENT_ID",   "").strip()
ANGEL_PASSWORD    = os.getenv("ANGEL_PASSWORD",     "").strip()
ANGEL_TOTP_SECRET = os.getenv("ANGEL_TOTP_SECRET", "").strip()

# Initialize SmartConnect if API key is present
smartApi: Optional[SmartConnect] = SmartConnect(api_key=ANGEL_API_KEY) if ANGEL_API_KEY else None

# Session state — token auto-refreshes every 8 hours
_session_active    = False
_session_expires_at: Optional[datetime] = None
SESSION_REFRESH_HOURS = 8

# Angel One error codes that indicate an expired / invalid session
_AUTH_ERROR_CODES = {"AB1010", "AG8002", "AB1004"}


def get_session_status() -> bool:
    """Returns the current Angel One session status (live value, not a stale import copy)."""
    return _session_active


def reset_session():
    """Force re-authentication on the next API call."""
    global _session_active, _session_expires_at
    _session_active    = False
    _session_expires_at = None


def ensure_session() -> bool:
    """
    Authenticates with Angel One SmartAPI using TOTP.
    Safe to call multiple times — re-authenticates automatically when the
    session is about to expire (SESSION_REFRESH_HOURS threshold).
    Returns True if session is active after the call.
    """
    global _session_active, _session_expires_at

    # Auto-refresh if session is expired
    if _session_active and _session_expires_at and datetime.now() >= _session_expires_at:
        print("⏰ Angel One session expired — refreshing...")
        reset_session()

    if _session_active:
        return True

    if not smartApi:
        print("⚠️  Angel One SmartAPI not initialized: ANGEL_API_KEY is missing.")
        return False

    if not (ANGEL_CLIENT_ID and ANGEL_PASSWORD and ANGEL_TOTP_SECRET):
        print("⚠️  Angel One credentials incomplete. Check .env for ANGEL_CLIENT_ID / ANGEL_PASSWORD / ANGEL_TOTP_SECRET.")
        return False

    try:
        totp = pyotp.TOTP(ANGEL_TOTP_SECRET).now()
        data = smartApi.generateSession(ANGEL_CLIENT_ID, ANGEL_PASSWORD, totp)

        if data and data.get("status"):
            _session_active    = True
            _session_expires_at = datetime.now() + timedelta(hours=SESSION_REFRESH_HOURS)
            print("✅ Angel One SmartAPI login successful.")
            return True
        else:
            msg = data.get("message", "No response") if data else "No response"
            print(f"❌ Angel One login failed: {msg}")
            return False

    except Exception as e:
        print(f"❌ Exception during Angel One login: {e}")
        return False


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
                    print(f"🔄 Auth error detected ({err_code}: {msg}) — re-authenticating...")
                    reset_session()
                    if ensure_session() and attempt < retries:
                        time.sleep(retry_delay)
                        continue

                # Rate-limit error — wait longer before retrying
                if "rate" in msg.lower() or "too many" in msg.lower():
                    print(f"⏳ Rate limit hit — waiting {retry_delay * 2}s before retry...")
                    time.sleep(retry_delay * 2)
                    if attempt < retries:
                        continue

            return result

        except Exception as e:
            err_str = str(e).lower()
            # Network-level errors — retry with backoff
            if attempt < retries:
                wait = retry_delay * (attempt + 1)
                print(f"⚠️  API call failed (attempt {attempt + 1}/{retries + 1}): {e}. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"❌ API call permanently failed after {retries + 1} attempts: {e}")
                return None

    return None


# ── ScripMaster Token Mapping ──
SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
_scrip_map: Dict[str, dict] = {}
_scrip_map_failed = False   # Prevents infinite retry loops on total failure


def _load_scrip_master(force: bool = False):
    """Downloads the ScripMaster JSON and indexes NSE equity symbols."""
    global _scrip_map, _scrip_map_failed

    if _scrip_map:          # Already loaded
        return
    if _scrip_map_failed and not force:
        return              # Already failed, wait for explicit retry

    print("📥 Downloading Angel One ScripMaster …")
    try:
        response = requests.get(SCRIP_MASTER_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        for item in data:
            if item.get("exch_seg") == "NSE" and (not item.get("instrumenttype") or item.get("instrumenttype") in ["", "EQ", "AMX"]):
                _scrip_map[item["symbol"]] = item
        save_stock_universe([
            {
                "ticker": item["symbol"].removesuffix("-EQ"),
                "name": item.get("name") or item["symbol"].removesuffix("-EQ"),
                "symbol": item["symbol"],
                "token": item.get("token", ""),
                "exchange": item.get("exch_seg", "NSE"),
            }
            for item in _scrip_map.values()
        ])
        print(f"✅ ScripMaster loaded — {len(_scrip_map)} NSE equity symbols indexed.")
        _scrip_map_failed = False
    except Exception as e:
        print(f"❌ Error downloading ScripMaster: {e}")
        _scrip_map_failed = True


def get_token_info(ticker: str) -> Optional[dict]:
    """
    Returns the ScripMaster record for a ticker (e.g. 'RELIANCE' or 'RELIANCE-EQ').
    Triggers a one-time ScripMaster download if needed.
    """
    _load_scrip_master()
    key = ticker if ticker.endswith("-EQ") else f"{ticker}-EQ"
    info = _scrip_map.get(key)
    if not info:
        # Try a forced reload once in case ScripMaster was stale
        if _scrip_map_failed:
            _load_scrip_master(force=True)
            info = _scrip_map.get(key)
    return info


def search_nse_stocks(query: str, limit: int = 12) -> list[dict]:
    """Search every locally stored NSE listing by ticker or company name."""
    _load_scrip_master()
    return search_stock_universe(query, limit)


# ── Simple TTL In-Memory Cache ──
_cache: dict = {}
CACHE_TTL_SECONDS = 120  # 2 minutes

def _get_cached(key: str):
    if key in _cache:
        data, expiry = _cache[key]
        if datetime.now() < expiry:
            # DataFrames are mutable; callers must not mutate the cache entry.
            return data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
        del _cache[key]
    return None

def _get_stale(key: str):
    """Returns cached data even if expired (used as fallback when API is unavailable)."""
    if key in _cache:
        data, _ = _cache[key]
        return data
    return None

def _set_cached(key: str, data):
    # Keep an isolated snapshot so request-specific transforms stay local.
    cached_data = data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
    _cache[key] = (cached_data, datetime.now() + timedelta(seconds=CACHE_TTL_SECONDS))


# ── fetch_stock_data ──

def fetch_stock_data(ticker: str, period: str = "1Y", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Fetches historical OHLCV data. 
    First checks the local SQLite database. If data is missing or stale,
    fetches from Angel One SmartAPI, updates the SQLite database, and returns.
    """
    ticker = ticker.upper().strip()
    cache_key = f"hist_{ticker}_{period}_{interval}"

    # 1. Check in-memory fast cache first
    fresh = _get_cached(cache_key)
    if fresh is not None:
        return fresh

    token_info = get_token_info(ticker)
    if not token_info:
        print(f"❌ Token not found for '{ticker}'.")
        return None

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
            return backfilled
    todate = datetime.now()
    fromdate = todate - timedelta(days=days)

    fromdate_str = fromdate.strftime("%Y-%m-%d")
    todate_str = todate.strftime("%Y-%m-%d")

    is_intraday = interval.lower() in ["1m", "5m", "15m", "1h"]

    # 2. Check SQLite local database (ONLY FOR DAILY INTERVAL '1d')
    db_df = None
    if not is_intraday:
        db_df = get_historical_prices(ticker, fromdate_str, todate_str)
        if db_df is not None and not db_df.empty:
            latest_db_date = pd.to_datetime(db_df["date"].max(), format='mixed', errors='coerce')
            is_up_to_date = (todate - latest_db_date).days <= 4
            expected_trading_days = int(days * (5/7))
            if is_up_to_date and len(db_df) >= expected_trading_days * 0.8:
                _set_cached(cache_key, db_df)
                return db_df

    # 3. Fetch from Angel One (database is missing, stale, or intraday request)
    ensure_session()
    if not _session_active:
        # Fallback to whatever stale data we have in SQLite
        if db_df is not None and not db_df.empty:
            print(f"⚠️  Angel One session offline. Returning stale SQLite data for {ticker}.")
            return db_df
        return None

    interval_map = {
        "1m": "ONE_MINUTE", "5m": "FIVE_MINUTE", "15m": "FIFTEEN_MINUTE",
        "1h": "ONE_HOUR",   "1d": "ONE_DAY",
    }
    api_interval = interval_map.get(interval.lower(), "ONE_DAY")

    # Angel One API limits: max 30 days for intraday, max 365 days per call for daily
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
        
        if is_intraday:
            # Intraday data formatted as YYYY-MM-DD HH:MM:SS
            df["date"] = pd.to_datetime(df["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d %H:%M:%S")
            df = df.dropna(subset=["date", "open", "high", "low", "close"]).sort_values("date")
            _set_cached(cache_key, df)
            return df
        else:
            # Daily data formatted strictly as YYYY-MM-DD
            df["date"] = pd.to_datetime(df["date"], format='mixed', errors='coerce').dt.strftime("%Y-%m-%d")
            df = df.dropna(subset=["date", "open", "high", "low", "close"]).sort_values("date")
            
            # Save daily records to local SQLite database (UPSERT)
            save_historical_prices(ticker, df)
            
            # Query again from database to get a complete/merged historical set
            merged_df = get_historical_prices(ticker, fromdate_str, todate_str)
            final_df = merged_df if (merged_df is not None and not merged_df.empty) else df
            
            _set_cached(cache_key, final_df)
            return final_df

    # API request failed — fallback to local database
    if db_df is not None and not db_df.empty:
        print(f"⚠️  Angel One API request failed. Returning stale SQLite data for {ticker}.")
        return db_df

    msg = response.get("message", "Unknown error") if response else "No response"
    print(f"❌ Failed to fetch history for {ticker}: {msg}")
    return None


# ── fetch_company_info ──

def fetch_company_info(ticker: str) -> Optional[dict]:
    """
    Fetches real-time LTP, daily stats, and 52-week data from Angel One SmartAPI.
    Results are cached in SQLite for 5 minutes and survive server restarts.
    Falls back to stale DB cache when Angel One is temporarily unavailable.
    """
    ensure_session()
    ticker = ticker.upper()

    if not _session_active:
        stale = get_stale_company_info(ticker)
        if stale is not None:
            print(f"⚠️  Using stale DB cache for {ticker} info (Angel One unavailable).")
            return stale
        return None

    # Check fresh DB cache
    fresh = get_company_info(ticker)
    if fresh is not None:
        return fresh

    token_info = get_token_info(ticker)
    if not token_info:
        print(f"❌ Token not found for '{ticker}'.")
        return None

    # 1. Real-time LTP
    ltp_response = _call_api(
        smartApi.ltpData,
        token_info["exch_seg"],
        token_info["symbol"],
        token_info["token"]
    )
    if not (ltp_response and ltp_response.get("status") and ltp_response.get("data")):
        stale = get_stale_company_info(ticker)
        if stale:
            print(f"⚠️  Using stale DB cache for {ticker} LTP.")
            return stale
        msg = ltp_response.get("message", "Unknown") if ltp_response else "No response"
        print(f"❌ LTP fetch failed for {ticker}: {msg}")
        return None

    ltp_data      = ltp_response["data"]
    current_price = float(ltp_data.get("ltp",   0.0))
    open_price    = float(ltp_data.get("open",  0.0))
    day_high      = float(ltp_data.get("high",  0.0))
    day_low       = float(ltp_data.get("low",   0.0))
    prev_close    = float(ltp_data.get("close", 0.0))

    # 2. 52-week high/low + last-session volume from 1-year daily candles
    fifty_two_week_high = 0.0
    fifty_two_week_low  = 0.0
    volume = 0

    todate   = datetime.now()
    fromdate = todate - timedelta(days=365)
    hist_param = {
        "exchange":    token_info["exch_seg"],
        "symboltoken": token_info["token"],
        "interval":    "ONE_DAY",
        "fromdate":    fromdate.strftime("%Y-%m-%d %H:%M"),
        "todate":      todate.strftime("%Y-%m-%d %H:%M"),
    }
    hist_resp = _call_api(smartApi.getCandleData, hist_param)
    if hist_resp and hist_resp.get("status") and hist_resp.get("data"):
        candles = hist_resp["data"]
        highs   = [float(c[2]) for c in candles]
        lows    = [float(c[3]) for c in candles]
        volumes = [int(c[5])   for c in candles]
        fifty_two_week_high = max(highs)  if highs   else 0.0
        fifty_two_week_low  = min(lows)   if lows    else 0.0
        volume              = volumes[-1] if volumes else 0

    info = {
        "name":                token_info.get("name", ticker),
        "sector":              "Indian Equities",
        "industry":            token_info.get("exch_seg", "NSE"),
        "exchange":            token_info.get("exch_seg", "NSE"),
        "currency":            "INR",
        "market_cap":          0,       # Not available via free SmartAPI tier
        "current_price":       current_price,
        "day_high":            day_high,
        "day_low":             day_low,
        "open":                open_price,
        "previous_close":      prev_close,
        "volume":              volume,
        "fifty_two_week_low":  fifty_two_week_low,
        "fifty_two_week_high": fifty_two_week_high,
    }
    # Persist to DB (survives server restarts) and in-memory cache
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

    # Step 2: Check live ticks only on trading days
    now = datetime.now()
    if now.weekday() >= 5:  # Saturday = 5, Sunday = 6
        return df

    today_candle = get_live_tick_ohlcv(ticker)
    if today_candle is None:
        return df  # No live ticks yet — return historical as-is

    today_str = today_candle["date"]

    # Step 3: Replace today's candle if it exists, otherwise append if during/after market hours
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

    print(f"📊 Combined data for {ticker}: {len(df)} rows (historical + live tick for {today_str})")
    return df


def backfill_5y_history(ticker: str) -> Optional[pd.DataFrame]:
    """
    Downloads 5 years of daily historical OHLCV data for a ticker
    using Angel One SmartAPI in 1-year chunks and bulk saves into SQLite DB.
    """
    ticker = ticker.upper().strip()
    print(f"📥 Fetching 5-year historical data via Angel One SmartAPI for {ticker}...")

    todate = datetime.now()
    fromdate = todate - timedelta(days=1825)
    fromdate_str = fromdate.strftime("%Y-%m-%d")
    todate_str   = todate.strftime("%Y-%m-%d")

    # Check if DB already has 5Y history (> 1000 records)
    existing_df = get_historical_prices(ticker, fromdate_str, todate_str)
    if existing_df is not None and len(existing_df) >= 1000:
        print(f"✅ Found existing {len(existing_df)} 5-year records in SQLite DB for {ticker}.")
        return existing_df

    token_info = get_token_info(ticker)
    if not token_info:
        print(f"❌ Token not found for '{ticker}'.")
        return existing_df

    ensure_session()
    if not _session_active or not smartApi:
        print(f"⚠️ Angel One session inactive — returning current DB history for {ticker}.")
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
            print(f"⚠️ Chunk fetch error ({chunk_start} to {chunk_end}): {e}")

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
            print(f"✅ Stored {len(clean_df)} 5-year Angel One records in SQLite for {ticker}.")
            return clean_df

    return existing_df
