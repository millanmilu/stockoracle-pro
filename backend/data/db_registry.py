# StockOracle Pro - model registry, AI providers & broker accounts.
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403
from .db_alerts import write_audit_log  # noqa: F401

# ── Model Registry Functions ─────────────────────────────────────────────────

def register_model_version(
    ticker: str, model_type: str, version: str, artifact_path: str,
    mape: float = None, rmse: float = None, metrics: dict = None
) -> int:
    """Registers a newly trained ML model artifact and metrics lineage."""
    now_str = datetime.now().isoformat()
    ticker_u = ticker.upper()
    with get_db_session() as session:
        session.execute(
            update(ModelRegistry).where(
                ModelRegistry.ticker == ticker_u,
                ModelRegistry.model_type == model_type
            ).values(is_active=0)
        )
        reg = ModelRegistry(
            ticker=ticker_u,
            model_type=model_type,
            version=version,
            artifact_path=artifact_path,
            mape=mape,
            rmse=rmse,
            metrics_json=json.dumps(metrics or {}),
            trained_at=now_str,
            is_active=1
        )
        session.add(reg)
        session.flush()
        row_id = reg.id
    write_audit_log("REGISTER", "model_version", entity_id=row_id, details=f"ticker={ticker_u} type={model_type} v={version} mape={mape}")
    return row_id


def get_registered_models(ticker: str = None) -> list:
    """Returns registered model artifacts and accuracy metrics."""
    with get_db_session() as session:
        stmt = select(ModelRegistry)
        if ticker:
            stmt = stmt.where(ModelRegistry.ticker == ticker.upper())
        stmt = stmt.order_by(ModelRegistry.id.desc()).limit(100)
        rows = session.execute(stmt).scalars().all()
        result = []
        for r in rows:
            try:
                m_obj = json.loads(r.metrics_json or "{}")
            except Exception:
                m_obj = {}
            result.append({
                "id": r.id,
                "ticker": r.ticker,
                "model_type": r.model_type,
                "version": r.version,
                "artifact_path": r.artifact_path,
                "mape": r.mape,
                "rmse": r.rmse,
                "metrics": m_obj,
                "metrics_json": r.metrics_json,
                "trained_at": r.trained_at,
                "is_active": r.is_active,
            })
        return result


# ── AI Providers Storage & Metrics Helpers ─────────────────────────────────────

