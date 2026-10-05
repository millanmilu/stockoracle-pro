# StockOracle Pro - saved screener scans & user screens.
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403
from .db_alerts import write_audit_log  # noqa: F401

# ── Saved Screener Scans Functions ───────────────────────────────────────────

def add_saved_scan(name: str, filters: dict, description: str = None, user_id: str = "default_user") -> int:
    """Saves user custom screener scan preset."""
    now_str = datetime.now().isoformat()
    with get_db_session() as session:
        scan = SavedScan(
            user_id=user_id,
            name=name.strip(),
            description=description,
            filters_json=json.dumps(filters or {}),
            created_at=now_str,
        )
        session.add(scan)
        session.flush()
        row_id = scan.id
    write_audit_log("CREATE", "saved_scan", entity_id=row_id, details=f"name={name}", user_id=user_id)
    return row_id


def get_saved_scans(user_id: str = "default_user") -> list:
    """Returns saved scans for a user."""
    with get_db_session() as session:
        stmt = select(SavedScan).where(SavedScan.user_id == user_id).order_by(SavedScan.id.desc())
        rows = session.execute(stmt).scalars().all()
        res = []
        for r in rows:
            try:
                f_obj = json.loads(r.filters_json or "{}")
            except Exception:
                f_obj = {}
            res.append({
                "id": r.id,
                "user_id": r.user_id,
                "name": r.name,
                "description": r.description,
                "filters": f_obj,
                "created_at": r.created_at,
            })
        return res


def delete_saved_scan(scan_id: int, user_id: str = "default_user") -> bool:
    """Deletes a saved scan."""
    with get_db_session() as session:
        session.execute(delete(SavedScan).where(SavedScan.id == scan_id, SavedScan.user_id == user_id))
    write_audit_log("DELETE", "saved_scan", entity_id=scan_id, user_id=user_id)
    return True


def save_user_screen_query(
    user_id: str,
    name: str,
    description: str = None,
    formula_query: str = None,
    filter_ast: dict = None,
    universe: str = "NIFTY_500",
    sort_by: str = "market_cap_cr",
    sort_dir: str = "DESC",
    is_public: bool = False
) -> dict:
    """Saves a user custom multi-factor screen and creates a unique share token."""
    import uuid
    share_token = uuid.uuid4().hex[:20]
    now_str = datetime.now().isoformat()

    with get_db_session() as session:
        screen = UserScreen(
            user_id=user_id,
            name=name.strip(),
            description=description,
            formula_query=formula_query,
            filter_ast_json=json.dumps(filter_ast or {}),
            universe=universe,
            sort_by=sort_by,
            sort_dir=sort_dir,
            is_public=1 if is_public else 0,
            share_token=share_token,
            created_at=now_str,
            updated_at=now_str,
        )
        session.add(screen)
        session.flush()
        row_id = screen.id

    write_audit_log("CREATE", "user_screen", entity_id=row_id, details=f"name={name}", user_id=user_id)
    return {
        "id": row_id,
        "user_id": user_id,
        "name": name,
        "share_token": share_token,
        "formula_query": formula_query,
    }


def get_user_screens_list(user_id: str = "default_user") -> list:
    """Returns saved screens for a user."""
    with get_db_session() as session:
        stmt = select(UserScreen).where(
            or_(UserScreen.user_id == user_id, UserScreen.is_public == 1)
        ).order_by(UserScreen.id.desc())
        rows = session.execute(stmt).scalars().all()
        res = []
        for r in rows:
            try:
                f_obj = json.loads(r.filter_ast_json or "{}")
            except Exception:
                f_obj = {}
            res.append({
                "id": r.id,
                "user_id": r.user_id,
                "name": r.name,
                "description": r.description,
                "formula_query": r.formula_query,
                "filter_ast": f_obj,
                "universe": r.universe,
                "sort_by": r.sort_by,
                "sort_dir": r.sort_dir,
                "is_public": r.is_public,
                "share_token": r.share_token,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            })
        return res


def get_user_screen_by_share_token(token: str) -> Optional[dict]:
    """Retrieves public screen by share token."""
    with get_db_session() as session:
        stmt = select(UserScreen).where(UserScreen.share_token == token)
        row = session.execute(stmt).scalar_one_or_none()
        if not row:
            return None
        try:
            f_obj = json.loads(row.filter_ast_json or "{}")
        except Exception:
            f_obj = {}
        return {
            "id": row.id,
            "user_id": row.user_id,
            "name": row.name,
            "description": row.description,
            "formula_query": row.formula_query,
            "filter_ast": f_obj,
            "universe": row.universe,
            "sort_by": row.sort_by,
            "sort_dir": row.sort_dir,
            "is_public": row.is_public,
            "share_token": row.share_token,
            "created_at": row.created_at,
        }


def delete_user_screen_query(screen_id: int, user_id: str = "default_user") -> bool:
    """Deletes a saved user screen."""
    with get_db_session() as session:
        session.execute(delete(UserScreen).where(UserScreen.id == screen_id, UserScreen.user_id == user_id))
    write_audit_log("DELETE", "user_screen", entity_id=screen_id, user_id=user_id)
    return True
