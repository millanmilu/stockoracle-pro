import os
import json
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Any

# Absolute path for the SQLite database file
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stockoracle.db")


def get_db_connection() -> sqlite3.Connection:
    """Returns a connection to the SQLite database with row factory and WAL mode enabled."""
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db():
    """Initializes the database schema and creates all tables if they do not exist."""
    print(f"📦 Initializing SQLite database at: {DB_PATH}")
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. Historical Prices Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS historical_prices (
                ticker  TEXT,
                date    TEXT,
                open    REAL,
                high    REAL,
                low     REAL,
                close   REAL,
                volume  INTEGER,
                PRIMARY KEY (ticker, date)
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_hist_ticker_date ON historical_prices (ticker, date)"
        )

        # 2. Live Ticks Table (WebSocket streaming records)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS live_ticks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker     TEXT,
                timestamp  TEXT,
                price      REAL,
                change_pct REAL
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_ticks_ticker_time ON live_ticks (ticker, timestamp)"
        )

        # 3. Company Info Cache (LTP, 52w high/low, volume — refreshed by TTL)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS company_info (
                ticker      TEXT PRIMARY KEY,
                data_json   TEXT NOT NULL,
                fetched_at  TEXT NOT NULL
            )
        """)

        # 4. Predictions Cache (AI 7-day prediction results)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                ticker      TEXT PRIMARY KEY,
                data_json   TEXT NOT NULL,
                fetched_at  TEXT NOT NULL
            )
        """)

        # 5. Screener Results Cache (pre-computed screener list)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS screener_results (
                id          INTEGER PRIMARY KEY CHECK (id = 1),
                data_json   TEXT NOT NULL,
                fetched_at  TEXT NOT NULL
            )
        """)

        # 6. Monte Carlo Cache (GBM simulation results per ticker)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS monte_carlo (
                ticker      TEXT PRIMARY KEY,
                data_json   TEXT NOT NULL,
                fetched_at  TEXT NOT NULL
            )
        """)

        conn.commit()
    print("✅ SQLite database initialization complete.")


# ── Historical Prices ──────────────────────────────────────────────────────────

def save_historical_prices(ticker: str, df: pd.DataFrame):
    """
    Saves a DataFrame of historical prices into the SQLite database.
    Uses executemany (bulk insert) for fast writes.
    """
    if df is None or df.empty:
        return

    ticker = ticker.upper()
    rows = [
        (
            ticker,
            str(row["date"]),
            float(row["open"]),
            float(row["high"]),
            float(row["low"]),
            float(row["close"]),
            int(row["volume"]),
        )
        for _, row in df.iterrows()
    ]
    with get_db_connection() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO historical_prices (ticker, date, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()


def get_historical_prices(ticker: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
    """
    Fetches historical price records for a ticker within a date range.
    Returns a Pandas DataFrame, or None if no records exist.
    """
    ticker = ticker.upper()
    query = """
        SELECT date, open, high, low, close, volume
        FROM historical_prices
        WHERE ticker = ? AND date BETWEEN ? AND ?
        ORDER BY date ASC
    """
    with get_db_connection() as conn:
        df = pd.read_sql_query(query, conn, params=(ticker, start_date, end_date))

    return df if not df.empty else None


# ── Live Ticks ─────────────────────────────────────────────────────────────────

def save_live_tick(ticker: str, price: float, change_pct: float):
    """Saves a single live tick update to the database."""
    ticker = ticker.upper()
    timestamp = datetime.now().isoformat()
    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO live_ticks (ticker, timestamp, price, change_pct) VALUES (?, ?, ?, ?)",
                (ticker, timestamp, price, change_pct),
            )
            conn.commit()
    except Exception as e:
        print(f"Error saving live tick to database: {e}")


# ── Generic JSON Cache Helpers ─────────────────────────────────────────────────

def _save_json(table: str, key_col: str, key_val: str, data: Any, ttl_minutes: int = 5):
    """Saves any JSON-serialisable data into a cache table."""
    payload = json.dumps(data, default=str)
    now = datetime.now().isoformat()
    with get_db_connection() as conn:
        if key_col == "id":
            conn.execute(
                f"INSERT OR REPLACE INTO {table} (id, data_json, fetched_at) VALUES (1, ?, ?)",
                (payload, now),
            )
        else:
            conn.execute(
                f"INSERT OR REPLACE INTO {table} ({key_col}, data_json, fetched_at) VALUES (?, ?, ?)",
                (key_val, payload, now),
            )
        conn.commit()


def _get_json(table: str, key_col: str, key_val: str, ttl_minutes: int = 5) -> Optional[Any]:
    """
    Returns cached JSON data if it exists and is within the TTL window.
    Returns None if missing or expired.
    """
    expiry = (datetime.now() - timedelta(minutes=ttl_minutes)).isoformat()
    try:
        with get_db_connection() as conn:
            if key_col == "id":
                row = conn.execute(
                    f"SELECT data_json, fetched_at FROM {table} WHERE id = 1 AND fetched_at > ?",
                    (expiry,),
                ).fetchone()
            else:
                row = conn.execute(
                    f"SELECT data_json, fetched_at FROM {table} WHERE {key_col} = ? AND fetched_at > ?",
                    (key_val, expiry),
                ).fetchone()
        if row:
            return json.loads(row["data_json"])
    except Exception as e:
        print(f"DB cache read error ({table}): {e}")
    return None


def _get_stale_json(table: str, key_col: str, key_val: str) -> Optional[Any]:
    """Returns cached data regardless of TTL (used as fallback when API is down)."""
    try:
        with get_db_connection() as conn:
            if key_col == "id":
                row = conn.execute(
                    f"SELECT data_json FROM {table} WHERE id = 1"
                ).fetchone()
            else:
                row = conn.execute(
                    f"SELECT data_json FROM {table} WHERE {key_col} = ?",
                    (key_val,),
                ).fetchone()
        if row:
            return json.loads(row["data_json"])
    except Exception as e:
        print(f"DB stale-cache read error ({table}): {e}")
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


# ── Monte Carlo ────────────────────────────────────────────────────────────────

def save_monte_carlo(ticker: str, data: dict, ttl_minutes: int = 30):
    _save_json("monte_carlo", "ticker", ticker.upper(), data, ttl_minutes)


def get_monte_carlo_cached(ticker: str, ttl_minutes: int = 30) -> Optional[dict]:
    return _get_json("monte_carlo", "ticker", ticker.upper(), ttl_minutes)
