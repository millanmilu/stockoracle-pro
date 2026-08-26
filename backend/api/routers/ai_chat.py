"""
StockOracle Pro — Gemini AI Chat, Summarizer & Explanations Router
"""
import os
import asyncio
import logging
from urllib.parse import quote_plus
from urllib.request import Request as UrllibRequest, urlopen
import xml.etree.ElementTree as ET

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.data.fetcher import fetch_stock_data, get_token_info
from backend.analysis.indicators import enrich_stock_dataframe
from backend.analysis.patterns import get_pattern_summary
from backend.analysis.levels import calculate_support_resistance

logger = logging.getLogger("StockOracle.API.AIChat")

router = APIRouter(prefix="/api", tags=["AI Chat & LLM Intelligence"])


class ChatRequest(BaseModel):
    ticker: str = Field(..., description="Stock symbol (e.g. RELIANCE, TCS)")
    question: str = Field(..., description="User query about technicals, fundamentals, or outlook")


@router.post("/ai/chat")
async def ai_chat_endpoint(req: ChatRequest):
    """
    Interactive Gemini-powered market analyst grounded strictly in live technical & fundamental context.
    """
    t = req.ticker.upper().strip()
    loop = asyncio.get_event_loop()

    df = await loop.run_in_executor(None, lambda: fetch_stock_data(t, period="3M"))
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for '{t}'")

    enriched_df = enrich_stock_dataframe(df)

    pred_data = {}
    try:
        from backend.ml.predictor import StockPredictor
        from backend.data.fetcher import fetch_company_info
        info = fetch_company_info(t)
        ltp = info.get("ltp") if info else None
        df_2y = await loop.run_in_executor(None, lambda: fetch_stock_data(t, period="2Y"))
        if df_2y is not None and len(df_2y) >= 50:
            pred_data = StockPredictor().predict(t, df_2y, current_price=ltp)
    except Exception as e:
        logger.warning("Prediction context fetch failed for %s: %s", t, e)

    patterns = {}
    try:
        df_6m = await loop.run_in_executor(None, lambda: fetch_stock_data(t, period="6M"))
        if df_6m is not None and not df_6m.empty:
            patterns = get_pattern_summary(df_6m)
    except Exception as e:
        logger.warning("Patterns fetch failed for %s: %s", t, e)

    levels = {}
    try:
        df_1y = await loop.run_in_executor(None, lambda: fetch_stock_data(t, period="1Y"))
        if df_1y is not None and not df_1y.empty:
            levels = calculate_support_resistance(df_1y)
    except Exception as e:
        logger.warning("Levels fetch failed for %s: %s", t, e)

    news_items = []
    try:
        token = get_token_info(t)
        company = token.get("name", t) if token else t
        url = f"https://news.google.com/rss/search?q={quote_plus(company + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en"
        request = UrllibRequest(url, headers={"User-Agent": "StockOracle/2.0"})
        with urlopen(request, timeout=5) as response:
            root = ET.fromstring(response.read())
        for item in root.findall("./channel/item")[:5]:
            title = item.findtext("title", "")
            if title:
                news_items.append({"title": title})
    except Exception as e:
        logger.warning("News fetch failed for %s: %s", t, e)

    from backend.ai.chat import build_stock_context, ask_gemini
    context = build_stock_context(t, enriched_df, pred_data, patterns, levels, news_items)
    answer = await loop.run_in_executor(None, lambda: ask_gemini(req.question, context))

    return {"answer": answer, "ticker": t}


@router.get("/stock/{ticker}/news-summary")
async def get_news_summary_endpoint(ticker: str):
    """Summarizes recent headlines using Gemini LLM into structured sentiment, risks, and impact."""
    t = ticker.upper().strip()
    token = get_token_info(t)
    company = token.get("name", t) if token else t
    headlines = []
    try:
        url = f"https://news.google.com/rss/search?q={quote_plus(company + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en"
        request = UrllibRequest(url, headers={"User-Agent": "StockOracle/2.0"})
        with urlopen(request, timeout=5) as response:
            root = ET.fromstring(response.read())
        for item in root.findall("./channel/item")[:8]:
            title = item.findtext("title", "")
            if title:
                headlines.append(title)
    except Exception as exc:
        logger.warning("News fetch error for %s: %s", t, exc)

    from backend.ai.news_summarizer import summarize_news
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: summarize_news(t, headlines))


@router.get("/stock/{symbol}/ai-trade-explain")
async def get_ai_trade_explain_endpoint(symbol: str):
    """Generates concise, human-readable rationale for current AI trade signals."""
    sym = symbol.upper().strip()
    loop = asyncio.get_event_loop()
    try:
        from backend.ml.predictor import StockPredictor
        from backend.data.fetcher import fetch_company_info
        df_2y = await loop.run_in_executor(None, lambda: fetch_stock_data(sym, period="2Y"))
        if df_2y is None or len(df_2y) < 50:
            raise HTTPException(status_code=404, detail=f"Insufficient history for '{sym}'")

        info = fetch_company_info(sym)
        ltp = info.get("ltp") if info else None
        pred_data = StockPredictor().predict(sym, df_2y, current_price=ltp)

        df = await loop.run_in_executor(None, lambda: fetch_stock_data(sym, period="45D"))
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"No data for '{sym}'")
        edf = enrich_stock_dataframe(df)
        last = edf.iloc[-1]

        signal = pred_data.get("signal", "NEUTRAL")
        pred_return = pred_data.get("predicted_return_pct", 0.0)
        rsi = round(float(last.get("rsi_14", 50.0)), 1)
        macd_val = round(float(last.get("macd", 0.0)), 2)
        macd_sig = round(float(last.get("macd_signal", 0.0)), 2)

        prompt_context = (
            f"Stock: {sym}\n"
            f"Current AI Signal: {signal} (Predicted 7-Day Return: {pred_return:+.2f}%)\n"
            f"RSI (14): {rsi}\n"
            f"MACD: {macd_val} vs Signal: {macd_sig}\n"
        )

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {
                "explanation": f"AI model indicates {signal} bias ({pred_return:+.1f}% 7D forecast). RSI is at {rsi}. Connect GEMINI_API_KEY for full AI trade commentary.",
                "signal": signal,
            }

        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        resp = model.generate_content(
            f"Explain this stock trade signal in 3 clear sentences for a trader:\n{prompt_context}\nInclude key technical drivers and one risk caveat."
        )
        return {"explanation": resp.text.strip(), "signal": signal}
    except Exception as exc:
        logger.warning("AI trade explain failed for %s: %s", sym, exc)
        return {"explanation": "Trade explanation temporarily unavailable.", "signal": "NEUTRAL"}
