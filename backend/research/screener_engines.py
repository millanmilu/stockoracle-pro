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


# ═══════════════════════════════════════════════════════════════════════════
# 3. VOLUME / LIQUIDITY ENGINE
# ═══════════════════════════════════════════════════════════════════════════

def compute_volume_snapshot(df: pd.DataFrame) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "volume": None, "avg_volume_20": None, "rel_volume": None,
        "volume_change_pct": None, "volume_spike": False,
        "liquidity_label": "N/A", "obv_trend": "N/A",
    }
    if df is None or df.empty or "volume" not in df.columns:
        return out
    try:
        vol = df["volume"].astype(float)
        out["volume"] = _f(vol.iloc[-1])
        out["avg_volume_20"] = _f(vol.rolling(20, min_periods=1).mean().iloc[-1])
        if out["avg_volume_20"]:
            out["rel_volume"] = round(out["volume"] / (out["avg_volume_20"] + 1e-9), 2)
        if len(vol) >= 2 and vol.iloc[-2]:
            out["volume_change_pct"] = round((vol.iloc[-1] - vol.iloc[-2]) / (abs(float(vol.iloc[-2])) + 1e-9) * 100.0, 1)
        out["volume_spike"] = bool(out["rel_volume"] is not None and out["rel_volume"] >= 1.5)
        if out["avg_volume_20"] is not None:
            dv = (out["volume"] or 0)  # delivery volume unavailable from feed
            out["liquidity_label"] = (
                "HIGH" if (out["rel_volume"] or 0) >= 1.5 and (out["volume"] or 0) >= out["avg_volume_20"]
                else "NORMAL" if (out["rel_volume"] or 0) >= 0.7 else "LOW"
            )
        if "obv" in df.columns and len(df) >= 5:
            obv = df["obv"].astype(float)
            out["obv_trend"] = "RISING" if float(obv.iloc[-1]) > float(obv.iloc[-5]) else "FALLING"
    except Exception as exc:
        logger.debug("compute_volume_snapshot failed: %s", exc)
    return out


# ═══════════════════════════════════════════════════════════════════════════
# 4. BREAKOUT + MOMENTUM SCANNERS
# ═══════════════════════════════════════════════════════════════════════════

def compute_breakout_snapshot(
    df: pd.DataFrame,
    tech: Dict[str, Any],
    struct: Dict[str, Any],
    vol: Dict[str, Any],
    high_52w: Optional[float],
    low_52w: Optional[float],
) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "breakout_52w_high": False, "breakdown_52w_low": False,
        "resistance_breakout": False, "support_breakdown": False,
        "volume_breakout": False, "volatility_breakout": False,
        "consolidation_breakout": False,
        "breakout_price": struct.get("breakout_price"),
        "breakout_strength": struct.get("breakout_strength"),
        "retest_status": struct.get("retest_status", "N/A"),
        "volume_ratio": vol.get("rel_volume"),
    }
    if df is None or df.empty:
        return out
    try:
        close = _f(df["close"].iloc[-1])
        if close is None:
            return out
        if high_52w and high_52w > 0 and close >= high_52w * 0.998:
            out["breakout_52w_high"] = True
        if low_52w and low_52w > 0 and close <= low_52w * 1.002:
            out["breakdown_52w_low"] = True
        if struct.get("breakout") == "BREAKOUT":
            out["resistance_breakout"] = True
        if struct.get("breakout") == "BREAKDOWN":
            out["support_breakdown"] = True
        if (vol.get("rel_volume") or 0) >= 2.0 and (tech.get("roc_12") or 0) > 0:
            out["volume_breakout"] = True
        bbw = tech.get("bb_width_pct")
        if bbw is not None and len(df) >= 50:
            # volatility breakout: current BB width > 80th percentile of last 50
            try:
                mid = df["close"].rolling(20, min_periods=1).mean()
                std = df["close"].rolling(20, min_periods=1).std().fillna(0)
                width_hist = ((mid + 2 * std) - (mid - 2 * std)) / (mid.replace(0, np.nan)) * 100.0
                p80 = float(width_hist.tail(50).quantile(0.80))
                out["volatility_breakout"] = bool(bbw > p80 and (tech.get("adx_14") or 0) >= 20)
            except Exception:
                pass
        if struct.get("consolidation") and struct.get("breakout") in ("BREAKOUT", "BREAKDOWN"):
            out["consolidation_breakout"] = True
    except Exception as exc:
        logger.debug("compute_breakout_snapshot failed: %s", exc)
    return out


