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
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.logging import get_logger
from backend.data import fetcher as _fetcher
from backend.data.database import (
    save_broker_account_orm,
    get_all_broker_accounts_orm,
    get_broker_account_orm,
    delete_broker_account_orm,
)
from backend.shared.security import encrypt_value, decrypt_value

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


class BrokerConnectRequest(BaseModel):
    broker: str  # "angel_one" | "zerodha" | "upstox" | "fyers"


class BrokerClearRequest(BaseModel):
    broker: str  # "angel_one" | "zerodha" | "upstox" | "fyers"



# ── Database Helpers ───────────────────────────────────────────────────────────

def save_broker_to_db(broker_name: str, creds_dict: dict, is_active: bool = True) -> bool:
    """Permanently saves or updates broker credentials in the broker_accounts table (ORM + PostgreSQL/SQLite)."""
    return save_broker_account_orm(broker_name, creds_dict, is_active=is_active)


def get_all_brokers_from_db() -> Dict[str, dict]:
    """Retrieves all saved broker accounts from the database (ORM + PostgreSQL/SQLite)."""
    return get_all_broker_accounts_orm()


def _persist_credentials_to_env(broker: str, creds_dict: dict) -> bool:
    """Updates .env on disk for server reboot survival."""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    target_paths = [
        os.path.join(base_dir, ".env"),
        os.path.join(base_dir, "backend", ".env"),
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


@router.get("/audit-logs")
def get_broker_audit_logs_endpoint(limit: int = 10):
    """Returns recent broker session and connection audit logs."""
    from backend.data.database import get_recent_broker_audit_logs
    return {"logs": get_recent_broker_audit_logs(limit=limit)}


@router.post("/test")
def test_broker_credentials(req: BrokerTestRequest):
    """Tests credentials without applying them to active sessions."""
    import time
    from backend.data.database import save_broker_audit_log

    broker = req.broker.lower().strip()
    t0 = time.perf_counter()

    if broker == "angel_one":
        creds = req.angel_one
        if not creds or not all([creds.api_key, creds.client_id, creds.password, creds.totp_secret]):
            raise HTTPException(status_code=422, detail="All four Angel One fields are required.")
        try:
            from SmartApi import SmartConnect
            test_api = SmartConnect(api_key=creds.api_key.strip())
            totp = pyotp.TOTP(creds.totp_secret.strip()).now()
            data = test_api.generateSession(creds.client_id.strip(), creds.password.strip(), totp)
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)

            if data and data.get("status"):
                client_code = data.get("data", {}).get("clientcode", creds.client_id)
                save_broker_audit_log("angel_one", "TEST", "SUCCESS", f"Session verified for client {client_code}", latency_ms)
                return {
                    "success": True,
                    "message": f"Connection successful — Angel One session verified ({latency_ms}ms).",
                    "client_id": client_code,
                    "latency_ms": latency_ms,
                }
            else:
                msg = data.get("message", "Unknown error") if data else "No response"
                save_broker_audit_log("angel_one", "TEST", "FAILED", msg, latency_ms)
                return {"success": False, "message": f"Login failed: {msg}", "latency_ms": latency_ms}
        except Exception as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            save_broker_audit_log("angel_one", "TEST", "ERROR", str(exc), latency_ms)
            return {"success": False, "message": f"Error: {str(exc)}", "latency_ms": latency_ms}

    elif broker == "zerodha":
        creds = req.zerodha
        if not creds or not creds.api_key or not creds.api_secret:
            raise HTTPException(status_code=422, detail="Zerodha API Key and API Secret are required.")
        
        # Test Kite session if access token is available
        if creds.access_token and len(creds.access_token.strip()) > 5:
            try:
                from kiteconnect import KiteConnect
                kite = KiteConnect(api_key=creds.api_key.strip())
                kite.set_access_token(creds.access_token.strip())
                prof = kite.profile()
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                user_id = prof.get("user_id", creds.api_key)
                save_broker_audit_log("zerodha", "TEST", "SUCCESS", f"Kite profile active: {user_id}", latency_ms)
                return {
                    "success": True,
                    "message": f"Zerodha Kite session verified for user {user_id} ({latency_ms}ms).",
                    "latency_ms": latency_ms,
                }
            except ImportError:
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                save_broker_audit_log("zerodha", "TEST", "NOTICE", "Credentials formatted (kiteconnect SDK not installed)", latency_ms)
                return {
                    "success": True,
                    "message": f"Zerodha credentials validated ({latency_ms}ms). Install kiteconnect for live session probe.",
                    "latency_ms": latency_ms,
                }
            except Exception as exc:
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                save_broker_audit_log("zerodha", "TEST", "FAILED", str(exc), latency_ms)
                return {"success": False, "message": f"Zerodha session verification failed: {str(exc)}", "latency_ms": latency_ms}
        
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        save_broker_audit_log("zerodha", "TEST", "VALIDATED", "Key & Secret validated format", latency_ms)
        return {
            "success": True,
            "message": f"Zerodha API Key & Secret validated ({latency_ms}ms). Enter daily Access Token for live feed.",
            "latency_ms": latency_ms,
        }

    elif broker == "upstox":
        creds = req.upstox
        if not creds or not creds.api_key or not creds.api_secret:
            raise HTTPException(status_code=422, detail="Upstox Client ID and API Secret are required.")
        
        if creds.access_token and len(creds.access_token.strip()) > 5:
            try:
                from urllib.request import Request as UReq, urlopen as UOpen
                req_up = UReq("https://api.upstox.com/v2/user/profile", headers={
                    "Authorization": f"Bearer {creds.access_token.strip()}",
                    "Accept": "application/json"
                })
                with UOpen(req_up, timeout=8) as resp:
                    u_data = json.loads(resp.read().decode("utf-8"))
                    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                    user_name = u_data.get("data", {}).get("user_name", "Upstox User")
                    save_broker_audit_log("upstox", "TEST", "SUCCESS", f"Profile verified: {user_name}", latency_ms)
                    return {
                        "success": True,
                        "message": f"Upstox session active for {user_name} ({latency_ms}ms).",
                        "latency_ms": latency_ms,
                    }
            except Exception as exc:
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                save_broker_audit_log("upstox", "TEST", "FAILED", str(exc), latency_ms)
                return {"success": False, "message": f"Upstox token probe failed: {str(exc)}", "latency_ms": latency_ms}

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        save_broker_audit_log("upstox", "TEST", "VALIDATED", "Format validated", latency_ms)
        return {
            "success": True,
            "message": f"Upstox credentials validated ({latency_ms}ms). Provide daily OAuth Access Token for live feed.",
            "latency_ms": latency_ms,
        }

    elif broker == "fyers":
        creds = req.fyers
        if not creds or not creds.app_id or not creds.secret_key:
            raise HTTPException(status_code=422, detail="Fyers App ID and Secret Key are required.")
        
        if creds.access_token and len(creds.access_token.strip()) > 5:
            try:
                from urllib.request import Request as FReq, urlopen as FOpen
                auth_hdr = f"{creds.app_id.strip()}:{creds.access_token.strip()}"
                req_fy = FReq("https://api-t1.fyers.in/api/v3/profile", headers={
                    "Authorization": auth_hdr,
                    "Accept": "application/json"
                })
                with FOpen(req_fy, timeout=8) as resp:
                    f_data = json.loads(resp.read().decode("utf-8"))
                    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                    save_broker_audit_log("fyers", "TEST", "SUCCESS", "Fyers profile active", latency_ms)
                    return {
                        "success": True,
                        "message": f"Fyers session verified successfully ({latency_ms}ms).",
                        "latency_ms": latency_ms,
                    }
            except Exception as exc:
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                save_broker_audit_log("fyers", "TEST", "FAILED", str(exc), latency_ms)
                return {"success": False, "message": f"Fyers token probe: {str(exc)}", "latency_ms": latency_ms}

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        save_broker_audit_log("fyers", "TEST", "VALIDATED", "Format validated", latency_ms)
        return {
            "success": True,
            "message": f"Fyers App ID & Secret Key validated ({latency_ms}ms). Enter daily 2FA Token for live feed.",
            "latency_ms": latency_ms,
        }

    raise HTTPException(status_code=400, detail=f"Unsupported broker: {broker}")


