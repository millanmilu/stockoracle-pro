"""
StockOracle Pro — Smart Alerts API Router
"""
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Security, Query
from pydantic import BaseModel, Field

from backend.shared.security import verify_api_key, get_current_user_id
from backend.data.database import (
    add_smart_alert, get_smart_alerts, remove_smart_alert
)
from backend.services.alert_scheduler import evaluate_all_alerts

logger = logging.getLogger("StockOracle.API.Alerts")

router = APIRouter(prefix="/api/smart-alerts", tags=["Smart Alerts"])


class SmartAlertRequest(BaseModel):
    ticker: str = Field(..., description="Stock symbol (e.g. RELIANCE, TCS)")
    alert_type: str = Field(..., description="Alert condition (e.g. price_above, price_below, rsi_below, rsi_above, volume_spike)")
    param_value: Dict[str, Any] = Field(default_factory=dict, description="Alert parameters (threshold, target_price, etc.)")


@router.get("")
def list_smart_alerts(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Lists all active and triggered smart alerts for the requesting user."""
    effective_user = user_id or get_current_user_id(request)
    return get_smart_alerts(user_id=effective_user)


@router.post("")
def create_smart_alert_endpoint(
    req: SmartAlertRequest,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Creates a new smart technical or price alert."""
    effective_user = user_id or get_current_user_id(request)
    alert_id = add_smart_alert(
        ticker=req.ticker.upper(),
        alert_type=req.alert_type,
        param_value=req.param_value,
        user_id=effective_user,
    )
    return {"id": alert_id, "user_id": effective_user}


@router.delete("/{alert_id}")
def delete_smart_alert_endpoint(
    alert_id: int,
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Deletes a smart alert by ID."""
    effective_user = user_id or get_current_user_id(request)
    remove_smart_alert(alert_id, user_id=effective_user)
    return {"deleted": True, "id": alert_id}


@router.get("/evaluate")
async def evaluate_smart_alerts_endpoint(
    request: Request,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Manually evaluates all smart alerts against current live market data."""
    effective_user = user_id or get_current_user_id(request)
    results = await evaluate_all_alerts(user_id=effective_user, auto_trigger=False)
    return results