def save_ai_provider_to_db(
    provider_name: str,
    api_key_encrypted: str,
    api_key_masked: str,
    selected_model: str,
    is_active: bool = False,
    last_test_status: str = "Configured",
) -> bool:
    """Saves or updates an AI provider in database via SQLAlchemy ORM."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with get_db_session() as session:
            if is_active:
                session.execute(update(AIProvider).values(is_active=0))
            provider = session.execute(
                select(AIProvider).where(AIProvider.provider_name == provider_name)
            ).scalar_one_or_none()
            if provider:
                provider.api_key_encrypted = api_key_encrypted
                provider.api_key_masked = api_key_masked
                provider.selected_model = selected_model
                provider.is_active = 1 if is_active else 0
                provider.last_tested_at = now_str
                provider.last_test_status = last_test_status
                provider.updated_at = now_str
            else:
                session.add(AIProvider(
                    provider_name=provider_name,
                    api_key_encrypted=api_key_encrypted,
                    api_key_masked=api_key_masked,
                    selected_model=selected_model,
                    is_active=1 if is_active else 0,
                    last_tested_at=now_str,
                    last_test_status=last_test_status,
                    total_requests=0,
                    created_at=now_str,
                    updated_at=now_str,
                ))
        return True
    except Exception as exc:
        logger.error("Failed saving AI provider %s: %s", provider_name, exc)
        return False


def get_all_ai_providers_from_db() -> Dict[str, dict]:
    """Returns all AI providers configured in the database."""
    result = {}
    try:
        with get_db_session() as session:
            rows = session.execute(select(AIProvider)).scalars().all()
            for r in rows:
                result[r.provider_name] = {
                    "id": r.id,
                    "provider_name": r.provider_name,
                    "api_key_encrypted": r.api_key_encrypted,
                    "api_key_masked": r.api_key_masked,
                    "selected_model": r.selected_model,
                    "is_active": bool(r.is_active),
                    "last_tested_at": r.last_tested_at,
                    "last_test_status": r.last_test_status,
                    "total_requests": r.total_requests or 0,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                }
    except Exception as exc:
        logger.warning("Could not read ai_providers table: %s", exc)
    return result


def get_active_ai_provider_from_db() -> Optional[dict]:
    """Returns the currently active AI provider record."""
    try:
        with get_db_session() as session:
            r = session.execute(select(AIProvider).where(AIProvider.is_active == 1).limit(1)).scalar_one_or_none()
            if r:
                return {
                    "id": r.id,
                    "provider_name": r.provider_name,
                    "api_key_encrypted": r.api_key_encrypted,
                    "api_key_masked": r.api_key_masked,
                    "selected_model": r.selected_model,
                    "is_active": bool(r.is_active),
                    "last_tested_at": r.last_tested_at,
                    "last_test_status": r.last_test_status,
                    "total_requests": r.total_requests or 0,
                    "updated_at": r.updated_at,
                }
    except Exception as exc:
        logger.warning("Failed reading active AI provider: %s", exc)
    return None


def activate_ai_provider_in_db(provider_name: str) -> bool:
    """Sets the designated provider as active and deactivates others."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with get_db_session() as session:
            session.execute(update(AIProvider).values(is_active=0))
            session.execute(
                update(AIProvider).where(AIProvider.provider_name == provider_name).values(
                    is_active=1, updated_at=now_str
                )
            )
        return True
    except Exception as exc:
        logger.error("Failed activating AI provider %s: %s", provider_name, exc)
        return False


def delete_ai_provider_from_db(provider_name: str) -> bool:
    """Removes an AI provider from database."""
    try:
        with get_db_session() as session:
            session.execute(delete(AIProvider).where(AIProvider.provider_name == provider_name))
        return True
    except Exception as exc:
        logger.error("Failed deleting AI provider %s: %s", provider_name, exc)
        return False


def update_ai_provider_test_status(provider_name: str, status: str, latency_ms: Optional[float] = None) -> bool:
    """Updates last test timestamp and status string."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with get_db_session() as session:
            session.execute(
                update(AIProvider).where(AIProvider.provider_name == provider_name).values(
                    last_tested_at=now_str,
                    last_test_status=status,
                    updated_at=now_str,
                )
            )
        return True
    except Exception as exc:
        logger.warning("Failed updating test status for %s: %s", provider_name, exc)
        return False


def increment_ai_provider_requests(provider_name: str) -> None:
    """Increments total requests counter for an AI provider."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with get_db_session() as session:
            session.execute(
                update(AIProvider).where(AIProvider.provider_name == provider_name).values(
                    total_requests=func.coalesce(AIProvider.total_requests, 0) + 1,
                    updated_at=now_str,
                )
            )
    except Exception as exc:
        logger.warning("Failed incrementing AI provider counter %s: %s", provider_name, exc)


