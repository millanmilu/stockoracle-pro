"""
StockOracle Pro — Paper Trading API Router (₹10 Lakh Virtual Ledger)
"""
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Security, Query
from pydantic import BaseModel, Field

from backend.shared.security import verify_api_key, get_current_user_id
from backend.data.database import (
    get_paper_account, place_paper_order, close_paper_position, sell_paper_position,
    get_paper_positions, get_paper_trade_history, get_paper_analytics, reset_paper_account
)

logger = logging.getLogger("StockOracle.API.PaperTrading")

router = APIRouter(prefix="/api/paper", tags=["Paper Trading 2.0"])


class PaperOrderRequest(BaseModel):
    ticker: str = Field(..., description="Stock symbol (e.g. RELIANCE, TCS)")
    order_type: str = Field(default="MARKET", description="MARKET | LIMIT")
    action: str = Field(default="BUY", description="BUY")
    shares: float = Field(..., gt=0, description="Number of shares")
    price: float = Field(..., gt=0, description="Execution price per share")
    stop_loss: Optional[float] = None
    target_price: Optional[float] = None
    notes: Optional[str] = None


class PaperCloseRequest(BaseModel):
    position_id: int
    current_price: float = Field(..., gt=0)


class PaperSellRequest(BaseModel):
    position_id: int
    shares: float = Field(..., gt=0, description="Shares quantity to sell")
    current_price: float = Field(..., gt=0, description="Execution exit price")
    notes: Optional[str] = None


@router.get("/account")
def paper_account_endpoint(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Returns virtual cash balance, starting balance, and ledger update timestamp."""
    effective_user = user_id or get_current_user_id(request)
    return get_paper_account(user_id=effective_user)


@router.post("/order")
def paper_order_endpoint(
    req: PaperOrderRequest,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Executes a virtual buy order, deducting cash balance and logging to journal."""
    effective_user = user_id or get_current_user_id(request)
    try:
        res = place_paper_order(
            ticker=req.ticker,
            order_type=req.order_type,
            action=req.action,
            shares=req.shares,
            price=req.price,
            stop_loss=req.stop_loss,
            target_price=req.target_price,
            notes=req.notes,
            user_id=effective_user,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sell")
def paper_sell_endpoint(
    req: PaperSellRequest,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Executes a full or partial sell order on an open paper position."""
    effective_user = user_id or get_current_user_id(request)
    try:
        return sell_paper_position(
            position_id=req.position_id,
            shares_to_sell=req.shares,
            current_price=req.current_price,
            notes=req.notes,
            user_id=effective_user
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/close")
def paper_close_endpoint(
    req: PaperCloseRequest,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Closes an open virtual position fully at live market price, calculates realized P&L."""
    effective_user = user_id or get_current_user_id(request)
    try:
        return close_paper_position(
            req.position_id, current_price=req.current_price, user_id=effective_user
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/positions")
def paper_positions_endpoint(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Returns active open virtual trading positions enriched with live LTP and unrealized P&L."""
    effective_user = user_id or get_current_user_id(request)
    return get_paper_positions(user_id=effective_user)


@router.get("/history")
def paper_history_endpoint(
    request: Request,
    limit: int = 100,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Returns past executed virtual orders journal."""
    effective_user = user_id or get_current_user_id(request)
    return get_paper_trade_history(user_id=effective_user, limit=limit)


@router.get("/analytics")
def paper_analytics_endpoint(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Returns comprehensive portfolio performance, win rate, profit factor, and sector allocation."""
    effective_user = user_id or get_current_user_id(request)
    return get_paper_analytics(user_id=effective_user)


@router.post("/reset")
def paper_reset_endpoint(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Resets paper account back to ₹1,000,000 and clears all positions and orders."""
    effective_user = user_id or get_current_user_id(request)
    return reset_paper_account(user_id=effective_user)
