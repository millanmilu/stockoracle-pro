"""Closed-candle 4H -> 1H -> 15M SMC setup evaluator.

The function is deliberately pure: a monitor and a replay caller provide the
same three finalized candle frames and receive the same decision.  It never
reads a forming candle, mutable price tick, LLM output, or external state.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd

from .contracts import AgentDecision, SmcSetup

_REJECTED_SOURCES = {"crypto_seed", "synthetic", "random_walk"}


def _closed(frame: pd.DataFrame, minutes: int, now: Optional[pd.Timestamp] = None) -> pd.DataFrame:
    if frame is None or frame.empty or not {"date", "open", "high", "low", "close"}.issubset(frame.columns):
        return pd.DataFrame()
    source = str(frame.attrs.get("data_source", "")).lower()
    if any(token in source for token in _REJECTED_SOURCES):
        return pd.DataFrame()
    result = frame.copy()
    result["date"] = pd.to_datetime(result["date"], errors="coerce", utc=True)
    for key in ("open", "high", "low", "close"):
        result[key] = pd.to_numeric(result[key], errors="coerce")
    result = result.dropna(subset=["date", "open", "high", "low", "close"])
    result = result[(result[["open", "high", "low", "close"]] > 0).all(axis=1)]
    result = result[(result["low"] <= result[["open", "close"]].min(axis=1)) & (result["high"] >= result[["open", "close"]].max(axis=1))]
    current = now if now is not None else pd.Timestamp.now(tz="UTC")
    result = result[result["date"] + pd.Timedelta(minutes=minutes) <= current]
    return result.sort_values("date").drop_duplicates("date", keep="last").reset_index(drop=True)


def _atr(frame: pd.DataFrame, period: int = 14) -> float:
    rows = frame.tail(period + 1)
    if len(rows) < 2:
        return float("nan")
    high, low, close = rows["high"].to_numpy(), rows["low"].to_numpy(), rows["close"].to_numpy()
    values = np.maximum(high[1:] - low[1:], np.maximum(np.abs(high[1:] - close[:-1]), np.abs(low[1:] - close[:-1])))
    return float(np.mean(values)) if len(values) else float("nan")


def _trend_4h(frame: pd.DataFrame) -> Optional[str]:
    if len(frame) < 55:
        return None
    close = frame["close"]
    fast, slow = close.ewm(span=21, adjust=False).mean().iloc[-1], close.ewm(span=50, adjust=False).mean().iloc[-1]
    price = float(close.iloc[-1])
    if price > fast > slow:
        return "bullish"
    if price < fast < slow:
        return "bearish"
    return None


def _confirmed_pivots(frame: pd.DataFrame, width: int = 3) -> tuple[list[tuple[int, float]], list[tuple[int, float]]]:
    highs: list[tuple[int, float]] = []
    lows: list[tuple[int, float]] = []
    # The last `width` rows are not eligible pivots: their confirmation bars
    # have not all closed yet.
    for index in range(width, len(frame) - width):
        high = float(frame.at[index, "high"])
        low = float(frame.at[index, "low"])
        window = frame.iloc[index - width:index + width + 1]
        if high > float(window.drop(index)["high"].max()):
            highs.append((index, high))
        if low < float(window.drop(index)["low"].min()):
            lows.append((index, low))
    return highs, lows


def _structure_1h(frame: pd.DataFrame, direction: str) -> tuple[bool, Optional[float], Optional[float]]:
    if len(frame) < 20:
        return False, None, None
    highs, lows = _confirmed_pivots(frame)
    close = float(frame["close"].iloc[-1])
    if direction == "bullish":
        crossed = [price for _, price in highs[-8:] if close > price]
        liquidity = lows[-1][1] if lows else None
        return bool(crossed), crossed[-1] if crossed else None, liquidity
    crossed = [price for _, price in lows[-8:] if close < price]
    liquidity = highs[-1][1] if highs else None
    return bool(crossed), crossed[-1] if crossed else None, liquidity


def _active_order_block_1h(frame: pd.DataFrame, direction: str) -> bool:
    """Require the most recent opposing 1H candle to have a closed impulse away.

    This uses only rows before the current closed 1H candle. The subsequent
    move must close through its far edge, which avoids labelling every red/green
    candle as an order block.
    """
    if len(frame) < 8:
        return False
    for index in range(len(frame) - 2, max(0, len(frame) - 22), -1):
        candle = frame.iloc[index]
        opposite = float(candle.close) < float(candle.open) if direction == "bullish" else float(candle.close) > float(candle.open)
        if not opposite:
            continue
        later = frame.iloc[index + 1:]
        departed = float(later["close"].max()) > float(candle.high) if direction == "bullish" else float(later["close"].min()) < float(candle.low)
        if departed:
            return True
    return False


def _entry_15m(frame: pd.DataFrame, direction: str, liquidity: float) -> tuple[bool, Optional[float], Optional[float], str]:
    if len(frame) < 20 or not np.isfinite(liquidity):
        return False, None, None, "missing confirmed 1H liquidity"
    atr = _atr(frame)
    if not np.isfinite(atr) or atr <= 0:
        return False, None, None, "invalid 15M ATR"
    latest, previous, first = frame.iloc[-1], frame.iloc[-2], frame.iloc[-3]
    body = abs(float(latest.close) - float(latest.open))
    if direction == "bullish":
        swept = float(latest.low) < liquidity and float(latest.close) > liquidity
        displacement = float(latest.close) > float(latest.open) and body >= atr * 1.2
        fvg = float(latest.low) > float(first.high)
        entry, stop = float(first.high), min(float(latest.low), liquidity) - atr * 0.2
    else:
        swept = float(latest.high) > liquidity and float(latest.close) < liquidity
        displacement = float(latest.close) < float(latest.open) and body >= atr * 1.2
        fvg = float(latest.high) < float(first.low)
        entry, stop = float(first.low), max(float(latest.high), liquidity) + atr * 0.2
    if not swept:
        return False, None, None, "15M liquidity sweep missing"
    if not displacement:
        return False, None, None, "15M displacement missing"
    if not fvg:
        return False, None, None, "15M FVG missing"
    if (direction == "bullish" and not stop < entry) or (direction == "bearish" and not stop > entry):
        return False, None, None, "invalid structural stop"
    return True, entry, stop, "15M sweep + displacement + FVG"


def evaluate_smc_setup(symbol: str, candles_4h: pd.DataFrame, candles_1h: pd.DataFrame,
                       candles_15m: pd.DataFrame, now: Optional[pd.Timestamp] = None) -> AgentDecision:
    four_hour, one_hour, fifteen = _closed(candles_4h, 240, now), _closed(candles_1h, 60, now), _closed(candles_15m, 15, now)
    if min(len(four_hour), len(one_hour), len(fifteen)) == 0:
        return AgentDecision(symbol, "unavailable", "verified closed 4H/1H/15M history required")
    direction = _trend_4h(four_hour)
    if not direction:
        return AgentDecision(symbol, "no_setup", "4H trend is neutral")
    bos, _, liquidity = _structure_1h(one_hour, direction)
    if not bos:
        return AgentDecision(symbol, "no_setup", f"1H {direction} BOS/CHoCH missing")
    if not _active_order_block_1h(one_hour, direction):
        return AgentDecision(symbol, "no_setup", f"1H {direction} order block missing")
    valid, entry, stop, reason = _entry_15m(fifteen, direction, liquidity)
    if not valid:
        return AgentDecision(symbol, "no_setup", reason)
    risk = abs(entry - stop)
    target = entry + risk * 2 if direction == "bullish" else entry - risk * 2
    confirmed_at = pd.Timestamp(fifteen["date"].iloc[-1]).isoformat()
    token = f"smc-agent-v1|{symbol.upper()}|{direction}|{confirmed_at}|{entry:.10f}|{stop:.10f}"
    setup = SmcSetup(symbol.upper(), direction, entry, stop, target, 2.0, "confirmed", confirmed_at,
                     hashlib.sha256(token.encode()).hexdigest()[:32], f"4H {direction}; 1H BOS/CHoCH + OB; {reason}")
    return AgentDecision(symbol.upper(), "confirmed", setup.reason, setup)
