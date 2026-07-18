import yfinance as yf
import pandas as pd
import time
from typing import Optional
from datetime import datetime, timedelta

# ── Simple TTL In-Memory Cache ──
# Stores (data, expiry_time) pairs to avoid hitting Yahoo Finance too frequently
_cache: dict = {}
CACHE_TTL_SECONDS = 120  # Cache data for 2 minutes

def _get_cached(key: str):
    """Returns cached value if not expired, else None."""
    if key in _cache:
        data, expiry = _cache[key]
        if datetime.now() < expiry:
            return data
        else:
            del _cache[key]
    return None

def _set_cached(key: str, data):
    """Stores data in cache with TTL expiry."""
    _cache[key] = (data, datetime.now() + timedelta(seconds=CACHE_TTL_SECONDS))

def fetch_stock_data(ticker: str, period: str = "2y", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Fetches historical OHLCV data for a given ticker from Yahoo Finance.
    Results are cached for 2 minutes to prevent rate limiting.
    """
    cache_key = f"hist_{ticker}_{period}_{interval}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached
    
    try:
        time.sleep(0.3)  # Small delay to avoid rate limiting
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval)
        if df.empty:
            return None
        
        # Clean index and column names
        df.reset_index(inplace=True)
        # Ensure consistent column names
        df.rename(columns={
            "Date": "date",
            "Datetime": "date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume"
        }, inplace=True)
        
        # Keep only required columns
        required_cols = ["date", "open", "high", "low", "close", "volume"]
        df = df[[c for c in required_cols if c in df.columns]]
        
        # Convert date to string format for JSON serialization
        if "date" in df.columns:
            df["date"] = df["date"].dt.strftime("%Y-%m-%d")

        _set_cached(cache_key, df)
        return df
    except Exception as e:
        print(f"Error fetching data for {ticker}: {str(e)}")
        return None

def fetch_company_info(ticker: str) -> Optional[dict]:
    """
    Fetches company metadata from Yahoo Finance.
    Results are cached for 2 minutes to prevent rate limiting.
    """
    cache_key = f"info_{ticker}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        time.sleep(0.3)  # Small delay to avoid rate limiting
        stock = yf.Ticker(ticker)
        info = stock.info
        
        return {
            "name": info.get("longName", ticker),
            "sector": info.get("sector", "unknown").lower(),
            "industry": info.get("industry", "unknown"),
            "exchange": info.get("exchange", "unknown"),
            "currency": info.get("currency", "USD"),
            "market_cap": info.get("marketCap", 0),
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice") or 0.0,
            "day_high": info.get("dayHigh") or 0.0,
            "day_low": info.get("dayLow") or 0.0,
            "open": info.get("open") or 0.0,
            "previous_close": info.get("previousClose") or 0.0,
            "volume": info.get("volume") or 0,
            "fifty_two_week_low": info.get("fiftyTwoWeekLow") or 0.0,
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh") or 0.0,
        }
    except Exception as e:
        print(f"Error fetching info for {ticker}: {str(e)}")
        return None
