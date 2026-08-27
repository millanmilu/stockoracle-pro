"""
StockOracle Pro — Sentiment + Technical Analysis (TA) Combined Endpoint
Combines:
  1. News sentiment (FinBERT / VADER)
  2. Technical indicators (RSI, MACD, Bollinger Bands, ATR, ADX)
  3. Options PCR sentiment
  4. AI Gemini final verdict
  5. Fear & Greed index
  6. Support / Resistance key levels
"""
import asyncio
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger("StockOracle.API.SentimentTA")

router = APIRouter(prefix="/api", tags=["Sentiment & TA"])


# ─────────────────────────────────────────────────────────────────────────────

def _ta_signal(rsi: float, macd: float, macd_signal: float, bb_pct_b: float) -> dict:
    """Derive composite TA signal from key indicators."""
    score = 0

    # RSI contribution
    if rsi < 30:
        rsi_sig = "Oversold 🟢"
        score += 2
    elif rsi < 45:
        rsi_sig = "Bearish"
        score += 0
    elif rsi < 55:
        rsi_sig = "Neutral"
        score += 1
    elif rsi < 70:
        rsi_sig = "Bullish 🟢"
        score += 2
    else:
        rsi_sig = "Overbought 🔴"
        score += 0

    # MACD contribution
    macd_cross = macd - macd_signal
    if macd_cross > 0:
        macd_sig = "Bullish Crossover 🟢"
        score += 2
    elif macd_cross > -0.5:
        macd_sig = "Neutral"
        score += 1
    else:
        macd_sig = "Bearish Crossover 🔴"
        score += 0

    # Bollinger Band position
    if bb_pct_b < 0.1:
        bb_sig = "Near Lower Band (Bounce Likely) 🟢"
        score += 2
    elif bb_pct_b > 0.9:
        bb_sig = "Near Upper Band (Caution) 🔴"
        score += 0
    else:
        bb_sig = "Within Bands (Neutral)"
        score += 1

    # Composite: 0-6 → TA rating
    if score >= 5:
        composite = "Strong Buy"
        color = "#10B981"
    elif score >= 4:
        composite = "Buy"
        color = "#34D399"
    elif score >= 3:
        composite = "Neutral / Hold"
        color = "#F59E0B"
    elif score >= 2:
        composite = "Sell"
        color = "#F97316"
    else:
        composite = "Strong Sell"
        color = "#F43F5E"

    return {
        "rsi_signal": rsi_sig,
        "macd_signal": macd_sig,
        "bb_signal": bb_sig,
        "ta_score": score,
        "ta_rating": composite,
        "ta_color": color,
    }


def _sentiment_label(score: float) -> dict:
    if score > 0.25:
        return {"label": "Strongly Bullish", "color": "#10B981", "icon": "🐂🐂"}
    elif score > 0.08:
        return {"label": "Bullish", "color": "#34D399", "icon": "🐂"}
    elif score > -0.08:
        return {"label": "Neutral", "color": "#F59E0B", "icon": "⚖️"}
    elif score > -0.25:
        return {"label": "Bearish", "color": "#F97316", "icon": "🐻"}
    else:
        return {"label": "Strongly Bearish", "color": "#F43F5E", "icon": "🐻🐻"}


def _combined_verdict(sentiment_score: float, ta_score: int, pcr: Optional[float]) -> dict:
    """Merge sentiment + TA + PCR into a single composite signal."""
    # Normalise sentiment [-1,+1] to [0,6]
    sent_pts = (sentiment_score + 1.0) / 2.0 * 6.0
    # PCR: < 0.7 → bullish (+1), > 1.0 → bearish (-1)
    pcr_pts = 3.0  # neutral default
    if pcr is not None:
        if pcr < 0.7:
            pcr_pts = 5.0
        elif pcr > 1.0:
            pcr_pts = 1.0

    combined = (sent_pts * 0.35) + (ta_score * 0.50) + (pcr_pts * 0.15)
    # combined is on 0-6 scale
    if combined >= 5.2:
        return {"verdict": "Strong Buy",   "verdict_color": "#10B981", "verdict_icon": "🚀"}
    elif combined >= 4.0:
        return {"verdict": "Buy",          "verdict_color": "#34D399", "verdict_icon": "📈"}
    elif combined >= 3.0:
        return {"verdict": "Hold / Neutral","verdict_color": "#F59E0B", "verdict_icon": "⚖️"}
    elif combined >= 2.0:
        return {"verdict": "Sell",         "verdict_color": "#F97316", "verdict_icon": "📉"}
    else:
        return {"verdict": "Strong Sell",  "verdict_color": "#F43F5E", "verdict_icon": "⚠️"}


