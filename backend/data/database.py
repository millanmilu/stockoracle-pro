import os
import json
import sqlite3
import pandas as pd
import numpy as np
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

        # 1b. Searchable NSE universe, populated from Angel One ScripMaster.
        # This is deliberately separate from historical prices: downloading two
        # years for every NSE listing would be slow and exceed broker limits.
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stock_universe (
                ticker      TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                symbol      TEXT NOT NULL,
                token       TEXT,
                exchange    TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_universe_name ON stock_universe (name)"
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

        # 7. Training Task Status (persists background job state across restarts)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_status (
                task_id     TEXT PRIMARY KEY,
                ticker      TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'queued',
                progress    INTEGER NOT NULL DEFAULT 0,
                mape        REAL,
                error       TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_task_ticker ON task_status (ticker)"
        )

        # 8. Portfolio positions (server-side persistence for user portfolios)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portfolio (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    TEXT    NOT NULL DEFAULT 'default',
                ticker     TEXT    NOT NULL,
                quantity   REAL    NOT NULL,
                buy_price  REAL    NOT NULL,
                added_at   TEXT    NOT NULL
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio (user_id)"
        )

        # 9. Price alerts (server-side persistence for user price alerts)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS price_alerts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    TEXT    NOT NULL DEFAULT 'default',
                ticker     TEXT    NOT NULL,
                condition  TEXT    NOT NULL,   -- 'above' or 'below'
                threshold  REAL    NOT NULL,
                created_at TEXT    NOT NULL
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts (user_id)"
        )

        conn.commit()
    print("✅ SQLite database initialization complete.")


# ── Historical Prices ──────────────────────────────────────────────────────────

def clear_ticker_history(ticker: str):
    """Deletes all historical price records for a specific ticker to clean stale/corrupted data."""
    if not ticker:
        return
    ticker = ticker.upper()
    with get_db_connection() as conn:
        conn.execute("DELETE FROM historical_prices WHERE ticker = ?", (ticker,))
        conn.commit()
    print(f"🧹 Cleared old historical DB records for {ticker}.")


def _normalize_price(v):
    try:
        val = float(v)
        if np.isnan(val) or val <= 0:
            return None
        # Heuristic: convert paise (> 100,000) to rupees
        if val > 100000:
            return round(val / 100.0, 2)
        return round(val, 2)
    except Exception:
        return None


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
                print(f"🛠️ Normalized {len(paise_candidates)} paise records to rupees for {t}.")

        # Delete invalid <= 0 rows
        conn.execute("DELETE FROM historical_prices WHERE close <= 0 OR high <= 0 OR open <= 0 OR low <= 0")
        conn.commit()


def save_historical_prices(ticker: str, df: pd.DataFrame):
    """
    Saves a DataFrame of historical prices into the SQLite database.
    Uses executemany (bulk insert) for fast writes with unit normalization.
    """
    if df is None or df.empty:
        return

    ticker = ticker.upper()
    rows = []
    for _, row in df.iterrows():
        try:
            d_str = str(row["date"])
            o_val = _normalize_price(row["open"])
            h_val = _normalize_price(row["high"])
            l_val = _normalize_price(row["low"])
            c_val = _normalize_price(row["close"])
            vol   = int(row.get("volume", 0) or 0)

            if not all([o_val, h_val, l_val, c_val]):
                continue
            rows.append((ticker, d_str, o_val, max(h_val, o_val, c_val), min(l_val, o_val, c_val), c_val, vol))
        except Exception:
            continue

    if not rows:
        return

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
    if len(end_date) == 10:
        end_date = end_date + " 23:59:59"

    query = """
        SELECT date, open, high, low, close, volume
        FROM historical_prices
        WHERE ticker = ? AND date BETWEEN ? AND ?
        ORDER BY date ASC
    """
    with get_db_connection() as conn:
        df = pd.read_sql_query(query, conn, params=(ticker, start_date, end_date))

    return df if not df.empty else None


