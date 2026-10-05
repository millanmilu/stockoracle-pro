"""StockOracle Pro — technical snapshot & market-structure engines.


Split verbatim out of ``backend/research/screener_engines.py`` (pure code motion).
"""

import math
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

from .screener_shared import logger, _f

# ═══════════════════════════════════════════════════════════════════════════
# 1. TECHNICAL INDICATOR ENGINE (reads enriched dataframe, no recompute dup)
# ═══════════════════════════════════════════════════════════════════════════

def compute_technical_snapshot(df: pd.DataFrame) -> Dict[str, Any]:
    """Extracts last-bar technical snapshot from an enriched dataframe.

    Returns dict with real values or None where unavailable. Never invents.
    """
    out: Dict[str, Any] = {
        "ema_9": None, "ema_20": None, "ema_50": None, "ema_100": None, "ema_200": None,
        "sma_20": None, "sma_50": None, "sma_200": None,
        "rsi_14": None, "macd": None, "macd_signal_line": None, "macd_hist": None,
        "macd_bullish": None, "macd_crossover": "N/A",
        "stoch_k": None, "stoch_d": None, "cci_20": None, "roc_12": None,
        "williams_r": None, "adx_14": None, "plus_di": None, "minus_di": None,
        "atr": None, "atr_pct": None, "bb_upper": None, "bb_middle": None,
        "bb_lower": None, "bb_width_pct": None, "bb_position": None,
        "supertrend": None, "supertrend_dir": None,
        "vwap": None, "vwap_dist_pct": None,
        "rsi_divergence": "NONE",
        "hist_vol_20": None,
        "data_status": "OK",
    }
    if df is None or df.empty or "close" not in df.columns:
        out["data_status"] = "N/A"
        return out
    try:
        last = df.iloc[-1]
        close = _f(last.get("close"))
        if close is None or close <= 0:
            out["data_status"] = "N/A"
            return out

        for col, key in [
            ("ema_9", "ema_9"), ("ema_21", "ema_20"), ("ema_12", None),
            ("sma_20", "sma_20"), ("sma_50", "sma_50"), ("sma_200", "sma_200"),
            ("rsi", "rsi_14"), ("macd", "macd"), ("macd_signal", "macd_signal_line"),
            ("macd_hist", "macd_hist"), ("stoch_k", "stoch_k"), ("stoch_d", "stoch_d"),
            ("cci", "cci_20"), ("roc", "roc_12"), ("williams_r", "williams_r"),
            ("adx", "adx_14"), ("plus_di", "plus_di"), ("minus_di", "minus_di"),
            ("atr", "atr"), ("bb_upper", "bb_upper"), ("bb_middle", "bb_middle"),
            ("bb_lower", "bb_lower"), ("supertrend", "supertrend"),
            ("supertrend_dir", "supertrend_dir"), ("vwap", "vwap"),
        ]:
            if col in df.columns:
                out[key] = _f(last.get(col))

        # EMA 50/100/200 derived from close series when enriched frame lacks them
        # (enriched frame has ema_9/12/21/26 only) — compute deterministically.
        try:
            close_s = df["close"].astype(float)
            for p, k in [(20, "ema_20"), (50, "ema_50"), (100, "ema_100"), (200, "ema_200")]:
                if out.get(k) is None:
                    out[k] = _f(close_s.ewm(span=p, adjust=False).mean().iloc[-1])
            if out.get("ema_9") is None and "ema_9" in df.columns:
                out["ema_9"] = _f(last.get("ema_9"))
        except Exception:
            pass

        # MACD bullish + crossover (needs 2 bars)
        try:
            if len(df) >= 2 and out["macd"] is not None and out["macd_signal_line"] is not None:
                out["macd_bullish"] = bool(out["macd"] > out["macd_signal_line"])
                prev_m, prev_s = _f(df["macd"].iloc[-2]), _f(df["macd_signal"].iloc[-2])
                if prev_m is not None and prev_s is not None:
                    if prev_m <= prev_s and out["macd"] > out["macd_signal_line"]:
                        out["macd_crossover"] = "BULLISH_CROSSOVER"
                    elif prev_m >= prev_s and out["macd"] < out["macd_signal_line"]:
                        out["macd_crossover"] = "BEARISH_CROSSOVER"
                    else:
                        out["macd_crossover"] = "NONE"
        except Exception:
            pass

        # ATR % + BB width/position + VWAP distance + hist vol
        try:
            if out["atr"] is not None and close:
                out["atr_pct"] = round(out["atr"] / close * 100.0, 2)
            if out["bb_upper"] is not None and out["bb_lower"] is not None and out["bb_middle"]:
                width = (out["bb_upper"] - out["bb_lower"]) / (abs(out["bb_middle"]) + 1e-9) * 100.0
                out["bb_width_pct"] = round(float(width), 2)
                denom = (out["bb_upper"] - out["bb_lower"]) or 1e-9
                out["bb_position"] = round((close - out["bb_lower"]) / denom, 3)
            if out["vwap"] is not None and close:
                out["vwap_dist_pct"] = round((close - out["vwap"]) / close * 100.0, 2)
            rets = df["close"].astype(float).pct_change().dropna()
            if len(rets) >= 5:
                out["hist_vol_20"] = round(float(rets.tail(20).std() * math.sqrt(252) * 100.0), 2)
        except Exception:
            pass

        # RSI divergence flags (from enriched columns when present)
        try:
            if "bullish_divergence" in df.columns and bool(df["bullish_divergence"].iloc[-1]):
                out["rsi_divergence"] = "BULLISH"
            elif "bearish_divergence" in df.columns and bool(df["bearish_divergence"].iloc[-1]):
                out["rsi_divergence"] = "BEARISH"
        except Exception:
            pass
    except Exception as exc:
        logger.debug("compute_technical_snapshot failed: %s", exc)
        out["data_status"] = "STALE"
    return out