def compute_momentum_snapshot(df: pd.DataFrame, tech: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "momentum_state": "N/A",      # STRONG | INCREASING | WEAKENING | WEAK
        "rsi_state": "N/A",           # BULLISH | BEARISH | NEUTRAL
        "macd_state": "N/A",          # BULLISH | BEARISH | NEUTRAL
        "ema_alignment": "N/A",       # BULLISH_ALIGNED | BEARISH_ALIGNED | MIXED
        "ema_alignment_label": "N/A",
        "supertrend_state": "N/A",
    }
    try:
        rsi = tech.get("rsi_14")
        if rsi is not None:
            out["rsi_state"] = "BULLISH" if rsi >= 55 else "BEARISH" if rsi <= 45 else "NEUTRAL"
            if rsi >= 70:
                out["rsi_state"] = "OVERBOUGHT"
            elif rsi <= 30:
                out["rsi_state"] = "OVERSOLD"
        if tech.get("macd_bullish") is True:
            out["macd_state"] = "BULLISH"
        elif tech.get("macd_bullish") is False:
            out["macd_state"] = "BEARISH"
        # EMA alignment
        e20, e50, e200 = tech.get("ema_20"), tech.get("ema_50"), tech.get("ema_200")
        close = _f(df["close"].iloc[-1]) if df is not None and not df.empty else None
        if e20 is not None and e50 is not None and e200 is not None and close is not None:
            if close > e20 > e50 > e200:
                out["ema_alignment"] = "BULLISH_ALIGNED"
                out["ema_alignment_label"] = "Strong bullish alignment (EMA 20 > 50 > 200, price above)"
            elif close < e20 < e50 < e200:
                out["ema_alignment"] = "BEARISH_ALIGNED"
                out["ema_alignment_label"] = "Strong bearish alignment (EMA 20 < 50 < 200, price below)"
            else:
                out["ema_alignment"] = "MIXED"
                out["ema_alignment_label"] = "Mixed EMA alignment"
        # Momentum increasing / weakening via RSI slope + MACD hist slope
        try:
            if df is not None and "rsi" in df.columns and len(df) >= 6:
                rsi_now = float(df["rsi"].iloc[-1])
                rsi_prev = float(df["rsi"].iloc[-6])
                hist_now = float(df["macd_hist"].iloc[-1]) if "macd_hist" in df.columns else 0.0
                hist_prev = float(df["macd_hist"].iloc[-6]) if "macd_hist" in df.columns else 0.0
                rising = (rsi_now > rsi_prev) and (hist_now >= hist_prev)
                falling = (rsi_now < rsi_prev) and (hist_now <= hist_prev)
                if rsi_now >= 60 and rising:
                    out["momentum_state"] = "STRONG"
                elif rising:
                    out["momentum_state"] = "INCREASING"
                elif rsi_now <= 40 and falling:
                    out["momentum_state"] = "WEAK"
                elif falling:
                    out["momentum_state"] = "WEAKENING"
                else:
                    out["momentum_state"] = "NEUTRAL"
        except Exception:
            pass
        if tech.get("supertrend_dir") == 1.0:
            out["supertrend_state"] = "BULLISH"
        elif tech.get("supertrend_dir") == -1.0:
            out["supertrend_state"] = "BEARISH"
    except Exception as exc:
        logger.debug("compute_momentum_snapshot failed: %s", exc)
    return out


# ═══════════════════════════════════════════════════════════════════════════
# 5. MARKET REGIME (enhanced 6-state) + RELATIVE STRENGTH
# ═══════════════════════════════════════════════════════════════════════════

