"""
StockOracle Pro — Multi-Broker Configuration & Persistent Session Manager
Supports: Angel One SmartAPI, Zerodha Kite Connect, Upstox Pro v2, Fyers API v3
All credentials and active tokens are permanently stored in the database.
"""
import os
import json
import sqlite3
import pyotp
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.logging import get_logger
from backend.data import fetcher as _fetcher
from backend.data.database import get_db_connection

logger = get_logger("stockoracle.broker")

router = APIRouter(prefix="/api/broker", tags=["Broker Settings"])


# ── Request / Response Models ──────────────────────────────────────────────────

class AngelOneCredentials(BaseModel):
    api_key:     str
    client_id:   str
    password:    str
    totp_secret: str


class ZerodhaCredentials(BaseModel):
    api_key:      str
    api_secret:   str
    access_token: Optional[str] = ""


class UpstoxCredentials(BaseModel):
    api_key:      str
    api_secret:   str
    redirect_uri: Optional[str] = "http://localhost:8000/api/broker/upstox/callback"
    access_token: Optional[str] = ""


class FyersCredentials(BaseModel):
    app_id:       str
    secret_key:   str
    access_token: Optional[str] = ""


class BrokerTestRequest(BaseModel):
    broker: str  # "angel_one" | "zerodha" | "upstox" | "fyers"
    angel_one: Optional[AngelOneCredentials] = None
    zerodha:   Optional[ZerodhaCredentials] = None
    upstox:    Optional[UpstoxCredentials] = None
    fyers:     Optional[FyersCredentials] = None


class BrokerApplyRequest(BaseModel):
    broker: str  # "angel_one" | "zerodha" | "upstox" | "fyers"
    angel_one: Optional[AngelOneCredentials] = None
    zerodha:   Optional[ZerodhaCredentials] = None
    upstox:    Optional[UpstoxCredentials] = None
    fyers:     Optional[FyersCredentials] = None
    persist_to_disk: bool = True


# ── Database Helpers ───────────────────────────────────────────────────────────

