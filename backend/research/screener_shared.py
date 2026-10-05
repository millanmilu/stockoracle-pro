"""StockOracle Pro — shared screener engine helpers & coverage contract.


Split verbatim out of ``backend/research/screener_engines.py`` (pure code motion).
"""

import logging
import math
from typing import Any, Dict, Optional, Tuple

import pandas as pd

logger = logging.getLogger("StockOracle.Research.ScreenerEngines")

# ── Transparent AI-score default weights (configurable, must sum to 1.0) ──
DEFAULT_AI_WEIGHTS = {
    "technical": 0.25,
    "momentum": 0.15,
    "volume": 0.15,
    "structure": 0.15,
    "fundamental": 0.15,
    "sentiment": 0.05,
    "ml_model": 0.10,
}

VALID_REGIMES = [
    "TRENDING", "RANGING", "BREAKOUT",
    "CONSOLIDATION", "HIGH_VOLATILITY", "LOW_VOLATILITY",
]

# ── Coverage contract (see derive_screener_data_status) ──
# Fields every covered row must have for its technicals to be usable.
TECHNICAL_CORE_FIELDS: Tuple[str, ...] = ("rsi_14", "sma_20", "sma_50", "sma_200", "volume_ratio_20d")
# Fields that make a row fully covered (screener-grade fundamental screen).
FUNDAMENTAL_CORE_FIELDS: Tuple[str, ...] = ("pe_ratio", "roe_pct", "roce_pct", "debt_to_equity")
# Rotation buckets smaller than this are noise, not rotation.
MIN_SECTOR_STOCKS = 3


def _f(x: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        if x is None:
            return default
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return default
        return v
    except Exception:
        return default


def _last(s: pd.Series) -> Optional[float]:
    try:
        if s is None or len(s) == 0:
            return None
        return _f(s.iloc[-1])
    except Exception:
        return None

def _card_num(r: Dict[str, Any], key: str) -> Optional[float]:
    """Numeric field accessor that mirrors SQL NULL semantics.

    Returns None for missing / non-numeric values so every comparison below
    behaves exactly like the SQL comparison the card's DSL compiles to
    (SQL three-valued logic never matches NULL).
    """
    v = r.get(key)
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None