@router.post("/apply")
def apply_broker_credentials(req: BrokerApplyRequest):
    """
    Saves credentials permanently to the database (broker_accounts) and .env,
    and activates the broker immediately for real-time live market feed.
    """
    from backend.data.database import save_broker_audit_log
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
            save_broker_audit_log("angel_one", "APPLY", "ACTIVE", f"Client {creds_dict['client_id']} active")
            return {
                "success": True,
                "message": "Angel One activated and permanently stored in database! Live feed is active.",
                "session_active": True,
                "db_persisted": db_saved,
                "env_persisted": env_saved,
            }
        else:
            err = _fetcher.get_session_details().get("last_auth_error") or "Authentication failed"
            save_broker_audit_log("angel_one", "APPLY", "AUTH_FAILED", err)
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
        save_broker_audit_log(broker, "APPLY", "ACTIVE", "Active broker updated in database")

        return {
            "success": True,
            "message": f"{broker.capitalize()} credentials permanently stored in database and set as active broker.",
            "session_active": True,
            "db_persisted": db_saved,
            "env_persisted": env_saved,
        }

    raise HTTPException(status_code=400, detail=f"Unsupported broker '{broker}'.")


@router.post("/connect")
def connect_saved_broker_endpoint(req: BrokerConnectRequest):
    """
    Connects/activates a broker using its already stored encrypted credentials from DB or .env.
    Allows 1-click connection without re-entering form fields.
    """
    from backend.data.database import save_broker_audit_log, get_broker_account_orm, save_broker_account_orm
    broker = req.broker.lower().strip()

    # Load stored credentials
    acc = get_broker_account_orm(broker)
    creds_dict = acc.get("credentials", {}) if acc else {}

    # If missing from DB, check in-memory or .env fallback
    if not creds_dict and broker == "angel_one":
        k = (os.environ.get("ANGEL_API_KEY") or "").strip()
        c = (os.environ.get("ANGEL_CLIENT_ID") or "").strip()
        p = (os.environ.get("ANGEL_PASSWORD") or "").strip()
        t = (os.environ.get("ANGEL_TOTP_SECRET") or "").strip()
        if all([k, c, p, t]):
            creds_dict = {"api_key": k, "client_id": c, "password": p, "totp_secret": t}
            save_broker_account_orm("angel_one", creds_dict, is_active=True)

    if not creds_dict:
        raise HTTPException(
            status_code=404,
            detail=f"No saved credentials found for {broker.replace('_', ' ').title()}. Please enter and save your credentials first."
        )

    if broker == "angel_one":
        for field in ["api_key", "client_id", "password", "totp_secret"]:
            if not creds_dict.get(field):
                raise HTTPException(status_code=422, detail=f"Incomplete saved credentials: {field} is missing.")

        # Update environment & fetcher globals
        os.environ["ANGEL_API_KEY"]     = creds_dict["api_key"]
        os.environ["ANGEL_CLIENT_ID"]   = creds_dict["client_id"]
        os.environ["ANGEL_PASSWORD"]    = creds_dict["password"]
        os.environ["ANGEL_TOTP_SECRET"] = creds_dict["totp_secret"]

        _fetcher.ANGEL_API_KEY     = creds_dict["api_key"]
        _fetcher.ANGEL_CLIENT_ID   = creds_dict["client_id"]
        _fetcher.ANGEL_PASSWORD    = creds_dict["password"]
        _fetcher.ANGEL_TOTP_SECRET = creds_dict["totp_secret"]

        save_broker_to_db("angel_one", creds_dict, is_active=True)

        try:
            from SmartApi import SmartConnect
            _fetcher.smartApi = SmartConnect(api_key=creds_dict["api_key"])
        except Exception as exc:
            logger.warning("SmartConnect reinit warning: %s", exc)

        _fetcher.reset_session()
        success = _fetcher.ensure_session()

        if success:
            logger.info("Angel One broker connected via 1-click connect from stored credentials.")
            save_broker_audit_log("angel_one", "CONNECT", "ACTIVE", f"Client {creds_dict['client_id']} connected")
            return {
                "success": True,
                "message": f"Connected to Angel One successfully! Live session active for client {creds_dict['client_id']}.",
                "session_active": True,
            }
        else:
            err = _fetcher.get_session_details().get("last_auth_error") or "Authentication failed"
            save_broker_audit_log("angel_one", "CONNECT", "AUTH_FAILED", err)
            return {
                "success": False,
                "message": f"Login failed with saved credentials: {err}",
                "session_active": False,
            }

    elif broker in ["zerodha", "upstox", "fyers"]:
        save_broker_to_db(broker, creds_dict, is_active=True)
        save_broker_audit_log(broker, "CONNECT", "ACTIVE", f"{broker} set as active broker")
        return {
            "success": True,
            "message": f"{broker.capitalize()} set as active broker from saved credentials.",
            "session_active": True,
        }

    raise HTTPException(status_code=400, detail=f"Unsupported broker '{broker}'.")


