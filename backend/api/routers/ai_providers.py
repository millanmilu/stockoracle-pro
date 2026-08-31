"""
StockOracle Pro — AI Providers API Router
Provides endpoints for managing, testing, activating, and monitoring Multi-AI LLM engines.
"""
import os
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.core.logging import get_logger
from backend.data.database import (
    get_all_ai_providers_from_db,
    get_active_ai_provider_from_db,
    save_ai_provider_to_db,
    activate_ai_provider_in_db,
    delete_ai_provider_from_db,
)
from backend.ai.provider import (
    PROVIDERS,
    encrypt_api_key,
    decrypt_api_key,
    mask_api_key,
    test_ai_provider,
    auto_detect_provider,
)

logger = get_logger("stockoracle.api.ai_providers")

router = APIRouter(prefix="/api/ai/providers", tags=["AI Providers Management"])


# ── Request / Response Models ──────────────────────────────────────────────────

class AIProviderTestRequest(BaseModel):
    provider: str = Field(..., description="gemini | openai | anthropic | mistral | cohere | groq")
    api_key: str = Field(..., description="Plaintext or updated API key")
    model: Optional[str] = Field(None, description="Specific model to test")


class AIProviderSaveRequest(BaseModel):
    provider: str = Field(..., description="gemini | openai | anthropic | mistral | cohere | groq")
    api_key: Optional[str] = Field(None, description="API key to encrypt and save (optional if existing)")
    model: Optional[str] = Field(None, description="Preferred model")
    is_active: bool = Field(False, description="Whether to activate immediately")


class AIProviderActivateRequest(BaseModel):
    provider: str = Field(..., description="Provider to set as active")


class AIProviderDeleteRequest(BaseModel):
    provider: str = Field(..., description="Provider to delete from DB")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
def get_ai_providers():
    """
    Returns the comprehensive status of all 6 supported AI providers,
    including configuration status, masked credentials, active status, and model metadata.
    """
    db_providers = get_all_ai_providers_from_db()
    active_db = get_active_ai_provider_from_db()
    active_pid = active_db["provider_name"] if active_db else None

    # If nothing active in DB, check environment variables
    if not active_pid:
        for pid in ["gemini", "groq", "openai", "mistral", "anthropic", "cohere"]:
            env_var = PROVIDERS.get(pid, {}).get("env_key", "")
            if os.environ.get(env_var):
                active_pid = pid
                break

    providers_list = []
    for pid, meta in PROVIDERS.items():
        db_record = db_providers.get(pid, {})
        env_val = os.environ.get(meta["env_key"], "").strip()
        
        has_key = bool(db_record.get("api_key_encrypted") or env_val)
        
        masked = "Not Configured"
        if db_record.get("api_key_masked"):
            masked = db_record["api_key_masked"]
        elif env_val:
            masked = mask_api_key(env_val)

        selected_model = db_record.get("selected_model") or meta["default_model"]
        is_active = (active_pid == pid)

        providers_list.append({
            "id": pid,
            "name": meta["name"],
            "logo": meta["logo"],
            "color": meta["color"],
            "env_key": meta["env_key"],
            "models": meta["models"],
            "default_model": meta["default_model"],
            "selected_model": selected_model,
            "is_active": is_active,
            "has_credentials": has_key,
            "masked_key": masked,
            "free_tier": meta["free_tier"],
            "rate_limit": meta["rate_limit"],
            "speed": meta["speed"],
            "quality": meta["quality"],
            "pricing": meta["pricing"],
            "signup_url": meta["signup_url"],
            "description": meta["description"],
            "last_tested_at": db_record.get("last_tested_at"),
            "last_test_status": db_record.get("last_test_status", "Untested" if not has_key else "Ready"),
            "total_requests": db_record.get("total_requests", 0),
        })

    return {
        "active_provider": active_pid or "gemini",
        "providers": providers_list,
    }


