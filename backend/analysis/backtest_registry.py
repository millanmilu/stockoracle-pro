"""StockOracle Pro — backtest strategy plugin registry.


Split verbatim out of ``backend/analysis/backtester.py`` (pure code motion).
Custom strategies ``backend/analysis/custom_strategies.py`` me likho — decorators
yahan register hote hain.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("StockOracle.Analysis.Backtester")

# ── Strategy Plugin Registry ─────────────────────────────────────────────────
# Apni strategy `backend/analysis/custom_strategies.py` me likho:
#
#   from backend.analysis.backtester import register_strategy, register_exit
#
#   @register_strategy("my_breakout", label="My Breakout", description="...")
#   def my_entry(ctx, i, p):
#       # ctx: look-ahead-free arrays + current-bar scalars, p: params dict
#       return ctx["close"][i] > ctx["donchian_high"][i]
#
#   @register_exit("my_breakout")  # optional — na do to SL/TP/trailing/time-stop par exit
#   def my_exit(ctx, i, p):
#       return ctx["close"][i] < ctx["donchian_low"][i]
#
# `ctx` keys: close/high/low/open/volume/volume_ratio/rsi_14/bb_lower/bb_upper/
#   macd/macd_signal/ema_fast/ema_slow/donchian_high/donchian_low/st_vals/st_dir/
#   preds (ai preds ya None) + curr_close/curr_rsi/curr_volume_ratio/curr_bb_low/curr_bb_high
# `p` keys: fast_period, slow_period, rsi_oversold, rsi_overbought, entry_threshold,
#   bearish_exit_threshold, atr_multiplier, stop_loss, take_profit, trailing_stop_pct,
#   max_holding_days, position_size_pct, slippage_bps, commission_bps
# Rule: sirf i ya i-1 access karo — i+1 = look-ahead bias, mana hai.
STRATEGY_REGISTRY: Dict[str, Dict[str, Any]] = {}

BUILTIN_STRATEGIES: Dict[str, Dict[str, str]] = {
    "ai_ensemble": {
        "label": "AI Walk-Forward ML Ensemble",
        "description": "XGBoost + ElasticNet walk-forward prediction edge.",
    },
    "ema_crossover": {
        "label": "EMA Trend Following / Golden Cross",
        "description": "Fast vs Slow EMA crossover trend following.",
    },
    "rsi_mean_reversion": {
        "label": "RSI + Bollinger Mean Reversion",
        "description": "Oversold lower-band dip buyer with mean target.",
    },
    "momentum_breakout": {
        "label": "20-Day Momentum / Donchian Breakout",
        "description": "Donchian channel breakout with volume expansion.",
    },
    "macd_crossover": {
        "label": "MACD Signal Momentum Cross",
        "description": "MACD line cross above signal with positive momentum.",
    },
    "supertrend": {
        "label": "Supertrend Volatility Trail",
        "description": "Dynamic ATR-based trailing trend-following stop.",
    },
}


def register_strategy(strategy_id: str, label: Optional[str] = None,
                      description: str = ""):
    """Decorator: custom entry rule register karo.

    Usage:
        @register_strategy("vwap_bounce", label="VWAP Bounce")
        def my_entry(ctx, i, p):
            return ctx["close"][i] > ctx["close"][i - 1]  # apna rule
    Exit rule alag se `register_exit` se judta hai (na do to sirf
    SL/TP/trailing/time-stop par exit hoga).
    """
    sid = str(strategy_id).lower().strip()

    def _deco(fn):
        spec = STRATEGY_REGISTRY.setdefault(sid, {})
        spec["id"] = sid
        spec["label"] = label or sid.upper()
        spec["description"] = description or ""
        spec["entry"] = fn
        return fn

    return _deco


def register_exit(strategy_id: str):
    """Decorator: custom signal-exit rule register karo."""
    sid = str(strategy_id).lower().strip()

    def _deco(fn):
        spec = STRATEGY_REGISTRY.setdefault(sid, {})
        spec["id"] = sid
        spec["exit"] = fn
        return fn

    return _deco


def list_strategies() -> List[Dict[str, str]]:
    """Builtin + registered custom strategies ki metadata list."""
    out: List[Dict[str, str]] = []
    for sid, meta in BUILTIN_STRATEGIES.items():
        out.append({"id": sid, "label": meta["label"],
                    "description": meta["description"], "builtin": True,
                    "has_custom_exit": bool(STRATEGY_REGISTRY.get(sid, {}).get("exit"))})
    for sid, spec in STRATEGY_REGISTRY.items():
        if sid in BUILTIN_STRATEGIES:
            continue
        out.append({"id": sid, "label": str(spec.get("label") or sid.upper()),
                    "description": str(spec.get("description") or ""),
                    "builtin": False,
                    "has_custom_exit": bool(spec.get("exit"))})
    return out


def _try_load_custom_strategies() -> None:
    """`backend/analysis/custom_strategies.py` ho to auto-import (decorators chal jayein)."""
    try:
        import importlib
        importlib.import_module("backend.analysis.custom_strategies")
    except ModuleNotFoundError:
        pass
    except Exception:
        # Custom file me error ho to builtin strategies tooti nahi chahiye.
        logger.exception("custom_strategies load failed — builtins continue")