def save_broker_audit_log(
    broker: str,
    event: str,
    status: str,
    details: Optional[str] = None,
    latency_ms: Optional[float] = None
) -> None:
    """Records a broker session or connection event in broker_audit_logs."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with get_db_session() as session:
            session.add(BrokerAuditLog(
                broker=broker,
                event=event,
                status=status,
                details=details,
                latency_ms=latency_ms,
                created_at=now_str,
            ))
    except Exception as exc:
        logger.warning("Failed writing broker audit log: %s", exc)


def get_recent_broker_audit_logs(limit: int = 10) -> list:
    """Returns the most recent broker connection attempts and session events."""
    try:
        with get_db_session() as session:
            stmt = select(BrokerAuditLog).order_by(BrokerAuditLog.id.desc()).limit(limit)
            rows = session.execute(stmt).scalars().all()
            return [{
                "id": r.id,
                "broker": r.broker,
                "event": r.event,
                "status": r.status,
                "details": r.details,
                "latency_ms": r.latency_ms,
                "created_at": r.created_at,
            } for r in rows]
    except Exception as exc:
        logger.warning("Failed retrieving broker audit logs: %s", exc)
        return []


def save_broker_account_orm(broker_name: str, credentials_dict: dict, is_active: bool = True) -> bool:
    """Permanently saves or updates broker credentials via SQLAlchemy 2.0 ORM with encryption."""
    from backend.shared.security import encrypt_value
    now_dt = datetime.now(timezone.utc)
    creds_encrypted = encrypt_value(json.dumps(credentials_dict))
    try:
        with get_db_session() as session:
            if is_active:
                session.execute(update(BrokerAccount).values(is_active=False))
            
            existing = session.query(BrokerAccount).filter(BrokerAccount.broker == broker_name).first()
            if existing:
                existing.credentials_json = creds_encrypted
                existing.is_active = is_active
                existing.updated_at = now_dt
            else:
                new_acc = BrokerAccount(
                    broker=broker_name,
                    is_active=is_active,
                    credentials_json=creds_encrypted,
                    created_at=now_dt,
                    updated_at=now_dt,
                )
                session.add(new_acc)
        return True
    except Exception as exc:
        logger.error("Failed saving broker account %s via ORM: %s", broker_name, exc)
        return False


def get_all_broker_accounts_orm() -> Dict[str, dict]:
    """Retrieves all configured broker accounts via SQLAlchemy ORM with automatic decryption."""
    from backend.shared.security import decrypt_value
    result = {}
    try:
        with get_db_session() as session:
            rows = session.query(BrokerAccount).all()
            for r in rows:
                try:
                    decrypted_raw = decrypt_value(r.credentials_json) if r.credentials_json else ""
                    creds = json.loads(decrypted_raw) if decrypted_raw else {}
                except Exception:
                    creds = {}
                result[r.broker] = {
                    "broker": r.broker,
                    "is_active": bool(r.is_active),
                    "credentials": creds,
                    "last_verified_at": r.last_verified_at,
                    "updated_at": r.updated_at.isoformat() if hasattr(r.updated_at, "isoformat") else str(r.updated_at),
                }
    except Exception as exc:
        logger.warning("Failed reading broker accounts via ORM: %s", exc)
    return result


def get_broker_account_orm(broker_name: str) -> Optional[dict]:
    """Retrieves a single broker account by name via SQLAlchemy ORM with decryption."""
    from backend.shared.security import decrypt_value
    try:
        with get_db_session() as session:
            r = session.query(BrokerAccount).filter(BrokerAccount.broker == broker_name).first()
            if r:
                try:
                    decrypted_raw = decrypt_value(r.credentials_json) if r.credentials_json else ""
                    creds = json.loads(decrypted_raw) if decrypted_raw else {}
                except Exception:
                    creds = {}
                return {
                    "broker": r.broker,
                    "is_active": bool(r.is_active),
                    "credentials": creds,
                    "last_verified_at": r.last_verified_at,
                    "updated_at": r.updated_at.isoformat() if hasattr(r.updated_at, "isoformat") else str(r.updated_at),
                }
    except Exception as exc:
        logger.warning("Failed reading broker account %s via ORM: %s", broker_name, exc)
    return None


def delete_broker_account_orm(broker_name: str) -> bool:
    """Deletes a broker account from the database via SQLAlchemy ORM."""
    try:
        with get_db_session() as session:
            session.execute(delete(BrokerAccount).where(BrokerAccount.broker == broker_name))
        return True
    except Exception as exc:
        logger.error("Failed deleting broker account %s via ORM: %s", broker_name, exc)
        return False