def classify_regime_enhanced(df: pd.DataFrame, tech: Dict[str, Any], struct: Dict[str, Any]) -> Dict[str, Any]:
    """TRENDING / RANGING / BREAKOUT / CONSOLIDATION / HIGH_VOLATILITY / LOW_VOLATILITY."""
    out = {"regime": "N/A", "trend": "N/A", "confidence": None, "reasons": []}
    try:
        adx = tech.get("adx_14")
        bbw = tech.get("bb_width_pct")
        hist_vol = tech.get("hist_vol_20")
        reasons: List[str] = []
        # Base from enriched market_regime when present
        base = None
        if df is not None and "market_regime" in df.columns and len(df):
            base = str(df["market_regime"].iloc[-1] or "")
        if struct.get("breakout") in ("BREAKOUT", "BREAKDOWN") and (struct.get("breakout_strength") or 0) >= 30:
            out["regime"] = "BREAKOUT"
            reasons.append(f"{(struct.get('breakout') or '').title()} beyond {struct.get('breakout_price')} (strength {struct.get('breakout_strength')})")
        elif struct.get("consolidation"):
            out["regime"] = "CONSOLIDATION"
            reasons.append("Tight 20-bar range with weak directional index")
        elif adx is not None and adx >= 25:
            out["regime"] = "TRENDING"
            reasons.append(f"ADX {adx:.1f} signals a firm directional trend")
        elif adx is not None and adx < 20:
            out["regime"] = "RANGING"
            reasons.append(f"ADX {adx:.1f} signals range-bound trade")
        elif base == "VOLATILITY_EXPANSION":
            out["regime"] = "HIGH_VOLATILITY"
            reasons.append("Bollinger bandwidth in top quintile with directional push")
        elif base == "RANGING_CONSOLIDATION":
            out["regime"] = "CONSOLIDATION"
            reasons.append("Classifier flags range consolidation")
        else:
            out["regime"] = "RANGING" if (adx or 0) < 22 else "TRENDING"
            reasons.append("Fallback from ADX level")
        # Volatility overlay
        if hist_vol is not None:
            if hist_vol >= 45:
                if out["regime"] in ("TRENDING", "BREAKOUT"):
                    out["regime"] = "HIGH_VOLATILITY"
                reasons.append(f"Annualised 20D volatility {hist_vol:.1f}% is elevated")
            elif hist_vol <= 15 and out["regime"] == "RANGING":
                out["regime"] = "LOW_VOLATILITY"
                reasons.append(f"Annualised 20D volatility {hist_vol:.1f}% is compressed")
        # Trend direction
        e50, e200 = tech.get("ema_50"), tech.get("ema_200")
        close = _f(df["close"].iloc[-1]) if df is not None and not df.empty else None
        if close is not None and e50 is not None and e200 is not None:
            if close > e50 and close > e200:
                out["trend"] = "BULLISH"
            elif close < e50 and close < e200:
                out["trend"] = "BEARISH"
            else:
                out["trend"] = "NEUTRAL"
        elif struct.get("trend_hint") in ("BULLISH", "BEARISH"):
            out["trend"] = struct["trend_hint"]
        else:
            out["trend"] = "NEUTRAL"
        # Confidence: ADX distance from 25 + breakout strength + EMA agreement
        conf = 55.0
        if adx is not None:
            conf += max(-15.0, min(20.0, (adx - 22.0)))
        if out["regime"] == "BREAKOUT" and struct.get("breakout_strength"):
            conf += min(15.0, float(struct["breakout_strength"]) * 0.15)
        if out["trend"] in ("BULLISH", "BEARISH"):
            conf += 5.0
        out["confidence"] = round(max(35.0, min(95.0, conf)), 1)
        out["reasons"] = reasons
    except Exception as exc:
        logger.debug("classify_regime_enhanced failed: %s", exc)
    return out