def save_stock_universe(records: list[dict]):
    """Persists the searchable NSE symbol master without fetching price history."""
    if not records:
        return
    now = datetime.now().isoformat()
    rows = [
        (
            item["ticker"], item["name"], item["symbol"],
            item.get("token", ""), item.get("exchange", "NSE"), now,
        )
        for item in records
    ]
    with get_db_connection() as conn:
        conn.executemany(
            """
            INSERT INTO stock_universe (ticker, name, symbol, token, exchange, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(ticker) DO UPDATE SET
                name=excluded.name, symbol=excluded.symbol, token=excluded.token,
                exchange=excluded.exchange, updated_at=excluded.updated_at
            """,
            rows,
        )


def search_stock_universe(query: str, limit: int = 12) -> list[dict]:
    """Returns ticker/name matches from the locally stored NSE symbol master."""
    text = query.strip().upper()
    if not text:
        return []
    like = f"%{text}%"
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT ticker, name, exchange
            FROM stock_universe
            WHERE ticker LIKE ? OR name LIKE ?
            ORDER BY CASE WHEN ticker = ? THEN 0 WHEN ticker LIKE ? THEN 1 ELSE 2 END, ticker
            LIMIT ?
            """,
            (like, like, text, f"{text}%", max(1, min(limit, 30))),
        ).fetchall()
    return [dict(row) for row in rows]


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


# ── Training Task Status ────────────────────────────────────────────────────────

def save_task_status(task_id: str, ticker: str, status: str, progress: int,
                     mape: Optional[float] = None, error: Optional[str] = None):
    """Creates or updates a training task record in the database."""
    now = datetime.now().isoformat()
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO task_status (task_id, ticker, status, progress, mape, error, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                    status=excluded.status, progress=excluded.progress,
                    mape=excluded.mape, error=excluded.error, updated_at=excluded.updated_at
                """,
                (task_id, ticker.upper(), status, progress, mape, error, now, now),
            )
            conn.commit()
    except Exception as e:
        print(f"Error saving task status for {task_id}: {e}")


def get_task_status(task_id: str) -> Optional[dict]:
    """Returns task status dict for the given task_id, or None if not found."""
    try:
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT task_id, ticker, status, progress, mape, error, created_at, updated_at "
                "FROM task_status WHERE task_id = ?",
                (task_id,),
            ).fetchone()
        if row:
            return dict(row)
    except Exception as e:
        print(f"Error reading task status for {task_id}: {e}")
    return None


def cleanup_old_tasks(max_age_hours: int = 24):
    """Deletes task records older than max_age_hours to keep the table small."""
    cutoff = (datetime.now() - timedelta(hours=max_age_hours)).isoformat()
    try:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM task_status WHERE updated_at < ?", (cutoff,))
            conn.commit()
    except Exception as e:
        print(f"Error cleaning old tasks: {e}")


# ── Monte Carlo ────────────────────────────────────────────────────────────────

def save_monte_carlo(ticker: str, data: dict, ttl_minutes: int = 30):
    _save_json("monte_carlo", "ticker", ticker.upper(), data, ttl_minutes)


def get_monte_carlo_cached(ticker: str, ttl_minutes: int = 30) -> Optional[dict]:
    return _get_json("monte_carlo", "ticker", ticker.upper(), ttl_minutes)


# ── Live Tick Analytics ────────────────────────────────────────────────────────

