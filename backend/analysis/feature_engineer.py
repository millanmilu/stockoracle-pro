import pandas as pd
import numpy as np
from functools import lru_cache
from datetime import datetime, timedelta
from backend.data.fetcher import fetch_stock_data
from backend.analysis.sentiment import fetch_and_score_sentiment

import time
from functools import wraps

def ttl_cache(ttl_seconds):
    cache = {}
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = str(args) + str(kwargs)
            if key in cache:
                result, timestamp = cache[key]
                if time.time() - timestamp < ttl_seconds:
                    return result.copy() if isinstance(result, pd.DataFrame) else result
            result = func(*args, **kwargs)
            cache[key] = (result.copy() if isinstance(result, pd.DataFrame) else result, time.time())
            return result
        return wrapper
    return decorator

@ttl_cache(ttl_seconds=300)
def get_features(symbol: str, end_date: str = None) -> pd.DataFrame:
    """
    Fetches historical OHLCV data, computes 25 features (OHLCV + 20 engineered),
    and caches the result for fast access.
    """
    if end_date is None:
        end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.strptime(end_date, '%Y-%m-%d') - timedelta(days=365*2)).strftime('%Y-%m-%d')
    
    # Fetch historical data (which should hit the DB cache)
    df = fetch_stock_data(symbol, period="2Y")
    if df is None or df.empty:
        return pd.DataFrame()
        
    df = df.copy()
    
    # Ensure datetime index safely parsing mixed formats (daily & intraday timestamps)
    df['date'] = pd.to_datetime(df['date'], format='mixed', errors='coerce')
    df = df.sort_values('date').set_index('date')
    
    # Base 5 Features: open, high, low, close, volume
    # (assuming they exist in the df)
    
    # 1. RSI (14-day)
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=14, min_periods=1).mean()
    avg_loss = loss.rolling(window=14, min_periods=1).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    df['rsi_14'] = 100 - (100 / (1 + rs))
    
    # 2. MACD (12, 26, 9) (Returning MACD Line only to keep feature count to 25 with OHLCV)
    ema_12 = df['close'].ewm(span=12, adjust=False).mean()
    ema_26 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = ema_12 - ema_26
    
    # 3. ATR (14)
    high_low = df['high'] - df['low']
    high_close = (df['high'] - df['close'].shift()).abs()
    low_close = (df['low'] - df['close'].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df['atr_14'] = tr.rolling(window=14, min_periods=1).mean()
    
    # 4. Bollinger %B (20, 2)
    rolling_mean_20 = df['close'].rolling(window=20, min_periods=1).mean()
    rolling_std_20 = df['close'].rolling(window=20, min_periods=1).std()
    upper_band = rolling_mean_20 + (rolling_std_20 * 2)
    lower_band = rolling_mean_20 - (rolling_std_20 * 2)
    df['bb_pct_b'] = (df['close'] - lower_band) / (upper_band - lower_band + 1e-9)
    
    # 5-8. Rolling means (5, 10, 20, 50)
    df['roll_mean_5'] = df['close'].rolling(window=5, min_periods=1).mean()
    df['roll_mean_10'] = df['close'].rolling(window=10, min_periods=1).mean()
    df['roll_mean_20'] = rolling_mean_20
    df['roll_mean_50'] = df['close'].rolling(window=50, min_periods=1).mean()
    
    # 9-11. Rolling stds (5, 10, 20)
    df['roll_std_5'] = df['close'].rolling(window=5, min_periods=1).std().fillna(0)
    df['roll_std_10'] = df['close'].rolling(window=10, min_periods=1).std().fillna(0)
    df['roll_std_20'] = rolling_std_20.fillna(0)
    
    # 12-16. Lagged closing prices (t-1, t-2, t-3, t-4, t-5)
    df['lag_1'] = df['close'].shift(1)
    df['lag_2'] = df['close'].shift(2)
    df['lag_3'] = df['close'].shift(3)
    df['lag_4'] = df['close'].shift(4)
    df['lag_5'] = df['close'].shift(5)
    
    # 17-18. Price rate of change (1-day, 5-day)
    df['roc_1'] = df['close'].pct_change(1) * 100
    df['roc_5'] = df['close'].pct_change(5) * 100
    
    # 19-20. Day-of-week sin/cos encoding
    day_of_week = df.index.dayofweek
    df['dow_sin'] = np.sin(2 * np.pi * day_of_week / 7)
    df['dow_cos'] = np.cos(2 * np.pi * day_of_week / 7)
    
    # We now have 5 (OHLCV) + 20 (Engineered) = 25 Features.
    
    try:
        sentiment_score = fetch_and_score_sentiment(symbol)
    except Exception as exc:
        sentiment_score = 0.0
        print(f"⚠️ Sentiment fetch failed for {symbol}: {exc}")
    df['sentiment'] = sentiment_score
    
    # Drop rows with NaNs caused by lagging/rolling (mainly first 50 days)
    df = df.dropna()
    
    return df
