import pandas as pd
import numpy as np
from typing import Dict, Any

def calculate_sma(series: pd.Series, period: int = 20) -> pd.Series:
    return series.rolling(window=period).mean()

def calculate_ema(series: pd.Series, period: int = 12) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-9)
    return 100 - (100 / (1 + rs))

def calculate_macd(series: pd.Series) -> Dict[str, pd.Series]:
    ema12 = calculate_ema(series, 12)
    ema26 = calculate_ema(series, 26)
    macd_line = ema12 - ema26
    signal_line = calculate_ema(macd_line, 9)
    macd_hist = macd_line - signal_line
    return {
        "macd": macd_line,
        "signal": signal_line,
        "hist": macd_hist
    }

def calculate_bollinger_bands(series: pd.Series, period: int = 20) -> Dict[str, pd.Series]:
    sma = calculate_sma(series, period)
    std = series.rolling(window=period).std()
    upper = sma + (2 * std)
    lower = sma - (2 * std)
    pct_b = (series - lower) / (upper - lower + 1e-9)
    return {
        "upper": upper,
        "middle": sma,
        "lower": lower,
        "pct_b": pct_b
    }

def calculate_volatility(series: pd.Series, period: int = 20) -> pd.Series:
    returns = np.log(series / series.shift(1))
    return returns.rolling(window=period).std()

def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"]
    low = df["low"]
    close_prev = df["close"].shift(1)
    
    tr1 = high - low
    tr2 = (high - close_prev).abs()
    tr3 = (low - close_prev).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def calculate_adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"]
    low = df["low"]
    close = df["close"]
    
    upmove = high.diff()
    downmove = low.shift(1) - low
    
    pos_dm = np.where((upmove > downmove) & (upmove > 0), upmove, 0.0)
    neg_dm = np.where((downmove > upmove) & (downmove > 0), downmove, 0.0)
    
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # Smooth indicators using wilder's rolling sum technique
    tr_smooth = tr.rolling(window=period).sum()
    pos_dm_smooth = pd.Series(pos_dm).rolling(window=period).sum()
    neg_dm_smooth = pd.Series(neg_dm).rolling(window=period).sum()
    
    plus_di = 100 * (pos_dm_smooth / (tr_smooth + 1e-9))
    minus_di = 100 * (neg_dm_smooth / (tr_smooth + 1e-9))
    
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9)
    adx = dx.rolling(window=period).mean()
    return adx

def calculate_pivot_points(df: pd.DataFrame) -> Dict[str, pd.Series]:
    # Pivot points are based on previous day's metrics
    high_prev = df["high"].shift(1)
    low_prev = df["low"].shift(1)
    close_prev = df["close"].shift(1)
    
    pivot = (high_prev + low_prev + close_prev) / 3.0
    r1 = (2.0 * pivot) - low_prev
    s1 = (2.0 * pivot) - high_prev
    r2 = pivot + (high_prev - low_prev)
    s2 = pivot - (high_prev - low_prev)
    
    return {"pivot": pivot, "r1": r1, "s1": s1, "r2": r2, "s2": s2}

def calculate_fibonacci_levels(df: pd.DataFrame, period: int = 50) -> Dict[str, pd.Series]:
    high_roll = df["high"].rolling(window=period).max()
    low_roll = df["low"].rolling(window=period).min()
    diff = high_roll - low_roll
    
    return {
        "fib_236": high_roll - 0.236 * diff,
        "fib_382": high_roll - 0.382 * diff,
        "fib_500": high_roll - 0.500 * diff,
        "fib_618": high_roll - 0.618 * diff
    }

