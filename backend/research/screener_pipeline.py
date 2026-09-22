"""
StockOracle Pro — Screener Daily Metrics Live Refresh Pipeline
Fetches fresh market data for all NSE universe stocks, computes live indicators (RSI 14, Volume Ratio 20D,
52W High/Low distance, SMA crossovers, Returns 1D/1W/1M/1Y), AI consensus scores, and updates SQLite.
"""
import logging
import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

from backend.data.fetcher import fetch_stock_data, fetch_company_info
from backend.data.database import upsert_screener_daily_metric
from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE
from backend.analysis.indicators import calculate_rsi, calculate_sma

logger = logging.getLogger("StockOracle.Research.Pipeline")


def compute_metrics_from_ohlcv(ticker: str, df: pd.DataFrame, meta: Optional[Dict[str, Any]] = None,
                              use_live_price: bool = True) -> Optional[Dict[str, Any]]:
    """
    Computes all standard screener indicators from 1-year daily OHLCV DataFrame and real-time LTP.

    use_live_price=False skips the per-ticker company-info/LTP call (saves
    broker quota during bulk backfills). All outputs then derive purely from
    the OHLCV frame + curated meta — still 100% real data.
    """
    if df is None or df.empty or len(df) < 5:
        return None

    meta = meta or {}
    df = df.copy()
    if "close" not in df.columns:
        return None

    close_series = df["close"].astype(float)
    vol_series = df["volume"].astype(float) if "volume" in df.columns else pd.Series([100000] * len(df))

    # Real-time company info / LTP integration
    company_info = (fetch_company_info(ticker) or {}) if use_live_price else {}
    live_price = float(company_info.get("price") or company_info.get("current_price") or close_series.iloc[-1])
    live_change_pct = float(company_info.get("change_pct") or company_info.get("changePercent") or 0.0)

    # Current close & previous close
    curr_close = live_price if live_price > 0 else float(close_series.iloc[-1])
    prev_close = float(close_series.iloc[-2]) if len(close_series) >= 2 else curr_close
    change_1d = live_change_pct if live_change_pct != 0.0 else round(((curr_close - prev_close) / (prev_close + 1e-9)) * 100.0, 2)

    # 1-week, 1-month, 1-year returns
    idx_1w = max(0, len(close_series) - 5)
    close_1w = float(close_series.iloc[idx_1w])
    change_1w = round(((curr_close - close_1w) / (close_1w + 1e-9)) * 100.0, 2)

    idx_1m = max(0, len(close_series) - 22)
    close_1m = float(close_series.iloc[idx_1m])
    change_1m = round(((curr_close - close_1m) / (close_1m + 1e-9)) * 100.0, 2)

    close_1y = float(close_series.iloc[0])
    change_1y = round(((curr_close - close_1y) / (close_1y + 1e-9)) * 100.0, 2)

    # 52-week High / Low (real OHLCV first; company info only as fallback).
    # Order matters: fetch_company_info invents a ±15% band when it has no
    # verified 52W data, so the real 1Y OHLCV range must win whenever present.
    high_52w = (float(df["high"].max()) if "high" in df.columns else None) or company_info.get("fifty_two_week_high")
    low_52w = (float(df["low"].min()) if "low" in df.columns else None) or company_info.get("fifty_two_week_low")
    dist_high = round(((curr_close - high_52w) / (high_52w + 1e-9)) * 100.0, 2) if high_52w else None
    dist_low = round(((curr_close - low_52w) / (low_52w + 1e-9)) * 100.0, 2) if low_52w else None

    # Technical indicators
    rsi_s = calculate_rsi(close_series, 14)
    rsi_14 = round(float(rsi_s.iloc[-1]), 1)

    sma_20_s = calculate_sma(close_series, 20)
    sma_20 = round(float(sma_20_s.iloc[-1]), 2)

    sma_50_s = calculate_sma(close_series, 50)
    sma_50 = round(float(sma_50_s.iloc[-1]), 2)

    sma_200_s = calculate_sma(close_series, 200)
    sma_200 = round(float(sma_200_s.iloc[-1]), 2)

    # Volume ratio (current volume vs 20-day SMA volume)
    vol_20_sma = calculate_sma(vol_series, 20)
    curr_vol = float(vol_series.iloc[-1])
    avg_vol = float(vol_20_sma.iloc[-1]) if len(vol_20_sma) > 0 else 1.0
    vol_ratio = round(curr_vol / (avg_vol + 1e-9), 2) if avg_vol > 0 else 1.0

    # Trend & MACD signal heuristic
    macd_signal = "BULLISH" if rsi_14 > 50 and curr_close >= sma_20 else "BEARISH"

    # Fundamentals: preserved from curated meta when available, else NULL.
    # Zero-fake-data rule: never invent PE/ROCE/market-cap numbers for tickers
    # without curated fundamentals — leave them NULL so IS NULL screens can
    # discover data-missing rows instead of reading invented values.
    roce = meta.get("roce_pct")
    roe = meta.get("roe_pct")
    pe = meta.get("pe_ratio")
    pb = meta.get("pb_ratio")
    debt_eq = meta.get("debt_to_equity")
    market_cap_cr = meta.get("market_cap_cr")

    # Market cap categorization (NULL when market cap unknown)
    if market_cap_cr is None:
        market_cap_cat = None
    elif market_cap_cr >= 50000.0:
        market_cap_cat = "LARGE"
    elif market_cap_cr >= 10000.0:
        market_cap_cat = "MID"
    else:
        market_cap_cat = "SMALL"

    # ── Institutional layered engines (all deterministic, real-data only) ──
    # Base row keeps legacy behaviour; engines enrich with traceable metrics.
    import json as _json
    tech = {"rsi_14": rsi_14, "_close": curr_close}
    struct: Dict[str, Any] = {}
    vol_snap: Dict[str, Any] = {"rel_volume": vol_ratio}
    momentum: Dict[str, Any] = {}
    breakout: Dict[str, Any] = {}
    regime: Dict[str, Any] = {"regime": "N/A", "trend": "N/A", "confidence": None, "reasons": []}
    confluence: Dict[str, Any] = {}
    ai: Dict[str, Any] = {}
    pos_52w = None
    try:
        from backend.analysis.indicators import enrich_stock_dataframe
        from backend.research.screener_engines import (
            compute_technical_snapshot, detect_market_structure,
            compute_volume_snapshot, compute_breakout_snapshot,
            compute_momentum_snapshot, classify_regime_enhanced,
            compute_confluence, compute_ai_score, build_why_explanation,
        )
        edf = enrich_stock_dataframe(df, use_cache=True, cache_key=f"screener:{ticker}")
        tech = compute_technical_snapshot(edf)
        tech["_close"] = curr_close
        struct = detect_market_structure(edf)
        vol_snap = compute_volume_snapshot(edf)
        if vol_snap.get("rel_volume") is None:
            vol_snap["rel_volume"] = vol_ratio
        momentum = compute_momentum_snapshot(edf, tech)
        breakout = compute_breakout_snapshot(edf, tech, struct, vol_snap, high_52w, low_52w)
        regime = classify_regime_enhanced(edf, tech, struct)
        confluence = compute_confluence(tech, struct, vol_snap, momentum, breakout)
        fundamentals = {"roce_pct": roce, "roe_pct": roe, "debt_to_equity": debt_eq, "pe_ratio": pe}
        ai = compute_ai_score(tech, struct, vol_snap, momentum, confluence, fundamentals)
        # Real enriched values override legacy heuristics where available
        if tech.get("rsi_14") is not None:
            rsi_14 = round(float(tech["rsi_14"]), 1)
        if tech.get("macd_bullish") is True:
            macd_signal = "BULLISH"
        elif tech.get("macd_bullish") is False:
            macd_signal = "BEARISH"
        # Prefer engine AI score (transparent, weighted) over legacy heuristic.
        # NOTE: never use ai_score/ai_sig/ai_conf as .get() defaults here — they
        # are unbound until this line runs (UnboundLocalError), which silently
        # forced every ticker onto the legacy fallback path.
        ai_score = float(ai["ai_score"])
        ai_sig = str(ai.get("ai_signal", "NEUTRAL"))
        ai_conf = float(ai.get("ai_confidence", round(ai_score * 0.95 + 4, 1)))
    except Exception as exc:
        logger.debug("Screener engines enrichment failed for %s: %s", ticker, exc)
        # Legacy fallback score (kept for resilience, still real-data derived).
        # None-guarded: tickers without curated fundamentals (e.g. small caps
        # with N/A values) must not crash the fallback path — and missing
        # fundamentals contribute a neutral term instead of an invented one.
        _roce_term = (roce * 0.4) if roce is not None else 6.6  # == old 16.5 default contribution
        _de_term = (debt_eq * 10) if debt_eq is not None else 4.5  # == old 0.45 default contribution
        ai_score = round(35.0 + _roce_term + (18 if 45 <= rsi_14 <= 68 else 4) - _de_term + (8 if curr_close > sma_50 else 0), 1)
        ai_score = max(20.0, min(96.0, ai_score))
        if ai_score >= 80 and curr_close > (sma_50 or 0) and (sma_200 is None or curr_close > sma_200):
            ai_sig = "STRONG BUY"
        elif ai_score >= 65 and curr_close > (sma_50 or 0) and (sma_200 is None or curr_close > sma_200):
            ai_sig = "BUY"
        elif ai_score >= 45:
            ai_sig = "NEUTRAL"
        elif curr_close < (sma_50 or float("inf")):
            ai_sig = "AVOID"
        else:
            ai_sig = "SELL"
        ai_conf = round(ai_score * 0.95 + 4, 1)

    # 52W position 0-100 (real, from verified high/low)
    try:
        if high_52w and low_52w and high_52w > low_52w:
            pos_52w = round((curr_close - low_52w) / (high_52w - low_52w) * 100.0, 1)
            pos_52w = max(0.0, min(100.0, pos_52w))
    except Exception:
        pos_52w = None

    # Why-explanation (supported claims only)
    why: List[str] = []
    try:
        from backend.research.screener_engines import build_why_explanation as _why
        rs_stub = {"rs_vs_nifty_pct": None}
        why = _why(ticker, tech, vol_snap, momentum, struct, rs_stub, ai, regime)
    except Exception:
        why = []

    base = {
        "ticker": ticker,
        "name": company_info.get("name") or company_info.get("companyName") or meta.get("name", ticker),
        "sector": meta.get("sector", "Diversified"),
        "industry": meta.get("industry", "General"),
        "market_cap_cr": market_cap_cr,
        "market_cap_cat": market_cap_cat,
        "close_price": curr_close,
        "change_1d_pct": change_1d,
        "change_1w_pct": change_1w,
        "change_1m_pct": change_1m,
        "change_1y_pct": change_1y,
        "distance_52w_high_pct": dist_high,
        "distance_52w_low_pct": dist_low,
        "rsi_14": rsi_14,
        "macd_signal": macd_signal,
        "sma_20": sma_20,
        "sma_50": sma_50,
        "sma_200": sma_200,
        "volume_ratio_20d": vol_snap.get("rel_volume", vol_ratio),
        "pe_ratio": pe,
        "pb_ratio": pb,
        "roe_pct": roe,
        "roce_pct": roce,
        "debt_to_equity": debt_eq,
        "sales_growth_3y": meta.get("sales_growth_3y"),
        "profit_growth_3y": meta.get("profit_growth_3y"),
        "pcr": meta.get("pcr"),
        "max_pain": meta.get("max_pain"),
        "iv": meta.get("iv"),
        "ai_consensus_score": round(float(ai_score), 1),
        "ai_signal": ai_sig,
        "ai_confidence_score": round(float(ai_conf), 1),
        "data_status": "OK",
    }
    # Extended institutional metrics (None-safe; DB upsert ignores Nones)
    try:
        base.update({
            "ema_9": tech.get("ema_9"), "ema_20": tech.get("ema_20"),
            "ema_50": tech.get("ema_50"), "ema_200": tech.get("ema_200"),
            "adx_14": tech.get("adx_14"), "atr_pct": tech.get("atr_pct"),
            "bb_width_pct": tech.get("bb_width_pct"), "bb_position": tech.get("bb_position"),
            "stoch_k": tech.get("stoch_k"), "stoch_d": tech.get("stoch_d"),
            "cci_20": tech.get("cci_20"), "roc_12": tech.get("roc_12"),
            "williams_r": tech.get("williams_r"), "macd_hist": tech.get("macd"),
            "macd_crossover": tech.get("macd_crossover"),
            "supertrend_dir": tech.get("supertrend_dir"),
            "vwap_dist_pct": tech.get("vwap_dist_pct"), "hist_vol_20": tech.get("hist_vol_20"),
            "high_52w": high_52w, "low_52w": low_52w, "pos_52w_pct": pos_52w,
            "structure_label": struct.get("structure_label"), "trend_hint": struct.get("trend_hint"),
            "support_price": struct.get("support"), "resistance_price": struct.get("resistance"),
            "breakout_52w_high": int(bool(breakout.get("breakout_52w_high"))),
            "breakdown_52w_low": int(bool(breakout.get("breakdown_52w_low"))),
            "resistance_breakout": int(bool(breakout.get("resistance_breakout"))),
            "support_breakdown": int(bool(breakout.get("support_breakdown"))),
            "volume_breakout": int(bool(breakout.get("volume_breakout"))),
            "breakout_strength": struct.get("breakout_strength"),
            "retest_status": struct.get("retest_status"),
            "consolidation": int(bool(struct.get("consolidation"))),
            "liquidity_sweep": struct.get("liquidity_sweep"),
            "momentum_state": momentum.get("momentum_state"),
            "ema_alignment": momentum.get("ema_alignment"),
            "market_regime": regime.get("regime"), "regime_confidence": regime.get("confidence"),
            "rs_vs_nifty_pct": None, "rs_vs_sector_pct": None,
            "confluence_score": confluence.get("confluence"),
            "ai_trend_score": (confluence.get("trend")),
            "ai_momentum_score": (confluence.get("momentum")),
            "ai_volatility_score": (confluence.get("volatility")),
            "ai_pattern_score": (confluence.get("structure")),
            "sentiment_score": None, "sentiment_label": "N/A", "news_count": 0,
            "why_json": _json.dumps(why[:8]),
            "confluence_json": _json.dumps({
                "components": {k: confluence.get(k) for k in ["trend", "momentum", "volume", "structure", "volatility"]},
                "reasons": (confluence.get("reasons") or [])[:10],
                "regime": regime,
                "weights": (ai.get("weights") if ai else None),
                "ai_components": (ai.get("components") if ai else None),
                "positives": (ai.get("positives") if ai else []),
                "negatives": (ai.get("negatives") if ai else []),
            })[:4000],
        })
    except Exception as exc:
        logger.debug("Extended metrics attach failed for %s: %s", ticker, exc)
    return base


