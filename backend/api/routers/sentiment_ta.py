"""
StockOracle Pro — High-Performance Sentiment + Technical Analysis (TA) Hub
Combines:
  1. News sentiment (FinBERT / VADER multi-source RSS with TTL cache)
  2. Multi-factor Quantitative Technical Scoring (RSI, MACD, Bollinger Bands, EMA Alignment, ADX, Volume Surge, ATR)
  3. Options PCR (Put-Call Ratio) sentiment
  4. Time-series chart & sparkline arrays (Price, RSI, MACD, Bollinger Bands)
  5. AI Confidence index & Signal Quality breakdown
  6. Support / Resistance key levels
  7. Multi-ticker comparison endpoint
"""
import asyncio
import logging
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query
from pydantic import BaseModel

logger = logging.getLogger("StockOracle.API.SentimentTA")

router = APIRouter(prefix="/api", tags=["Sentiment & TA 2.0"])

# ── In-Memory Response Cache ──────────────────────────────────────────────────
_TA_CACHE: Dict[str, Dict[str, Any]] = {}
_TA_CACHE_TTL = 300  # 5 minutes


# ── Multi-Factor Technical Scoring Engine (0 - 10 scale) ──────────────────────
def _calculate_multifactor_ta(
    close: float,
    rsi: float,
    macd: float,
    macd_signal_val: float,
    macd_hist: float,
    bb_pct_b: float,
    sma20: float,
    sma50: float,
    ema12: float,
    adx: float,
    vol: float,
    vol_sma20: float = 0.0,
    atr: float = 0.0
) -> dict:
    """
    Evaluates 7 institutional technical factors:
    1. RSI-14 Momentum & Extremes (0 to 2 pts)
    2. MACD Line & Histogram Momentum (0 to 2 pts)
    3. Bollinger Bands %B Position (0 to 1 pt)
    4. Moving Average Trend Alignment (0 to 2 pts)
    5. ADX Trend Strength (0 to 1 pt)
    6. Volume Confirmation (0 to 1 pt)
    7. Price Location vs Short EMA (0 to 1 pt)
    Total Score: 0 to 10 points
    """
    score = 0
    signals = []
    bullish_count = 0
    bearish_count = 0
    neutral_count = 0

    # 1. RSI-14 Evaluation
    if rsi < 30:
        rsi_sig = "Oversold (Rebound Potential)"
        rsi_score = 2
        bullish_count += 1
    elif 30 <= rsi < 45:
        rsi_sig = "Weak / Bearish"
        rsi_score = 0
        bearish_count += 1
    elif 45 <= rsi <= 65:
        rsi_sig = "Bullish Momentum"
        rsi_score = 2
        bullish_count += 1
    elif 65 < rsi <= 75:
        rsi_sig = "Strong Momentum (Watch Levels)"
        rsi_score = 1
        neutral_count += 1
    else:
        rsi_sig = "Overbought (Correction Risk)"
        rsi_score = 0
        bearish_count += 1
    score += rsi_score
    signals.append({"factor": "RSI (14)", "status": rsi_sig, "value": f"{rsi:.1f}", "bullish": rsi_score > 0})

    # 2. MACD Evaluation
    macd_cross = macd - macd_signal_val
    if macd_cross > 0 and macd_hist > 0:
        macd_sig = "Bullish Crossover & Expanding"
        macd_score = 2
        bullish_count += 1
    elif macd_cross > 0:
        macd_sig = "Bullish Crossover"
        macd_score = 1
        bullish_count += 1
    elif macd_cross < 0 and macd_hist < 0:
        macd_sig = "Bearish Momentum Expanding"
        macd_score = 0
        bearish_count += 1
    else:
        macd_sig = "Neutral"
        macd_score = 1
        neutral_count += 1
    score += macd_score
    signals.append({"factor": "MACD", "status": macd_sig, "value": f"{macd:.2f}", "bullish": macd_score > 0})

    # 3. Bollinger Band Position
    if bb_pct_b < 0.15:
        bb_sig = "Lower Band Support (Oversold)"
        bb_score = 1
        bullish_count += 1
    elif bb_pct_b > 0.85:
        bb_sig = "Upper Band Resistance"
        bb_score = 0
        bearish_count += 1
    else:
        bb_sig = "Within Bands (Normal)"
        bb_score = 1
        neutral_count += 1
    score += bb_score
    signals.append({"factor": "Bollinger %B", "status": bb_sig, "value": f"{bb_pct_b:.2f}", "bullish": bb_score > 0})

    # 4. Moving Average Alignment (Golden Cross / Trend Structure)
    if sma20 > 0 and sma50 > 0:
        if close > sma20 > sma50:
            ma_sig = "Bullish Trend (Price > SMA20 > SMA50)"
            ma_score = 2
            bullish_count += 1
        elif close > sma50:
            ma_sig = "Moderate Bullish (Above SMA50)"
            ma_score = 1
            bullish_count += 1
        elif close < sma20 < sma50:
            ma_sig = "Bearish Alignment (Price < SMA20 < SMA50)"
            ma_score = 0
            bearish_count += 1
        else:
            ma_sig = "Consolidating / Mixed"
            ma_score = 1
            neutral_count += 1
    else:
        ma_sig = "Sufficient History Required"
        ma_score = 1
        neutral_count += 1
    score += ma_score
    signals.append({"factor": "Trend Alignment", "status": ma_sig, "value": f"₹{sma20:.1f} / ₹{sma50:.1f}", "bullish": ma_score > 0})

    # 5. ADX Trend Strength
    if adx >= 25:
        adx_sig = "Strong Trend in Play"
        adx_score = 1
    else:
        adx_sig = "Weak / Rangebound Trend"
        adx_score = 0
    score += adx_score
    signals.append({"factor": "ADX Strength", "status": adx_sig, "value": f"{adx:.1f}", "bullish": adx_score > 0})

    # 6. Volume Confirmation
    if vol_sma20 > 0 and vol > 1.2 * vol_sma20:
        vol_sig = "High Volume Surge (>1.2x SMA)"
        vol_score = 1
        bullish_count += 1
    else:
        vol_sig = "Normal Volume"
        vol_score = 0
        neutral_count += 1
    score += vol_score
    signals.append({"factor": "Volume Confirmation", "status": vol_sig, "value": f"{vol:,.0f}", "bullish": vol_score > 0})

    # 7. Short-Term EMA Momentum
    if ema12 > 0 and close >= ema12:
        ema_sig = "Above EMA 12"
        ema_score = 1
    else:
        ema_sig = "Below EMA 12"
        ema_score = 0
    score += ema_score

    # Determine Rating from 0 to 10
    if score >= 8:
        composite = "Strong Buy"
        color = "#10B981"
    elif score >= 6:
        composite = "Buy"
        color = "#34D399"
    elif score >= 4:
        composite = "Hold / Neutral"
        color = "#F59E0B"
    elif score >= 2:
        composite = "Sell"
        color = "#F97316"
    else:
        composite = "Strong Sell"
        color = "#F43F5E"

    return {
        "ta_score": score,
        "ta_max_score": 10,
        "ta_rating": composite,
        "ta_color": color,
        "rsi_signal": rsi_sig,
        "macd_signal": macd_sig,
        "bb_signal": bb_sig,
        "ma_signal": ma_sig,
        "adx_signal": adx_sig,
        "volume_signal": vol_sig,
        "signals_breakdown": signals,
        "bullish_signals": bullish_count,
        "bearish_signals": bearish_count,
        "neutral_signals": neutral_count,
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


def _combined_verdict(
    sentiment_score: float,
    ta_score: int,
    pcr: Optional[float],
    has_sentiment: bool = True,
    has_pcr: bool = True
) -> dict:
    """Merge sentiment + TA + PCR into a unified verdict with confidence scoring."""
    # Scale TA from 0-10 to 0-6
    ta_pts = (ta_score / 10.0) * 6.0
    sent_pts = (sentiment_score + 1.0) / 2.0 * 6.0

    pcr_pts = 3.0
    if pcr is not None:
        if pcr < 0.7:
            pcr_pts = 5.0
        elif pcr > 1.0:
            pcr_pts = 1.0

    # Weightings
    combined = (sent_pts * 0.35) + (ta_pts * 0.50) + (pcr_pts * 0.15)

    # Confidence calculation
    confidence_pts = 40  # Base for reliable OHLCV TA data
    if has_sentiment:
        confidence_pts += 35
    if has_pcr:
        confidence_pts += 25

    confidence_level = "High" if confidence_pts >= 80 else ("Moderate" if confidence_pts >= 50 else "Low")

    if combined >= 5.0:
        verdict = "Strong Buy"
        color = "#10B981"
        icon = "🚀"
    elif combined >= 3.8:
        verdict = "Buy"
        color = "#34D399"
        icon = "📈"
    elif combined >= 2.8:
        verdict = "Hold / Neutral"
        color = "#F59E0B"
        icon = "⚖️"
    elif combined >= 1.8:
        verdict = "Sell"
        color = "#F97316"
        icon = "📉"
    else:
        verdict = "Strong Sell"
        color = "#F43F5E"
        icon = "⚠️"

    return {
        "verdict": verdict,
        "verdict_color": color,
        "verdict_icon": icon,
        "composite_score": round(combined, 2),
        "confidence_score": confidence_pts,
        "confidence_level": confidence_level,
    }


# ── Combined Sentiment + TA Endpoint ──────────────────────────────────────────
@router.get("/stock/{ticker}/sentiment-ta")
async def get_sentiment_ta(ticker: str, period: Optional[str] = "3M"):
    """
    High-Performance Combined Sentiment + Technical Analysis endpoint.
    Executes all data sources in parallel with in-memory TTL caching.
    """
    t = ticker.upper().strip()
    cache_key = f"{t}_{period}"
    now = time.time()

    # Check cache
    if cache_key in _TA_CACHE:
        entry = _TA_CACHE[cache_key]
        if now - entry["timestamp"] < _TA_CACHE_TTL:
            return entry["data"]

    loop = asyncio.get_event_loop()

    from backend.data.fetcher import fetch_stock_data, fetch_company_info, get_token_info
    from backend.analysis.indicators import enrich_stock_dataframe
    from backend.analysis.levels import calculate_support_resistance
    from backend.analysis.sentiment import fetch_sentiment_and_headlines
    from backend.data.options import get_options_chain
    from backend.ai.news_summarizer import summarize_news

    # Run all independent data fetch operations in PARALLEL
    results = await asyncio.gather(
        loop.run_in_executor(None, lambda: fetch_stock_data(t, period=period)),
        loop.run_in_executor(None, lambda: fetch_stock_data(t, period="1Y")),
        loop.run_in_executor(None, lambda: fetch_company_info(t)),
        loop.run_in_executor(None, lambda: get_options_chain(t)),
        loop.run_in_executor(None, lambda: fetch_sentiment_and_headlines(t)),
        return_exceptions=True
    )

    df_res, df_1y_res, info_res, opts_res, sent_res = results

    # 1. Process Price Data & TA Indicators
    if isinstance(df_res, Exception) or df_res is None or df_res.empty:
        return {"error": f"No price data available for '{t}'", "ticker": t}

    df = df_res
    edf = enrich_stock_dataframe(df)
    last = edf.iloc[-1]

    close = float(last.get("close", 0.0) or 0.0)
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
    vol = float(last.get("volume", 0.0) or 0.0)
    vol_sma20 = float(last.get("volume_sma_20", 0.0) or 0.0)

    first_close = float(edf.iloc[0].get("close", close) or close)
    period_return_pct = round((close - first_close) / first_close * 100, 2) if first_close > 0 else 0.0

    # Multi-factor TA
    ta = _calculate_multifactor_ta(
        close=close, rsi=rsi, macd=macd, macd_signal_val=macd_signal_val,
        macd_hist=macd_hist, bb_pct_b=bb_pct_b, sma20=sma20, sma50=sma50,
        ema12=ema12, adx=adx, vol=vol, vol_sma20=vol_sma20, atr=atr
    )

    # 2. Key Support & Resistance Levels
    levels = {}
    if not isinstance(df_1y_res, Exception) and df_1y_res is not None and not df_1y_res.empty:
        try:
            levels = calculate_support_resistance(df_1y_res)
        except Exception:
            pass

    # 3. Company Info
    info = info_res if not isinstance(info_res, Exception) and info_res else {}

    # 4. Options PCR
    pcr: Optional[float] = None
    pcr_sentiment_label = "N/A"
    has_pcr = False
    if not isinstance(opts_res, Exception) and opts_res:
        pcr = opts_res.get("put_call_ratio")
        pcr_sentiment_label = opts_res.get("pcr_sentiment", "N/A")
        if pcr is not None:
            has_pcr = True

    # 5. News Sentiment
    sentiment_data = sent_res if not isinstance(sent_res, Exception) and sent_res else {}
    sentiment_score = float(sentiment_data.get("sentiment_score", 0.0))
    headlines = sentiment_data.get("headlines", [])
    has_sentiment = len(headlines) > 0

    sent_meta = _sentiment_label(sentiment_score)

    # 6. Combined Verdict
    verdict = _combined_verdict(
        sentiment_score=sentiment_score,
        ta_score=ta["ta_score"],
        pcr=pcr,
        has_sentiment=has_sentiment,
        has_pcr=has_pcr
    )

    # 7. Candlestick & Sparkline Time-Series Data
    candlestick_series = []
    for idx, row in edf.iterrows():
        candlestick_series.append({
            "date": str(row.get("date", "")),
            "open": round(float(row.get("open", 0.0)), 2),
            "high": round(float(row.get("high", 0.0)), 2),
            "low": round(float(row.get("low", 0.0)), 2),
            "close": round(float(row.get("close", 0.0)), 2),
            "volume": int(row.get("volume", 0)),
            "rsi": round(float(row.get("rsi", 50.0)), 2) if row.get("rsi") is not None else 50.0,
            "macd": round(float(row.get("macd", 0.0)), 3) if row.get("macd") is not None else 0.0,
            "macd_signal": round(float(row.get("macd_signal", 0.0)), 3) if row.get("macd_signal") is not None else 0.0,
            "macd_hist": round(float(row.get("macd_hist", 0.0)), 3) if row.get("macd_hist") is not None else 0.0,
            "sma20": round(float(row.get("sma_20", 0.0)), 2) if row.get("sma_20") is not None else None,
            "bb_upper": round(float(row.get("bb_upper", 0.0)), 2) if row.get("bb_upper") is not None else None,
            "bb_lower": round(float(row.get("bb_lower", 0.0)), 2) if row.get("bb_lower") is not None else None,
        })

    # 8. 52-week Context
    week52_high = float(info.get("fifty_two_week_high", 0) or 0)
    week52_low = float(info.get("fifty_two_week_low", 0) or 0)
    pct_from_52h = round((close - week52_high) / week52_high * 100, 2) if week52_high > 0 else None
    pct_from_52l = round((close - week52_low) / week52_low * 100, 2) if week52_low > 0 else None

    response_data = {
        "ticker": t,
        "company_name": info.get("name", t),
        "sector": info.get("sector", "Diversified"),
        "period": period,

        # Price snapshot
        "close": round(close, 2),
        "period_return_pct": period_return_pct,
        "week52_high": week52_high,
        "week52_low": week52_low,
        "pct_from_52w_high": pct_from_52h,
        "pct_from_52w_low": pct_from_52l,
        "volume": int(vol),

        # Indicators
        "rsi": round(rsi, 2),
        "macd": round(macd, 4),
        "macd_signal": round(macd_signal_val, 4),
        "macd_hist": round(macd_hist, 4),
        "bb_upper": round(bb_upper, 2),
        "bb_mid": round(bb_mid, 2),
        "bb_lower": round(bb_lower, 2),
        "bb_pct_b": round(bb_pct_b, 4),
        "sma20": round(sma20, 2),
        "sma50": round(sma50, 2),
        "ema12": round(ema12, 2),
        "atr": round(atr, 2),
        "adx": round(adx, 2),

        # Multi-factor TA
        **ta,

        # Key Levels
        "support_levels": levels.get("support_levels", [])[:3],
        "resistance_levels": levels.get("resistance_levels", [])[:3],
        "pivot_points": levels.get("pivot_points", {}),

        # Sentiment
        "sentiment_score": round(sentiment_score, 4),
        "sentiment_label": sent_meta["label"],
        "sentiment_color": sent_meta["color"],
        "sentiment_icon": sent_meta["icon"],
        "headlines": headlines[:8],
        "structured_headlines": sentiment_data.get("structured_headlines", [])[:8],

        # Options PCR
        "pcr": round(pcr, 3) if pcr is not None else None,
        "pcr_sentiment": pcr_sentiment_label,

        # Combined verdict & Confidence
        **verdict,

        # Interactive Chart Time-Series
        "candlestick_series": candlestick_series,
    }

    # Store in cache
    _TA_CACHE[cache_key] = {"data": response_data, "timestamp": now}
    return response_data


# ── Multi-Ticker Comparison Endpoint ──────────────────────────────────────────
@router.get("/stock/sentiment-ta/compare")
async def compare_sentiment_ta(
    tickers: str = Query("RELIANCE,TCS,INFY", description="Comma-separated ticker symbols")
):
    """Returns comparative Sentiment + TA scores for multiple stocks."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:6]
    tasks = [get_sentiment_ta(t, period="3M") for t in ticker_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    valid_results = []
    for t, res in zip(ticker_list, results):
        if not isinstance(res, Exception) and "error" not in res:
            valid_results.append(res)

    return {"comparison": valid_results}


# ── Market Overview Endpoint ──────────────────────────────────────────────────
@router.get("/sentiment/market-overview")
async def get_market_sentiment_overview(
    tickers: Optional[str] = "RELIANCE,TCS,HDFCBANK,INFY,ICICIBANK,SBIN,BHARTIARTL,ITC,AXISBANK,WIPRO"
):
    """Market-wide Sentiment Overview with Fear & Greed index."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:20]
    loop = asyncio.get_event_loop()
    from backend.analysis.sentiment_market import get_market_sentiment
    result = await loop.run_in_executor(None, lambda: get_market_sentiment(ticker_list))
    return result
