import os
import re
import json
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, Any, Dict, List, Tuple
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
    """Returns a high-concurrency SQLite connection with sqlite3.Row factory and WAL mode."""
    conn = sqlite3.connect(DB_PATH, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db():
    """Initializes the database schema and creates all tables via SQLAlchemy ORM."""
    logger.info("Initializing database with unified SQLAlchemy engine: %s", DB_PATH)
    init_database()
    # Invariant: Auto-cleansing on init to purge legacy non-daily candle strings
    try:
        with get_db_session() as session:
            session.execute(text("DELETE FROM historical_prices WHERE length(date) > 10 OR length(date) != 10"))
    except Exception as e:
        logger.debug("Historical prices auto-cleansing check notice: %s", e)

    # Auto-seed broker_accounts from existing .env credentials if table is currently empty
    try:
        existing_brokers = get_all_broker_accounts_orm()
        angel_key = (os.environ.get("ANGEL_API_KEY") or "").strip()
        angel_client = (os.environ.get("ANGEL_CLIENT_ID") or "").strip()
        angel_pass = (os.environ.get("ANGEL_PASSWORD") or "").strip()
        angel_totp = (os.environ.get("ANGEL_TOTP_SECRET") or "").strip()
        if "angel_one" not in existing_brokers and all([angel_key, angel_client, angel_pass, angel_totp]):
            save_broker_account_orm("angel_one", {
                "api_key": angel_key,
                "client_id": angel_client,
                "password": angel_pass,
                "totp_secret": angel_totp,
            }, is_active=True)
            logger.info("Auto-seeded active Angel One credentials from .env into broker_accounts table.")
    except Exception as e:
        logger.debug("Broker auto-seed notice: %s", e)

    logger.info("Database initialization complete.")




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


# ── Historical Prices ──────────────────────────────────────────────────────────

def clear_ticker_history(ticker: str):
    """Deletes all historical price records for a specific ticker to clean stale/corrupted data."""
    if not ticker:
        return
    ticker = ticker.upper()
    with get_db_session() as session:
        session.execute(delete(HistoricalPrice).where(HistoricalPrice.ticker == ticker))
    logger.info("Cleared old historical DB records for %s.", ticker)



def _normalize_price(v):
    try:
        val = float(v)
        if np.isnan(val) or val <= 0:
            return None
        # Normalization heuristic: convert paise (> 100,000 for non-MRF stocks) to rupees
        if val > 200000:
            return round(val / 100.0, 2)
        return round(val, 2)
    except Exception:
        return None


def validate_and_sanitize_candles(df: pd.DataFrame) -> pd.DataFrame:
    """
    Validates and sanitizes an OHLCV DataFrame:
    1. Ensures all prices are positive and normalized.
    2. Enforces OHLC invariant: low <= min(open, close) and high >= max(open, close).
    3. Removes duplicate timestamps preserving the latest record.
    """
    if df is None or df.empty:
        return pd.DataFrame()

    clean_df = df.copy()
    if "date" in clean_df.columns:
        clean_df = clean_df.drop_duplicates(subset=["date"], keep="last")

    # Enforce positive prices
    for col in ["open", "high", "low", "close"]:
        if col in clean_df.columns:
            clean_df[col] = pd.to_numeric(clean_df[col], errors="coerce")
            clean_df = clean_df[clean_df[col] > 0]

    if clean_df.empty:
        return clean_df

    # Sanitize high and low bounds
    clean_df["high"] = clean_df[["high", "open", "close"]].max(axis=1)
    clean_df["low"] = clean_df[["low", "open", "close"]].min(axis=1)
    return clean_df


def clean_paise_and_outliers(ticker: str = None):
    """
    Scans historical_prices table in SQLite, auto-corrects paise-to-rupee unit mismatches
    (close > 50 * median), and deletes corrupt/non-positive price rows.
    """
    with get_db_connection() as conn:
        query = "SELECT rowid, ticker, close FROM historical_prices"
        params = []
        if ticker:
            query += " WHERE ticker = ?"
            params.append(ticker.upper())

        df = pd.read_sql_query(query, conn, params=params)
        if df.empty:
            return

        for t, group in df.groupby("ticker"):
            median_val = group["close"].median()
            if not median_val or median_val <= 0:
                continue

            # Identify candidates (> 50x median, likely paise mismatch)
            paise_candidates = group[group["close"] > median_val * 50]
            if not paise_candidates.empty:
                for rid, old_val in zip(paise_candidates["rowid"], paise_candidates["close"]):
                    conn.execute("UPDATE historical_prices SET open = open/100.0, high = high/100.0, low = low/100.0, close = close/100.0 WHERE rowid = ?", (rid,))
                logger.info("Normalized %d paise records to rupees for %s.", len(paise_candidates), t)

        # Delete invalid <= 0 rows
        conn.execute("DELETE FROM historical_prices WHERE close <= 0 OR high <= 0 OR open <= 0 OR low <= 0 OR length(date) != 10")
        conn.commit()


def save_historical_prices(ticker: str, df: pd.DataFrame):
    """
    Saves a DataFrame of daily historical prices into the database using SQLAlchemy 2.0 ORM.
    Strictly accepts only daily dates (YYYY-MM-DD) matching DATE_REGEX.
    """
    if df is None or df.empty:
        return

    ticker = ticker.upper()
    records = []
    for _, row in df.iterrows():
        try:
            raw_d = str(row["date"]).strip()
            if not DATE_REGEX.fullmatch(raw_d):
                # Reject any non-daily format (intraday timestamps, invalid strings)
                continue
            d_str = raw_d

            o_val = _normalize_price(row["open"])
            h_val = _normalize_price(row["high"])
            l_val = _normalize_price(row["low"])
            c_val = _normalize_price(row["close"])
            vol   = int(row.get("volume", 0) or 0)

            if not all([o_val, h_val, l_val, c_val]):
                continue
            records.append({
                "ticker": ticker,
                "date": d_str,
                "open": o_val,
                "high": max(h_val, o_val, c_val),
                "low": min(l_val, o_val, c_val),
                "close": c_val,
                "volume": vol,
            })
        except Exception:
            continue

    if not records:
        return

    with get_db_session() as session:
        dialect = session.bind.dialect.name if session.bind else "sqlite"
        if dialect == "sqlite":
            stmt = sqlite_insert(HistoricalPrice).values(records)
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker", "date"],
                set_={
                    "open": stmt.excluded.open,
                    "high": stmt.excluded.high,
                    "low": stmt.excluded.low,
                    "close": stmt.excluded.close,
                    "volume": stmt.excluded.volume,
                }
            )
            session.execute(stmt)
        elif dialect == "postgresql":
            stmt = pg_insert(HistoricalPrice).values(records)
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker", "date"],
                set_={
                    "open": stmt.excluded.open,
                    "high": stmt.excluded.high,
                    "low": stmt.excluded.low,
                    "close": stmt.excluded.close,
                    "volume": stmt.excluded.volume,
                }
            )
            session.execute(stmt)
        else:
            for r in records:
                session.merge(HistoricalPrice(**r))


