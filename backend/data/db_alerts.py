# StockOracle Pro - audit log, training task status & smart alerts.
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

def write_audit_log(
    action: str,
    entity: str,
    entity_id: str = None,
    details: str = None,
    user_id: str = "default_user",
) -> None:
    """Appends one immutable row to the audit_log table via SQLAlchemy ORM."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with get_db_session() as session:
            entry = AuditLog(
                user_id=user_id,
                action=action.upper(),
                entity=entity,
                entity_id=str(entity_id) if entity_id is not None else None,
                details=details,
                ts_utc=now_str,
            )
            session.add(entry)
    except Exception as e:
        logger.error("audit_log write failed: %s", e)


# ── Training Task Status ────────────────────────────────────────────────────────

def save_task_status(task_id: str, ticker: str, status: str, progress: int,
                     mape: Optional[float] = None, error: Optional[str] = None):
    """Creates or updates a model training task registry record."""
    now_str = datetime.now().isoformat()
    try:
        with get_db_session() as session:
            task = session.get(TaskStatus, task_id)
            if task:
                task.status = status
                task.progress = progress
                task.mape = mape
                task.error = error
                task.updated_at = now_str
            else:
                session.add(TaskStatus(
                    task_id=task_id,
                    ticker=ticker.upper(),
                    status=status,
                    progress=progress,
                    mape=mape,
                    error=error,
                    created_at=now_str,
                    updated_at=now_str,
                ))
    except Exception as e:
        logger.error("Error saving task status for %s: %s", task_id, e)


def get_task_status(task_id: str) -> Optional[dict]:
    """Returns task status dictionary for the given task_id."""
    try:
        with get_db_session() as session:
            task = session.get(TaskStatus, task_id)
            if task:
                return {
                    "task_id": task.task_id,
                    "ticker": task.ticker,
                    "status": task.status,
                    "progress": task.progress,
                    "mape": task.mape,
                    "error": task.error,
                    "created_at": task.created_at,
                    "updated_at": task.updated_at,
                }
    except Exception as e:
        logger.error("Error reading task status for %s: %s", task_id, e)
    return None


def cleanup_old_tasks(max_age_hours: int = 24):
    """Deletes task records older than max_age_hours."""
    cutoff = (datetime.now() - timedelta(hours=max_age_hours)).isoformat()
    try:
        with get_db_session() as session:
            session.execute(delete(TaskStatus).where(TaskStatus.updated_at < cutoff))
    except Exception as e:
        logger.error("Error cleaning old tasks: %s", e)


# ── Smart Alert Functions ──────────────────────────────────────────────────────

def add_smart_alert(ticker: str, alert_type: str, param_value: dict, user_id: str = "default_user") -> int:
    """Add a smart alert via SQLAlchemy ORM and return the new row id."""
    now_ts = datetime.now(timezone.utc).isoformat()
    with get_db_session() as session:
        alert = SmartAlert(
            user_id=user_id,
            ticker=ticker.upper(),
            alert_type=alert_type,
            param_value=json.dumps(param_value or {}),
            triggered=0,
            created_at=now_ts,
        )
        session.add(alert)
        session.flush()
        row_id = alert.id
    write_audit_log("ADD", "smart_alert", entity_id=row_id,
                    details=f"ticker={ticker} type={alert_type} params={param_value}",
                    user_id=user_id)
    return row_id


def get_smart_alerts(user_id: str = "default_user") -> list:
    """Return all smart alerts for a user as a list of dicts (param_value parsed from JSON)."""
    with get_db_session() as session:
        stmt = select(SmartAlert).where(SmartAlert.user_id == user_id).order_by(SmartAlert.id.desc())
        rows = session.execute(stmt).scalars().all()
        result = []
        for r in rows:
            try:
                p_val = json.loads(r.param_value or "{}")
            except Exception:
                p_val = {}
            result.append({
                "id": r.id,
                "user_id": r.user_id,
                "ticker": r.ticker,
                "alert_type": r.alert_type,
                "param_value": p_val,
                "created_at": r.created_at,
                "triggered": r.triggered,
            })
        return result


def remove_smart_alert(alert_id: int, user_id: str = "default_user"):
    """Delete a smart alert by id and user_id."""
    with get_db_session() as session:
        session.execute(
            delete(SmartAlert).where(SmartAlert.id == alert_id, SmartAlert.user_id == user_id)
        )
    write_audit_log("REMOVE", "smart_alert", entity_id=alert_id, user_id=user_id)


def mark_alert_triggered(alert_id: int):
    """Mark a smart alert as triggered and log audit event."""
    user_id = "default_user"
    ticker = ""
    alert_type = ""
    with get_db_session() as session:
        alert = session.get(SmartAlert, alert_id)
        if alert:
            alert.triggered = 1
            user_id = alert.user_id
            ticker = alert.ticker
            alert_type = alert.alert_type
    if ticker:
        write_audit_log("TRIGGERED", "smart_alert", entity_id=alert_id,
                        details=f"ticker={ticker} type={alert_type}",
                        user_id=user_id)