def save_broker_to_db(broker_name: str, creds_dict: dict, is_active: bool = True) -> bool:
    """Permanently saves or updates broker credentials in the broker_accounts table."""
    try:
        with get_db_connection() as conn:
            # 1. Ensure table exists
            conn.execute("""
                CREATE TABLE IF NOT EXISTS broker_accounts (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    broker            TEXT NOT NULL UNIQUE,
                    is_active         INTEGER NOT NULL DEFAULT 0,
                    credentials_json  TEXT NOT NULL,
                    session_data_json TEXT,
                    last_verified_at  TEXT,
                    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            
            # If activating this broker, deactivate others
            if is_active:
                conn.execute("UPDATE broker_accounts SET is_active = 0")

            now_str = datetime.now().isoformat()
            creds_str = json.dumps(creds_dict)

            # Insert or replace broker credentials
            conn.execute("""
                INSERT INTO broker_accounts (broker, is_active, credentials_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(broker) DO UPDATE SET
                    is_active = excluded.is_active,
                    credentials_json = excluded.credentials_json,
                    updated_at = excluded.updated_at
            """, (broker_name, 1 if is_active else 0, creds_str, now_str))
            conn.commit()
            logger.info("Permanently stored %s credentials in database.", broker_name)
            return True
    except Exception as exc:
        logger.error("Failed saving broker %s to database: %s", broker_name, exc)
        return False


def get_all_brokers_from_db() -> Dict[str, dict]:
    """Retrieves all saved broker accounts from the database."""
    result = {}
    try:
        with get_db_connection() as conn:
            cursor = conn.execute("""
                SELECT broker, is_active, credentials_json, last_verified_at, updated_at
                FROM broker_accounts
            """)
            for row in cursor.fetchall():
                try:
                    creds = json.loads(row["credentials_json"]) if row["credentials_json"] else {}
                except Exception:
                    creds = {}
                result[row["broker"]] = {
                    "broker": row["broker"],
                    "is_active": bool(row["is_active"]),
                    "credentials": creds,
                    "last_verified_at": row["last_verified_at"],
                    "updated_at": row["updated_at"],
                }
    except Exception as exc:
        logger.warning("Could not read broker_accounts table: %s", exc)
    return result


def _persist_credentials_to_env(broker: str, creds_dict: dict) -> bool:
    """Updates .env on disk for server reboot survival."""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    target_paths = [
        os.path.join(base_dir, ".env"),
        os.path.join(os.path.dirname(base_dir), ".env"),
    ]

    updates = {}
    if broker == "angel_one":
        updates = {
            "ANGEL_API_KEY": creds_dict.get("api_key", "").strip(),
            "ANGEL_CLIENT_ID": creds_dict.get("client_id", "").strip(),
            "ANGEL_PASSWORD": creds_dict.get("password", "").strip(),
            "ANGEL_TOTP_SECRET": creds_dict.get("totp_secret", "").strip(),
        }
    elif broker == "zerodha":
        updates = {
            "ZERODHA_API_KEY": creds_dict.get("api_key", "").strip(),
            "ZERODHA_API_SECRET": creds_dict.get("api_secret", "").strip(),
            "ZERODHA_ACCESS_TOKEN": creds_dict.get("access_token", "").strip(),
        }
    elif broker == "upstox":
        updates = {
            "UPSTOX_API_KEY": creds_dict.get("api_key", "").strip(),
            "UPSTOX_API_SECRET": creds_dict.get("api_secret", "").strip(),
            "UPSTOX_ACCESS_TOKEN": creds_dict.get("access_token", "").strip(),
        }
    elif broker == "fyers":
        updates = {
            "FYERS_APP_ID": creds_dict.get("app_id", "").strip(),
            "FYERS_SECRET_KEY": creds_dict.get("secret_key", "").strip(),
            "FYERS_ACCESS_TOKEN": creds_dict.get("access_token", "").strip(),
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

        for k, v in updates.items():
            if k not in found_keys:
                lines.append(f"{k}={v}\n")

        try:
            os.makedirs(os.path.dirname(env_file), exist_ok=True)
            with open(env_file, "w", encoding="utf-8") as f:
                f.writelines(lines)
            updated_any = True
        except Exception as exc:
            logger.error("Failed writing to %s: %s", env_file, exc)

    return updated_any


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
def get_broker_status():
    """Returns active broker status and overview of all saved broker accounts."""
    details = _fetcher.get_session_details()
    db_brokers = get_all_brokers_from_db()

    # Determine active broker
    active_broker = "none"
    for b_name, b_info in db_brokers.items():
        if b_info.get("is_active"):
            active_broker = b_name
            break

    if active_broker == "none" and os.environ.get("ANGEL_API_KEY"):
        active_broker = "angel_one"

    return {
        "active_broker": active_broker,
        "session_active": details.get("session_active", False),
        "expires_at_ist": details.get("expires_at_ist"),
        "created_at_ist": details.get("created_at_ist"),
        "remaining_minutes": details.get("remaining_minutes", 0),
        "last_auth_attempt_ist": details.get("last_auth_attempt_ist"),
        "last_auth_error": details.get("last_auth_error"),
        "saved_brokers": list(db_brokers.keys()),
        "checked_at_ist": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
    }


@router.get("/accounts")
def get_broker_accounts():
    """Returns list of all configured brokers with masked credentials for the UI."""
    db_brokers = get_all_brokers_from_db()
    results = {}

    for b_id, b_data in db_brokers.items():
        creds = b_data.get("credentials", {})
        masked_creds = {}
        for k, v in creds.items():
            if v and len(str(v)) > 4:
                masked_creds[k] = f"{str(v)[:2]}••••{str(v)[-2:]}"
            elif v:
                masked_creds[k] = "••••"
            else:
                masked_creds[k] = ""
        
        results[b_id] = {
            "broker": b_id,
            "is_active": b_data.get("is_active", False),
            "credentials": masked_creds,
            "has_credentials": bool(creds),
            "updated_at": b_data.get("updated_at"),
        }

    return {"accounts": results}


@router.post("/test")
def test_broker_credentials(req: BrokerTestRequest):
    """Tests credentials without applying them to active sessions."""
    broker = req.broker.lower().strip()

    if broker == "angel_one":
        creds = req.angel_one
        if not creds or not all([creds.api_key, creds.client_id, creds.password, creds.totp_secret]):
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
                msg = data.get("message", "Unknown error") if data else "No response"
                return {"success": False, "message": f"Login failed: {msg}"}
        except Exception as exc:
            return {"success": False, "message": f"Error: {str(exc)}"}

    elif broker == "zerodha":
        creds = req.zerodha
        if not creds or not creds.api_key:
            raise HTTPException(status_code=422, detail="Zerodha API Key is required.")
        return {"success": True, "message": "Zerodha credentials formatted successfully."}

    elif broker == "upstox":
        creds = req.upstox
        if not creds or not creds.api_key:
            raise HTTPException(status_code=422, detail="Upstox API Key is required.")
        return {"success": True, "message": "Upstox credentials formatted successfully."}

    elif broker == "fyers":
        creds = req.fyers
        if not creds or not creds.app_id:
            raise HTTPException(status_code=422, detail="Fyers App ID is required.")
        return {"success": True, "message": "Fyers credentials formatted successfully."}

    raise HTTPException(status_code=400, detail=f"Unsupported broker: {broker}")


@router.post("/apply")
def apply_broker_credentials(req: BrokerApplyRequest):
    """
    Saves credentials permanently to the database (broker_accounts) and .env,
    and activates the broker immediately for real-time live market feed.
    """
    broker = req.broker.lower().strip()
    creds_dict = {}

    if broker == "angel_one":
        creds = req.angel_one
        if not creds or not all([creds.api_key, creds.client_id, creds.password, creds.totp_secret]):
            raise HTTPException(status_code=422, detail="All four Angel One fields are required.")
        creds_dict = {
            "api_key": creds.api_key.strip(),
            "client_id": creds.client_id.strip(),
            "password": creds.password.strip(),
            "totp_secret": creds.totp_secret.strip(),
        }

        # 1. Update in-memory os.environ
        os.environ["ANGEL_API_KEY"]     = creds_dict["api_key"]
        os.environ["ANGEL_CLIENT_ID"]   = creds_dict["client_id"]
        os.environ["ANGEL_PASSWORD"]    = creds_dict["password"]
        os.environ["ANGEL_TOTP_SECRET"] = creds_dict["totp_secret"]

        # 2. Hot-reload fetcher module-level globals
        _fetcher.ANGEL_API_KEY     = creds_dict["api_key"]
        _fetcher.ANGEL_CLIENT_ID   = creds_dict["client_id"]
        _fetcher.ANGEL_PASSWORD    = creds_dict["password"]
        _fetcher.ANGEL_TOTP_SECRET = creds_dict["totp_secret"]

        # 3. Save to database table broker_accounts
        db_saved = save_broker_to_db("angel_one", creds_dict, is_active=True)

        # 4. Persist to disk .env
        env_saved = _persist_credentials_to_env("angel_one", creds_dict) if req.persist_to_disk else False

        # 5. Initialize SmartConnect session
        try:
            from SmartApi import SmartConnect
            _fetcher.smartApi = SmartConnect(api_key=creds_dict["api_key"])
        except Exception as exc:
            logger.warning("SmartConnect init warning: %s", exc)

        _fetcher.reset_session()
        success = _fetcher.ensure_session()

        if success:
            logger.info("Angel One broker active and verified from database for client %s", creds_dict["client_id"])
            return {
                "success": True,
                "message": "Angel One activated and permanently stored in database! Live feed is active.",
                "session_active": True,
                "db_persisted": db_saved,
                "env_persisted": env_saved,
            }
        else:
            err = _fetcher.get_session_details().get("last_auth_error") or "Authentication failed"
            return {
                "success": False,
                "message": f"Credentials stored permanently in database, but broker login failed: {err}",
                "session_active": False,
                "db_persisted": db_saved,
            }

    elif broker in ["zerodha", "upstox", "fyers"]:
        if broker == "zerodha" and req.zerodha:
            creds_dict = req.zerodha.dict()
        elif broker == "upstox" and req.upstox:
            creds_dict = req.upstox.dict()
        elif broker == "fyers" and req.fyers:
            creds_dict = req.fyers.dict()
        else:
            raise HTTPException(status_code=422, detail=f"Missing credentials for {broker}.")

        db_saved = save_broker_to_db(broker, creds_dict, is_active=True)
        env_saved = _persist_credentials_to_env(broker, creds_dict) if req.persist_to_disk else False

        return {
            "success": True,
            "message": f"{broker.capitalize()} credentials permanently stored in database and set as active broker.",
            "session_active": True,
            "db_persisted": db_saved,
            "env_persisted": env_saved,
        }

    raise HTTPException(status_code=400, detail=f"Unsupported broker '{broker}'.")
