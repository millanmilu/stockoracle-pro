import os
import json
import time
import requests
import pyotp
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Dict
from SmartApi import SmartConnect

# ── API & Authentication Setup ──
ANGEL_API_KEY    = os.getenv("ANGEL_API_KEY",    "")
ANGEL_CLIENT_ID  = os.getenv("ANGEL_CLIENT_ID",  "")
ANGEL_PASSWORD   = os.getenv("ANGEL_PASSWORD",   "")
ANGEL_TOTP_SECRET = os.getenv("ANGEL_TOTP_SECRET", "")

# Initialize SmartConnect if API key is present
smartApi: Optional[SmartConnect] = SmartConnect(api_key=ANGEL_API_KEY) if ANGEL_API_KEY else None
_session_active = False

def ensure_session():
    """Authenticates with Angel One SmartAPI using TOTP. Idempotent — safe to call multiple times."""
    global _session_active
    if _session_active:
        return
    if not smartApi:
        print("Angel One SmartAPI not initialized: ANGEL_API_KEY is missing.")
        return
    if not (ANGEL_CLIENT_ID and ANGEL_PASSWORD and ANGEL_TOTP_SECRET):
        print("Angel One credentials incomplete. Check ANGEL_CLIENT_ID / ANGEL_PASSWORD / ANGEL_TOTP_SECRET in .env")
        return
    try:
        totp = pyotp.TOTP(ANGEL_TOTP_SECRET).now()
        data = smartApi.generateSession(ANGEL_CLIENT_ID, ANGEL_PASSWORD, totp)
        if data and data.get("status"):
            _session_active = True
            print("✅ Angel One SmartAPI login successful.")
        else:
            print(f"❌ Angel One login failed: {data.get('message') if data else 'No response'}")
    except Exception as e:
        print(f"Error during Angel One login: {e}")

# ── ScripMaster Token Mapping ──
# Angel One requires numeric symbol tokens instead of plain ticker strings.
SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
_scrip_map: Dict[str, dict] = {}

def _load_scrip_master():
    """Downloads the ScripMaster JSON and builds a lookup map for NSE equity symbols."""
    global _scrip_map
    if _scrip_map:
        return
    print("Downloading Angel One ScripMaster …")
    try:
        response = requests.get(SCRIP_MASTER_URL, timeout=30)
        data = response.json()
        for item in data:
            # Only NSE equity instruments (instrumenttype == '' for EQ series)
            if item.get("exch_seg") == "NSE" and item.get("instrumenttype", "") == "":
                _scrip_map[item["symbol"]] = item
        print(f"✅ ScripMaster loaded — {len(_scrip_map)} NSE equity symbols indexed.")
    except Exception as e:
        print(f"Error downloading ScripMaster: {e}")

def get_token_info(ticker: str) -> Optional[dict]:
    """
    Returns the ScripMaster record for a given ticker.
    Accepts both 'RELIANCE' and 'RELIANCE-EQ' forms.
    """
    _load_scrip_master()
    key = ticker if ticker.endswith("-EQ") else f"{ticker}-EQ"
    return _scrip_map.get(key)

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

def _set_cached(key: str, data):
    _cache[key] = (data, datetime.now() + timedelta(seconds=CACHE_TTL_SECONDS))


# ── fetch_stock_data ──

def fetch_stock_data(ticker: str, period: str = "1Y", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Fetches historical OHLCV data from Angel One SmartAPI.
    Returns a DataFrame with columns: date, open, high, low, close, volume.
    Results are cached for 2 minutes.
    """
    ensure_session()
    if not _session_active:
        print("Cannot fetch stock data: Not logged into Angel One.")
        return None

    cache_key = f"hist_{ticker}_{period}_{interval}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    token_info = get_token_info(ticker)
    if not token_info:
        print(f"Token not found for {ticker}. Check ScripMaster.")
        return None

    # Map interval
    interval_map = {
        "1m":  "ONE_MINUTE",
        "5m":  "FIVE_MINUTE",
        "15m": "FIFTEEN_MINUTE",
        "1h":  "ONE_HOUR",
        "1d":  "ONE_DAY",
    }
    api_interval = interval_map.get(interval.lower(), "ONE_DAY")

    # Map period to date range
    todate = datetime.now()
    period_map = {
        "10D": 10, "1W": 7, "45D": 45, "1M": 30, "120D": 120,
        "3M": 90, "200D": 200, "6M": 180, "370D": 370,
        "1Y": 365, "2Y": 365  # Angel One free tier allows up to 1 year
    }
    days = period_map.get(period.upper(), 120)
    fromdate = todate - timedelta(days=days)

    historicParam = {
        "exchange":    token_info["exch_seg"],
        "symboltoken": token_info["token"],
        "interval":    api_interval,
        "fromdate":    fromdate.strftime("%Y-%m-%d %H:%M"),
        "todate":      todate.strftime("%Y-%m-%d %H:%M"),
    }

    try:
        response = smartApi.getCandleData(historicParam)
        if response and response.get("status") and response.get("data"):
            # format: [timestamp, open, high, low, close, volume]
            df = pd.DataFrame(
                response["data"],
                columns=["date", "open", "high", "low", "close", "volume"]
            )
            df = df.astype({"open": float, "high": float, "low": float,
                            "close": float, "volume": int})
            df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            _set_cached(cache_key, df)
            return df
        else:
            msg = response.get("message", "Unknown Error") if response else "No response"
            print(f"Failed to fetch data for {ticker}: {msg}")
            return None
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        return None


# ── fetch_company_info ──

def fetch_company_info(ticker: str) -> Optional[dict]:
    """
    Fetches company metadata and live price stats from Angel One SmartAPI.
    Computes 52-week high/low and last-session volume from 1-year daily candles.
    Results are cached for 2 minutes.
    """
    ensure_session()
    if not _session_active:
        print("Cannot fetch company info: Not logged into Angel One.")
        return None

    cache_key = f"info_{ticker}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    token_info = get_token_info(ticker)
    if not token_info:
        return None

    try:
        # 1. Real-time LTP data
        ltp_response = smartApi.ltpData(
            token_info["exch_seg"],
            token_info["symbol"],
            token_info["token"]
        )
        if not (ltp_response and ltp_response.get("status") and ltp_response.get("data")):
            return None

        ltp_data = ltp_response["data"]
        current_price = float(ltp_data.get("ltp", 0.0))
        open_price    = float(ltp_data.get("open", 0.0))
        day_high      = float(ltp_data.get("high", 0.0))
        day_low       = float(ltp_data.get("low", 0.0))
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
        hist_response = smartApi.getCandleData(hist_param)
        if hist_response and hist_response.get("status") and hist_response.get("data"):
            candles = hist_response["data"]  # [timestamp, open, high, low, close, volume]
            highs   = [float(c[2]) for c in candles]
            lows    = [float(c[3]) for c in candles]
            volumes = [int(c[5])   for c in candles]
            fifty_two_week_high = max(highs) if highs else 0.0
            fifty_two_week_low  = min(lows)  if lows  else 0.0
            volume              = volumes[-1] if volumes else 0

        info = {
            "name":               token_info.get("name", ticker),
            "sector":             "Indian Equities",
            "industry":           token_info.get("exch_seg", "NSE"),
            "exchange":           token_info.get("exch_seg", "NSE"),
            "currency":           "INR",
            "market_cap":         0,        # Not available via free SmartAPI tier
            "current_price":      current_price,
            "day_high":           day_high,
            "day_low":            day_low,
            "open":               open_price,
            "previous_close":     prev_close,
            "volume":             volume,
            "fifty_two_week_low": fifty_two_week_low,
            "fifty_two_week_high": fifty_two_week_high,
        }
        _set_cached(cache_key, info)
        return info
    except Exception as e:
        print(f"Error fetching info for {ticker}: {e}")
        return None