def get_recent_live_ticks(ticker: str, limit: int = 200) -> Optional[pd.DataFrame]:
    """
    Returns the most recent live tick records for a ticker as a DataFrame.
    Columns: timestamp, price, change_pct
    """
    ticker = ticker.upper()
    try:
        with get_db_connection() as conn:
            df = pd.read_sql_query(
                """
                SELECT timestamp, price, change_pct
                FROM live_ticks
                WHERE ticker = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                conn,
                params=(ticker, limit),
            )
        return df if not df.empty else None
    except Exception as e:
        print(f"Error reading live ticks for {ticker}: {e}")
        return None


def get_live_tick_ohlcv(ticker: str) -> Optional[dict]:
    """
    Aggregates today's live ticks into a single synthetic OHLCV row.
    Returns a dict with keys: date, open, high, low, close, volume
    or None if no ticks exist for today.
    """
    ticker = ticker.upper()
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        with get_db_connection() as conn:
            df = pd.read_sql_query(
                """
                SELECT price, timestamp
                FROM live_ticks
                WHERE ticker = ? AND timestamp >= ?
                ORDER BY timestamp ASC
                """,
                conn,
                params=(ticker, today),
            )
        if df.empty:
            return None
        return {
            "date":   today,
            "open":   float(df["price"].iloc[0]),
            "high":   float(df["price"].max()),
            "low":    float(df["price"].min()),
            "close":  float(df["price"].iloc[-1]),
            "volume": len(df),
        }
    except Exception as e:
        print(f"Error building live OHLCV for {ticker}: {e}")
        return None


def get_db_stats() -> dict:
    """Returns a summary of all DB table sizes for the /api/db/status endpoint."""
    stats = {}
    tables = ["historical_prices", "stock_universe", "live_ticks", "company_info",
              "predictions", "screener_results", "monte_carlo", "task_status"]
    try:
        with get_db_connection() as conn:
            for table in tables:
                count = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                stats[table] = count
            # Per-ticker historical rows
            ticker_rows = conn.execute(
                "SELECT ticker, count(*) as rows, min(date), max(date) "
                "FROM historical_prices GROUP BY ticker ORDER BY ticker"
            ).fetchall()
            stats["historical_by_ticker"] = [
                {"ticker": r[0], "rows": r[1], "from": r[2], "to": r[3]}
                for r in ticker_rows
            ]
    except Exception as e:
        stats["error"] = str(e)
    return stats


# ── Portfolio ──────────────────────────────────────────────────────────────────

def save_portfolio_item(user_id: str, ticker: str, quantity: float, buy_price: float) -> int:
    """Inserts a new portfolio position. Returns the new row ID."""
    now = datetime.now().isoformat()
    with get_db_connection() as conn:
        cur = conn.execute(
            "INSERT INTO portfolio (user_id, ticker, quantity, buy_price, added_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, ticker.upper(), quantity, buy_price, now),
        )
        conn.commit()
        return cur.lastrowid


def get_portfolio(user_id: str = "default") -> list:
    """Returns all portfolio positions for the given user_id."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, ticker, quantity, buy_price, added_at FROM portfolio WHERE user_id = ? ORDER BY added_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_portfolio_item(item_id: int, user_id: str = "default") -> bool:
    """Deletes a portfolio position by ID. Returns True if a row was deleted."""
    with get_db_connection() as conn:
        cur = conn.execute(
            "DELETE FROM portfolio WHERE id = ? AND user_id = ?",
            (item_id, user_id),
        )
        conn.commit()
        return cur.rowcount > 0


# ── Price Alerts ───────────────────────────────────────────────────────────────

def save_price_alert(user_id: str, ticker: str, condition: str, threshold: float) -> int:
    """Inserts a new price alert. Returns the new row ID."""
    now = datetime.now().isoformat()
    with get_db_connection() as conn:
        cur = conn.execute(
            "INSERT INTO price_alerts (user_id, ticker, condition, threshold, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, ticker.upper(), condition, threshold, now),
        )
        conn.commit()
        return cur.lastrowid


def get_price_alerts(user_id: str = "default") -> list:
    """Returns all price alerts for the given user_id."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, ticker, condition, threshold, created_at FROM price_alerts WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_price_alert(alert_id: int, user_id: str = "default") -> bool:
    """Deletes a price alert by ID. Returns True if a row was deleted."""
    with get_db_connection() as conn:
        cur = conn.execute(
            "DELETE FROM price_alerts WHERE id = ? AND user_id = ?",
            (alert_id, user_id),
        )
        conn.commit()
        return cur.rowcount > 0