def get_historical_prices(ticker: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
    """
    Fetches historical daily price records for a ticker within a date range.
    Returns a Pandas DataFrame, or None if no records exist.
    """
    ticker = ticker.upper()
    start_date = str(start_date)[:10]
    end_date = str(end_date)[:10]

    with get_db_session() as session:
        stmt = select(
            HistoricalPrice.date,
            HistoricalPrice.open,
            HistoricalPrice.high,
            HistoricalPrice.low,
            HistoricalPrice.close,
            HistoricalPrice.volume
        ).where(
            HistoricalPrice.ticker == ticker,
            func.length(HistoricalPrice.date) == 10,
            HistoricalPrice.date >= start_date,
            HistoricalPrice.date <= end_date
        ).order_by(HistoricalPrice.date.asc())
        rows = session.execute(stmt).all()
        if not rows:
            return None
        return pd.DataFrame(
            [{"date": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]} for r in rows]
        )



def save_stock_universe(records: list[dict]):
    """Persists the searchable NSE symbol master via SQLAlchemy ORM."""
    if not records:
        return
    now = datetime.now().isoformat()
    rows = [
        {
            "ticker": item["ticker"],
            "name": item["name"],
            "symbol": item["symbol"],
            "token": item.get("token", ""),
            "exchange": item.get("exchange", "NSE"),
            "updated_at": now,
        }
        for item in records
    ]
    with get_db_session() as session:
        dialect = session.bind.dialect.name if session.bind else "sqlite"
        if dialect == "sqlite":
            stmt = sqlite_insert(StockUniverse).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker"],
                set_={
                    "name": stmt.excluded.name,
                    "symbol": stmt.excluded.symbol,
                    "token": stmt.excluded.token,
                    "exchange": stmt.excluded.exchange,
                    "updated_at": stmt.excluded.updated_at,
                }
            )
            session.execute(stmt)
        elif dialect == "postgresql":
            stmt = pg_insert(StockUniverse).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker"],
                set_={
                    "name": stmt.excluded.name,
                    "symbol": stmt.excluded.symbol,
                    "token": stmt.excluded.token,
                    "exchange": stmt.excluded.exchange,
                    "updated_at": stmt.excluded.updated_at,
                }
            )
            session.execute(stmt)
        else:
            for r in rows:
                session.merge(StockUniverse(**r))