@router.get("/stock/{ticker}/sentiment-ta")
async def get_sentiment_ta(ticker: str, period: Optional[str] = "3M"):
    """
    Combined Sentiment + Technical Analysis for a single ticker.
    Returns news sentiment score, FinBERT label, TA indicators, PCR,
    key levels, and an AI-combined verdict.
    """
    t = ticker.upper().strip()
    loop = asyncio.get_event_loop()

    # ── 1. Fetch price data & enrich indicators ───────────────────────────────
    from backend.data.fetcher import fetch_stock_data, fetch_company_info, get_token_info
    from backend.analysis.indicators import enrich_stock_dataframe
    from backend.analysis.levels import calculate_support_resistance

    df = await loop.run_in_executor(None, lambda: fetch_stock_data(t, period=period))
    if df is None or df.empty:
        return {"error": f"No price data for '{t}'", "ticker": t}

    edf = enrich_stock_dataframe(df)
    last = edf.iloc[-1]

    rsi = float(last.get("rsi", 50.0) or 50.0)
    macd = float(last.get("macd", 0.0) or 0.0)
    macd_signal_val = float(last.get("macd_signal", 0.0) or 0.0)
    macd_hist = float(last.get("macd_hist", 0.0) or 0.0)
    bb_pct_b = float(last.get("bb_pct_b", 0.5) or 0.5)
    bb_upper = float(last.get("bb_upper", 0.0) or 0.0)
    bb_lower = float(last.get("bb_lower", 0.0) or 0.0)
    bb_mid = float(last.get("bb_middle", 0.0) or 0.0)
    sma20 = float(last.get("sma_20", 0.0) or 0.0)
    sma50 = float(last.get("sma_50", 0.0) or 0.0)
    ema12 = float(last.get("ema_12", 0.0) or 0.0)
    atr = float(last.get("atr", 0.0) or 0.0)
    adx = float(last.get("adx", 0.0) or 0.0)
    close = float(last.get("close", 0.0) or 0.0)
    vol = float(last.get("volume", 0.0) or 0.0)

    # Price change since period start
    first_close = float(edf.iloc[0].get("close", close) or close)
    period_return_pct = round((close - first_close) / first_close * 100, 2) if first_close > 0 else 0.0

    # TA composite
    ta = _ta_signal(rsi, macd, macd_signal_val, bb_pct_b)

    # ── 2. Support / Resistance levels ───────────────────────────────────────
    levels = {}
    try:
        df_1y = await loop.run_in_executor(None, lambda: fetch_stock_data(t, period="1Y"))
        if df_1y is not None and not df_1y.empty:
            levels = calculate_support_resistance(df_1y)
    except Exception as e:
        logger.debug("Levels error for %s: %s", t, e)

    # ── 3. News sentiment (FinBERT/VADER) ────────────────────────────────────
    sentiment_score = 0.0
    headlines: List[str] = []
    try:
        from backend.analysis.sentiment import fetch_and_score_sentiment
        import urllib.request, xml.etree.ElementTree as ET
        from urllib.parse import quote_plus

        token = await loop.run_in_executor(None, lambda: get_token_info(t))
        company = token.get("name", t) if token else t
        url = f"https://news.google.com/rss/search?q={quote_plus(company + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en"
        req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
        with urllib.request.urlopen(req, timeout=7) as resp:
            root = ET.fromstring(resp.read())
        import re
        for item in root.findall("./channel/item")[:10]:
            raw = item.findtext("title", "")
            clean = re.sub(r'<[^>]+>', '', raw)
            clean = re.sub(r'[^\x00-\x7F]+', ' ', clean).strip()
            if clean:
                headlines.append(clean)
        sentiment_score = await loop.run_in_executor(
            None, lambda: fetch_and_score_sentiment(t)
        )
    except Exception as e:
        logger.debug("Sentiment error for %s: %s", t, e)

    sent_meta = _sentiment_label(sentiment_score)

    # ── 4. Options PCR sentiment ──────────────────────────────────────────────
    pcr: Optional[float] = None
    pcr_sentiment_label = "N/A"
    try:
        from backend.data.options import get_options_chain
        opts = await loop.run_in_executor(None, lambda: get_options_chain(t))
        pcr = opts.get("put_call_ratio")
        pcr_sentiment_label = opts.get("pcr_sentiment", "N/A")
    except Exception as e:
        logger.debug("PCR error for %s: %s", t, e)

    # ── 5. Company quote ──────────────────────────────────────────────────────
    info = {}
    try:
        info = await loop.run_in_executor(None, lambda: fetch_company_info(t)) or {}
    except Exception:
        pass

    # ── 6. AI Gemini verdict ──────────────────────────────────────────────────
    ai_summary: Optional[str] = None
    try:
        from backend.ai.news_summarizer import summarize_news
        news_result = await loop.run_in_executor(None, lambda: summarize_news(t, headlines))
        ai_summary = news_result.get("summary")
    except Exception as e:
        logger.debug("AI summary error for %s: %s", t, e)

    # ── 7. Combined verdict ───────────────────────────────────────────────────
    verdict = _combined_verdict(sentiment_score, ta["ta_score"], pcr)

    # ── 8. 52-week context ────────────────────────────────────────────────────
    week52_high = float(info.get("fifty_two_week_high", 0) or 0)
    week52_low  = float(info.get("fifty_two_week_low",  0) or 0)
    pct_from_52h = round((close - week52_high) / week52_high * 100, 2) if week52_high > 0 else None
    pct_from_52l = round((close - week52_low)  / week52_low  * 100, 2) if week52_low  > 0 else None

    return {
        "ticker": t,
        "company_name": info.get("name", t),
        "period": period,

        # Price snapshot
        "close": round(close, 2),
        "period_return_pct": period_return_pct,
        "week52_high": week52_high,
        "week52_low":  week52_low,
        "pct_from_52w_high": pct_from_52h,
        "pct_from_52w_low":  pct_from_52l,
        "volume": int(vol),

        # Technical indicators
        "rsi":        round(rsi, 2),
        "macd":       round(macd, 4),
        "macd_signal":round(macd_signal_val, 4),
        "macd_hist":  round(macd_hist, 4),
        "bb_upper":   round(bb_upper, 2),
        "bb_mid":     round(bb_mid, 2),
        "bb_lower":   round(bb_lower, 2),
        "bb_pct_b":   round(bb_pct_b, 4),
        "sma20":      round(sma20, 2),
        "sma50":      round(sma50, 2),
        "ema12":      round(ema12, 2),
        "atr":        round(atr, 2),
        "adx":        round(adx, 2),

        # TA composite
        **ta,

        # Key levels
        "support_levels":    levels.get("support_levels", [])[:3],
        "resistance_levels": levels.get("resistance_levels", [])[:3],
        "pivot_points":      levels.get("pivot_points", {}),

        # Sentiment
        "sentiment_score": round(sentiment_score, 4),
        "sentiment_label": sent_meta["label"],
        "sentiment_color": sent_meta["color"],
        "sentiment_icon":  sent_meta["icon"],
        "headlines":       headlines[:8],
        "ai_news_summary": ai_summary,

        # Options PCR
        "pcr":               round(pcr, 3) if pcr is not None else None,
        "pcr_sentiment":     pcr_sentiment_label,

        # Combined verdict
        **verdict,
    }


@router.get("/sentiment/market-overview")
async def get_market_sentiment_overview(
    tickers: Optional[str] = "RELIANCE,TCS,HDFCBANK,INFY,ICICIBANK,SBIN,BHARTIARTL,ITC,AXISBANK,WIPRO"
):
    """
    Market-wide Sentiment Overview.
    Returns Fear & Greed index + per-ticker sentiment for the given watchlist.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:20]
    loop = asyncio.get_event_loop()
    from backend.analysis.sentiment_market import get_market_sentiment
    result = await loop.run_in_executor(None, lambda: get_market_sentiment(ticker_list))
    return result
