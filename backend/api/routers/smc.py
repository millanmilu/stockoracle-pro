"""Read-only SMC agent status and setup APIs."""

from fastapi import APIRouter, HTTPException, Query, Security
from sqlalchemy import select

from backend.shared.database import get_db_session
from backend.shared.models import SmcAgentSetup
from backend.shared.security import verify_api_key
from backend.services.smc_agent import DEFAULT_SYMBOLS, evaluate_symbol, get_status

router = APIRouter(prefix="/api/smc-agent", tags=["SMC Agent"], dependencies=[Security(verify_api_key)])


@router.get("/status")
def status():
    return get_status()


@router.get("/setups")
def setups(limit: int = Query(100, ge=1, le=500)):
    with get_db_session() as session:
        rows = session.scalars(select(SmcAgentSetup).order_by(SmcAgentSetup.created_at.desc()).limit(limit)).all()
        return [{"fingerprint": r.fingerprint, "symbol": r.ticker, "direction": r.direction, "status": r.status,
                 "entry": r.entry, "stop": r.stop_loss, "target": r.target, "risk_reward": r.risk_reward,
                 "confirmed_at": r.confirmed_at, "reason": r.reason, "notified_at": r.notified_at} for r in rows]


@router.post("/evaluate/{symbol}")
def evaluate(symbol: str):
    value = evaluate_symbol(symbol.upper())
    if value["status"] == "unavailable":
        raise HTTPException(status_code=503, detail=value["reason"])
    return value
