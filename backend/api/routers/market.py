"""
StockOracle Pro — Market Data & History API Router
"""
import hashlib
import logging
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
from urllib.request import Request as UrllibRequest, urlopen
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import JSONResponse, Response

from backend.data.fetcher import (
    fetch_stock_data, fetch_company_info, get_session_status,
    search_nse_stocks, get_token_info, get_combined_stock_data,
    preload_all_stock_timeframes
)
from backend.analysis.indicators import enrich_stock_dataframe, evaluate_custom_formula
from pydantic import BaseModel, Field

logger = logging.getLogger("StockOracle.API.Market")

router = APIRouter(prefix="/api", tags=["Market Data"])

# Columns consumed by the chart. Trimmed from the ~45 returned by enrich_stock_dataframe()
# to reduce payload from ~8 MB to ~2 MB. Use ?full=true to receive all columns.
_CHART_COLUMNS = [
    "date", "open", "high", "low", "close", "volume",
    "sma_20", "sma_50", "sma_200", "ema_9", "ema_21",
    "vwap", "obv", "mfi", "supertrend", "supertrend_dir", "rsi",
    "macd", "macd_signal", "macd_hist",
    "bb_upper", "bb_middle", "bb_lower",
    "stoch_k", "stoch_d", "cci", "williams_r", "roc",
    "keltner_upper", "keltner_middle", "keltner_lower",
    "donchian_upper", "donchian_middle", "donchian_lower",
    "pivot", "r1", "s1", "r2", "s2", "atr",
    "market_regime", "bullish_divergence", "bearish_divergence",
    "pattern_hammer", "pattern_hanging_man", "pattern_shooting_star",
    "pattern_inverted_hammer", "pattern_doji", "pattern_bullish_engulfing",
    "pattern_bearish_engulfing", "pattern_morning_star", "pattern_evening_star"
]

# Rounding precision per column group
_PRICE_COLS = {
    "open", "high", "low", "close", "vwap", "bb_upper", "bb_middle", "bb_lower",
    "pivot", "r1", "s1", "r2", "s2", "supertrend", "sma_20", "sma_50", "sma_200",
    "ema_9", "ema_21", "atr", "keltner_upper", "keltner_middle", "keltner_lower",
    "donchian_upper", "donchian_middle", "donchian_lower"
}
_INDICATOR_COLS = {
    "rsi", "macd", "macd_signal", "macd_hist", "stoch_k", "stoch_d",
    "cci", "williams_r", "roc", "mfi"
}


def _trim_and_round(df, full: bool):
    """Return a trimmed, rounded dict-list suitable for JSON serialization."""
    if not full:
        keep = [c for c in _CHART_COLUMNS if c in df.columns]
        df = df[keep]
    # Round prices to 2 decimals, indicators to 4
    round_map = {}
    for col in df.columns:
        if col in _PRICE_COLS:
            round_map[col] = 2
        elif col in _INDICATOR_COLS:
            round_map[col] = 4
    if round_map:
        df = df.round(round_map)
    return df.to_dict(orient="records")


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
def get_stock_history(
    ticker: str,
    request: Request,
    background_tasks: BackgroundTasks,
    timeframe: Optional[str] = None,
    interval: str = "1d",
    full: bool = False,
):
    """
    Fetches historical OHLCV data with technical indicators.
    Returns standard envelope { data: [...], data_source: "angel_one" | "sqlite" | "yahoo_finance" }
    and sets X-Data-Source response header.

    When interval='1d' and timeframe is omitted or 'ALL', returns complete multi-year data from inception.
    Pass ?full=true to receive all ~45 enriched columns instead of the default 22 chart columns.
    """
    t = ticker.upper().strip()

    valid_intervals = {"1s", "30s", "1m", "5m", "15m", "30m", "1h", "4h", "1d"}
    iv = interval.lower()
    if iv not in valid_intervals:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid interval '{interval}'. Valid: 1s, 30s, 1m, 5m, 15m, 30m, 1h, 4h, 1d.",
        )

    days_map = {
        "1D": "2D", "5D": "7D", "1W": "10D", "1M": "45D",
        "3M": "120D", "6M": "200D", "1Y": "370D", "2Y": "2Y", "5Y": "5Y",
        "ALL": "ALL", "MAX": "ALL",
    }
    if timeframe and timeframe.upper() not in ["ALL", "MAX"]:
        period = days_map.get(timeframe.upper())
        if not period:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid timeframe '{timeframe}'. Valid: 1D, 5D, 1W, 1M, 3M, 6M, 1Y, 2Y, 5Y, ALL.",
            )
    else:
        # Full historical lookbacks: 1d loads all history from inception; intraday loads full available capacity
        if iv == "1d":
            period = "ALL"
        elif iv in ["1s", "30s", "1m"]:
            period = "30D"
        elif iv == "5m":
            period = "60D"
        elif iv in ["15m", "30m"]:
            period = "90D"
        else:  # 1h, 4h
            period = "365D"

    if iv == "1d":
        df = get_combined_stock_data(t, period=period)
    else:
        df = fetch_stock_data(t, period=period, interval=iv)
    if df is None or df.empty:
        if not get_session_status():
            raise HTTPException(status_code=503, detail="Angel One API unavailable. Try again shortly.")
        raise HTTPException(status_code=404, detail=f"No price history found for '{t}'.")

    # Preload remaining timeframes and backfill DB in background
    if background_tasks is not None:
        background_tasks.add_task(preload_all_stock_timeframes, t)

    data_source = df.attrs.get("data_source", "unknown")
    enriched_df = enrich_stock_dataframe(df, use_cache=True, cache_key=f"{t}:{iv}:{period}")

    # --- HTTP Caching: ETag + Cache-Control ---
    last_date = str(enriched_df["date"].max()) if not enriched_df.empty else "none"
    etag_val = hashlib.md5(f"{t}:{iv}:{period}:{last_date}".encode()).hexdigest()[:16]
    client_etag = request.headers.get("if-none-match", "")
    if client_etag == f'"{etag_val}"':
        return Response(status_code=304, headers={"ETag": f'"{etag_val}"'})

    # --- Payload diet: strip unused columns, round floats ---
    records = _trim_and_round(enriched_df, full=full)

    return JSONResponse(
        content={"data": records, "data_source": data_source},
        headers={
            "X-Data-Source": data_source,
            "ETag": f'"{etag_val}"',
            "Cache-Control": "max-age=60, stale-while-revalidate=30",
        },
    )


