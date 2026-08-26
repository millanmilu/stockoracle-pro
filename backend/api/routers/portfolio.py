"""
StockOracle Pro — Portfolio API Router
"""
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Security, Query
from pydantic import BaseModel, Field

from backend.shared.security import verify_api_key, get_current_user_id
from backend.data.database import (
    add_portfolio_position, get_portfolio, remove_portfolio_position
)
from backend.data.fetcher import fetch_company_info

logger = logging.getLogger("StockOracle.API.Portfolio")

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])

EXPANDED_SECTOR_MAP = {
    "RELIANCE": "Energy & Petrochemicals", "TCS": "IT & Software Services",
    "HDFCBANK": "Banking & Financial Services", "INFY": "IT & Software Services",
    "ICICIBANK": "Banking & Financial Services", "SBIN": "Banking & Financial Services",
    "BHARTIARTL": "Telecommunications", "ITC": "Consumer Goods & FMCG",
    "LT": "Engineering & Construction", "HUL": "Consumer Goods & FMCG",
    "KOTAKBANK": "Banking & Financial Services", "AXISBANK": "Banking & Financial Services",
    "ASIANPAINT": "Consumer Goods & Paints", "MARUTI": "Automobile & Manufacturing",
    "TITAN": "Consumer Goods & Jewellery", "BAJFINANCE": "Non-Banking Financial (NBFC)",
    "WIPRO": "IT & Software Services", "HCLTECH": "IT & Software Services",
    "SUNPHARMA": "Pharmaceuticals & Healthcare", "TATAMOTORS": "Automobile & Manufacturing",
    "TATASTEEL": "Metals & Mining", "NTPC": "Power & Energy",
    "POWERGRID": "Power Transmission", "ONGC": "Oil & Gas Exploration",
    "COALINDIA": "Metals & Mining", "ADANIENT": "Diversified Conglomerate",
    "ADANIPORTS": "Infrastructure & Ports", "ULTRACEMCO": "Cement & Building Materials",
    "NESTLEIND": "Consumer Goods & FMCG", "JSWSTEEL": "Metals & Mining",
    "GRASIM": "Cement & Chemicals", "CIPLA": "Pharmaceuticals & Healthcare",
    "DRREDDY": "Pharmaceuticals & Healthcare", "EICHERMOT": "Automobile & Manufacturing",
    "DIVISLAB": "Pharmaceuticals & Healthcare", "BPCL": "Energy & Petrochemicals",
    "APOLLOHOSP": "Healthcare Services", "HEROMOTOCO": "Automobile & Manufacturing",
    "HINDALCO": "Metals & Mining", "BRITANNIA": "Consumer Goods & FMCG",
}


class PortfolioPositionRequest(BaseModel):
    ticker: str = Field(..., description="Stock symbol (e.g. RELIANCE, TCS)")
    shares: float = Field(..., gt=0, description="Positive quantity of shares")
    buy_price: float = Field(..., gt=0, description="Buy price per share")


@router.get("")
def list_portfolio(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Lists all user portfolio holdings with live price, P&L, and sector mapping."""
    effective_user = user_id or get_current_user_id(request)
    positions = get_portfolio(user_id=effective_user)
    enriched = []
    for pos in positions:
        ticker = pos["ticker"]
        info = fetch_company_info(ticker)
        current_price = info.get("ltp") if info else None
        buy_price = pos["buy_price"]
        shares = pos["shares"]
        pnl = None
        pnl_pct = None
        if current_price is not None:
            pnl = round((current_price - buy_price) * shares, 2)
            pnl_pct = round(((current_price - buy_price) / buy_price) * 100, 2) if buy_price else 0.0

        enriched.append({
            "id": pos["id"],
            "user_id": pos.get("user_id", effective_user),
            "ticker": ticker,
            "shares": shares,
            "buy_price": buy_price,
            "current_price": current_price,
            "pnl": pnl,
            "pnl_pct": pnl_pct,
            "sector": EXPANDED_SECTOR_MAP.get(ticker, "Other"),
            "added_at": pos.get("added_at"),
        })
    return enriched


@router.post("")
def add_portfolio_position_endpoint(
    req: PortfolioPositionRequest,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Adds a new stock holding to the user's portfolio."""
    effective_user = user_id or get_current_user_id(request)
    pos_id = add_portfolio_position(
        req.ticker.upper(), req.shares, req.buy_price, user_id=effective_user
    )
    return {"id": pos_id, "message": "Position added", "user_id": effective_user}


@router.delete("/{position_id}")
def remove_portfolio_position_endpoint(
    position_id: int,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Removes a position from user portfolio."""
    effective_user = user_id or get_current_user_id(request)
    remove_portfolio_position(position_id, user_id=effective_user)
    return {"deleted": True, "id": position_id}