def build_refresh_targets() -> List[Dict[str, Any]]:
    """Curated master universe UNION all official index constituents.

    Index-only tickers (e.g. HINDUNILVR, ETERNAL, JIOFIN) get skeleton meta;
    their fundamentals stay NULL until real OHLCV/fundamentals are computed —
    never fabricated.
    """
    targets: Dict[str, Dict[str, Any]] = {}
    for m in MASTER_NSE_UNIVERSE:
        t = str(m["ticker"]).upper().strip()
        entry = dict(m)
        entry["ticker"] = t
        targets[t] = entry
    try:
        from backend.data.index_constituents import INDEX_CONSTITUENTS
        for syms in INDEX_CONSTITUENTS.values():
            for raw in syms:
                t = str(raw).upper().strip()
                if t and t not in targets:
                    targets[t] = {
                        "ticker": t, "name": t, "sector": None, "industry": None,
                        "market_cap_cr": None, "market_cap_cat": None,
                    }
    except Exception as exc:
        logger.warning("Index constituents unavailable for refresh targets: %s", exc)
    return list(targets.values())


def _fetch_with_retry(ticker: str, max_attempts: int = 3) -> Optional[pd.DataFrame]:
    """Fetches 1Y daily OHLCV, riding out broker rate-limit cooldowns.

    Angel One throttles historical-data bursts; while throttled every call
    short-circuits to an empty frame. Treating that as "no data" would skip
    hundreds of tickers permanently, so: when the fetcher reports an active
    rate-limit cooldown, sleep past it (plus a refill buffer) and retry;
    otherwise one short retry covers transient blips before giving up.
    """
    import backend.data.fetcher as _fetcher

    df = None
    for attempt in range(max_attempts):
        try:
            df = fetch_stock_data(ticker, period="1Y", interval="1d")
        except Exception:
            df = None
        if df is not None and not df.empty and len(df) >= 5:
            return df
        if attempt >= max_attempts - 1:
            break
        try:
            cooldown = float(getattr(_fetcher, "_broker_rate_limited_until", 0.0)) - time.time()
        except Exception:
            cooldown = 0.0
        wait = max(cooldown + 7.0, 8.0) if cooldown > 0 else 5.0
        logger.info("Screener fetch for %s empty (attempt %d/%d) — retrying in %.0fs.",
                    ticker, attempt + 1, max_attempts, wait)
        time.sleep(wait)
    return df


