"""
StockOracle Pro — Security, Auth, & User Identity Utilities
"""
from typing import Optional
from fastapi import Request, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader, APIKeyQuery
from backend.shared.config import settings

_API_KEY_NAME = "X-API-Key"
_api_key_header = APIKeyHeader(name=_API_KEY_NAME, auto_error=False)
_api_key_query = APIKeyQuery(name="api_key", auto_error=False)


def verify_api_key(
    header_key: Optional[str] = Security(_api_key_header),
    query_key: Optional[str] = Security(_api_key_query),
) -> None:
    """
    Enforces API key validation on protected endpoints when SERVER_API_KEY / settings.API_KEY is configured.
    """
    server_key = (settings.API_KEY or "").strip()
    if server_key:
        key = header_key or query_key
        if not key or key != server_key:
            raise HTTPException(status_code=403, detail="Invalid or missing API key.")


def get_current_user_id(request: Request) -> str:
    """
    Extracts user identity from X-User-Id header or query parameters.
    Defaults to 'default_user' for multi-tenant isolation.
    """
    user_id = (
        request.headers.get("X-User-Id")
        or request.query_params.get("user_id")
        or "default_user"
    )
    return user_id.strip()
