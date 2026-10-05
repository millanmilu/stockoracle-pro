"""StockOracle Pro — execution friction model + custom-strategy rule context.


Split verbatim out of ``backend/analysis/backtester.py`` (pure code motion).
"""

from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd

def _calculate_friction(trade_value: float, vol_ratio: float, slippage_bps: float, commission_bps: float) -> Tuple[float, float]:
    """
    Returns (slippage_cost, commission_cost) in currency units.
    Includes base slippage bps + volume liquidity penalty + trade market impact.
    """
    base_slip = slippage_bps / 10000.0
    liquidity_pen = max(0.0, (1.0 - min(vol_ratio, 3.0)) * 0.0005)
    market_impact = min(0.0015, trade_value / 50_000_000 * 0.0015)
    eff_slip_rate = base_slip + liquidity_pen + market_impact

    comm_rate = commission_bps / 10000.0

    slip_cost = trade_value * eff_slip_rate
    comm_cost = trade_value * comm_rate
    return slip_cost, comm_cost

def _strategy_params(fast_period, slow_period, rsi_oversold, rsi_overbought,
                     entry_threshold, bearish_exit_threshold, atr_multiplier,
                     stop_loss, take_profit, trailing_stop_pct, max_holding_days,
                     position_size_pct, slippage_bps, commission_bps) -> Dict[str, Any]:
    """run_backtest ke risk/signal params ka snapshot — custom rules ko milta hai."""
    return {
        "fast_period": fast_period, "slow_period": slow_period,
        "rsi_oversold": rsi_oversold, "rsi_overbought": rsi_overbought,
        "entry_threshold": entry_threshold,
        "bearish_exit_threshold": bearish_exit_threshold,
        "atr_multiplier": atr_multiplier, "stop_loss": stop_loss,
        "take_profit": take_profit, "trailing_stop_pct": trailing_stop_pct,
        "max_holding_days": max_holding_days,
        "position_size_pct": position_size_pct,
        "slippage_bps": slippage_bps, "commission_bps": commission_bps,
    }


def _strategy_ctx(test_df: pd.DataFrame, preds: Optional[np.ndarray],
                  ema_fast: np.ndarray, ema_slow: np.ndarray,
                  donchian_high: np.ndarray, donchian_low: np.ndarray,
                  st_vals: np.ndarray, st_dir: np.ndarray,
                  curr_close: float, i: int) -> Dict[str, Any]:
    """Custom rule ko look-ahead-free context: arrays + current scalars."""
    row = test_df.iloc[i]
    return {
        # arrays (index i ya i-1 se access karo — i+1 kabhi mat chhoona)
        "close": test_df["close"].values.astype(float),
        "high": test_df["high"].values.astype(float),
        "low": test_df["low"].values.astype(float),
        "open": test_df["open"].values.astype(float),
        "volume": test_df["volume"].values.astype(float),
        "volume_ratio": test_df["volume_ratio"].values.astype(float),
        "rsi_14": test_df["rsi_14"].values.astype(float),
        "bb_lower": test_df["bb_lower"].values.astype(float),
        "bb_upper": test_df["bb_upper"].values.astype(float),
        "macd": test_df["macd"].values.astype(float),
        "macd_signal": test_df["macd_signal"].values.astype(float),
        "ema_fast": ema_fast, "ema_slow": ema_slow,
        "donchian_high": donchian_high, "donchian_low": donchian_low,
        "st_vals": st_vals, "st_dir": st_dir,
        "preds": preds,
        # current-bar scalars (shortcut)
        "curr_close": curr_close,
        "curr_rsi": float(row.get("rsi_14", 50.0)),
        "curr_volume_ratio": float(row.get("volume_ratio", 1.0)),
        "curr_bb_low": float(row.get("bb_lower", curr_close * 0.95)),
        "curr_bb_high": float(row.get("bb_upper", curr_close * 1.05)),
    }
