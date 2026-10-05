"""StockOracle Pro — high-performance in-memory indicator LRU cache.


Split verbatim out of ``backend/analysis/indicators.py`` (pure code motion).
"""

import logging
from collections import OrderedDict
from typing import Optional

import pandas as pd

logger = logging.getLogger("StockOracle.Indicators")

# ── High-Performance In-Memory LRU Cache ─────────────────────────────────────
_indicator_cache: OrderedDict[str, pd.DataFrame] = OrderedDict()


def _get_cache_fingerprint(df: pd.DataFrame, cache_key: Optional[str] = None) -> str:
    """Generates a lightning-fast hash fingerprint of a dataframe."""
    n = len(df)
    if n == 0:
        return f"{cache_key or 'empty'}:0"
    last_close = float(df["close"].iloc[-1]) if "close" in df.columns else 0.0
    last_vol = float(df["volume"].iloc[-1]) if "volume" in df.columns else 0.0
    last_date = str(df["date"].iloc[-1]) if "date" in df.columns else str(df.index[-1])
    first_date = str(df["date"].iloc[0]) if "date" in df.columns else str(df.index[0])
    prefix = cache_key or "df"
    return f"{prefix}:{n}:{first_date}:{last_date}:{last_close:.2f}:{last_vol:.0f}"


def clear_indicator_cache() -> None:
    """Clears the in-memory indicator cache."""
    global _indicator_cache
    _indicator_cache.clear()
