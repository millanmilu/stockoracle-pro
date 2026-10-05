"""StockOracle Pro — volume, breakout, momentum, regime & relative-strength engines.


Split verbatim out of ``backend/research/screener_engines.py`` (pure code motion).
"""

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from .screener_shared import logger, _f

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
