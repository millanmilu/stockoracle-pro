# StockOracle Pro - database connection & config core (leaf module).
# Imported by the db_* siblings and re-exported by backend.data.database.
# NEVER import backend.data.database from here (import cycle).
import os
import re
import json
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, Any, Dict, Iterable, List, Tuple
from backend.core.logging import get_logger

logger = get_logger("stockoracle.db")

DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


from sqlalchemy import select, update, delete, func, text, or_, and_
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.shared.database import (
    engine, init_database, get_db_session, DATABASE_URL, DEFAULT_SQLITE_PATH,
)


def _resolve_sqlite_path() -> str:
    """Path of the SQLite file the legacy raw-sqlite3 helpers must open.

    Single source of truth = ``backend.shared.database`` (the ORM engine), so
    the raw path can never drift from the engine URL. With a hardcoded path,
    any process that points ``DATABASE_URL`` at a different SQLite file — the
    test suite does exactly that (``test_stockoracle.db``) — had ``init_db()``
    create the schema in that file while ``get_db_connection()`` still opened
    the default one, i.e. every legacy caller died with "no such table".
    Relative URLs resolve against the CWD, matching SQLAlchemy's own semantics.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return DEFAULT_SQLITE_PATH
    tail = DATABASE_URL.split("sqlite:///", 1)[-1].split("?", 1)[0]
    if not tail or tail.startswith(":"):  # driver-less URL / ':memory:'
        return DEFAULT_SQLITE_PATH
    return tail if os.path.isabs(tail) else os.path.join(os.getcwd(), tail)


# Absolute path for the SQLite database file (same file the ORM engine opens).
DB_PATH = _resolve_sqlite_path()
from backend.shared.models import (
    Base, HistoricalPrice, StockUniverse, LiveTick, IntradayCandle,
    PortfolioPosition, SmartAlert, PaperAccount, PaperPosition, PaperOrder,
    AuditLog, TaskStatus, ModelRegistry, SavedScan, Company,
    FinancialStatement, FinancialRatio, ShareholdingSnapshot,
    ScreenerDailyMetric, UserScreen, CompanyInfoCache, PredictionCache,
    ScreenerResultCache, MonteCarloCache, BrokerAccount, AIProvider, BrokerAuditLog
)

CACHE_MODEL_MAP = {
    "company_info": CompanyInfoCache,
    "predictions": PredictionCache,
    "monte_carlo": MonteCarloCache,
    "screener_results": ScreenerResultCache,
}



def get_db_connection():
    """[DEPRECATED] Returns a legacy SQLite connection. Use `get_db_session()` for unified PostgreSQL/SQLite ORM queries."""
    conn = sqlite3.connect(DB_PATH, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn
