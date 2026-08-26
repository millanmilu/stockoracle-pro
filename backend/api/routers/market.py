"""
StockOracle Pro — Market Data & History API Router
"""
import logging
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
from urllib.request import Request as UrllibRequest, urlopen
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from backend.data.fetcher import (
    fetch_stock_data, fetch_company_info, get_session_status,
    search_nse_stocks, get_token_info
)
from backend.analysis.indicators import enrich_stock_dataframe

logger = logging.getLogger("StockOracle.API.Market")

router = APIRouter(prefix="/api", tags=["Market Data"])


@router.get("/stock/{ticker}/info")
def get_stock_info(ticker: str):
    """Returns real-time LTP, 52-week high/low, open/close stats."""
    t = ticker.upper().strip()
    info = fetch_company_info(t)
    if not info:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"Stock data not found for '{t}'.")
    return info


@router.get("/stock/{ticker}/history")
def get_stock_history(ticker: str, timeframe: str = "5Y", interval: str = "1d"):
    """
    Fetches historical OHLCV data with technical indicators.
    Returns standard envelope { data: [...], data_source: "angel_one" | "sqlite" | "yahoo_finance" }
    and sets X-Data-Source response header.
    """
    t = ticker.upper().strip()

    days_map = {
        "1D": "2D", "5D": "7D", "1W": "10D", "1M": "45D",
        "3M": "120D", "6M": "200D", "1Y": "370D", "2Y": "2Y", "5Y": "5Y",
    }
    period = days_map.get(timeframe.upper())
    if not period:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid timeframe '{timeframe}'. Valid: 1D, 5D, 1W, 1M, 3M, 6M, 1Y, 2Y, 5Y.",
        )

    valid_intervals = {"1m", "5m", "15m", "1h", "1d"}
    iv = interval.lower()
    if iv not in valid_intervals:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid interval '{interval}'. Valid: 1m, 5m, 15m, 1h, 1d.",
        )

    df = fetch_stock_data(t, period=period, interval=iv)
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history found for '{t}'.")

    data_source = df.attrs.get("data_source", "unknown")
    enriched_df = enrich_stock_dataframe(df)

    return JSONResponse(
        content={"data": enriched_df.to_dict(orient="records"), "data_source": data_source},
        headers={"X-Data-Source": data_source},
    )


@router.get("/stock/search/{query}")
def search_stock(query: str):
    """Validates an NSE ticker and returns basic information."""
    t = query.upper().strip()
    if not t or len(t) > 20:
        raise HTTPException(status_code=422, detail="Invalid ticker format.")

    tok = get_token_info(t)
    if tok:
        return {"found": True, "ticker": t, "name": tok.get("name", t), "exchange": tok.get("exch_seg", "NSE")}

    info = fetch_company_info(t)
    if info:
        return {"found": True, "ticker": t, "name": info.get("name", t), "exchange": info.get("exchange", "NSE")}

    return {"found": False, "ticker": t, "name": t, "exchange": "NSE"}


@router.get("/stocks/search")
def search_stocks(query: str, limit: int = 12):
    """Autocomplete across the full NSE ScripMaster cached in SQLite/DB."""
    if not query.strip():
        return []
    return search_nse_stocks(query, limit)


@router.get("/stock/{ticker}/news")
def get_stock_news(ticker: str, limit: int = 8):
    """Returns recent public news headlines without requiring paid news API."""
    t = ticker.upper().strip()
    token = get_token_info(t)
    company = token.get("name", t) if token else t
    url = f"https://news.google.com/rss/search?q={quote_plus(company + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en"
    try:
        request = UrllibRequest(url, headers={"User-Agent": "StockOracle/2.0"})
        with urlopen(request, timeout=8) as response:
            root = ET.fromstring(response.read())
        items = []
        for item in root.findall("./channel/item")[:max(1, min(limit, 15))]:
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            source = item.findtext("source", "Google News")
            if title:
                items.append({
                    "title": title,
                    "url": link,
                    "published_at": pub_date,
                    "source": source,
                })
        return items
    except Exception as exc:
        logger.warning("Error fetching news for %s: %s", t, exc)
        return []
