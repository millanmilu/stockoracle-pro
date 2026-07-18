import numpy as np
import pandas as pd
from typing import List, Dict, Any

def detect_anomalies(df: pd.DataFrame, window: int = 20, threshold: float = 2.2) -> List[Dict[str, Any]]:
    """
    Detects pricing anomalies (extreme daily shocks) using rolling Z-scores of daily returns.
    
    Args:
        df (pd.DataFrame): Dataframe containing 'close' and 'date' columns.
        window (int): Rolling window for computing mean and standard deviation.
        threshold (float): Z-score cut-off threshold.
        
    Returns:
        List[Dict[str, Any]]: List of anomaly records.
    """
    if len(df) < window + 2:
        return []
        
    df = df.copy()
    
    # Calculate daily returns
    df["return"] = df["close"].pct_change()
    
    # Calculate rolling statistics
    df["mean_return"] = df["return"].rolling(window=window).mean()
    df["std_return"] = df["return"].rolling(window=window).std()
    
    # Compute rolling Z-score
    # Avoid dividing by zero if standard deviation is zero
    df["z_score"] = (df["return"] - df["mean_return"]) / (df["std_return"] + 1e-9)
    
    # Filter anomalies
    anomalies_df = df[df["z_score"].abs() > threshold].copy()
    
    anomalies = []
    for idx, row in anomalies_df.iterrows():
        # Get location index of the row in the original df
        day_idx = int(df.index.get_loc(idx))
        days_ago = int(len(df) - 1 - day_idx)
        
        anomalies.append({
            "day_idx": day_idx,
            "z": float(row["z_score"]),
            "ret": float(row["return"]),
            "price": float(row["close"]),
            "date": str(row["date"]),
            "days_ago": days_ago
        })
        
    # Sort anomalies by magnitude of Z-score descending
    anomalies.sort(key=lambda x: abs(x["z"]), reverse=True)
    return anomalies
