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


# ── Vault Encryption / Decryption Utilities ───────────────────────────────────
import base64
import hashlib


def _get_vault_key() -> bytes:
    secret = (getattr(settings, "JWT_SECRET", None) or os.environ.get("JWT_SECRET") or "stockoracle_master_vault_key_2026").encode("utf-8")
    salt = b"stockoracle_vault_salt_v1"
    derived = hashlib.pbkdf2_hmac("sha256", secret, salt, 100000, dklen=32)
    return base64.urlsafe_b64encode(derived)


def encrypt_value(raw_val: str) -> str:
    """Encrypts a string (such as credentials JSON or API keys) into encrypted ciphertext."""
    if not raw_val:
        return ""
    try:
        from cryptography.fernet import Fernet
        f = Fernet(_get_vault_key())
        return "ENC:" + f.encrypt(raw_val.strip().encode("utf-8")).decode("utf-8")
    except Exception:
        key_bytes = _get_vault_key()
        raw_bytes = raw_val.strip().encode("utf-8")
        xored = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(raw_bytes))
        return "OBF:" + base64.b64encode(xored).decode("utf-8")


def decrypt_value(encrypted_val: str) -> str:
    """Decrypts a string. Seamlessly handles ENC:, OBF:, or legacy unencrypted plaintext."""
    if not encrypted_val:
        return ""
    try:
        if encrypted_val.startswith("ENC:"):
            from cryptography.fernet import Fernet
            f = Fernet(_get_vault_key())
            return f.decrypt(encrypted_val[4:].encode("utf-8")).decode("utf-8")
        elif encrypted_val.startswith("OBF:"):
            key_bytes = _get_vault_key()
            xored = base64.b64decode(encrypted_val[4:].encode("utf-8"))
            return bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(xored)).decode("utf-8")
        # Legacy unencrypted plaintext fallback
        return encrypted_val
    except Exception as exc:
        logger.warning("Failed decrypting value (returning raw fallback): %s", exc)
        return encrypted_val
