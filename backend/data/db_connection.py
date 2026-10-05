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

# Absolute path for the SQLite database file
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stockoracle.db")
DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


from sqlalchemy import select, update, delete, func, text, or_, and_
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.shared.database import engine, init_database, get_db_session
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