POPULAR_NSE_FALLBACKS = [
    {"ticker": "RELIANCE", "name": "Reliance Industries Ltd", "exchange": "NSE"},
    {"ticker": "TCS", "name": "Tata Consultancy Services Ltd", "exchange": "NSE"},
    {"ticker": "HDFCBANK", "name": "HDFC Bank Ltd", "exchange": "NSE"},
    {"ticker": "INFY", "name": "Infosys Ltd", "exchange": "NSE"},
    {"ticker": "ICICIBANK", "name": "ICICI Bank Ltd", "exchange": "NSE"},
    {"ticker": "HINDUNILVR", "name": "Hindustan Unilever Ltd", "exchange": "NSE"},
    {"ticker": "ITC", "name": "ITC Ltd", "exchange": "NSE"},
    {"ticker": "SBIN", "name": "State Bank of India", "exchange": "NSE"},
    {"ticker": "BHARTIARTL", "name": "Bharti Airtel Ltd", "exchange": "NSE"},
    {"ticker": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd", "exchange": "NSE"},
    {"ticker": "LT", "name": "Larsen & Toubro Ltd", "exchange": "NSE"},
    {"ticker": "BAJFINANCE", "name": "Bajaj Finance Ltd", "exchange": "NSE"},
    {"ticker": "AXISBANK", "name": "Axis Bank Ltd", "exchange": "NSE"},
    {"ticker": "ASIANPAINT", "name": "Asian Paints Ltd", "exchange": "NSE"},
    {"ticker": "MARUTI", "name": "Maruti Suzuki India Ltd", "exchange": "NSE"},
    {"ticker": "TATAMOTORS", "name": "Tata Motors Ltd", "exchange": "NSE"},
    {"ticker": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "exchange": "NSE"},
    {"ticker": "TITAN", "name": "Titan Company Ltd", "exchange": "NSE"},
    {"ticker": "WIPRO", "name": "Wipro Ltd", "exchange": "NSE"},
    {"ticker": "ULTRACEMCO", "name": "UltraTech Cement Ltd", "exchange": "NSE"},
    {"ticker": "POWERGRID", "name": "Power Grid Corporation of India Ltd", "exchange": "NSE"},
    {"ticker": "NTPC", "name": "NTPC Ltd", "exchange": "NSE"},
    {"ticker": "M&M", "name": "Mahindra & Mahindra Ltd", "exchange": "NSE"},
    {"ticker": "HCLTECH", "name": "HCL Technologies Ltd", "exchange": "NSE"},
    {"ticker": "ADANIENT", "name": "Adani Enterprises Ltd", "exchange": "NSE"},
    {"ticker": "ADANIPORTS", "name": "Adani Ports & SEZ Ltd", "exchange": "NSE"},
    {"ticker": "TATASTEEL", "name": "Tata Steel Ltd", "exchange": "NSE"},
    {"ticker": "COALINDIA", "name": "Coal India Ltd", "exchange": "NSE"},
    {"ticker": "BAJAJFINSV", "name": "Bajaj Finserv Ltd", "exchange": "NSE"},
    {"ticker": "ONGC", "name": "Oil & Natural Gas Corporation Ltd", "exchange": "NSE"},
]


POPULAR_NAME_MAP = {item["ticker"]: item["name"] for item in POPULAR_NSE_FALLBACKS}


def search_stock_universe(query: str, limit: int = 12) -> list[dict]:
    """Returns ticker/name matches from the locally stored NSE symbol master and screener universe."""
    text_q = query.strip().upper()
    if not text_q:
        return []
    like_q = f"%{text_q}%"
    prefix_q = f"{text_q}%"
    lim = max(1, min(limit, 30))

    try:
        with get_db_session() as session:
            stmt = text("""
                SELECT ticker, name, exchange
                FROM (
                    SELECT ticker, name, exchange,
                        MIN(CASE 
                            WHEN UPPER(ticker) = :exact THEN 0 
                            WHEN UPPER(ticker) LIKE :prefix AND UPPER(ticker) NOT LIKE '%-%' THEN 1 
                            WHEN UPPER(ticker) LIKE :prefix THEN 2
                            WHEN UPPER(name) LIKE :prefix THEN 3
                            WHEN UPPER(ticker) NOT LIKE '%-%' THEN 4
                            ELSE 5 
                        END) AS rank_score
                    FROM (
                        SELECT ticker, COALESCE(name, ticker) as name, COALESCE(exchange, 'NSE') as exchange 
                        FROM stock_universe 
                        WHERE UPPER(ticker) LIKE :like OR UPPER(name) LIKE :like
                        UNION ALL
                        SELECT ticker, COALESCE(name, ticker) as name, 'NSE' as exchange 
                        FROM screener_daily_metrics 
                        WHERE UPPER(ticker) LIKE :like OR UPPER(name) LIKE :like
                    ) sub
                    GROUP BY ticker, name, exchange
                ) ranked
                ORDER BY rank_score ASC, ticker ASC
                LIMIT :lim
            """)
            rows = session.execute(stmt, {
                "like": like_q,
                "exact": text_q,
                "prefix": prefix_q,
                "lim": lim
            }).fetchall()

            if rows:
                results = []
                for r in rows:
                    t = r[0]
                    n = r[1] or t
                    if (not n or n == t) and t in POPULAR_NAME_MAP:
                        n = POPULAR_NAME_MAP[t]
                    results.append({"ticker": t, "name": n, "exchange": r[2] or "NSE"})
                return results
    except Exception as exc:
        logger.warning("Error searching stock universe in database: %s", exc)

    # Fallback to local matching against popular stocks list
    matches = []
    for item in POPULAR_NSE_FALLBACKS:
        if text_q in item["ticker"].upper() or text_q in item["name"].upper():
            matches.append(item)
            if len(matches) >= lim:
                break
    return matches




def get_all_stock_universe_tickers(limit: int = 1500) -> list[str]:
    """Returns all NSE tickers stored in the stock_universe table."""
    with get_db_session() as session:
        stmt = select(StockUniverse.ticker).order_by(StockUniverse.ticker.asc()).limit(limit)
        return list(session.execute(stmt).scalars().all())


def get_all_stock_universe_records(limit: int = 1500) -> list[dict]:
    """Returns all NSE stock master records."""
    with get_db_session() as session:
        stmt = select(StockUniverse.ticker, StockUniverse.name, StockUniverse.exchange).order_by(StockUniverse.ticker.asc()).limit(limit)
        rows = session.execute(stmt).all()
        return [{"ticker": r[0], "name": r[1], "exchange": r[2]} for r in rows]


def get_stock_universe_token(ticker_or_symbol: str) -> Optional[dict]:
    """Retrieves token and scrip metadata for a ticker or symbol via SQLAlchemy ORM."""
    t = ticker_or_symbol.upper().strip()
    key = t if t.endswith("-EQ") else f"{t}-EQ"
    try:
        with get_db_session() as session:
            stmt = select(
                StockUniverse.ticker, StockUniverse.name, StockUniverse.symbol, StockUniverse.token, StockUniverse.exchange
            ).filter(
                or_(StockUniverse.ticker == t, StockUniverse.symbol == key, StockUniverse.ticker == key, StockUniverse.symbol == t)
            ).limit(1)
            row = session.execute(stmt).first()
            if row:
                return {
                    "symbol": row[2] or key,
                    "token": row[3] or "",
                    "exchange": row[4] or "NSE",
                    "exch_seg": row[4] or "NSE",
                    "name": row[1] or t,
                }
    except Exception as exc:
        logger.debug("Error looking up stock token for %s: %s", t, exc)
    return None



# ── Live Ticks ─────────────────────────────────────────────────────────────────

def save_live_tick(ticker: str, price: float, change_pct: float):
    """Saves a single live tick update to the database using SQLAlchemy ORM."""
    ticker_u = ticker.upper()
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        with get_db_session() as session:
            session.add(LiveTick(
                ticker=ticker_u,
                timestamp=timestamp,
                price=float(price),
                change_pct=float(change_pct) if change_pct is not None else None,
            ))
    except Exception as e:
        logger.error("Error saving live tick for %s: %s", ticker_u, e, exc_info=True)



# ── Generic JSON Cache Helpers ─────────────────────────────────────────────────

def _save_json(table: str, key_col: str, key_val: str, data: Any, ttl_minutes: int = 5):
    """Saves any JSON-serialisable data into L1 Redis cache and L2 ORM entity."""
    ticker_key = str(key_val).upper()
    cache_k = f"{table}:{ticker_key}"
    try:
        from backend.data.redis_cache import cache_set
        cache_set(cache_k, data, ttl_seconds=int(ttl_minutes * 60))
    except Exception:
        pass

    payload = json.dumps(data, default=str)
    now_str = datetime.now().isoformat()
    model = CACHE_MODEL_MAP.get(table)
    if not model:
        return

    with get_db_session() as session:
        if table == "screener_results":
            existing = session.get(ScreenerResultCache, 1)
            if existing:
                existing.data_json = payload
                existing.fetched_at = now_str
            else:
                session.add(ScreenerResultCache(id=1, data_json=payload, fetched_at=now_str))
        else:
            existing = session.get(model, ticker_key)
            if existing:
                existing.data_json = payload
                existing.fetched_at = now_str
            else:
                session.add(model(ticker=ticker_key, data_json=payload, fetched_at=now_str))


def _get_json(table: str, key_col: str, key_val: str, ttl_minutes: int = 5) -> Optional[Any]:
    """Returns cached JSON data from L1 Redis cache or L2 ORM table if within TTL."""
    ticker_key = str(key_val).upper()
    cache_k = f"{table}:{ticker_key}"
    try:
        from backend.data.redis_cache import cache_get
        cached_val = cache_get(cache_k)
        if cached_val is not None:
            return cached_val
    except Exception:
        pass

    expiry = (datetime.now() - timedelta(minutes=ttl_minutes)).isoformat()
    model = CACHE_MODEL_MAP.get(table)
    if not model:
        return None

    try:
        with get_db_session() as session:
            if table == "screener_results":
                row = session.get(ScreenerResultCache, 1)
            else:
                row = session.get(model, ticker_key)
            if row and row.fetched_at and row.fetched_at > expiry:
                val = json.loads(row.data_json)
                try:
                    from backend.data.redis_cache import cache_set
                    cache_set(cache_k, val, ttl_seconds=int(ttl_minutes * 60))
                except Exception:
                    pass
                return val
    except Exception as e:
        logger.warning("DB cache read error (%s): %s", table, e)
    return None



def _get_stale_json(table: str, key_col: str, key_val: str) -> Optional[Any]:
    """Returns cached data regardless of TTL (fallback when upstream is down)."""
    model = CACHE_MODEL_MAP.get(table)
    if not model:
        return None

    try:
        with get_db_session() as session:
            if table == "screener_results":
                row = session.get(ScreenerResultCache, 1)
            else:
                row = session.get(model, str(key_val).upper())
            if row and row.data_json:
                return json.loads(row.data_json)
    except Exception as e:
        logger.error("DB stale-cache read error (%s): %s", table, e)
    return None



# ── Company Info ───────────────────────────────────────────────────────────────

def save_company_info(ticker: str, data: dict, ttl_minutes: int = 5):
    _save_json("company_info", "ticker", ticker.upper(), data, ttl_minutes)


def get_company_info(ticker: str, ttl_minutes: int = 5) -> Optional[dict]:
    return _get_json("company_info", "ticker", ticker.upper(), ttl_minutes)


def get_stale_company_info(ticker: str) -> Optional[dict]:
    return _get_stale_json("company_info", "ticker", ticker.upper())


# ── Predictions ────────────────────────────────────────────────────────────────

def save_prediction(ticker: str, data: dict, ttl_minutes: int = 10):
    _save_json("predictions", "ticker", ticker.upper(), data, ttl_minutes)


def get_prediction_cached(ticker: str, ttl_minutes: int = 10) -> Optional[dict]:
    return _get_json("predictions", "ticker", ticker.upper(), ttl_minutes)


# ── Screener Results ───────────────────────────────────────────────────────────

def save_screener_results(data: list, ttl_minutes: int = 5):
    _save_json("screener_results", "id", "1", data, ttl_minutes)


def get_screener_results(ttl_minutes: int = 5) -> Optional[list]:
    return _get_json("screener_results", "id", "1", ttl_minutes)


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



# ── Monte Carlo ────────────────────────────────────────────────────────────────

def save_monte_carlo(ticker: str, data: dict, ttl_minutes: int = 30):
    _save_json("monte_carlo", "ticker", ticker.upper(), data, ttl_minutes)


def get_monte_carlo_cached(ticker: str, ttl_minutes: int = 30) -> Optional[dict]:
    return _get_json("monte_carlo", "ticker", ticker.upper(), ttl_minutes)


# ── Live Tick Analytics ────────────────────────────────────────────────────────

def get_recent_live_ticks(ticker: str, limit: int = 200) -> Optional[pd.DataFrame]:
    """Returns recent live tick records for a ticker as a DataFrame."""
    ticker_u = ticker.upper()
    try:
        with get_db_session() as session:
            stmt = select(LiveTick.timestamp, LiveTick.price, LiveTick.change_pct).where(
                LiveTick.ticker == ticker_u
            ).order_by(LiveTick.id.desc()).limit(limit)
            rows = session.execute(stmt).all()
            if not rows:
                return None
            return pd.DataFrame([{"timestamp": r[0], "price": r[1], "change_pct": r[2]} for r in rows])
    except Exception as e:
        logger.error("Error reading live ticks for %s: %s", ticker_u, e)
        return None


def get_live_tick_ohlcv(ticker: str) -> Optional[dict]:
    """Aggregates today's live ticks into a single synthetic OHLCV row."""
    ticker_u = ticker.upper()
    today = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d")
    try:
        with get_db_session() as session:
            stmt = select(LiveTick.price, LiveTick.timestamp).where(
                LiveTick.ticker == ticker_u,
                LiveTick.timestamp >= today
            ).order_by(LiveTick.id.asc())
            rows = session.execute(stmt).all()
            if not rows:
                return None
            prices = [float(r[0]) for r in rows]
            return {
                "date": today,
                "open": prices[0],
                "high": max(prices),
                "low": min(prices),
                "close": prices[-1],
                "volume": len(prices),
            }
    except Exception as e:
        logger.error("Error building live OHLCV for %s: %s", ticker_u, e)
        return None


def get_db_stats() -> dict:
    """Returns a summary of DB table sizes and telemetry via SQLAlchemy 2.0 ORM."""
    stats = {}
    with get_db_session() as session:
        for name, model in [
            ("historical_prices", HistoricalPrice),
            ("stock_universe", StockUniverse),
            ("live_ticks", LiveTick),
            ("portfolio", PortfolioPosition),
            ("smart_alerts", SmartAlert),
            ("paper_accounts", PaperAccount),
            ("paper_positions", PaperPosition),
            ("paper_orders", PaperOrder),
            ("task_status", TaskStatus),
            ("saved_scans", SavedScan),
            ("user_screens", UserScreen),
            ("audit_log", AuditLog),
            ("ai_providers", AIProvider),
            ("broker_audit_logs", BrokerAuditLog),
        ]:
            try:
                cnt = session.execute(select(func.count()).select_from(model)).scalar() or 0
                stats[name] = cnt
            except Exception:
                stats[name] = 0

        # Per-ticker historical summary
        try:
            stmt = select(
                HistoricalPrice.ticker,
                func.count().label("rows"),
                func.min(HistoricalPrice.date).label("min_date"),
                func.max(HistoricalPrice.date).label("max_date")
            ).group_by(HistoricalPrice.ticker).order_by(HistoricalPrice.ticker.asc())
            ticker_rows = session.execute(stmt).all()
            stats["historical_by_ticker"] = [
                {"ticker": r[0], "rows": r[1], "from": r[2], "to": r[3]}
                for r in ticker_rows
            ]
        except Exception:
            stats["historical_by_ticker"] = []

    stats["db_path"] = DB_PATH
    stats["engine"] = engine.url.drivername
    return stats



# ── Portfolio Functions ────────────────────────────────────────────────────────

# ── Portfolio Functions ────────────────────────────────────────────────────────

def add_portfolio_position(ticker: str, shares: float, buy_price: float, user_id: str = "default_user") -> int:
    """Add a portfolio position via SQLAlchemy ORM and return the new row id."""
    now_ts = datetime.now(timezone.utc).isoformat()
    with get_db_session() as session:
        pos = PortfolioPosition(
            user_id=user_id,
            ticker=ticker.upper(),
            shares=float(shares),
            buy_price=float(buy_price),
            added_at=now_ts,
        )
        session.add(pos)
        session.flush()
        row_id = pos.id
    write_audit_log("ADD", "portfolio", entity_id=row_id,
                    details=f"ticker={ticker} shares={shares} buy_price={buy_price}",
                    user_id=user_id)
    return row_id


def get_portfolio(user_id: str = "default_user") -> list:
    """Return all portfolio positions for a user as a list of dicts."""
    with get_db_session() as session:
        stmt = select(PortfolioPosition).where(PortfolioPosition.user_id == user_id).order_by(PortfolioPosition.id.desc())
        rows = session.execute(stmt).scalars().all()
        return [{
            "id": r.id,
            "user_id": r.user_id,
            "ticker": r.ticker,
            "shares": r.shares,
            "buy_price": r.buy_price,
            "added_at": r.added_at,
        } for r in rows]


def remove_portfolio_position(position_id: int, user_id: str = "default_user"):
    """Delete a portfolio position by id and user_id."""
    with get_db_session() as session:
        session.execute(
            delete(PortfolioPosition).where(PortfolioPosition.id == position_id, PortfolioPosition.user_id == user_id)
        )
    write_audit_log("REMOVE", "portfolio", entity_id=position_id, user_id=user_id)


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



# ── Paper Trading Functions (₹10 Lakh Virtual Funds) ──────────────────────────

def get_paper_account(user_id: str = "default_user") -> dict:
    """Returns the paper trading account state, initializing with ₹1,000,000 if new."""
    now_str = datetime.now().isoformat()
    with get_db_session() as session:
        acc = session.get(PaperAccount, user_id)
        if not acc:
            acc = PaperAccount(
                user_id=user_id,
                cash_balance=1000000.0,
                starting_balance=1000000.0,
                updated_at=now_str
            )
            session.add(acc)
            session.commit()
            return {"user_id": user_id, "cash_balance": 1000000.0, "starting_balance": 1000000.0, "updated_at": now_str}
        return {
            "user_id": acc.user_id,
            "cash_balance": acc.cash_balance,
            "starting_balance": acc.starting_balance,
            "updated_at": acc.updated_at
        }


def get_paper_positions(user_id: str = "default_user") -> list:
    """Returns active open paper trading positions enriched with live LTP, market value, and unrealized P&L."""
    with get_db_session() as session:
        stmt = select(PaperPosition).where(PaperPosition.user_id == user_id).order_by(PaperPosition.id.desc())
        rows = session.execute(stmt).scalars().all()
        positions = []
        for r in rows:
            p = {
                "id": r.id,
                "user_id": r.user_id,
                "ticker": r.ticker,
                "order_type": r.order_type,
                "shares": r.shares,
                "avg_buy_price": r.avg_buy_price,
                "stop_loss": r.stop_loss,
                "target_price": r.target_price,
                "opened_at": r.opened_at,
            }
            ticker = p["ticker"]
            shares = float(p["shares"])
            buy_p = float(p["avg_buy_price"])

            current_p = buy_p
            sector = "Diversified"
            try:
                info = get_company_info(ticker)
                if info and info.get("current_price") and float(info["current_price"]) > 0:
                    current_p = float(info["current_price"])
                else:
                    m = session.get(ScreenerDailyMetric, ticker)
                    if m and m.close_price:
                        current_p = float(m.close_price)
                    if m and m.sector:
                        sector = m.sector
            except Exception:
                current_p = buy_p

            sl = float(p["stop_loss"]) if p.get("stop_loss") else None
            tp = float(p["target_price"]) if p.get("target_price") else None
            if sl and current_p <= sl and current_p > 0:
                close_paper_position(p["id"], current_price=current_p, user_id=user_id, exit_reason="STOP_LOSS_HIT")
                continue
            if tp and current_p >= tp and current_p > 0:
                close_paper_position(p["id"], current_price=current_p, user_id=user_id, exit_reason="TARGET_HIT")
                continue

            invested_val = round(shares * buy_p, 2)
            market_val = round(shares * current_p, 2)
            unrealized = round((current_p - buy_p) * shares, 2)
            unrealized_pct = round(((current_p - buy_p) / max(0.01, buy_p)) * 100, 2)

            p["current_price"] = round(current_p, 2)
            p["sector"] = sector
            p["invested_value"] = invested_val
            p["market_value"] = market_val
            p["unrealized_pnl"] = unrealized
            p["unrealized_pnl_pct"] = unrealized_pct
            positions.append(p)

        return positions


def place_paper_order(ticker: str, order_type: str, action: str, shares: float, price: float, stop_loss: float = None, target_price: float = None, notes: str = None, user_id: str = "default_user") -> dict:
    """Executes a paper order atomically under transaction lock."""
    ticker_u = ticker.upper().strip()
    action_u = action.upper().strip()
    order_type_u = order_type.upper().strip()
    total_cost = float(shares) * float(price)
    now_str = datetime.now().isoformat()

    if action_u != "BUY":
        raise ValueError("Direct SELL without position not supported. Use sell_paper_position() to exit holdings.")

    if shares <= 0 or price <= 0:
        raise ValueError("Shares and price must be positive numbers.")

    with get_db_session() as session:
        acc = session.get(PaperAccount, user_id)
        if not acc:
            acc = PaperAccount(user_id=user_id, cash_balance=1000000.0, starting_balance=1000000.0, updated_at=now_str)
            session.add(acc)
            session.flush()

        if acc.cash_balance < total_cost:
            raise ValueError(f"Insufficient virtual cash balance. Needed ₹{total_cost:,.2f}, Available ₹{acc.cash_balance:,.2f}")

        acc.cash_balance -= total_cost
        acc.updated_at = now_str
        new_cash = acc.cash_balance

        pos = PaperPosition(
            user_id=user_id,
            ticker=ticker_u,
            order_type=order_type_u,
            shares=float(shares),
            avg_buy_price=float(price),
            stop_loss=float(stop_loss) if stop_loss else None,
            target_price=float(target_price) if target_price else None,
            opened_at=now_str,
        )
        session.add(pos)
        session.flush()
        pos_id = pos.id

        order_note = notes or f"BUY {ticker_u} @ ₹{price:.2f}"
        order = PaperOrder(
            user_id=user_id,
            ticker=ticker_u,
            order_type=order_type_u,
            action="BUY",
            shares=float(shares),
            executed_price=float(price),
            realized_pnl=0.0,
            status=order_note,
            executed_at=now_str,
        )
        session.add(order)

    write_audit_log("BUY", "paper_order", entity_id=pos_id,
                    details=f"ticker={ticker_u} shares={shares} price={price} cost={total_cost:.2f}",
                    user_id=user_id)
    return {"status": "SUCCESS", "position_id": pos_id, "action": "BUY", "ticker": ticker_u, "shares": shares, "price": price, "remaining_cash": new_cash}



def sell_paper_position(position_id: int, shares_to_sell: float, current_price: float, notes: str = None, user_id: str = "default_user") -> dict:
    """Executes a full or partial sell order on an open paper position atomically."""
    if shares_to_sell <= 0 or current_price <= 0:
        raise ValueError("Shares to sell and current price must be greater than zero.")

    now_str = datetime.now().isoformat()
    with get_db_session() as session:
        pos = session.get(PaperPosition, position_id)
        if not pos or pos.user_id != user_id:
            raise ValueError(f"Position #{position_id} not found.")

        ticker = pos.ticker
        order_type = pos.order_type
        current_shares = float(pos.shares)
        if shares_to_sell > current_shares:
            shares_to_sell = current_shares

        buy_p = float(pos.avg_buy_price)
        pnl = (current_price - buy_p) * shares_to_sell
        proceeds = shares_to_sell * current_price

        # Update Account Cash
        acc = session.get(PaperAccount, user_id)
        if not acc:
            acc = PaperAccount(user_id=user_id, cash_balance=1000000.0, starting_balance=1000000.0, updated_at=now_str)
            session.add(acc)
            session.flush()

        acc.cash_balance += proceeds
        acc.updated_at = now_str
        new_cash = acc.cash_balance

        status_text = notes or ("CLOSED" if shares_to_sell >= current_shares else f"PARTIAL_SELL ({shares_to_sell}/{current_shares})")

        # Record Sell Order in Journal
        order = PaperOrder(
            user_id=user_id,
            ticker=ticker,
            order_type=order_type,
            action="SELL",
            shares=float(shares_to_sell),
            executed_price=float(current_price),
            realized_pnl=float(pnl),
            status=status_text,
            executed_at=now_str,
        )
        session.add(order)

        # Update or delete position
        remaining_shares = current_shares - shares_to_sell
        if remaining_shares > 0.0001:
            pos.shares = remaining_shares
        else:
            session.delete(pos)
            remaining_shares = 0.0

    write_audit_log("SELL", "paper_order", entity_id=position_id,
                    details=f"ticker={ticker} shares_sold={shares_to_sell} remaining={remaining_shares} exit_price={current_price} pnl={pnl:.2f}",
                    user_id=user_id)
    return {
        "status": "SUCCESS",
        "position_id": position_id,
        "ticker": ticker,
        "shares_sold": shares_to_sell,
        "remaining_shares": round(remaining_shares, 2),
        "exit_price": current_price,
        "realized_pnl": round(pnl, 2),
        "new_cash": round(new_cash, 2)
    }


def close_paper_position(position_id: int, current_price: float, user_id: str = "default_user", exit_reason: str = "MANUAL_CLOSE") -> dict:
    """Closes an open position fully at current live price and calculates realized P&L."""
    with get_db_session() as session:
        pos = session.get(PaperPosition, position_id)
        if not pos or pos.user_id != user_id:
            return {"status": "ERROR", "message": f"Position #{position_id} not found."}
        shares = float(pos.shares)

    return sell_paper_position(
        position_id=position_id,
        shares_to_sell=shares,
        current_price=current_price,
        notes=exit_reason,
        user_id=user_id
    )


def get_paper_trade_history(user_id: str = "default_user", limit: int = 100) -> list:
    """Returns past executed orders journal."""
    with get_db_session() as session:
        stmt = select(PaperOrder).where(PaperOrder.user_id == user_id).order_by(PaperOrder.id.desc()).limit(limit)
        rows = session.execute(stmt).scalars().all()
        return [{
            "id": r.id,
            "user_id": r.user_id,
            "ticker": r.ticker,
            "order_type": r.order_type,
            "action": r.action,
            "shares": r.shares,
            "executed_price": r.executed_price,
            "realized_pnl": r.realized_pnl,
            "status": r.status,
            "executed_at": r.executed_at,
        } for r in rows]


def get_paper_analytics(user_id: str = "default_user") -> dict:
    """Computes full portfolio analytics: net worth, win rate, profit factor, best/worst trade, and sector allocation."""
    account = get_paper_account(user_id=user_id)
    positions = get_paper_positions(user_id=user_id)
    history = get_paper_trade_history(user_id=user_id, limit=200)

    cash = float(account.get("cash_balance", 1000000.0))
    start_balance = float(account.get("starting_balance", 1000000.0))
    invested_val = sum(p.get("invested_value", 0.0) for p in positions)
    market_val = sum(p.get("market_value", 0.0) for p in positions)
    unrealized_pnl = sum(p.get("unrealized_pnl", 0.0) for p in positions)

    total_net_worth = cash + market_val
    total_realized_pnl = sum(float(h.get("realized_pnl") or 0.0) for h in history if h.get("action") == "SELL")

    # Trade statistics
    closed_trades = [h for h in history if h.get("action") == "SELL"]
    total_closed = len(closed_trades)
    winning_trades = [h for h in closed_trades if float(h.get("realized_pnl") or 0.0) > 0]
    losing_trades = [h for h in closed_trades if float(h.get("realized_pnl") or 0.0) < 0]

    win_count = len(winning_trades)
    loss_count = len(losing_trades)
    win_rate = round((win_count / total_closed * 100), 1) if total_closed > 0 else 0.0

    gross_profit = sum(float(h["realized_pnl"]) for h in winning_trades)
    gross_loss = abs(sum(float(h["realized_pnl"]) for h in losing_trades))
    profit_factor = round(gross_profit / max(1.0, gross_loss), 2) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

    best_trade = max([float(h["realized_pnl"]) for h in closed_trades], default=0.0)
    worst_trade = min([float(h["realized_pnl"]) for h in closed_trades], default=0.0)

    # Sector Allocation
    sector_map = {}
    for p in positions:
        sec = p.get("sector") or "Diversified"
        mval = float(p.get("market_value") or 0.0)
        sector_map[sec] = sector_map.get(sec, 0.0) + mval

    sector_allocation = []
    if market_val > 0:
        for sec, val in sorted(sector_map.items(), key=lambda x: x[1], reverse=True):
            sector_allocation.append({
                "sector": sec,
                "value": round(val, 2),
                "pct": round((val / market_val) * 100, 1)
            })

    total_return_pct = round(((total_net_worth - start_balance) / start_balance) * 100, 2)

    return {
        "cash_balance": round(cash, 2),
        "starting_balance": round(start_balance, 2),
        "invested_value": round(invested_val, 2),
        "market_value": round(market_val, 2),
        "total_net_worth": round(total_net_worth, 2),
        "total_realized_pnl": round(total_realized_pnl, 2),
        "total_unrealized_pnl": round(unrealized_pnl, 2),
        "total_return_pct": total_return_pct,
        "win_rate_pct": win_rate,
        "total_trades": total_closed,
        "win_count": win_count,
        "loss_count": loss_count,
        "profit_factor": profit_factor,
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2),
        "open_positions_count": len(positions),
        "sector_allocation": sector_allocation
    }