@router.post("/test")
def test_provider_endpoint(req: AIProviderTestRequest):
    """
    Runs a live, timed probe against the designated AI provider to verify latency & credentials.
    """
    pid = req.provider.lower().strip()
    if pid not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported AI provider: {pid}")

    raw_key = req.api_key.strip()
    if not raw_key or raw_key.startswith("••••") or "••••" in raw_key:
        # Resolve from DB or environment if masked placeholder was sent
        db_providers = get_all_ai_providers_from_db()
        if pid in db_providers:
            raw_key = decrypt_api_key(db_providers[pid].get("api_key_encrypted", ""))
        if not raw_key:
            raw_key = os.environ.get(PROVIDERS[pid]["env_key"], "").strip()

    if not raw_key:
        raise HTTPException(status_code=422, detail="API key is required for connection testing.")

    success, message, latency_ms = test_ai_provider(pid, raw_key, req.model)
    return {
        "success": success,
        "provider": pid,
        "message": message,
        "latency_ms": latency_ms,
    }


@router.post("/save")
def save_provider_endpoint(req: AIProviderSaveRequest):
    """
    Encrypts and permanently stores provider credentials and preferred model in the database.
    """
    pid = req.provider.lower().strip()
    if pid not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported AI provider: {pid}")

    db_providers = get_all_ai_providers_from_db()
    existing = db_providers.get(pid, {})

    raw_key = (req.api_key or "").strip()
    encrypted_key = existing.get("api_key_encrypted", "")
    masked_key = existing.get("api_key_masked", "")

    # If new raw key is supplied and not masked
    if raw_key and not ("••••" in raw_key):
        encrypted_key = encrypt_api_key(raw_key)
        masked_key = mask_api_key(raw_key)
        # Also hot-reload memory env
        os.environ[PROVIDERS[pid]["env_key"]] = raw_key
    elif not encrypted_key:
        # Fallback to existing environment variable if no DB key exists
        env_val = os.environ.get(PROVIDERS[pid]["env_key"], "").strip()
        if env_val:
            encrypted_key = encrypt_api_key(env_val)
            masked_key = mask_api_key(env_val)

    selected_model = req.model or existing.get("selected_model") or PROVIDERS[pid]["default_model"]

    success = save_ai_provider_to_db(
        provider_name=pid,
        api_key_encrypted=encrypted_key,
        api_key_masked=masked_key,
        selected_model=selected_model,
        is_active=req.is_active,
        last_test_status="Saved (Encrypted)",
    )

    if success:
        return {
            "success": True,
            "message": f"{PROVIDERS[pid]['name']} credentials encrypted and saved successfully.",
            "provider": pid,
            "masked_key": masked_key,
            "selected_model": selected_model,
            "is_active": req.is_active,
        }
    raise HTTPException(status_code=500, detail="Failed to save AI provider configuration.")


@router.post("/activate")
def activate_provider_endpoint(req: AIProviderActivateRequest):
    """
    Sets the active AI provider for the entire platform.
    """
    pid = req.provider.lower().strip()
    if pid not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported AI provider: {pid}")

    success = activate_ai_provider_in_db(pid)
    if success:
        return {
            "success": True,
            "message": f"{PROVIDERS[pid]['name']} is now the active AI intelligence provider.",
            "active_provider": pid,
        }
    raise HTTPException(status_code=500, detail=f"Failed to activate provider {pid}.")


@router.delete("/delete")
def delete_provider_endpoint(req: AIProviderDeleteRequest):
    """
    Deletes the encrypted credentials and configuration for a provider from SQLite.
    """
    pid = req.provider.lower().strip()
    success = delete_ai_provider_from_db(pid)
    env_key = PROVIDERS.get(pid, {}).get("env_key")
    if env_key and env_key in os.environ:
        del os.environ[env_key]

    return {
        "success": success,
        "message": f"Cleared credentials for {pid.capitalize()}.",
    }


@router.get("/usage")
def get_ai_usage():
    """
    Returns request counts and performance metrics across all providers.
    """
    db_providers = get_all_ai_providers_from_db()
    usage = {}
    for pid, meta in PROVIDERS.items():
        rec = db_providers.get(pid, {})
        usage[pid] = {
            "name": meta["name"],
            "total_requests": rec.get("total_requests", 0),
            "last_tested_at": rec.get("last_tested_at"),
            "last_test_status": rec.get("last_test_status"),
        }
    return {"usage": usage}