def refresh_screener_metrics_for_tickers(tickers: List[str], sleep_s: float = 1.0, limit: Optional[int] = None) -> Dict[str, Any]:
    """Backfill path: fetches REAL 1Y daily OHLCV per ticker and upserts computed metrics.

    Unlike the curated seeder this never writes placeholder fundamentals:
    tickers without curated meta get NULL PE/ROCE/market-cap until real data
    exists. Synthesized broker data is rejected outright.
    """
    curated = {str(m["ticker"]).upper().strip(): m for m in MASTER_NSE_UNIVERSE}
    results: Dict[str, Any] = {"updated": 0, "skipped": 0, "failed": 0, "synthesized": 0, "errors": []}
    processed = 0
    for raw in tickers:
        if limit is not None and processed >= limit:
            break
        ticker = str(raw).upper().strip()
        if not ticker:
            continue
        try:
            df = _fetch_with_retry(ticker)
            if df is None or df.empty or len(df) < 5:
                results["skipped"] += 1
                processed += 1
                if sleep_s > 0:
                    time.sleep(sleep_s)
                continue
            data_source = df.attrs.get("data_source") or "unknown"
            if data_source in {"synthesized", "synthesized_market_baseline"}:
                results["synthesized"] += 1
                results["errors"].append(f"{ticker}: synthesized data rejected")
                processed += 1
                if sleep_s > 0:
                    time.sleep(sleep_s)
                continue
            metrics = compute_metrics_from_ohlcv(ticker, df, curated.get(ticker), use_live_price=False)
            if metrics:
                upsert_screener_daily_metric(metrics)
                results["updated"] += 1
            else:
                results["skipped"] += 1
        except Exception as exc:
            results["failed"] += 1
            results["errors"].append(f"{ticker}: {exc}")
        processed += 1
        if processed % 10 == 0:
            logger.info("Screener backfill progress: %d processed (%d updated, %d skipped, %d failed).",
                        processed, results["updated"], results["skipped"], results["failed"])
        if sleep_s > 0:
            time.sleep(sleep_s)
    return results