def reset_paper_account(user_id: str = "default_user") -> dict:
    """Resets paper trading account back to ₹1,000,000 and clears positions/orders."""
    now_str = datetime.now().isoformat()
    with get_db_session() as session:
        session.execute(delete(PaperPosition).where(PaperPosition.user_id == user_id))
        session.execute(delete(PaperOrder).where(PaperOrder.user_id == user_id))
        acc = session.get(PaperAccount, user_id)
        if acc:
            acc.cash_balance = 1000000.0
            acc.starting_balance = 1000000.0
            acc.updated_at = now_str
        else:
            session.add(PaperAccount(user_id=user_id, cash_balance=1000000.0, starting_balance=1000000.0, updated_at=now_str))
    write_audit_log("RESET", "paper_account", details="reset to ₹10,00,000", user_id=user_id)
    return {"status": "RESET", "cash_balance": 1000000.0}



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



# ── Screener Platform Database Operations ────────────────────────────────────

def upsert_screener_daily_metric(row_data: dict) -> None:
    """Inserts or updates precomputed daily metrics for a ticker via SQLAlchemy ORM."""
    now_str = datetime.now().isoformat()
    ticker = str(row_data.get("ticker", "")).upper().strip()
    if not ticker:
        return

    metric_dict = {
        "ticker": ticker,
        "name": row_data.get("name", ticker),
        "sector": row_data.get("sector"),
        "industry": row_data.get("industry"),
        "market_cap_cr": float(row_data.get("market_cap_cr", 10000.0) or 10000.0),
        "market_cap_cat": str(row_data.get("market_cap_cat", "MID")),
        "close_price": float(row_data.get("close_price", 100.0) or 100.0),
        "change_1d_pct": float(row_data.get("change_1d_pct", 0.0) or 0.0),
        "change_1w_pct": float(row_data.get("change_1w_pct", 0.0) or 0.0),
        "change_1m_pct": float(row_data.get("change_1m_pct", 0.0) or 0.0),
        "change_1y_pct": float(row_data.get("change_1y_pct", 0.0) or 0.0),
        "distance_52w_high_pct": float(row_data.get("distance_52w_high_pct", -5.0) or -5.0),
        "distance_52w_low_pct": float(row_data.get("distance_52w_low_pct", 25.0) or 25.0),
        "rsi_14": float(row_data.get("rsi_14", 50.0) or 50.0),
        "macd_signal": str(row_data.get("macd_signal", "BULLISH")),
        "sma_20": float(row_data["sma_20"]) if row_data.get("sma_20") is not None else None,
        "sma_50": float(row_data["sma_50"]) if row_data.get("sma_50") is not None else None,
        "sma_200": float(row_data["sma_200"]) if row_data.get("sma_200") is not None else None,
        "volume_ratio_20d": float(row_data.get("volume_ratio_20d", 1.0) or 1.0),
        "pe_ratio": float(row_data["pe_ratio"]) if row_data.get("pe_ratio") is not None else None,
        "pb_ratio": float(row_data["pb_ratio"]) if row_data.get("pb_ratio") is not None else None,
        "roe_pct": float(row_data["roe_pct"]) if row_data.get("roe_pct") is not None else None,
        "roce_pct": float(row_data["roce_pct"]) if row_data.get("roce_pct") is not None else None,
        "debt_to_equity": float(row_data["debt_to_equity"]) if row_data.get("debt_to_equity") is not None else None,
        "sales_growth_3y": float(row_data["sales_growth_3y"]) if row_data.get("sales_growth_3y") is not None else None,
        "profit_growth_3y": float(row_data["profit_growth_3y"]) if row_data.get("profit_growth_3y") is not None else None,
        "pcr": float(row_data["pcr"]) if row_data.get("pcr") is not None else None,
        "max_pain": float(row_data["max_pain"]) if row_data.get("max_pain") is not None else None,
        "iv": float(row_data["iv"]) if row_data.get("iv") is not None else None,
        "ai_consensus_score": float(row_data.get("ai_consensus_score", 60.0) or 60.0),
        "ai_signal": str(row_data.get("ai_signal", "BUY")),
        "ai_confidence_score": float(row_data.get("ai_confidence_score", 75.0) or 75.0),
        "updated_at": now_str,
    }

    with get_db_session() as session:
        dialect = session.bind.dialect.name if session.bind else "sqlite"
        if dialect == "sqlite":
            stmt = sqlite_insert(ScreenerDailyMetric).values(metric_dict)
            update_cols = {k: v for k, v in metric_dict.items() if k != "ticker"}
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker"],
                set_=update_cols
            )
            session.execute(stmt)
        elif dialect == "postgresql":
            stmt = pg_insert(ScreenerDailyMetric).values(metric_dict)
            update_cols = {k: v for k, v in metric_dict.items() if k != "ticker"}
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker"],
                set_=update_cols
            )
            session.execute(stmt)
        else:
            session.merge(ScreenerDailyMetric(**metric_dict))



