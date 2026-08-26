"""
StockOracle Pro — System & Health Endpoints
"""
import os
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Security, Query

from backend.shared.security import verify_api_key, get_current_user_id
from backend.data.database import get_db_stats, DB_PATH
from backend.services.alert_scheduler import get_scheduler_status
from backend.data.fetcher import get_session_status

logger = logging.getLogger("StockOracle.API.System")

router = APIRouter(tags=["System & Observability"])


@router.get("/")
def read_root():
    return {
        "status": "online",
        "message": "StockOracle Pro Advanced AI Market Forecasting API live.",
        "version": "2.0.0",
    }


@router.get("/api/health")
def health_check():
    """Liveness and readiness probe for load balancers and system monitoring."""
    api_ready = get_session_status()
    db_ok = os.path.exists(DB_PATH)
    scheduler_info = get_scheduler_status()
    return {
        "status": "ok" if (api_ready or db_ok) else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "angel_one_api": "active" if api_ready else "inactive",
        "alert_scheduler": scheduler_info,
        "environment": os.getenv("ENVIRONMENT", "production"),
    }


@router.get("/api/db/status")
def db_status_endpoint():
    """Returns row counts and storage metrics for all core database tables."""
    return get_db_stats()


@router.get("/api/audit-log")
async def get_audit_log_endpoint(
    request: Request,
    limit: int = 50,
    user_id: Optional[str] = Query(None),
    _auth: None = Security(verify_api_key),
):
    """Returns the last N audit log entries for the requesting user."""
    import sqlite3 as _sqlite3
    effective_user = user_id or get_current_user_id(request)
    limit = max(1, min(limit, 500))
    try:
        conn = _sqlite3.connect(DB_PATH)
        conn.row_factory = _sqlite3.Row
        rows = conn.execute(
            "SELECT id, user_id, action, entity, entity_id, details, ts_utc "
            "FROM audit_log WHERE user_id = ? ORDER BY ts_utc DESC LIMIT ?",
            (effective_user, limit),
        ).fetchall()
        conn.close()
        return {"user_id": effective_user, "entries": [dict(r) for r in rows]}
    except Exception as exc:
        logger.error("audit-log read failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Could not read audit log")