@router.post("/stock/{ticker}/preload")
def preload_stock(ticker: str, background_tasks: BackgroundTasks):
    """Triggers background full daily inception backfill into SQLite and pre-caches all timeframes."""
    t = ticker.upper().strip()
    background_tasks.add_task(preload_all_stock_timeframes, t)
    return {"status": "preloading_started", "ticker": t}


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
def get_stock_news(
    ticker: str,
    limit: int = Query(15, ge=1, le=50),
    source: Optional[str] = Query(None, description="Filter by publisher (e.g. Economic Times, Moneycontrol, LiveMint, Yahoo Finance, Google News)"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment (Bullish, Bearish, Neutral)")
):
    """Returns multi-source real-time Indian stock market news aggregated across top financial publications."""
    from backend.data.news_multi_source import get_multi_source_news
    return get_multi_source_news(ticker=ticker, limit=limit, source_filter=source, sentiment_filter=sentiment)


@router.get("/market/news")
def get_general_market_news(
    limit: int = Query(15, ge=1, le=50),
    source: Optional[str] = Query(None, description="Filter by publisher"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment")
):
    """Returns broad Indian stock market & NSE headline news across multiple premier sources."""
    from backend.data.news_multi_source import get_multi_source_news
    return get_multi_source_news(ticker=None, limit=limit, source_filter=source, sentiment_filter=sentiment)


@router.get("/market/heatmap")
def get_market_heatmap(
    universe: str = Query("ALL", description="Index universe (e.g. ALL, NIFTY 50, BANK NIFTY, NIFTY IT)"),
    metric: str = Query("change_1d_pct", description="Metric to visualize (e.g. change_1d_pct, change_1w_pct, change_1m_pct, rsi_14, volume_ratio_20d, pe_ratio, ai_consensus_score)")
):
    """
    Returns structured sectoral stock heatmap data with market breadth,
    multi-metric calculations, and market cap tier weighting for Treemap UI.
    """
    from backend.analysis.market_heatmap import compute_market_heatmap_data
    return compute_market_heatmap_data(universe=universe, metric=metric)


class CustomIndicatorRequest(BaseModel):
    formula: str = Field(..., description="Formula e.g. '(close - sma(close, 20)) / (std(close, 20) + 1e-9)'")
    interval: str = Field("1d", description="Interval e.g. 1d, 15m, 1h")
    period: str = Field("1Y", description="Lookback period e.g. 1Y, 3M, ALL")


@router.post("/stock/{ticker}/custom-indicator")
def run_custom_indicator(ticker: str, req: CustomIndicatorRequest):
    """
    Safely parses and evaluates user-defined custom technical indicators using AST validation.
    Returns computed series aligned with timestamps and close prices.
    """
    t = ticker.upper().strip()
    if req.interval == "1d":
        df = get_combined_stock_data(t, period=req.period)
    else:
        df = fetch_stock_data(t, period=req.period, interval=req.interval)

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history found for '{t}'.")

    try:
        series = evaluate_custom_formula(df, req.formula)
        records = []
        for idx in range(len(df)):
            date_val = str(df["date"].iloc[idx]) if "date" in df.columns else str(df.index[idx])
            val = float(series.iloc[idx]) if not pd.isna(series.iloc[idx]) else None
            records.append({
                "date": date_val,
                "close": round(float(df["close"].iloc[idx]), 2),
                "value": round(val, 4) if val is not None else None
            })
        return {
            "ticker": t,
            "formula": req.formula,
            "data": records
        }
    except Exception as e:
        logger.warning(f"Error evaluating custom formula '{req.formula}': {e}")
        raise HTTPException(status_code=400, detail=f"Invalid formula: {str(e)}")

