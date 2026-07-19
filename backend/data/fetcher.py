import os
import time
import requests
import pyotp
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from SmartApi import SmartConnect

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
            if item.get("exch_seg") == "NSE" and item.get("instrumenttype", "") == "":
                _scrip_map[item["symbol"]] = item
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


# ── Simple TTL In-Memory Cache ──
_cache: dict = {}
CACHE_TTL_SECONDS = 120  # 2 minutes

def _get_cached(key: str):
    if key in _cache:
        data, expiry = _cache[key]
        if datetime.now() < expiry:
            return data
        del _cache[key]
    return None

def _get_stale(key: str):
    """Returns cached data even if expired (used as fallback when API is unavailable)."""
    if key in _cache:
        data, _ = _cache[key]
        return data
    return None

def _set_cached(key: str, data):
    _cache[key] = (data, datetime.now() + timedelta(seconds=CACHE_TTL_SECONDS))


# ── fetch_stock_data ──

def fetch_stock_data(ticker: str, period: str = "1Y", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Fetches historical OHLCV data from Angel One SmartAPI.
    Returns a DataFrame: date, open, high, low, close, volume.
    Falls back to stale cache when Angel One is temporarily unavailable.
    """
    ensure_session()
    cache_key = f"hist_{ticker}_{period}_{interval}"

    if not _session_active:
        # Return stale cache data as fallback
        stale = _get_stale(cache_key)
        if stale is not None:
            print(f"⚠️  Using stale cache for {ticker} history (Angel One unavailable).")
            return stale
        return None

    fresh = _get_cached(cache_key)
    if fresh is not None:
        return fresh

    token_info = get_token_info(ticker)
    if not token_info:
        print(f"❌ Token not found for '{ticker}'. Is it a valid NSE equity symbol?")
        return None

    interval_map = {
        "1m": "ONE_MINUTE", "5m": "FIVE_MINUTE", "15m": "FIFTEEN_MINUTE",
        "1h": "ONE_HOUR",   "1d": "ONE_DAY",
    }
    api_interval = interval_map.get(interval.lower(), "ONE_DAY")

    period_map = {
        "10D": 10, "1W": 7,   "45D": 45,  "1M": 30,  "120D": 120,
        "3M":  90, "200D": 200, "6M": 180, "370D": 370,
        "1Y":  365, "2Y": 365,
    }
    days     = period_map.get(period.upper(), 120)
    todate   = datetime.now()
    fromdate = todate - timedelta(days=days)

    historicParam = {
        "exchange":    token_info["exch_seg"],
        "symboltoken": token_info["token"],
        "interval":    api_interval,
        "fromdate":    fromdate.strftime("%Y-%m-%d %H:%M"),
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
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        _set_cached(cache_key, df)
        return df

    # API returned no data — try stale cache before giving up
    stale = _get_stale(cache_key)
    if stale is not None:
        print(f"⚠️  Returning stale cache for {ticker} history (market may be closed).")
        return stale

    msg = response.get("message", "Unknown error") if response else "No response from Angel One"
    print(f"❌ Failed to fetch history for {ticker}: {msg}")
    return None


# ── fetch_company_info ──

def fetch_company_info(ticker: str) -> Optional[dict]:
    """
    Fetches real-time LTP, daily stats, and 52-week data from Angel One SmartAPI.
    Falls back to stale cache when Angel One is temporarily unavailable.
    """
    ensure_session()
    cache_key = f"info_{ticker}"

    if not _session_active:
        stale = _get_stale(cache_key)
        if stale is not None:
            print(f"⚠️  Using stale cache for {ticker} info (Angel One unavailable).")
            return stale
        return None

    fresh = _get_cached(cache_key)
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
        stale = _get_stale(cache_key)
        if stale:
            print(f"⚠️  Using stale cache for {ticker} LTP.")
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
    _set_cached(cache_key, info)
    return info
