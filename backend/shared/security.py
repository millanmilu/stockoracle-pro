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
    Uses constant-time comparison to avoid timing attacks. The ?api_key=
    query param is deprecated (leaks into server/proxy logs) — prefer the
    X-API-Key header; query usage is logged once as a warning.
    """
    global _warned_query_key
    server_key = (settings.API_KEY or "").strip()
    if server_key:
        key = (header_key or "").strip() or None
        if query_key and not header_key:
            if not _warned_query_key:
                logger.warning(
                    "API key supplied via ?api_key= query param — deprecated, "
                    "it leaks into access logs. Use X-API-Key header instead."
                )
                _warned_query_key = True
            key = (query_key or "").strip() or None
        if not key or not hmac.compare_digest(key, server_key):
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
import hmac
import secrets as _secrets

# Legacy hardcoded secret — DECRYPT-ONLY fallback for rows encrypted before
# the fail-loud fix. NEVER use for new encryptions.
_LEGACY_VAULT_SECRET = b"stockoracle_master_vault_key_2026"
_VAULT_SALT = b"stockoracle_vault_salt_v1"
_DEV_VAULT_KEY_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".vault_dev.key"
)
_warned_query_key = False


def _derive_fernet_key(secret: bytes) -> bytes:
    derived = hashlib.pbkdf2_hmac("sha256", secret, _VAULT_SALT, 100000, dklen=32)
    return base64.urlsafe_b64encode(derived)


def _load_or_create_dev_key() -> bytes:
    """Per-machine random dev key persisted with 0600 perms. Never committed."""
    path = os.path.abspath(_DEV_VAULT_KEY_FILE)
    try:
        if os.path.exists(path):
            with open(path, "rb") as fh:
                stored = fh.read().strip()
                if stored:
                    try:
                        raw = base64.urlsafe_b64decode(stored)
                    except Exception:
                        raw = stored
                    return _derive_fernet_key(raw)
    except Exception as exc:
        logger.warning("Could not read dev vault key file %s: %s", path, exc)
    raw = _secrets.token_bytes(32)
    try:
        with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "wb") as fh:
            fh.write(base64.urlsafe_b64encode(raw))
        logger.warning(
            "Generated ephemeral per-machine dev vault key at %s. "
            "Set JWT_SECRET in production — dev key is NOT portable.",
            path,
        )
    except Exception as exc:
        logger.warning("Could not persist dev vault key file %s: %s", path, exc)
    return _derive_fernet_key(raw)


def _get_vault_key() -> bytes:
    """Derive the Fernet key for NEW encryptions.

    Fails loudly in production when no explicit JWT_SECRET is configured
    instead of falling back to a publicly-known constant. In non-production
    a per-machine random dev key file is used so local dev keeps working
    without sharing a global secret.
    """
    secret = (
        (getattr(settings, "JWT_SECRET", None) or "").strip()
        or (os.environ.get("JWT_SECRET") or "").strip()
    )
    # Treat the old dev placeholder as "not configured".
    if not secret or secret == "stockoracle-dev-secret-key-non-prod":
        is_prod = False
        try:
            is_prod = bool(settings.is_production)
        except Exception:
            is_prod = os.environ.get("ENVIRONMENT", "production").lower() in ("production", "prod")
        if is_prod:
            raise RuntimeError(
                "JWT_SECRET is not configured. Refusing to encrypt with a default key. "
                "Set JWT_SECRET (or API_KEY/JWT_SECRET in backend/.env) to a random 32+ byte secret."
            )
        return _load_or_create_dev_key()
    return _derive_fernet_key(secret.encode("utf-8"))


def _legacy_vault_key() -> bytes:
    return _derive_fernet_key(_LEGACY_VAULT_SECRET)


def encrypt_value(raw_val: str) -> str:
    """Encrypts a string (such as credentials JSON or API keys) into encrypted ciphertext."""
    if not raw_val:
        return ""
    # Fail loudly — never fall back to XOR obfuscation.
    try:
        from cryptography.fernet import Fernet
    except ImportError as exc:
        raise RuntimeError(
            "cryptography package is required for vault encryption "
            "(pip install -r backend/requirements.txt)."
        ) from exc
    f = Fernet(_get_vault_key())
    return "ENC:" + f.encrypt(raw_val.strip().encode("utf-8")).decode("utf-8")


def decrypt_value(encrypted_val: str) -> str:
    """Decrypts a string. Handles ENC: (current + legacy key), OBF: legacy, or plaintext."""
    if not encrypted_val:
        return ""
    if encrypted_val.startswith("ENC:"):
        payload = encrypted_val[4:].encode("utf-8")
        # Try current key first, then legacy hardcoded key for pre-fix rows.
        for key_fn in (_get_vault_key, _legacy_vault_key):
            try:
                from cryptography.fernet import Fernet
                f = Fernet(key_fn())
                return f.decrypt(payload).decode("utf-8")
            except Exception:
                continue
        logger.warning("Failed decrypting ENC: value with current and legacy keys.")
        return encrypted_val
    elif encrypted_val.startswith("OBF:"):
        # Legacy XOR-obfuscated rows: best-effort decode with current then legacy key.
        for key_fn in (_get_vault_key, _legacy_vault_key):
            try:
                key_bytes = base64.urlsafe_b64decode(key_fn())
                # OBF: payload was XORed against the base64-encoded derived key bytes;
                # try both the raw derived bytes and the b64 form for compat.
                for kb in (key_bytes, key_fn()):
                    xored = base64.b64decode(encrypted_val[4:].encode("utf-8"))
                    return bytes(b ^ kb[i % len(kb)] for i, b in enumerate(xored)).decode("utf-8")
            except Exception:
                continue
        logger.warning("Failed decoding legacy OBF: value.")
        return encrypted_val
    try:
        # Legacy unencrypted plaintext fallback
        return encrypted_val
    except Exception as exc:
        logger.warning("Failed decrypting value (returning raw fallback): %s", exc)
        return encrypted_val
