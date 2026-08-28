"""
StockOracle Pro — Broker Configuration & Session Management Router
Supports: Angel One SmartAPI (active), Zerodha/Upstox/Fyers (future-ready)
"""
import os
import pyotp
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.logging import get_logger
from backend.data import fetcher as _fetcher

logger = get_logger("stockoracle.broker")

router = APIRouter(prefix="/api/broker", tags=["Broker Settings"])


# ── Request / Response Models ──────────────────────────────────────────────────

class AngelOneCredentials(BaseModel):
    api_key:     str
    client_id:   str
    password:    str
    totp_secret: str


class BrokerTestRequest(BaseModel):
    broker: str  # "angel_one" for now
    angel_one: Optional[AngelOneCredentials] = None


class BrokerApplyRequest(BaseModel):
    broker: str
    angel_one: Optional[AngelOneCredentials] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
def get_broker_status():
    """
    Returns the active broker session status, last heartbeat, and which
    broker is currently configured (from os.environ).
    """
    session_active = _fetcher.get_session_status()
    api_key = os.environ.get("ANGEL_API_KEY", "").strip()
    client_id = os.environ.get("ANGEL_CLIENT_ID", "").strip()

    return {
        "active_broker": "angel_one" if api_key else "none",
        "session_active": session_active,
        "client_id_masked": f"{client_id[:2]}***{client_id[-2:]}" if len(client_id) > 4 else ("set" if client_id else ""),
        "api_key_set": bool(api_key),
        "totp_secret_set": bool(os.environ.get("ANGEL_TOTP_SECRET", "").strip()),
        "checked_at_ist": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
    }


@router.post("/test")
def test_broker_credentials(req: BrokerTestRequest):
    """
    Tests credentials WITHOUT applying them to the active session.
    Creates a throwaway SmartConnect instance to verify login.
    Returns success/failure and any error message from the broker.
    """
    if req.broker != "angel_one" or not req.angel_one:
        raise HTTPException(status_code=400, detail="Only 'angel_one' broker supported currently.")

    creds = req.angel_one
    if not all([creds.api_key, creds.client_id, creds.password, creds.totp_secret]):
        raise HTTPException(status_code=422, detail="All four Angel One fields are required.")

    try:
        from SmartApi import SmartConnect
        test_api = SmartConnect(api_key=creds.api_key.strip())
        totp = pyotp.TOTP(creds.totp_secret.strip()).now()
        data = test_api.generateSession(creds.client_id.strip(), creds.password.strip(), totp)

        if data and data.get("status"):
            return {
                "success": True,
                "message": "Connection successful — Angel One session verified.",
                "client_id": data.get("data", {}).get("clientcode", creds.client_id),
            }
        else:
            msg = data.get("message", "Unknown error") if data else "No response from Angel One"
            return {"success": False, "message": f"Login failed: {msg}"}

    except Exception as exc:
        logger.warning("Broker test failed for angel_one: %s", exc)
        return {"success": False, "message": f"Error: {str(exc)}"}


@router.post("/apply")
def apply_broker_credentials(req: BrokerApplyRequest):
    """
    Applies credentials to the running process via os.environ (in-memory only).
    Resets and reinitializes the Angel One SmartAPI session immediately.
    No .env file is modified — changes persist only for the current server process.
    """
    if req.broker != "angel_one" or not req.angel_one:
        raise HTTPException(status_code=400, detail="Only 'angel_one' broker supported currently.")

    creds = req.angel_one
    if not all([creds.api_key, creds.client_id, creds.password, creds.totp_secret]):
        raise HTTPException(status_code=422, detail="All four Angel One fields are required.")

    # Update os.environ so fetcher module-level reads pick them up on next call
    os.environ["ANGEL_API_KEY"]     = creds.api_key.strip()
    os.environ["ANGEL_CLIENT_ID"]   = creds.client_id.strip()
    os.environ["ANGEL_PASSWORD"]    = creds.password.strip()
    os.environ["ANGEL_TOTP_SECRET"] = creds.totp_secret.strip()

    # Hot-reload fetcher module-level globals directly
    _fetcher.ANGEL_API_KEY     = creds.api_key.strip()
    _fetcher.ANGEL_CLIENT_ID   = creds.client_id.strip()
    _fetcher.ANGEL_PASSWORD    = creds.password.strip()
    _fetcher.ANGEL_TOTP_SECRET = creds.totp_secret.strip()

    # Reinitialize SmartConnect with new API key
    try:
        from SmartApi import SmartConnect
        _fetcher.smartApi = SmartConnect(api_key=creds.api_key.strip())
    except Exception as exc:
        logger.warning("SmartConnect re-init failed: %s", exc)

    # Reset session so the next broadcast loop call re-authenticates cleanly
    _fetcher.reset_session()

    # Attempt an immediate session to give instant feedback
    success = _fetcher.ensure_session()

    if success:
        logger.info("Broker credentials applied and session established for client %s", creds.client_id)
        return {
            "success": True,
            "message": "Credentials applied and session active. Live feed will resume.",
            "session_active": True,
        }
    else:
        return {
            "success": False,
            "message": "Credentials saved in memory but session could not be established. Check your credentials.",
            "session_active": False,
        }