def compute_relative_strength(
    df: pd.DataFrame,
    benchmark_df: Optional[pd.DataFrame] = None,
    sector_df: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """Relative strength vs NIFTY/sector. N/A when benchmark data unavailable.

    Never synthesises a benchmark — missing data returns status UNAVAILABLE.
    """
    out = {
        "rs_vs_nifty_pct": None, "rs_vs_sector_pct": None,
        "rs_status": "UNAVAILABLE", "rs_note": "Benchmark data unavailable",
    }
    try:
        if df is None or df.empty or len(df) < 22:
            return out
        close = df["close"].astype(float)
        stock_ret_1m = (float(close.iloc[-1]) / (float(close.iloc[-22]) + 1e-9) - 1.0) * 100.0
        if benchmark_df is not None and not benchmark_df.empty and "close" in benchmark_df.columns:
            b = benchmark_df["close"].astype(float).dropna()
            if len(b) >= 22:
                bench_ret = (float(b.iloc[-1]) / (float(b.iloc[-22]) + 1e-9) - 1.0) * 100.0
                out["rs_vs_nifty_pct"] = round(stock_ret_1m - bench_ret, 2)
                out["rs_status"] = "OK"
                out["rs_note"] = "1-month excess return vs NIFTY 50 benchmark"
        if sector_df is not None and not sector_df.empty and "close" in sector_df.columns:
            s = sector_df["close"].astype(float).dropna()
            if len(s) >= 22:
                sec_ret = (float(s.iloc[-1]) / (float(s.iloc[-22]) + 1e-9) - 1.0) * 100.0
                out["rs_vs_sector_pct"] = round(stock_ret_1m - sec_ret, 2)
                if out["rs_status"] == "UNAVAILABLE":
                    out["rs_status"] = "PARTIAL"
                    out["rs_note"] = "Sector benchmark only; NIFTY benchmark unavailable"
    except Exception as exc:
        logger.debug("compute_relative_strength failed: %s", exc)
    return out


# ═══════════════════════════════════════════════════════════════════════════
# 6. TECHNICAL CONFLUENCE + TRANSPARENT AI SCORE
# ═══════════════════════════════════════════════════════════════════════════

def compute_confluence(
    tech: Dict[str, Any],
    struct: Dict[str, Any],
    vol: Dict[str, Any],
    momentum: Dict[str, Any],
    breakout: Dict[str, Any],
) -> Dict[str, Any]:
    """Technical Confluence 0-100 with component scores + human-readable reasons."""
    reasons: List[str] = []
    # Trend 0-100
    trend = 50.0
    close_v = tech.get("_close")
    e50, e200 = tech.get("ema_50"), tech.get("ema_200")
    if close_v and e50 and e200:
        if close_v > e50 and close_v > e200:
            trend = 82.0
            reasons.append(f"Price above EMA 50 ({e50:.0f}) and EMA 200 ({e200:.0f})")
        elif close_v < e50 and close_v < e200:
            trend = 22.0
            reasons.append(f"Price below EMA 50 ({e50:.0f}) and EMA 200 ({e200:.0f})")
        elif close_v > e50:
            trend = 63.0
            reasons.append(f"Price above EMA 50 ({e50:.0f}) but below EMA 200")
        else:
            trend = 38.0
            reasons.append("Price below key moving averages")
    if tech.get("supertrend_dir") == 1.0:
        trend = min(100.0, trend + 6.0)
        reasons.append("Supertrend bullish")
    elif tech.get("supertrend_dir") == -1.0:
        trend = max(0.0, trend - 6.0)
        reasons.append("Supertrend bearish")
    if (tech.get("adx_14") or 0) >= 25:
        trend = min(100.0, trend + 4.0)

    # Momentum 0-100
    rsi = tech.get("rsi_14")
    momentum_score = 50.0
    if rsi is not None:
        if 55 <= rsi <= 70:
            momentum_score = 74.0
        elif 45 <= rsi < 55:
            momentum_score = 58.0
        elif rsi > 70:
            momentum_score = 62.0
        elif rsi < 30:
            momentum_score = 30.0
        elif rsi < 45:
            momentum_score = 40.0
        reasons.append(f"RSI(14) = {rsi:.1f}")
    if tech.get("macd_bullish") is True:
        momentum_score = min(100.0, momentum_score + 10.0)
        reasons.append("MACD bullish (line above signal)")
    elif tech.get("macd_bullish") is False:
        momentum_score = max(0.0, momentum_score - 10.0)
        reasons.append("MACD bearish (line below signal)")
    if tech.get("macd_crossover") == "BULLISH_CROSSOVER":
        reasons.append("Fresh MACD bullish crossover")
        momentum_score = min(100.0, momentum_score + 4.0)
    if momentum.get("ema_alignment") == "BULLISH_ALIGNED":
        reasons.append("EMA 20 > 50 > 200 bullish alignment")
        momentum_score = min(100.0, momentum_score + 4.0)

    # Volume 0-100
    rv = vol.get("rel_volume") or 1.0
    volume_score = max(5.0, min(100.0, 45.0 + (rv - 1.0) * 35.0))
    if vol.get("volume_spike"):
        reasons.append(f"Relative volume {rv:.1f}x — institutional participation")
    else:
        reasons.append(f"Relative volume {rv:.1f}x")

    # Structure 0-100
    structure_score = 50.0
    if struct.get("bos") == "BULLISH_BOS":
        structure_score = 85.0
        reasons.append("Bullish break of structure detected")
    elif struct.get("bos") == "BEARISH_BOS":
        structure_score = 18.0
        reasons.append("Bearish break of structure detected")
    elif struct.get("choch"):
        structure_score = 55.0
        reasons.append(f"Change of character ({struct.get('choch')}) — wait for confirmation")
    elif struct.get("structure_label") == "HH/HL_UPTREND":
        structure_score = 78.0
        reasons.append("Higher-high / higher-low uptrend structure")
    elif struct.get("structure_label") == "LH/LL_DOWNTREND":
        structure_score = 25.0
        reasons.append("Lower-high / lower-low downtrend structure")
    elif struct.get("consolidation"):
        structure_score = 48.0
        reasons.append("Consolidation — no directional structure edge")
    if breakout.get("breakout_52w_high"):
        structure_score = min(100.0, structure_score + 8.0)
        reasons.append("Trading at/above 52-week high")
    if struct.get("liquidity_sweep"):
        reasons.append(f"Liquidity sweep ({struct.get('liquidity_sweep')}) — traps possible")

    # Volatility 0-100 (higher = calmer / more favourable for trend systems)
    volatility_score = 60.0
    atrp = tech.get("atr_pct")
    if atrp is not None:
        if atrp <= 1.5:
            volatility_score = 72.0
            reasons.append(f"ATR {atrp:.2f}% — controlled volatility")
        elif atrp <= 3.0:
            volatility_score = 63.0
        elif atrp <= 5.0:
            volatility_score = 48.0
            reasons.append(f"ATR {atrp:.2f}% — elevated volatility, size down")
        else:
            volatility_score = 32.0
            reasons.append(f"ATR {atrp:.2f}% — very high volatility")

    confluence = round(
        trend * 0.30 + momentum_score * 0.25 + volume_score * 0.20
        + structure_score * 0.15 + volatility_score * 0.10,
        1,
    )
    return {
        "trend": round(trend, 1),
        "momentum": round(momentum_score, 1),
        "volume": round(volume_score, 1),
        "structure": round(structure_score, 1),
        "volatility": round(volatility_score, 1),
        "confluence": confluence,
        "reasons": reasons[:12],
    }


def compute_ai_score(
    tech: Dict[str, Any],
    struct: Dict[str, Any],
    vol: Dict[str, Any],
    momentum: Dict[str, Any],
    confluence: Dict[str, Any],
    fundamentals: Dict[str, Any],
    sentiment: Optional[Dict[str, Any]] = None,
    ml_score: Optional[float] = None,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """Transparent 0-100 AI score. Every sub-score is rule-based and explained.

    weights keys: technical, momentum, volume, structure, fundamental,
    sentiment, ml_model (must sum ~1.0; normalised defensively).
    """
    w = dict(DEFAULT_AI_WEIGHTS)
    if weights:
        for k in list(w.keys()):
            if k in weights:
                try:
                    w[k] = max(0.0, float(weights[k]))
                except Exception:
                    pass
    total_w = sum(w.values()) or 1.0
    for k in w:
        w[k] = w[k] / total_w

    positives: List[str] = []
    negatives: List[str] = []

    # Technical 0-100 from confluence trend + EMA/price placement
    technical = float(confluence.get("trend", 50.0))
    close_v = tech.get("_close")
    e200 = tech.get("ema_200")
    if close_v and e200:
        if close_v > e200:
            positives.append(f"Price above EMA 200 ({e200:.0f})")
        else:
            negatives.append(f"Price below EMA 200 ({e200:.0f})")

    # Momentum 0-100
    momentum_sub = float(confluence.get("momentum", 50.0))
    if tech.get("macd_bullish") is True:
        positives.append("Positive MACD (line above signal)")
    elif tech.get("macd_bullish") is False:
        negatives.append("MACD below signal line")

    # Volume 0-100
    volume_sub = float(confluence.get("volume", 50.0))
    rv = vol.get("rel_volume") or 1.0
    if rv >= 1.5:
        positives.append(f"Volume expansion ({rv:.1f}x vs 20-day average)")
    elif rv < 0.7:
        negatives.append(f"Thin volume ({rv:.1f}x vs average)")

    # Structure 0-100
    structure_sub = float(confluence.get("structure", 50.0))
    if struct.get("bos") == "BULLISH_BOS" or struct.get("structure_label") == "HH/HL_UPTREND":
        positives.append("Bullish market structure (HH/HL or bullish BOS)")
    elif struct.get("bos") == "BEARISH_BOS" or struct.get("structure_label") == "LH/LL_DOWNTREND":
        negatives.append("Bearish market structure")

    # Fundamental 0-100 (only from real available fields; missing -> neutral 50 + note)
    fund_notes: List[str] = []
    roce = _f(fundamentals.get("roce_pct"))
    de = _f(fundamentals.get("debt_to_equity"))
    roe = _f(fundamentals.get("roe_pct"))
    pe = _f(fundamentals.get("pe_ratio"))
    fundamental = 50.0
    if roce is not None:
        fundamental += max(-15.0, min(15.0, (roce - 15.0) * 0.8))
        if roce >= 20:
            positives.append(f"High ROCE {roce:.1f}%")
        elif roce < 10:
            negatives.append(f"Weak ROCE {roce:.1f}%")
    else:
        fund_notes.append("ROCE unavailable — scored neutral")
    if de is not None:
        fundamental += max(-12.0, min(8.0, (0.6 - de) * 10.0))
        if de <= 0.3:
            positives.append(f"Low leverage (D/E {de:.2f})")
        elif de >= 1.5:
            negatives.append(f"High leverage (D/E {de:.2f})")
    else:
        fund_notes.append("Debt/Equity unavailable — scored neutral")
    if roe is not None:
        fundamental += max(-8.0, min(8.0, (roe - 14.0) * 0.5))
    if pe is not None:
        if pe > 60:
            fundamental -= 8.0
            negatives.append(f"Stretched valuation (P/E {pe:.1f}x)")
        elif 0 < pe < 18 and (roce or 0) >= 15:
            fundamental += 5.0
            positives.append(f"Reasonable valuation (P/E {pe:.1f}x)")
    fundamental = max(0.0, min(100.0, fundamental))

    # Sentiment 0-100 (neutral when unavailable — explicitly labelled)
    sentiment_sub = 50.0
    sentiment_note = "News sentiment unavailable — scored neutral"
    if sentiment and sentiment.get("score") is not None:
        try:
            sentiment_sub = max(0.0, min(100.0, float(sentiment["score"])))
            sentiment_note = str(sentiment.get("label", "Model output"))
        except Exception:
            pass

    # ML model 0-100 (neutral when no trained model — explicitly labelled)
    ml_sub = 50.0
    ml_note = "No trained ML model for this ticker — scored neutral"
    if ml_score is not None:
        try:
            ml_sub = max(0.0, min(100.0, float(ml_score)))
            ml_note = "Trained model output"
        except Exception:
            pass

    score = round(
        technical * w["technical"] + momentum_sub * w["momentum"]
        + volume_sub * w["volume"] + structure_sub * w["structure"]
        + fundamental * w["fundamental"] + sentiment_sub * w["sentiment"]
        + ml_sub * w["ml_model"],
        1,
    )
    if score >= 80:
        signal = "STRONG BUY"
    elif score >= 65:
        signal = "BUY"
    elif score >= 45:
        signal = "NEUTRAL"
    elif score >= 30:
        signal = "AVOID"
    else:
        signal = "SELL"

    # ── Structural Signal Verification ──────────────────────────────────────
    # EMA position is a MANDATORY gating factor for directional signals.
    # A BUY/STRONG BUY requires price to be above EMA 200 at minimum — RSI
    # or MACD alone cannot override a bearish EMA structure.
    # A SELL/AVOID requires price to be below EMA 200 at minimum.
    # This eliminates confusing "BEARISH EMA trend + BUY signal" contradictions.
    #
    # EMA position score (ema_bull / ema_bear):
    #   BULLISH_ALIGNED (price > EMA20 > EMA50 > EMA200) → 2  (strongest)
    #   price > EMA 200                                   → 1
    #   BEARISH_ALIGNED or price < EMA 200                → 0  (blocks BUY)
    #
    # Signal rules:
    #   STRONG BUY → ema_bull = 2 (BULLISH_ALIGNED mandatory) + 1 more confirmation
    #   BUY        → ema_bull ≥ 1 (price above EMA200 mandatory) + RSI or MACD bull
    #   AVOID      → ema_bear ≥ 1
    #   SELL       → ema_bear = 2 (BEARISH_ALIGNED mandatory) + 1 more confirmation
    # ------------------------------------------------------------------
    _ema_align = momentum.get("ema_alignment", "")
    _close     = tech.get("_close")
    _e200      = tech.get("ema_200")
    _rsi       = tech.get("rsi_14")
    _macd_bull = tech.get("macd_bullish")

    # EMA position score (mandatory gate: price must be on the right side of EMA 200)
    ema_bull = (2 if (_ema_align == "BULLISH_ALIGNED" and _close and _e200 and _close > _e200)
                else 1 if (_close and _e200 and _close > _e200)
                else 0)
    ema_bear = (2 if (_ema_align == "BEARISH_ALIGNED" and _close and _e200 and _close < _e200)
                else 1 if (_close and _e200 and _close < _e200)
                else 0)

    # Additional confirmations (momentum support)
    rsi_bull = 1 if (_rsi is not None and _rsi > 50) else 0
    rsi_bear = 1 if (_rsi is not None and _rsi < 50) else 0
    macd_bull_conf = 1 if _macd_bull is True else 0
    macd_bear_conf = 1 if _macd_bull is False else 0

    bull_conf = ema_bull + rsi_bull + macd_bull_conf
    bear_conf = ema_bear + rsi_bear + macd_bear_conf

    # Apply gating: EMA position is non-negotiable
    if signal in ("STRONG BUY", "BUY") and ema_bull == 0:
        # EMA structure is bearish/flat — cannot issue a bullish signal
        signal = "NEUTRAL"
    elif signal == "STRONG BUY" and (ema_bull < 2 or bull_conf < 3):
        # STRONG BUY needs full BULLISH_ALIGNED + additional momentum
        signal = "BUY" if bull_conf >= 2 else "NEUTRAL"
    elif signal == "BUY" and bull_conf < 2:
        # BUY needs price > EMA200 + at least one more confirmation
        signal = "NEUTRAL"
    elif signal in ("SELL", "AVOID") and ema_bear == 0:
        # EMA structure is bullish/flat — cannot issue a bearish signal
        signal = "NEUTRAL"
    elif signal == "SELL" and (ema_bear < 2 or bear_conf < 3):
        signal = "AVOID" if bear_conf >= 2 else "NEUTRAL"
    elif signal == "AVOID" and bear_conf < 2:
        signal = "NEUTRAL"

    # Swing structure gating: price structure and signal MUST NOT contradict.
    # If the recent swing pivots form a lower-high/lower-low pattern (trend_hint == 'BEARISH'),
    # the stock is in a pullback or distribution — it CANNOT be a BUY or STRONG BUY.
    _trend_hint = str(struct.get("trend_hint") or "").upper()
    if _trend_hint == "BEARISH" and signal in ("STRONG BUY", "BUY"):
        signal = "NEUTRAL"
    elif _trend_hint == "BULLISH" and signal in ("SELL", "AVOID"):
        signal = "NEUTRAL"
    # ── End verification ─────────────────────────────────────────────────────


    return {
        "ai_score": score,
        "ai_signal": signal,
        "ai_confidence": round(max(30.0, min(97.0, 45.0 + abs(score - 50.0) * 0.9)), 1),
        "weights": {k: round(v, 3) for k, v in w.items()},
        "components": {
            "technical": round(technical, 1),
            "momentum": round(momentum_sub, 1),
            "volume": round(volume_sub, 1),
            "structure": round(structure_sub, 1),
            "fundamental": round(fundamental, 1),
            "sentiment": round(sentiment_sub, 1),
            "ml_model": round(ml_sub, 1),
        },
        "positives": positives[:8],
        "negatives": negatives[:8],
        "notes": fund_notes + [sentiment_note, ml_note],
    }


def build_why_explanation(
    ticker: str,
    tech: Dict[str, Any],
    vol: Dict[str, Any],
    momentum: Dict[str, Any],
    struct: Dict[str, Any],
    rs: Dict[str, Any],
    ai: Dict[str, Any],
    regime: Dict[str, Any],
) -> List[str]:
    """'Why is this stock appearing?' — only supported claims, each traceable."""
    why: List[str] = []
    e50, e200 = tech.get("ema_50"), tech.get("ema_200")
    close_v = tech.get("_close")
    if close_v and e50 and e200:
        if close_v > e50 and close_v > e200:
            why.append(f"Price above EMA 50 ({e50:.0f}) and EMA 200 ({e200:.0f}).")
        elif close_v > e50:
            why.append(f"Price above EMA 50 ({e50:.0f}).")
    rv = vol.get("rel_volume")
    if rv is not None:
        why.append(f"Relative volume is {rv:.1f}x the 20-day average.")
    if tech.get("macd_crossover") == "BULLISH_CROSSOVER":
        why.append("Fresh MACD bullish crossover detected.")
    elif tech.get("macd_bullish") is True:
        why.append("MACD line is above its signal line.")
    if momentum.get("ema_alignment") == "BULLISH_ALIGNED":
        why.append("EMA 20 > EMA 50 > EMA 200 bullish alignment.")
    if struct.get("bos") == "BULLISH_BOS":
        lvl = struct.get("breakout_price")
        why.append(f"Bullish break of structure above {lvl}." if lvl else "Bullish break of structure.")
    if rs.get("rs_vs_nifty_pct") is not None:
        direction = "positive" if rs["rs_vs_nifty_pct"] >= 0 else "negative"
        why.append(f"1-month relative strength vs NIFTY is {direction} ({rs['rs_vs_nifty_pct']:+.1f}%).")
    if regime.get("regime") and regime.get("regime") != "N/A":
        why.append(f"Market regime classified as {regime['regime']} with {regime.get('confidence', '?')}% confidence.")
    if tech.get("rsi_14") is not None:
        why.append(f"RSI(14) reads {tech['rsi_14']:.1f}.")
    # Cap + ticker prefix removed (caller adds header); keep factual only
    return why[:8]


# ═══════════════════════════════════════════════════════════════════════════
# 7. SECTOR ROTATION + MARKET BREADTH (from real screener rows)
# ═══════════════════════════════════════════════════════════════════════════

def compute_sector_rotation(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Groups real screener rows by sector into Strong/Improving/Weakening/Weak.

    Score ingredients (all real): avg 1D change, % above EMA proxy
    (price > sma_50), avg AI score, avg relative volume, breadth.
    """
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        sec = (r.get("sector") or "Diversified").strip() or "Diversified"
        buckets.setdefault(sec, []).append(r)
    out = []
    for sec, items in buckets.items():
        n = len(items)
        try:
            avg_chg = float(np.mean([float(x.get("change_1d_pct") or 0.0) for x in items]))
            avg_ai = float(np.mean([float(x.get("ai_consensus_score") or 50.0) for x in items]))
            avg_rv = float(np.mean([float(x.get("volume_ratio_20d") or 1.0) for x in items]))
            above = sum(1 for x in items if (x.get("close_price") or 0) > (x.get("sma_50") or float("inf")))
            breadth_pct = round(above / max(1, n) * 100.0, 1)
            bullish = sum(1 for x in items if str(x.get("ai_signal") or "").upper() in ("BUY", "STRONG BUY"))
            # Composite -100..+100
            composite = (
                max(-30.0, min(30.0, avg_chg * 8.0)) * 0.35
                + (avg_ai - 55.0) * 0.35
                + (breadth_pct - 50.0) * 0.20
                + max(-10.0, min(10.0, (avg_rv - 1.0) * 10.0)) * 0.10
            )
            if composite >= 12:
                bucket = "Strong"
            elif composite >= 2:
                bucket = "Improving"
            elif composite > -6:
                bucket = "Weakening"
            else:
                bucket = "Weak"
            out.append({
                "sector": sec,
                "stocks": n,
                "avg_change_1d_pct": round(avg_chg, 2),
                "avg_ai_score": round(avg_ai, 1),
                "avg_rel_volume": round(avg_rv, 2),
                "breadth_pct": breadth_pct,
                "bullish": bullish,
                "bearish": sum(1 for x in items if str(x.get("ai_signal") or "").upper() in ("SELL", "AVOID")),
                "quadrant": bucket,
                "composite": round(composite, 1),
                "data_status": "OK",
            })
        except Exception as exc:
            logger.debug("sector %s failed: %s", sec, exc)
    out.sort(key=lambda x: x["composite"], reverse=True)
    return out


def compute_market_breadth(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Advancing/declining, new highs/lows, above-EMA counts, bull/bear %."""
    total = len(rows)
    if total == 0:
        return {
            "total": 0, "advancing": 0, "declining": 0, "unchanged": 0,
            "new_highs": 0, "new_lows": 0, "above_ema20": 0, "above_ema50": 0,
            "above_ema200": 0, "bullish_pct": 0.0, "bearish_pct": 0.0,
            "data_status": "N/A",
        }
    adv = sum(1 for r in rows if (r.get("change_1d_pct") or 0) > 0.05)
    dec = sum(1 for r in rows if (r.get("change_1d_pct") or 0) < -0.05)
    new_highs = sum(1 for r in rows if (r.get("distance_52w_high_pct") or -100) >= -1.0)
    new_lows = sum(1 for r in rows if (r.get("distance_52w_low_pct") or 100) <= 1.0)
    above20 = sum(1 for r in rows if (r.get("close_price") or 0) > (r.get("sma_20") or float("inf")))
    above50 = sum(1 for r in rows if (r.get("close_price") or 0) > (r.get("sma_50") or float("inf")))
    above200 = sum(1 for r in rows if (r.get("close_price") or 0) > (r.get("sma_200") or float("inf")))
    bull = sum(1 for r in rows if str(r.get("ai_signal") or "").upper() in ("BUY", "STRONG BUY"))
    bear = sum(1 for r in rows if str(r.get("ai_signal") or "").upper() in ("SELL", "AVOID"))
    return {
        "total": total,
        "advancing": adv,
        "declining": dec,
        "unchanged": total - adv - dec,
        "new_highs": new_highs,
        "new_lows": new_lows,
        "above_ema20": above20,
        "above_ema50": above50,
        "above_ema200": above200,
        "above_ema20_pct": round(above20 / total * 100.0, 1),
        "above_ema50_pct": round(above50 / total * 100.0, 1),
        "above_ema200_pct": round(above200 / total * 100.0, 1),
        "bullish_pct": round(bull / total * 100.0, 1),
        "bearish_pct": round(bear / total * 100.0, 1),
        "data_status": "OK",
        "timestamp": datetime.now().isoformat(),
    }


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


def compute_overview_cards(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Clickable header cards — every count derived from real row fields.

    INVARIANT: each count MUST equal the number of rows the frontend gets when
    the matching card in ``frontend/src/components/screener/screenerColumns.js``
    (``OVERVIEW_CARDS``) is clicked and its ``dsl`` is executed by
    ``backend/research/screener_dsl.parse_screener_query``.

    Therefore:
      * every predicate below uses the SAME field and the SAME operator as the
        card DSL (``>`` stays ``>``, never silently promoted to ``>=``), and
      * NULL / missing values are excluded exactly like SQL does — never
        defaulted to a neutral value (a default would inflate the count and the
        card would lie about how many rows are behind it).

    Keep this table and OVERVIEW_CARDS in lockstep; change one, change both.
    """
    n = lambda r, k: _card_num(r, k)  # noqa: E731 - terse alias, local only

    def _cmp(r, key, op, val):
        v = n(r, key)
        if v is None:
            return False
        return v > val if op == ">" else v < val

    total = len(rows)                                                  # TOTAL
    bullish = sum(1 for r in rows if _cmp(r, "ai_consensus_score", ">", 65))          # AIConsensus > 65
    bearish = sum(1 for r in rows if _cmp(r, "ai_consensus_score", "<", 45))          # AIConsensus < 45
    neutral = sum(1 for r in rows if (lambda v: v is not None and 45 <= v <= 65)(n(r, "ai_consensus_score")))
    breakouts = sum(1 for r in rows if _cmp(r, "distance_52w_high_pct", ">", -2))      # Distance52WHigh > -2
    breakdowns = sum(1 for r in rows if _cmp(r, "distance_52w_low_pct", "<", 2))       # Distance52WLow < 2
    vol_surges = sum(1 for r in rows if _cmp(r, "volume_ratio_20d", ">", 1.5))         # VolumeRatio20D > 1.5
    oversold = sum(1 for r in rows if _cmp(r, "rsi_14", "<", 35))                      # RSI14 < 35
    overbought = sum(1 for r in rows if _cmp(r, "rsi_14", ">", 70))                    # RSI14 > 70
    high_mom = sum(                                                                   # RSI14 > 55 AND VolumeRatio20D > 1.2
        1 for r in rows if _cmp(r, "rsi_14", ">", 55) and _cmp(r, "volume_ratio_20d", ">", 1.2)
    )
    ai_high = sum(1 for r in rows if _cmp(r, "ai_consensus_score", ">", 80))           # AIConsensus > 80
    return {
        "total": total, "bullish": bullish, "bearish": bearish, "neutral": neutral,
        "breakouts": breakouts, "breakdowns": breakdowns, "volume_surges": vol_surges,
        "oversold": oversold, "overbought": overbought, "high_momentum": high_mom,
        "ai_high_confidence": ai_high,
    }
