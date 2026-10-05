"""
StockOracle Pro — High-Performance Technical Indicator Engine
Features:
- Complete momentum, volume-weighted, volatility, and trend indicators
- Zero candle dropping & min_periods=1 standard (AGENTS.md invariant)
- Rigorous RSI neutral-50 bug fix on zero gain/loss
- Fast NumPy vectorized Supertrend
- Candlestick patterns with prior trend context verification
- Multi-timeframe support (MTF)
- Divergence detection & market regime classification
- AST-based safe custom indicator formula builder
- High-speed LRU in-memory indicator caching
"""

import ast
import logging
from collections import OrderedDict
from typing import Dict, Any, Optional, Union

import numpy as np
import pandas as pd

from .constants import (
    DEFAULT_SMA_20, DEFAULT_SMA_50, DEFAULT_SMA_200,
    DEFAULT_EMA_9, DEFAULT_EMA_12, DEFAULT_EMA_21, DEFAULT_EMA_26,
    DEFAULT_RSI_PERIOD, DEFAULT_RSI_NEUTRAL,
    DEFAULT_MACD_FAST, DEFAULT_MACD_SLOW, DEFAULT_MACD_SIGNAL,
    DEFAULT_BB_PERIOD, DEFAULT_BB_STD,
    DEFAULT_ATR_PERIOD, DEFAULT_ADX_PERIOD,
    DEFAULT_SUPERTREND_PERIOD, DEFAULT_SUPERTREND_MULTIPLIER,
    DEFAULT_STOCH_K_PERIOD, DEFAULT_STOCH_D_PERIOD,
    DEFAULT_CCI_PERIOD, DEFAULT_WILLIAMS_R_PERIOD,
    DEFAULT_ROC_PERIOD, DEFAULT_MFI_PERIOD,
    DEFAULT_KELTNER_EMA_PERIOD, DEFAULT_KELTNER_ATR_PERIOD, DEFAULT_KELTNER_MULTIPLIER,
    DEFAULT_DONCHIAN_PERIOD,
    DEFAULT_ICHIMOKU_TENKAN, DEFAULT_ICHIMOKU_KIJUN,
    DEFAULT_ICHIMOKU_SENKOU_B, DEFAULT_ICHIMOKU_DISPLACEMENT,
    DEFAULT_FIBONACCI_PERIOD, INDICATOR_CACHE_MAX_ENTRIES,
    SMA_20, SMA_50, SMA_200, EMA_9, EMA_12, EMA_21, EMA_26,
    RSI_PERIOD, MACD_FAST, MACD_SLOW, MACD_SIGNAL, BB_PERIOD,
    ATR_PERIOD, ADX_PERIOD, STOCH_K_PERIOD, STOCH_D_PERIOD,
    CCI_PERIOD, WILLIAMS_R_PERIOD, MFI_PERIOD
)

from .indicator_cache import (
    logger,
    _indicator_cache,
    _get_cache_fingerprint,
    clear_indicator_cache,
)
from .indicator_trend import (
    calculate_sma, calculate_ema, calculate_rsi, calculate_macd,
    calculate_bollinger_bands, calculate_atr, calculate_adx,
    _supertrend_core_numpy, calculate_supertrend,
    calculate_keltner_channels, calculate_donchian_channels,
    calculate_pivot_points, calculate_fibonacci_levels, calculate_ichimoku,
    calculate_adx_full,
)
from .indicator_volume import (
    _session_day_keys, calculate_vwap, calculate_obv, calculate_mfi, calculate_cmf,
)
from .indicator_momentum import (
    calculate_stochastic, calculate_cci, calculate_williams_r, calculate_roc,
    calculate_stoch_rsi, calculate_elder_ray, calculate_psar,
)
from .indicator_patterns import (
    detect_candlestick_patterns, detect_divergences, classify_market_regime,
    calculate_mtf_indicator,
)
from .indicator_formula import _SafeFormulaEvaluator, evaluate_custom_formula
from .indicator_enrich import enrich_stock_dataframe

# Pre-split module declared an annotated module-level assignment here; keep the
# facade's namespace identical (creates `__annotations__` without rebinding).
_indicator_cache: OrderedDict[str, pd.DataFrame]