def execute_screener_sql_query(
    where_clause: str = "1=1",
    params: Any = None,
    sort_by: str = "market_cap_cr",
    sort_dir: str = "DESC",
    limit: int = 50,
    offset: int = 0
) -> dict:
    """Executes indexed SQL filter query against screener_daily_metrics table."""
    if params is None:
        params = {} if ":" in where_clause else ()
    elif isinstance(params, list):
        params = tuple(params)

    allowed_sorts = {
        "market_cap_cr", "close_price", "change_1d_pct", "rsi_14", "pe_ratio",
        "pb_ratio", "roe_pct", "roce_pct", "debt_to_equity", "volume_ratio_20d",
        "sales_growth_3y", "profit_growth_3y", "ai_consensus_score"
    }
    safe_sort = sort_by if sort_by in allowed_sorts else "market_cap_cr"
    safe_dir = "ASC" if str(sort_dir).upper() == "ASC" else "DESC"

    query_sql = f"""
        SELECT *
        FROM screener_daily_metrics
        WHERE {where_clause}
        ORDER BY {safe_sort} {safe_dir} NULLS LAST
        LIMIT {max(1, min(limit, 2000))} OFFSET {max(0, offset)}
    """

    count_sql = f"""
        SELECT COUNT(*) as total_count
        FROM screener_daily_metrics
        WHERE {where_clause}
    """

    try:
        with get_db_connection() as conn:
            total_row = conn.execute(count_sql, params).fetchone()
            total = total_row["total_count"] if total_row else 0
            rows = conn.execute(query_sql, params).fetchall()

        return {
            "total": total,
            "count": len(rows),
            "results": [dict(r) for r in rows],
        }
    except Exception as e:
        logger.warning("execute_screener_sql_query error for where=%s: %s", where_clause, e)
        return {
            "total": 0,
            "count": 0,
            "results": [],
        }


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
    share_token = str(uuid.uuid4())[:12]
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
    except Exception:
        pass


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







