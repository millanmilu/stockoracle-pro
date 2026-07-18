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
    
    # Avoid division by zero
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

def enrich_stock_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes all technical indicators and appends them to the dataframe.
    """
    df = df.copy()
    
    # Base indicators
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
    
    # Drop rows containing NaNs arising from rolling windows to keep clean
    df.dropna(subset=["sma_50", "volatility", "rsi"], inplace=True)
    return df