def refresh_screener_metrics_from_market() -> Dict[str, Any]:
    """
    Synchronously updates metrics for all stocks in the master universe +
    official index constituents using fresh market data.
    """
    targets = build_refresh_targets()
    logger.info("Initiating market metrics refresh for Screener universe (%d tickers)...", len(targets))
    updated_count = 0
    errors = []

    for item in targets:
        ticker = item["ticker"]
        try:
            df = _fetch_with_retry(ticker)
            time.sleep(1.0)  # pace broker historical-data calls; throttles cascade otherwise
            if df is not None and not df.empty and len(df) >= 5:
                # Guard: never upsert metrics derived from synthetic/random-walk data.
                data_source = df.attrs.get("data_source") or "unknown"
                if data_source in {"synthesized", "synthesized_market_baseline"}:
                    logger.warning(
                        "Screener skipping %s — fetch_stock_data returned synthesized data "
                        "(broker offline or no verified records). Existing DB row preserved.",
                        ticker,
                    )
                    errors.append(f"{ticker}: synthesized data rejected — DB row unchanged")
                    continue
                metrics = compute_metrics_from_ohlcv(ticker, df, item)
                if metrics:
                    upsert_screener_daily_metric(metrics)
                    updated_count += 1
            else:
                # Update with company info LTP if available
                c_info = fetch_company_info(ticker)
                if c_info and (c_info.get("price") or c_info.get("current_price")):
                    item_copy = dict(item)
                    item_copy["close_price"] = float(c_info.get("price") or c_info.get("current_price"))
                    item_copy["change_1d_pct"] = float(c_info.get("change_pct") or c_info.get("changePercent") or item.get("change_1d_pct") or 0.0)
                    upsert_screener_daily_metric(item_copy)
                    updated_count += 1
                else:
                    # No real data available; leave the existing DB row intact rather than
                    # overwriting with stale hardcoded seed values.
                    logger.info(
                        "Screener skipping %s — no real price data available. Existing DB row preserved.",
                        ticker,
                    )
        except Exception as exc:
            logger.warning("Metrics refresh failed for %s: %s", ticker, exc)
            errors.append(f"{ticker}: {str(exc)}")
            # Do NOT fall back to upsert_screener_daily_metric(item) here; that would
            # overwrite a previously-valid DB row with hardcoded seed data.


    logger.info("Screener metrics refresh complete. %d/%d stocks updated.", updated_count, len(targets))
    return {
        "status": "success",
        "updated": updated_count,
        "total": len(targets),
        "timestamp": datetime.now().isoformat(),
        "errors": errors[:5]
    }


