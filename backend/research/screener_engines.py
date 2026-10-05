"""
StockOracle Pro — Institutional Screener Analytics Engines (Layered Architecture)

Layers:
  Market Data Engine -> Fundamental Engine -> Technical Engine ->
  Market Structure Engine -> Volume/Liquidity Engine -> News/Sentiment Engine ->
  AI/ML Engine -> Scoring Engine -> Screener -> UI

Every function here is DETERMINISTIC and operates ONLY on real calculated data
(real OHLCV, real enriched indicators, real DB metrics). No random numbers,
no invented prices/ratios/scores. Unavailable inputs yield None / "N/A" with
explicit data_status flags — never fake values.

AGENTS.md invariants respected:
  - No intraday fabrication; daily engines only use daily OHLCV.
  - enrich_stock_dataframe() is the single indicator source (min_periods=1,
    zero candle dropping).
"""

import logging
import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .screener_shared import (
    logger,
    DEFAULT_AI_WEIGHTS,
    VALID_REGIMES,
    TECHNICAL_CORE_FIELDS,
    FUNDAMENTAL_CORE_FIELDS,
    MIN_SECTOR_STOCKS,
    _f,
    _last,
    _card_num,
)
from .screener_ta_engines import compute_technical_snapshot, detect_market_structure
from .screener_flow_engines import (
    compute_volume_snapshot,
    compute_breakout_snapshot,
    compute_momentum_snapshot,
    classify_regime_enhanced,
    compute_relative_strength,
)
from .screener_scoring import compute_confluence, compute_ai_score, build_why_explanation
from .screener_aggregates import (
    UNCLASSIFIED_SECTOR_LABELS,
    real_sector,
    _mean_of,
    _coverage_status,
    measured_sector_stocks,
    compute_sector_rotation,
    compute_sector_exclusions,
    compute_market_breadth,
)
from .screener_status import (
    market_cap_category,
    derive_screener_data_status,
    compute_overview_cards,
)

# Pre-split module declared annotated module-level assignments here; keep the
# facade's namespace identical (creates `__annotations__` without rebinding).
TECHNICAL_CORE_FIELDS: Tuple[str, ...]
