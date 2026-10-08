"""Explicit XAU/USD market-data adapter. It never substitutes PAXG for spot gold."""

from __future__ import annotations

from typing import Optional

import pandas as pd


def fetch_xauusd_data(period: str = "120D", interval: str = "15m") -> Optional[pd.DataFrame]:
    """Fetch XAUUSD from Yahoo's FX instrument; return None when unavailable.

    This is intentionally a distinct adapter from Binance/PAXG. A production
    broker feed can replace this function without changing strategy code.
    """
    try:
        import yfinance as yf
    except ImportError:
        return None
    period_map = {"7D": "7d", "45D": "60d", "120D": "180d", "200D": "1y", "370D": "2y"}
    interval_map = {"15m": "15m", "1h": "60m", "4h": "1h", "1d": "1d"}
    try:
        raw = yf.download("XAUUSD=X", period=period_map.get(period.upper(), "180d"), interval=interval_map.get(interval, "15m"),
                          auto_adjust=False, progress=False, threads=False)
        if raw is None or raw.empty:
            return None
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        out = raw.rename(columns={"Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"}).reset_index()
        date_col = "Datetime" if "Datetime" in out else "Date"
        out = out.rename(columns={date_col: "date"})[["date", "open", "high", "low", "close", "volume"]]
        if interval == "4h":
            out["date"] = pd.to_datetime(out["date"], utc=True, errors="coerce")
            out = (out.dropna(subset=["date"]).set_index("date").resample("4h", origin="epoch")
                   .agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"})
                   .dropna(subset=["open", "high", "low", "close"]).reset_index())
        out.attrs["data_source"] = "xauusd_yahoo_fx"
        return out
    except Exception:
        return None