# ═══════════════════════════════════════════════════════════════════════════
# 2. MARKET STRUCTURE ENGINE (deterministic swing/BOS/CHoCH/support/resist)
# ═══════════════════════════════════════════════════════════════════════════

def detect_market_structure(df: pd.DataFrame, window: int = 5) -> Dict[str, Any]:
    """Deterministic market-structure labelling from real OHLC (no AI labels).

    Detects: HH/HL/LH/LL sequence, BOS/CHoCH, support/resistance,
    equal highs/lows, liquidity sweep, consolidation, breakout/breakdown,
    supply/demand proximity, order-block / FVG presence (boolean only).
    """
    out: Dict[str, Any] = {
        "structure_label": "N/A",
        "trend_hint": "N/A",
        "bos": None,          # "BULLISH_BOS" | "BEARISH_BOS" | None
        "choch": None,        # "BULLISH_CHOCH" | "BEARISH_CHOCH" | None
        "support": None,
        "resistance": None,
        "breakout": None,     # "BREAKOUT" | "BREAKDOWN" | None
        "breakout_price": None,
        "breakout_strength": None,  # 0-100 deterministic
        "retest_status": "N/A",
        "consolidation": False,
        "equal_high": False,
        "equal_low": False,
        "liquidity_sweep": None,  # "BUY_SIDE" | "SELL_SIDE" | None
        "order_block_present": False,
        "fvg_present": False,
        "supply_zone": None,
        "demand_zone": None,
        "hh_hl_count": 0,
        "lh_ll_count": 0,
    }
    if df is None or df.empty or len(df) < window * 2 + 3:
        return out
    try:
        highs = df["high"].astype(float).to_numpy()
        lows = df["low"].astype(float).to_numpy()
        closes = df["close"].astype(float).to_numpy()
        n = len(df)
        swing_highs: List[Tuple[int, float]] = []
        swing_lows: List[Tuple[int, float]] = []
        for i in range(window, n - window):
            h, lo = highs[i], lows[i]
            if np.all(highs[i - window:i + window + 1] <= h + 1e-9) and np.any(highs[i - window:i + window + 1] < h - 1e-9):
                # strict-ish fractal: at least one neighbour strictly lower
                swing_highs.append((i, float(h)))
            if np.all(lows[i - window:i + window + 1] >= lo - 1e-9) and np.any(lows[i - window:i + window + 1] > lo + 1e-9):
                swing_lows.append((i, float(lo)))
        swing_highs = swing_highs[-8:]
        swing_lows = swing_lows[-8:]
        close_last = float(closes[-1])

        hh = hl = lh = ll = 0
        for k in range(1, len(swing_highs)):
            if swing_highs[k][1] > swing_highs[k - 1][1] * 1.0005:
                hh += 1
            elif swing_highs[k][1] < swing_highs[k - 1][1] * 0.9995:
                lh += 1
        for k in range(1, len(swing_lows)):
            if swing_lows[k][1] > swing_lows[k - 1][1] * 1.0005:
                hl += 1
            elif swing_lows[k][1] < swing_lows[k - 1][1] * 0.9995:
                ll += 1
        out["hh_hl_count"] = hh + hl
        out["lh_ll_count"] = lh + ll

        if hh + hl > lh + ll and (hh + hl) > 0:
            out["structure_label"] = "HH/HL_UPTREND"
            out["trend_hint"] = "BULLISH"
        elif lh + ll > hh + hl and (lh + ll) > 0:
            out["structure_label"] = "LH/LL_DOWNTREND"
            out["trend_hint"] = "BEARISH"
        elif (hh + hl + lh + ll) == 0:
            out["structure_label"] = "NO_CLEAR_STRUCTURE"
            out["trend_hint"] = "NEUTRAL"
        else:
            out["structure_label"] = "MIXED"
            out["trend_hint"] = "NEUTRAL"

        # BOS / CHoCH: close beyond most recent opposite swing
        if swing_highs and close_last > swing_highs[-1][1]:
            out["bos"] = "BULLISH_BOS" if out["trend_hint"] == "BULLISH" else "BULLISH_CHOCH"
            if "BOS" in out["bos"]:
                pass
            else:
                out["choch"] = out["bos"]
                out["bos"] = None
            out["breakout"] = "BREAKOUT"
            out["breakout_price"] = round(swing_highs[-1][1], 2)
        elif swing_lows and close_last < swing_lows[-1][1]:
            out["bos"] = "BEARISH_BOS" if out["trend_hint"] == "BEARISH" else "BEARISH_CHOCH"
            if "BOS" not in (out["bos"] or ""):
                out["choch"] = out["bos"]
                out["bos"] = None
            out["breakout"] = "BREAKDOWN"
            out["breakout_price"] = round(swing_lows[-1][1], 2)

        # Support / resistance = nearest swing low/high
        if swing_lows:
            cands = [p for _, p in swing_lows if p < close_last]
            out["support"] = round(max(cands) if cands else swing_lows[-1][1], 2)
        if swing_highs:
            cands = [p for _, p in swing_highs if p > close_last]
            out["resistance"] = round(min(cands) if cands else swing_highs[-1][1], 2)

        # Breakout strength: close distance beyond level scaled by ATR
        try:
            tr1 = df["high"] - df["low"]
            tr2 = (df["high"] - df["close"].shift(1)).abs()
            tr3 = (df["low"] - df["close"].shift(1)).abs()
            atr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1).rolling(14, min_periods=1).mean().iloc[-1]
            atr = float(atr) if atr and atr > 0 else close_last * 0.01
            if out["breakout_price"]:
                dist_atr = abs(close_last - out["breakout_price"]) / atr
                out["breakout_strength"] = round(max(0.0, min(100.0, dist_atr * 50.0)), 1)
                # Retest: did price revisit within 0.25 ATR in last 5 bars?
                recent = closes[-6:-1] if n >= 6 else closes[:-1]
                if len(recent):
                    touched = np.any(np.abs(recent - out["breakout_price"]) <= 0.25 * atr)
                    out["retest_status"] = "RETESTED" if touched else "NO_RETEST"
        except Exception:
            pass

        # Equal highs / lows (within 0.15%)
        try:
            if len(swing_highs) >= 2 and abs(swing_highs[-1][1] - swing_highs[-2][1]) / swing_highs[-2][1] < 0.0015:
                out["equal_high"] = True
            if len(swing_lows) >= 2 and abs(swing_lows[-1][1] - swing_lows[-2][1]) / swing_lows[-2][1] < 0.0015:
                out["equal_low"] = True
        except Exception:
            pass

        # Liquidity sweep: wick beyond swing but close back inside (last 3 bars)
        try:
            lookback = df.tail(3)
            if swing_highs:
                lvl = swing_highs[-1][1]
                swept = ((lookback["high"] > lvl) & (lookback["close"] < lvl)).any()
                if bool(swept):
                    out["liquidity_sweep"] = "BUY_SIDE"
            if swing_lows and out["liquidity_sweep"] is None:
                lvl = swing_lows[-1][1]
                swept = ((lookback["low"] < lvl) & (lookback["close"] > lvl)).any()
                if bool(swept):
                    out["liquidity_sweep"] = "SELL_SIDE"
        except Exception:
            pass

        # Consolidation: 20-bar range < 1.2 * ATR and ADX < 20 when available
        try:
            last20 = df.tail(20)
            rng = float(last20["high"].max() - last20["low"].min())
            atr_now = float(pd.concat([
                df["high"] - df["low"],
                (df["high"] - df["close"].shift(1)).abs(),
                (df["low"] - df["close"].shift(1)).abs(),
            ], axis=1).max(axis=1).rolling(14, min_periods=1).mean().iloc[-1] or 0)
            adx_now = _f(df["adx"].iloc[-1]) if "adx" in df.columns else None
            if atr_now > 0 and rng < 3.0 * atr_now and (adx_now is None or adx_now < 22):
                out["consolidation"] = True
                if out["structure_label"] in ("MIXED", "NO_CLEAR_STRUCTURE"):
                    out["structure_label"] = "CONSOLIDATION"
        except Exception:
            pass

        # Order block / FVG presence (boolean, deterministic rules)
        try:
            o, h, l, c = df["open"].astype(float), highs, lows, closes
            # Bullish OB: bearish candle followed by 2 closes above its high
            found_ob = False
            for i in range(max(0, n - 30), n - 2):
                if c[i] < o[i] and c[i + 1] > h[i] and c[i + 2] > c[i + 1]:
                    found_ob = True
                    break
                if c[i] > o[i] and c[i + 1] < l[i] and c[i + 2] < c[i + 1]:
                    found_ob = True
                    break
            out["order_block_present"] = found_ob
            # FVG: 3-candle gap (low[i] > high[i-2] or high[i] < low[i-2])
            found_fvg = False
            for i in range(max(2, n - 30), n):
                if lows[i] > highs[i - 2] or highs[i] < lows[i - 2]:
                    found_fvg = True
                    break
            out["fvg_present"] = found_fvg
        except Exception:
            pass

        # Supply / demand proximity: last strong-bodied candle with follow-through
        try:
            i = n - 2
            if i >= 1:
                body = abs(float(df["close"].iloc[i]) - float(df["open"].iloc[i]))
                rng_i = float(df["high"].iloc[i] - df["low"].iloc[i]) or 1e-9
                if body / rng_i > 0.5:
                    if float(df["close"].iloc[i]) > float(df["open"].iloc[i]):
                        out["demand_zone"] = round(float(df["open"].iloc[i]), 2)
                    else:
                        out["supply_zone"] = round(float(df["open"].iloc[i]), 2)
        except Exception:
            pass
    except Exception as exc:
        logger.debug("detect_market_structure failed: %s", exc)
    return out
