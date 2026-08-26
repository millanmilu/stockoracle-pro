"""
StockOracle Pro — Research, Fundamentals, Options & Quantitative Analytics Router
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query

from backend.data.fetcher import fetch_stock_data, get_session_status
from backend.analysis.patterns import get_pattern_summary
from backend.analysis.levels import calculate_support_resistance
from backend.analysis.volatility_forecast import calculate_volatility_forecast
from backend.analysis.monte_carlo import run_monte_carlo_simulation
from backend.analysis.anomaly import detect_anomalies
from backend.analysis.macro import get_macro_data
from backend.analysis.supply_chain import get_supply_chain

logger = logging.getLogger("StockOracle.API.Research")

router = APIRouter(prefix="/api", tags=["Research & Analytics"])


@router.get("/stock/{ticker}/fundamentals")
def get_stock_fundamentals(ticker: str):
    """Fetches fundamental financial metrics and ratios scraped from Screener.in."""
    from backend.data.fundamentals import get_fundamentals
    t = ticker.upper().strip()
    return get_fundamentals(t)


@router.get("/stock/{ticker}/options-chain")
def get_stock_options_chain(ticker: str, expiry: Optional[str] = None):
    """Fetches real-time NSE Options Chain with Max Pain and Put-Call Ratio (PCR)."""
    from backend.data.options import get_options_chain
    t = ticker.upper().strip()
    return get_options_chain(t, expiry)


@router.get("/stock/{ticker}/patterns")
def get_stock_patterns(ticker: str):
    """Detects candlestick and chart patterns (Head & Shoulders, Double Bottoms, Engulfing)."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="6M")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history for '{t}'.")
    return get_pattern_summary(df)


@router.get("/stock/{ticker}/levels")
def get_stock_levels(ticker: str):
    """Calculates Support, Resistance, and Fibonacci Retracement levels."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history for '{t}'.")
    return calculate_support_resistance(df)


@router.get("/stock/{ticker}/volatility")
def get_stock_volatility(ticker: str):
    """Calculates GARCH(1,1) forward volatility forecast and historical volatility cone."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history for '{t}'.")
    return calculate_volatility_forecast(df)


@router.get("/stock/{ticker}/montecarlo")
def get_stock_monte_carlo(ticker: str):
    """Simulates 1,000 Geometric Brownian Motion (GBM) paths with VaR calculations."""
    t = ticker.upper().strip()
    from backend.data.database import get_monte_carlo_cached, save_monte_carlo
    cached = get_monte_carlo_cached(t)
    if cached:
        return cached

    df = fetch_stock_data(t, period="1Y")
    if df is None or len(df) < 30:
        raise HTTPException(status_code=404, detail=f"Insufficient price history for '{t}'.")

    result = run_monte_carlo_simulation(df)
    save_monte_carlo(t, result)
    return result


@router.get("/stock/{ticker}/anomalies")
def get_stock_anomalies(ticker: str):
    """Detects statistical volume, price, and volatility anomalies using Isolation Forests."""
    t = ticker.upper().strip()
    df = fetch_stock_data(t, period="1Y")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price history for '{t}'.")
    return detect_anomalies(df)


@router.get("/macro")
def get_macro_indicators():
    """Returns macro-economic indicators (Crude Oil, USD/INR, US 10Y Yield, Gold, India 10Y)."""
    return get_macro_data()


@router.get("/stock/{ticker}/supply-chain")
def get_stock_supply_chain(ticker: str):
    """Returns Tier-1 suppliers, customers, and key input commodities with live risk scores."""
    t = ticker.upper().strip()
    return get_supply_chain(t)


@router.get("/screener")
def get_screener_list():
    """Returns pre-screened technical filter candidates."""
    from backend.data.database import get_screener_results, save_screener_results
    cached = get_screener_results()
    if cached:
        return cached

    popular = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "HUL"]
    results = []
    from backend.data.fetcher import fetch_company_info
    from backend.analysis.indicators import enrich_stock_dataframe
    for sym in popular:
        info = fetch_company_info(sym)
        df = fetch_stock_data(sym, period="3M")
        if df is not None and not df.empty and info:
            edf = enrich_stock_dataframe(df)
            last = edf.iloc[-1]
            results.append({
                "ticker": sym,
                "name": info.get("name", sym),
                "price": info.get("ltp"),
                "change_pct": info.get("change_pct"),
                "rsi_14": round(float(last.get("rsi_14", 50.0)), 2) if "rsi_14" in last else 50.0,
                "sma_50": round(float(last.get("sma_50", 0.0)), 2) if "sma_50" in last else 0.0,
                "sma_200": round(float(last.get("sma_200", 0.0)), 2) if "sma_200" in last else 0.0,
                "signal": "BULLISH" if last.get("close", 0) > last.get("sma_50", 0) else "BEARISH",
            })

    save_screener_results(results)
    return results
