"""
StockOracle Pro — Institutional Walk-Forward Backtesting Engine v3.0

Quantitative Features:
  1. ✅ Multi-Strategy Engine:
       - AI Ensemble (XGBoost + ElasticNet Walk-Forward with Auto In-Sample Fit Fallback)
       - EMA Trend Following / Crossover (Golden Cross)
       - RSI + Bollinger Bands Mean Reversion
       - 20-Day Momentum / Donchian Breakout with Volume Expansion
       - MACD Signal Crossover
       - Supertrend Volatility Trailing Trend
  2. ✅ Look-Ahead Bias Eliminated: Features computed causally per-row up to day T
  3. ✅ True Out-of-Sample Testing: Train/Test split (default 70/30), model trained strictly on past
  4. ✅ Configurable Risk & Execution:
       - Position Sizing (% of equity)
       - Stop Loss (%)
       - Take Profit (%)
       - Trailing Stop (% from peak)
       - Max Holding Period (Time-stop)
       - Realistic Frictions: Configurable Slippage (bps) + Commission/STT (bps) + Liquidity penalty
  5. ✅ Institutional Analytics:
       - Sharpe, Sortino, Calmar, Alpha vs B&H, Beta, CAGR, Recovery Factor, Max Drawdown
       - Win Rate, Profit Factor, Payoff Ratio (Avg Win / Avg Loss), Expectancy (₹ & %)
       - Consecutive Wins / Losses, Best / Worst Trade
  6. ✅ Monthly Returns Heatmap Matrix & Trade P&L Distribution
  7. ✅ Monte Carlo Robustness (500 Random Permutations)
"""

import os
import json
import logging
import tempfile
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import ElasticNet

from .backtest_registry import (
    logger,
    STRATEGY_REGISTRY,
    BUILTIN_STRATEGIES,
    register_strategy,
    register_exit,
    list_strategies,
    _try_load_custom_strategies,
)

# Pre-split module auto-imported custom_strategies right after the registry was
# defined (module import time, before run_backtest existed) — keep that order.
_try_load_custom_strategies()

from .backtest_features import _build_features_row_by_row, _compute_supertrend
from .backtest_ai import MODEL_DIR, _predict_ai_walk_forward
from .backtest_analytics import (
    _compute_monthly_analytics,
    _compute_pnl_distribution,
    _run_monte_carlo,
)
from .backtest_execution import _calculate_friction, _strategy_params, _strategy_ctx
from .backtest_engine import run_backtest

# Pre-split module declared annotated module-level assignments here; keep the
# facade's namespace identical (creates `__annotations__` without rebinding).
STRATEGY_REGISTRY: Dict[str, Dict[str, Any]]