def detect_candlestick_patterns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    o, h, l, c = df["open"], df["high"], df["low"], df["close"]
    
    body = (c - o).abs()
    candle_range = h - l
    body_avg = body.rolling(window=10).mean()
    
    # 1. Doji (extremely small body compared to full range)
    df["pattern_doji"] = (body <= 0.1 * candle_range)
    
    # 2. Hammer (long lower shadow, tiny upper shadow, occurs after downtrend)
    lower_shadow = np.minimum(o, c) - l
    upper_shadow = h - np.maximum(o, c)
    df["pattern_hammer"] = (
        (lower_shadow >= 2 * body) & 
        (upper_shadow <= 0.2 * body) & 
        (c > l + 0.6 * candle_range)
    )
    
    # 3. Shooting Star (long upper shadow, tiny lower shadow, occurs after uptrend)
    df["pattern_shooting_star"] = (
        (upper_shadow >= 2 * body) & 
        (lower_shadow <= 0.2 * body) & 
        (c < l + 0.4 * candle_range)
    )
    
    # 4. Bullish Engulfing
    df["pattern_bullish_engulfing"] = (
        (c.shift(1) < o.shift(1)) & 
        (c > o) & 
        (c >= o.shift(1)) & 
        (o <= c.shift(1))
    )
    
    # 5. Bearish Engulfing
    df["pattern_bearish_engulfing"] = (
        (c.shift(1) > o.shift(1)) & 
        (c < o) & 
        (c <= o.shift(1)) & 
        (o >= c.shift(1))
    )
    
    # 6. Morning Star (three-candle pattern)
    df["pattern_morning_star"] = (
        (c.shift(2) < o.shift(2)) & # Bearish candle
        (body.shift(1) < body_avg.shift(1) * 0.5) & # Star (small body)
        (c.shift(1) < c.shift(2)) & # Gaps down
        (c > o) & # Bullish reversal candle
        (c > (o.shift(2) + c.shift(2)) / 2) # Closes inside body of first candle
    )
    
    # 7. Evening Star (three-candle pattern)
    df["pattern_evening_star"] = (
        (c.shift(2) > o.shift(2)) & # Bullish candle
        (body.shift(1) < body_avg.shift(1) * 0.5) & # Star (small body)
        (c.shift(1) > c.shift(2)) & # Gaps up
        (c < o) & # Bearish reversal candle
        (c < (o.shift(2) + c.shift(2)) / 2) # Closes inside body of first candle
    )
    
    # 8. Harami
    df["pattern_harami"] = (
        # Bullish Harami
        ((c.shift(1) < o.shift(1)) & (c > o) & (c < o.shift(1)) & (o > c.shift(1))) |
        # Bearish Harami
        ((c.shift(1) > o.shift(1)) & (c < o) & (c > o.shift(1)) & (o < c.shift(1)))
    )
    
    # 9. Marubozu (large body, tiny or no shadows)
    df["pattern_marubozu"] = (
        (body >= 0.9 * candle_range) & 
        (body > body_avg * 1.5)
    )
    
    # Fill any NaNs with False
    pattern_cols = [col for col in df.columns if col.startswith("pattern_")]
    df[pattern_cols] = df[pattern_cols].fillna(False)
    
    return df

def enrich_stock_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes all technical indicators and appends them to the dataframe.
    """
    df = df.copy()
    
    # 1. Standard Technical indicators
    df["sma_20"] = calculate_sma(df["close"], 20)
    df["sma_50"] = calculate_sma(df["close"], 50)
    df["ema_12"] = calculate_ema(df["close"], 12)
    df["ema_26"] = calculate_ema(df["close"], 26)
    df["rsi"] = calculate_rsi(df["close"], 14)
    
    macd_data = calculate_macd(df["close"])
    df["macd"] = macd_data["macd"]
    df["macd_signal"] = macd_data["signal"]
    df["macd_hist"] = macd_data["hist"]
    
    bb_data = calculate_bollinger_bands(df["close"], 20)
    df["bb_upper"] = bb_data["upper"]
    df["bb_middle"] = bb_data["middle"]
    df["bb_lower"] = bb_data["lower"]
    df["bb_pct_b"] = bb_data["pct_b"]
    
    df["volatility"] = calculate_volatility(df["close"], 20)
    
    # 2. ATR & ADX indicators
    df["atr"] = calculate_atr(df, 14)
    df["adx"] = calculate_adx(df, 14)
    
    # 3. Pivot Points (Classic)
    pivots = calculate_pivot_points(df)
    df["pivot"] = pivots["pivot"]
    df["r1"] = pivots["r1"]
    df["s1"] = pivots["s1"]
    df["r2"] = pivots["r2"]
    df["s2"] = pivots["s2"]
    
    # 4. Fibonacci Levels
    fibs = calculate_fibonacci_levels(df, 50)
    df["fib_236"] = fibs["fib_236"]
    df["fib_382"] = fibs["fib_382"]
    df["fib_500"] = fibs["fib_500"]
    df["fib_618"] = fibs["fib_618"]
    
    # 5. Candlestick Patterns
    df = detect_candlestick_patterns(df)
    
    # Drop rows containing NaNs arising from rolling windows to keep clean
    df.dropna(subset=["sma_50", "volatility", "rsi", "atr", "adx", "fib_618"], inplace=True)
    return df