SCREENER_REFRESH_HOUR_IST = 16
SCREENER_REFRESH_MINUTE_IST = 15  # NSE close 15:30 IST + settlement buffer


def next_screener_refresh_delay_seconds(now: Optional[datetime] = None) -> float:
    """Seconds until the next 16:15 IST weekday refresh (never <= 60; skips weekends)."""
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("Asia/Kolkata")
    if now is None:
        now = datetime.now(tz)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=tz)
    else:
        now = now.astimezone(tz)
    candidate = now.replace(hour=SCREENER_REFRESH_HOUR_IST, minute=SCREENER_REFRESH_MINUTE_IST,
                            second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    while candidate.weekday() >= 5:  # Saturday/Sunday — market closed
        candidate += timedelta(days=1)
    return max(60.0, (candidate - now).total_seconds())


async def run_screener_refresh_loop():
    """
    Background worker: daily screener metrics refresh at 16:15 IST (post-close).

    Bootstraps immediately when the metrics table is nearly empty (first boot
    after an upgrade), then re-runs every weekday after market close. A failed
    cycle retries after an hour so a transient broker outage never skips a day.
    """
    logger.info("Starting background screener metrics refresh daemon (daily 16:15 IST)...")
    first_pass = True
    while True:
        try:
            if first_pass:
                first_pass = False
                try:
                    from sqlalchemy import text as _text
                    from backend.shared.database import get_db_session
                    with get_db_session() as session:
                        n_rows = session.execute(_text("SELECT COUNT(*) FROM screener_daily_metrics")).scalar() or 0
                    if n_rows < 50:
                        logger.info("Screener metrics table nearly empty (%d rows) — bootstrapping now.", n_rows)
                        await asyncio.to_thread(refresh_screener_metrics_from_market)
                except Exception as exc:
                    logger.debug("Screener bootstrap check skipped: %s", exc)
            delay = next_screener_refresh_delay_seconds()
            logger.info("Next screener metrics refresh in %.1f hours.", delay / 3600.0)
            await asyncio.sleep(delay)
            await asyncio.to_thread(refresh_screener_metrics_from_market)
        except asyncio.CancelledError:
            logger.info("Screener refresh worker cancelled.")
            break
        except Exception as err:
            logger.error("Error in screener refresh loop: %s", err)
            await asyncio.sleep(3600)  # unexpected error — retry in 1h

