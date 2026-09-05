import pandas as pd
import numpy as np
from typing import Dict, Any

def calculate_sma(series: pd.Series, period: int = 20) -> pd.Series:
    return series.rolling(window=period, min_periods=1).mean()

def calculate_ema(series: pd.Series, period: int = 12) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=1).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=1).mean()
    rs = gain / (loss + 1e-9)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50.0)

def calculate_macd(series: pd.Series) -> Dict[str, pd.Series]:
    ema12 = calculate_ema(series, 12)
    ema26 = calculate_ema(series, 26)
    macd_line = ema12 - ema26
    signal_line = calculate_ema(macd_line, 9)
    macd_hist = macd_line - signal_line
    return {
        "macd": macd_line.fillna(0.0),
        "signal": signal_line.fillna(0.0),
        "hist": macd_hist.fillna(0.0)
    }

def calculate_bollinger_bands(series: pd.Series, period: int = 20) -> Dict[str, pd.Series]:
    sma = calculate_sma(series, period)
    std = series.rolling(window=period, min_periods=1).std().fillna(0.0)
    upper = sma + (2 * std)
    lower = sma - (2 * std)
    pct_b = (series - lower) / (upper - lower + 1e-9)
    return {
        "upper": upper,
        "middle": sma,
        "lower": lower,
        "pct_b": pct_b.fillna(0.5)
    }

def calculate_volatility(series: pd.Series, period: int = 20) -> pd.Series:
    returns = np.log(series / (series.shift(1).replace(0, np.nan)))
    return returns.rolling(window=period, min_periods=1).std().fillna(0.0)

def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"]
    low = df["low"]
    close_prev = df["close"].shift(1).fillna(df["open"])
    
    tr1 = high - low
    tr2 = (high - close_prev).abs()
    tr3 = (low - close_prev).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period, min_periods=1).mean().fillna(0.0)

def calculate_adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"]
    low = df["low"]
    close = df["close"]
    
    upmove = high.diff().fillna(0.0)
    downmove = (low.shift(1) - low).fillna(0.0)
    
    pos_dm = np.where((upmove > downmove) & (upmove > 0), upmove, 0.0)
    neg_dm = np.where((downmove > upmove) & (downmove > 0), downmove, 0.0)
    
    tr1 = high - low
    tr2 = (high - close.shift(1).fillna(close)).abs()
    tr3 = (low - close.shift(1).fillna(close)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    tr_smooth = tr.rolling(window=period, min_periods=1).sum()
    pos_dm_smooth = pd.Series(pos_dm, index=df.index).rolling(window=period, min_periods=1).sum()
    neg_dm_smooth = pd.Series(neg_dm, index=df.index).rolling(window=period, min_periods=1).sum()
    
    plus_di = 100 * (pos_dm_smooth / (tr_smooth + 1e-9))
    minus_di = 100 * (neg_dm_smooth / (tr_smooth + 1e-9))
    
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9)
    adx = dx.rolling(window=period, min_periods=1).mean()
    return adx.fillna(0.0)

def calculate_pivot_points(df: pd.DataFrame) -> Dict[str, pd.Series]:
    # Pivot points are based on previous day's metrics (or current if first row)
    high_prev = df["high"].shift(1).fillna(df["high"])
    low_prev = df["low"].shift(1).fillna(df["low"])
    close_prev = df["close"].shift(1).fillna(df["close"])
    
    pivot = (high_prev + low_prev + close_prev) / 3.0
    r1 = (2.0 * pivot) - low_prev
    s1 = (2.0 * pivot) - high_prev
    r2 = pivot + (high_prev - low_prev)
    s2 = pivot - (high_prev - low_prev)
    
    return {"pivot": pivot, "r1": r1, "s1": s1, "r2": r2, "s2": s2}

def calculate_fibonacci_levels(df: pd.DataFrame, period: int = 50) -> Dict[str, pd.Series]:
    effective_period = min(period, max(len(df), 1))
    high_roll = df["high"].rolling(window=effective_period, min_periods=1).max()
    low_roll = df["low"].rolling(window=effective_period, min_periods=1).min()
    diff = high_roll - low_roll
    
    return {
        "fib_236": high_roll - 0.236 * diff,
        "fib_382": high_roll - 0.382 * diff,
        "fib_500": high_roll - 0.500 * diff,
        "fib_618": high_roll - 0.618 * diff
    }

def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """Calculates Volume Weighted Average Price (VWAP)."""
    typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
    if "volume" not in df.columns or df["volume"].sum() == 0:
        return typical_price
    cum_vol_price = (typical_price * df["volume"]).cumsum()
    cum_vol = df["volume"].cumsum()
    vwap = cum_vol_price / (cum_vol.replace(0, np.nan))
    return vwap.ffill().bfill().fillna(typical_price)

def calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> Dict[str, pd.Series]:
    """Calculates Supertrend indicator with trend direction (1 = Bullish green, -1 = Bearish red)."""
    atr = calculate_atr(df, period)
    hl2 = (df["high"] + df["low"]) / 2.0
    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)

    n = len(df)
    final_upper = np.zeros(n)
    final_lower = np.zeros(n)
    supertrend = np.zeros(n)
    direction = np.ones(n)

    close_arr = df["close"].to_numpy()
    basic_upper_arr = basic_upper.to_numpy()
    basic_lower_arr = basic_lower.to_numpy()

    for i in range(n):
        if i == 0:
            final_upper[i] = basic_upper_arr[i]
            final_lower[i] = basic_lower_arr[i]
            supertrend[i] = final_lower[i]
            direction[i] = 1
            continue

        if basic_upper_arr[i] < final_upper[i-1] or close_arr[i-1] > final_upper[i-1]:
            final_upper[i] = basic_upper_arr[i]
        else:
            final_upper[i] = final_upper[i-1]

        if basic_lower_arr[i] > final_lower[i-1] or close_arr[i-1] < final_lower[i-1]:
            final_lower[i] = basic_lower_arr[i]
        else:
            final_lower[i] = final_lower[i-1]

        if direction[i-1] == 1:
            if close_arr[i] < final_lower[i]:
                direction[i] = -1
                supertrend[i] = final_upper[i]
            else:
                direction[i] = 1
                supertrend[i] = final_lower[i]
        else:
            if close_arr[i] > final_upper[i]:
                direction[i] = 1
                supertrend[i] = final_lower[i]
            else:
                direction[i] = -1
                supertrend[i] = final_upper[i]

    return {
        "supertrend": pd.Series(supertrend, index=df.index),
        "direction": pd.Series(direction, index=df.index),
    }

def detect_candlestick_patterns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    o, h, l, c = df["open"], df["high"], df["low"], df["close"]
    
    body = (c - o).abs()
    candle_range = (h - l).replace(0, 1e-9)
    body_avg = body.rolling(window=10, min_periods=1).mean()
    
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
        (c.shift(1).fillna(c) < o.shift(1).fillna(o)) & 
        (c > o) & 
        (c >= o.shift(1).fillna(o)) & 
        (o <= c.shift(1).fillna(c))
    )
    
    # 5. Bearish Engulfing
    df["pattern_bearish_engulfing"] = (
        (c.shift(1).fillna(c) > o.shift(1).fillna(o)) & 
        (c < o) & 
        (c <= o.shift(1).fillna(o)) & 
        (o >= c.shift(1).fillna(c))
    )
    
    # 6. Morning Star (three-candle pattern)
    df["pattern_morning_star"] = (
        (c.shift(2).fillna(c) < o.shift(2).fillna(o)) &
        (body.shift(1).fillna(body) < body_avg.shift(1).fillna(body_avg) * 0.5) &
        (c.shift(1).fillna(c) < c.shift(2).fillna(c)) &
        (c > o) &
        (c > (o.shift(2).fillna(o) + c.shift(2).fillna(c)) / 2)
    )
    
    # 7. Evening Star (three-candle pattern)
    df["pattern_evening_star"] = (
        (c.shift(2).fillna(c) > o.shift(2).fillna(o)) &
        (body.shift(1).fillna(body) < body_avg.shift(1).fillna(body_avg) * 0.5) &
        (c.shift(1).fillna(c) > c.shift(2).fillna(c)) &
        (c < o) &
        (c < (o.shift(2).fillna(o) + c.shift(2).fillna(c)) / 2)
    )
    
    # 8. Harami
    df["pattern_harami"] = (
        ((c.shift(1).fillna(c) < o.shift(1).fillna(o)) & (c > o) & (c < o.shift(1).fillna(o)) & (o > c.shift(1).fillna(c))) |
        ((c.shift(1).fillna(c) > o.shift(1).fillna(o)) & (c < o) & (c > o.shift(1).fillna(o)) & (o < c.shift(1).fillna(c)))
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
    Computes all technical indicators and appends them to the dataframe without dropping OHLCV bars.
    """
    if df is None or df.empty:
        return df

    df = df.copy()
    
    # 1. Standard Moving Averages & Trend indicators
    df["sma_20"] = calculate_sma(df["close"], 20)
    df["sma_50"] = calculate_sma(df["close"], 50)
    df["sma_200"] = calculate_sma(df["close"], 200)
    df["ema_9"] = calculate_ema(df["close"], 9)
    df["ema_12"] = calculate_ema(df["close"], 12)
    df["ema_21"] = calculate_ema(df["close"], 21)
    df["ema_26"] = calculate_ema(df["close"], 26)
    df["vwap"] = calculate_vwap(df)

    st_data = calculate_supertrend(df, 10, 3.0)
    df["supertrend"] = st_data["supertrend"]
    df["supertrend_dir"] = st_data["direction"]

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
    
    # 2. Volume SMA
    if "volume" in df.columns:
        df["volume_sma_20"] = calculate_sma(df["volume"], 20)
    else:
        df["volume_sma_20"] = 0.0

    # 3. ATR & ADX indicators
    df["atr"] = calculate_atr(df, 14)
    df["adx"] = calculate_adx(df, 14)
    
    # 4. Pivot Points (Classic)
    pivots = calculate_pivot_points(df)
    df["pivot"] = pivots["pivot"]
    df["r1"] = pivots["r1"]
    df["s1"] = pivots["s1"]
    df["r2"] = pivots["r2"]
    df["s2"] = pivots["s2"]
    
    # 5. Fibonacci Levels
    fibs = calculate_fibonacci_levels(df, 50)
    df["fib_236"] = fibs["fib_236"]
    df["fib_382"] = fibs["fib_382"]
    df["fib_500"] = fibs["fib_500"]
    df["fib_618"] = fibs["fib_618"]
    
    # 6. Candlestick Patterns
    df = detect_candlestick_patterns(df)
    
    # AGENTS.md invariant: NEVER drop raw price rows.
    # Only remove rows where ALL core OHLCV price columns are simultaneously NaN
    # (i.e. completely empty rows with no price information at all).
    # 'date' may live in the index rather than a column — never include it in subset.
    price_cols = [c for c in ["open", "high", "low", "close"] if c in df.columns]
    if price_cols:
        df = df[~df[price_cols].isna().all(axis=1)]
    return df
