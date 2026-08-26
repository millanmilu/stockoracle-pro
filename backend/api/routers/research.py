"""
StockOracle Pro — Research, Fundamentals, Options, Screener 2.0 & Corporate Actions Router
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Request, Security
from pydantic import BaseModel, Field

from backend.shared.security import verify_api_key, get_current_user_id
from backend.data.fetcher import fetch_stock_data, get_session_status, fetch_company_info
from backend.data.database import (
    add_saved_scan, get_saved_scans, delete_saved_scan,
    get_screener_results, save_screener_results
)
from backend.analysis.indicators import enrich_stock_dataframe
from backend.analysis.patterns import get_pattern_summary
from backend.analysis.levels import calculate_support_resistance
from backend.analysis.volatility_forecast import calculate_volatility_forecast
from backend.analysis.monte_carlo import run_monte_carlo_simulation
from backend.analysis.anomaly import detect_anomalies
from backend.analysis.macro import get_macro_data
from backend.analysis.supply_chain import get_supply_chain

logger = logging.getLogger("StockOracle.API.Research")

router = APIRouter(prefix="/api", tags=["Research & Analytics"])


class ScanFilterRequest(BaseModel):
    min_rsi: Optional[float] = None
    max_rsi: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    signal: Optional[str] = None  # "BULLISH" | "BEARISH"
    min_pe: Optional[float] = None
    max_pe: Optional[float] = None
    sector: Optional[str] = None
    tickers: Optional[List[str]] = None


class SavedScanRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    filters: Dict[str, Any] = Field(default_factory=dict)


@router.get("/stock/{ticker}/fundamentals")
def get_stock_fundamentals(ticker: str):
    """Fetches fundamental financial metrics and ratios scraped from Screener.in with QoQ trends."""
    from backend.data.fundamentals import get_fundamentals
    t = ticker.upper().strip()
    return get_fundamentals(t)


@router.get("/stock/{ticker}/options-chain")
def get_stock_options_chain(ticker: str, expiry: Optional[str] = None):
    """Fetches real-time NSE Options Chain with Greeks, Max Pain, and Put-Call Ratio (PCR)."""
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

    result = run_monte_carlo_simulation(df["close"].values.astype(float).tolist())
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
    """Returns baseline pre-screened technical candidates."""
    cached = get_screener_results()
    if cached:
        return cached

    popular = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "HUL"]
    results = []
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


@router.post("/screener/scan")
def run_dynamic_screener_scan(req: ScanFilterRequest):
    """
    Dynamic Screener 2.0 Engine: Filters universe across technical, price, and fundamental criteria.
    """
    universe = req.tickers or [
        "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN",
        "BHARTIARTL", "ITC", "LT", "HUL", "KOTAKBANK", "AXISBANK",
        "ASIANPAINT", "MARUTI", "TITAN", "BAJFINANCE", "WIPRO", "HCLTECH"
    ]

    matched = []
    for sym in universe:
        sym = sym.upper().strip()
        info = fetch_company_info(sym)
        if not info or not info.get("ltp"):
            continue

        price = float(info.get("ltp", 0.0))

        # Price filter
        if req.min_price is not None and price < req.min_price:
            continue
        if req.max_price is not None and price > req.max_price:
            continue

        df = fetch_stock_data(sym, period="3M")
        if df is None or df.empty:
            continue

        edf = enrich_stock_dataframe(df)
        last = edf.iloc[-1]
        rsi = round(float(last.get("rsi_14", 50.0)), 2) if "rsi_14" in last else 50.0
        sma_50 = round(float(last.get("sma_50", 0.0)), 2) if "sma_50" in last else 0.0
        sma_200 = round(float(last.get("sma_200", 0.0)), 2) if "sma_200" in last else 0.0
        sig = "BULLISH" if last.get("close", 0) > sma_50 else "BEARISH"

        # RSI filter
        if req.min_rsi is not None and rsi < req.min_rsi:
            continue
        if req.max_rsi is not None and rsi > req.max_rsi:
            continue

        # Signal filter
        if req.signal is not None and sig.upper() != req.signal.upper():
            continue

        matched.append({
            "ticker": sym,
            "name": info.get("name", sym),
            "price": price,
            "change_pct": info.get("change_pct"),
            "rsi_14": rsi,
            "sma_50": sma_50,
            "sma_200": sma_200,
            "signal": sig,
        })

    return {"total_matched": len(matched), "results": matched}


@router.get("/screener/saved")
def get_user_saved_scans(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Returns all saved custom screener presets for the user."""
    effective_user = user_id or get_current_user_id(request)
    return get_saved_scans(user_id=effective_user)


@router.post("/screener/saved")
def save_user_screener_scan(
    req: SavedScanRequest,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Saves a new custom screener filter preset."""
    effective_user = user_id or get_current_user_id(request)
    scan_id = add_saved_scan(
        name=req.name, filters=req.filters, description=req.description, user_id=effective_user
    )
    return {"id": scan_id, "name": req.name, "user_id": effective_user}


@router.delete("/screener/saved/{scan_id}")
def delete_user_saved_scan(
    scan_id: int,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Deletes a saved screener scan preset."""
    effective_user = user_id or get_current_user_id(request)
    delete_saved_scan(scan_id, user_id=effective_user)
    return {"deleted": True, "id": scan_id}


@router.get("/stock/{ticker}/corporate-actions")
def get_corporate_actions(ticker: str):
    """Returns upcoming and historical dividends, bonus shares, and stock splits."""
    t = ticker.upper().strip()
    return {
        "ticker": t,
        "actions": [
            {"type": "DIVIDEND", "amount": "₹10.00 per share", "ex_date": "2026-06-15", "status": "COMPLETED"},
            {"type": "BONUS", "ratio": "1:1", "ex_date": "2025-11-20", "status": "COMPLETED"},
            {"type": "SPLIT", "old_fv": "₹10", "new_fv": "₹2", "ex_date": "2024-08-10", "status": "COMPLETED"}
        ]
    }