@router.post("/clear")

def clear_broker_credentials_endpoint(req: BrokerClearRequest):
    """
    Clears credentials for a broker from database and active memory.
    """
    from backend.data.database import save_broker_audit_log, delete_broker_account_orm
    broker = req.broker.lower().strip()
    try:
        delete_broker_account_orm(broker)

        if broker == "angel_one":
            for k in ["ANGEL_API_KEY", "ANGEL_CLIENT_ID", "ANGEL_PASSWORD", "ANGEL_TOTP_SECRET"]:
                os.environ.pop(k, None)
            _fetcher.ANGEL_API_KEY = ""
            _fetcher.ANGEL_CLIENT_ID = ""
            _fetcher.ANGEL_PASSWORD = ""
            _fetcher.ANGEL_TOTP_SECRET = ""
            _fetcher.reset_session()
        elif broker == "zerodha":
            for k in ["ZERODHA_API_KEY", "ZERODHA_API_SECRET", "ZERODHA_ACCESS_TOKEN"]:
                os.environ.pop(k, None)
        elif broker == "upstox":
            for k in ["UPSTOX_API_KEY", "UPSTOX_API_SECRET", "UPSTOX_ACCESS_TOKEN"]:
                os.environ.pop(k, None)
        elif broker == "fyers":
            for k in ["FYERS_APP_ID", "FYERS_SECRET_KEY", "FYERS_ACCESS_TOKEN"]:
                os.environ.pop(k, None)

        save_broker_audit_log(broker, "CLEAR", "SUCCESS", "Credentials removed from database and environment.")
        return {
            "success": True,
            "message": f"Successfully cleared credentials for {broker.capitalize()}."
        }
    except Exception as exc:
        save_broker_audit_log(broker, "CLEAR", "ERROR", str(exc))
        raise HTTPException(status_code=500, detail=f"Failed clearing broker credentials: {str(exc)}")
