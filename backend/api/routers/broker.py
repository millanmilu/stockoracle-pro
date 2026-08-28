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
    persist_to_disk: bool = True  # Automatically persist to backend/.env for reboot survival


# ── Helpers ────────────────────────────────────────────────────────────────────

def _persist_credentials_to_env(creds: AngelOneCredentials) -> bool:
    """
    Safely updates or appends Angel One credentials to backend/.env (and root .env if present).
    Preserves all other configuration lines, existing API keys, and comments intact.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    target_paths = [
        os.path.join(base_dir, ".env"),                     # backend/.env
        os.path.join(os.path.dirname(base_dir), ".env"),   # root/.env
    ]

    updates = {
        "ANGEL_API_KEY": creds.api_key.strip(),
        "ANGEL_CLIENT_ID": creds.client_id.strip(),
        "ANGEL_PASSWORD": creds.password.strip(),
        "ANGEL_TOTP_SECRET": creds.totp_secret.strip(),
    }

    updated_any = False
    for env_file in set(target_paths):
        lines = []
        found_keys = set()
        if os.path.exists(env_file):
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        stripped = line.strip()
                        matched_key = None
                        for k, v in updates.items():
                            if stripped.startswith(f"{k}=") or stripped.startswith(f"{k} ="):
                                matched_key = k
                                lines.append(f"{k}={v}\n")
                                found_keys.add(k)
                                break
                        if not matched_key:
                            lines.append(line)
            except Exception as exc:
                logger.warning("Could not read %s: %s", env_file, exc)
                continue

        # Append any missing keys
        for k, v in updates.items():
            if k not in found_keys:
                lines.append(f"{k}={v}\n")

        try:
            os.makedirs(os.path.dirname(env_file), exist_ok=True)
            with open(env_file, "w", encoding="utf-8") as f:
                f.writelines(lines)
            updated_any = True
            logger.info("Successfully persisted credentials to %s", env_file)
        except Exception as exc:
            logger.error("Failed writing credentials to %s: %s", env_file, exc)

    return updated_any


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
def get_broker_status():
    """
    Returns the active broker session status, expiry countdown, keepalive info,
    and which broker is currently configured.
    """
    details = _fetcher.get_session_details()
    api_key = os.environ.get("ANGEL_API_KEY", "").strip()
    client_id = os.environ.get("ANGEL_CLIENT_ID", "").strip()

    # Check if .env is persisted
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_file = os.path.join(base_dir, ".env")
    has_env = os.path.exists(env_file)

    return {
        "active_broker": "angel_one" if api_key else "none",
        "session_active": details["session_active"],
        "expires_at_ist": details["expires_at_ist"],
        "created_at_ist": details["created_at_ist"],
        "remaining_minutes": details["remaining_minutes"],
        "last_auth_attempt_ist": details["last_auth_attempt_ist"],
        "last_auth_error": details["last_auth_error"],
        "client_id_masked": f"{client_id[:2]}***{client_id[-2:]}" if len(client_id) > 4 else ("set" if client_id else ""),
        "api_key_set": bool(api_key),
        "totp_secret_set": bool(os.environ.get("ANGEL_TOTP_SECRET", "").strip()),
        "persisted_on_disk": has_env,
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
    Applies credentials to the running process via os.environ (in-memory) and
    safely persists to backend/.env so it survives server reboots/restarts.
    Resets and reinitializes the Angel One SmartAPI session immediately.
    """
    if req.broker != "angel_one" or not req.angel_one:
        raise HTTPException(status_code=400, detail="Only 'angel_one' broker supported currently.")

    creds = req.angel_one
    if not all([creds.api_key, creds.client_id, creds.password, creds.totp_secret]):
        raise HTTPException(status_code=422, detail="All four Angel One fields are required.")

    # 1. Update in-memory os.environ
    os.environ["ANGEL_API_KEY"]     = creds.api_key.strip()
    os.environ["ANGEL_CLIENT_ID"]   = creds.client_id.strip()
    os.environ["ANGEL_PASSWORD"]    = creds.password.strip()
    os.environ["ANGEL_TOTP_SECRET"] = creds.totp_secret.strip()

    # 2. Hot-reload fetcher module-level globals
    _fetcher.ANGEL_API_KEY     = creds.api_key.strip()
    _fetcher.ANGEL_CLIENT_ID   = creds.client_id.strip()
    _fetcher.ANGEL_PASSWORD    = creds.password.strip()
    _fetcher.ANGEL_TOTP_SECRET = creds.totp_secret.strip()

    # 3. Persist to .env on disk if requested
    persisted = False
    if req.persist_to_disk:
        persisted = _persist_credentials_to_env(creds)

    # 4. Reinitialize SmartConnect instance
    try:
        from SmartApi import SmartConnect
        _fetcher.smartApi = SmartConnect(api_key=creds.api_key.strip())
    except Exception as exc:
        logger.warning("SmartConnect re-init failed: %s", exc)

    # 5. Reset and re-establish session
    _fetcher.reset_session()
    success = _fetcher.ensure_session()

    persist_note = " (Persisted to .env on server)" if persisted else ""

    if success:
        logger.info("Broker credentials applied and session active for client %s%s", creds.client_id, persist_note)
        return {
            "success": True,
            "message": f"Credentials applied and session active! Live feed resumed.{persist_note}",
            "session_active": True,
            "persisted": persisted,
        }
    else:
        err_msg = _fetcher.get_session_details().get("last_auth_error") or "Unknown authentication error"
        return {
            "success": False,
            "message": f"Credentials saved{persist_note}, but session login failed: {err_msg}",
            "session_active": False,
            "persisted": persisted,
        }
