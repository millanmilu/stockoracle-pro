"""
StockOracle Pro — Security, Auth & User Identity Utilities

Single-user safe mode:
  - No JWT infrastructure yet → all requests are treated as the same
    canonical user ("default_user").
  - X-User-Id / user_id query param overrides are REJECTED so that a
    browser tab cannot read another user's portfolio by sending a crafted
    header.  When a real JWT layer is added, swap get_current_user_id()
    to decode the JWT and extract sub/uid.
"""
import os
import logging
from typing import Optional

from fastapi import Request, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader, APIKeyQuery
from backend.shared.config import settings

logger = logging.getLogger("StockOracle.Security")

_API_KEY_NAME   = "X-API-Key"
_api_key_header = APIKeyHeader(name=_API_KEY_NAME, auto_error=False)
_api_key_query  = APIKeyQuery(name="api_key", auto_error=False)

# ── Canonical single-user constant ───────────────────────────────────────────
# Replace with JWT sub-claim extraction once auth is implemented.
_DEFAULT_USER = "default_user"

# If the operator wants to lock the API to a known user set, they can override
# this env var.  Leave blank to allow _DEFAULT_USER.
_ALLOWED_USER_IDS: frozenset = frozenset(
    u.strip() for u in os.environ.get("ALLOWED_USER_IDS", _DEFAULT_USER).split(",") if u.strip()
)


def verify_api_key(
    header_key: Optional[str] = Security(_api_key_header),
    query_key:  Optional[str] = Security(_api_key_query),
) -> None:
    """
    Enforces API key validation on protected endpoints when
    SERVER_API_KEY / settings.API_KEY is configured.
    If no server key is configured the check is skipped (dev mode).
    """
    server_key = (settings.API_KEY or "").strip()
    if server_key:
        key = header_key or query_key
        if not key or key != server_key:
            raise HTTPException(status_code=403, detail="Invalid or missing API key.")


def get_current_user_id(request: Request) -> str:
    """
    Returns the authenticated user identity for data-isolation purposes.

    SECURITY NOTE:
      Client-supplied X-User-Id or ?user_id= values are intentionally
      IGNORED.  Until a proper JWT/session layer is in place we operate
      in single-user safe mode so no request can read another tenant's
      data.  All data is scoped to _DEFAULT_USER.

    Migration path:
      When JWT login is implemented, decode the Authorization bearer token
      here and return its `sub` or `uid` claim instead of _DEFAULT_USER.
    """
    # Future JWT path (commented out until auth service is ready):
    # token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    # if token:
    #     payload = decode_jwt(token)          # raises 401 on invalid/expired
    #     user_id = payload.get("sub", "")
    #     if user_id in _ALLOWED_USER_IDS:
    #         return user_id
    #     raise HTTPException(status_code=403, detail="User not authorized.")

    return _DEFAULT_USER
