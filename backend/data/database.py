import os
import re
import json
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Any
from backend.core.logging import get_logger

logger = get_logger("stockoracle.db")

# Absolute path for the SQLite database file
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stockoracle.db")
DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def get_db_connection() -> sqlite3.Connection:
    """Returns a connection to the SQLite database with row factory and WAL mode enabled."""
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db():
    """Initializes the database schema and creates all tables if they do not exist."""
    logger.info("Initializing SQLite database at: %s", DB_PATH)
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

        # 8. Portfolio (user holdings with multi-user isolation)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portfolio (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT DEFAULT 'default_user',
                ticker      TEXT NOT NULL,
                shares      REAL NOT NULL,
                buy_price   REAL NOT NULL,
                added_at    TEXT DEFAULT (datetime('now'))
            )
        """)
        # Auto-migrate user_id if missing
        try:
            p_cols = [c[1] for c in cursor.execute("PRAGMA table_info(portfolio)").fetchall()]
            if "user_id" not in p_cols:
                cursor.execute("ALTER TABLE portfolio ADD COLUMN user_id TEXT DEFAULT 'default_user'")
        except Exception:
            pass

        # 10. Paper Trading Accounts (Virtual ₹10 Lakhs)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS paper_accounts (
                user_id           TEXT PRIMARY KEY,
                cash_balance      REAL NOT NULL DEFAULT 1000000.0,
                starting_balance  REAL NOT NULL DEFAULT 1000000.0,
                updated_at        TEXT NOT NULL
            )
        """)

        # 11. Paper Trading Active Positions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS paper_positions (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        TEXT NOT NULL,
                ticker         TEXT NOT NULL,
                order_type     TEXT NOT NULL DEFAULT 'BUY',
                shares         REAL NOT NULL,
                avg_buy_price  REAL NOT NULL,
                stop_loss      REAL,
                target_price   REAL,
                opened_at      TEXT NOT NULL
            )
        """)

        # 12. Paper Trading Executed Orders & Journal
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS paper_orders (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         TEXT NOT NULL,
                ticker          TEXT NOT NULL,
                order_type      TEXT NOT NULL,
                action          TEXT NOT NULL,
                shares          REAL NOT NULL,
                executed_price  REAL NOT NULL,
                realized_pnl    REAL DEFAULT 0.0,
                status          TEXT NOT NULL DEFAULT 'EXECUTED',
                executed_at     TEXT NOT NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_pos_user ON paper_positions (user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_ord_user ON paper_orders (user_id)")

        # 12. Smart Alerts
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS smart_alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT    NOT NULL DEFAULT 'default_user',
                ticker      TEXT    NOT NULL,
                alert_type  TEXT    NOT NULL,
                param_value TEXT,
                created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
                triggered   INTEGER NOT NULL DEFAULT 0
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_smart_alerts_ticker ON smart_alerts (ticker)"
        )

        # 13. Audit Log — immutable event trail (timestamps stored in UTC ISO-8601)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT    NOT NULL DEFAULT 'default_user',
                action      TEXT    NOT NULL,
                entity      TEXT    NOT NULL,
                entity_id   TEXT,
                details     TEXT,
                ts_utc      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts_utc)"
        )

        # 14. Saved Custom Screener Scans
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_scans (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      TEXT    NOT NULL DEFAULT 'default_user',
                name         TEXT    NOT NULL,
                description  TEXT,
                filters_json TEXT    NOT NULL DEFAULT '{}',
                created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_saved_scans_user ON saved_scans (user_id)"
        )

        # 15. Model Registry & Version Lineage
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS model_registry (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker        TEXT    NOT NULL,
                model_type    TEXT    NOT NULL,
                version       TEXT    NOT NULL,
                artifact_path TEXT    NOT NULL,
                mape          REAL,
                rmse          REAL,
                metrics_json  TEXT,
                trained_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
                is_active     INTEGER NOT NULL DEFAULT 1
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_registry_ticker ON model_registry (ticker)"
        )

        # 16. Companies Metadata
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                ticker              TEXT PRIMARY KEY,
                name                TEXT NOT NULL,
                sector              TEXT,
                industry            TEXT,
                market_cap_category TEXT,
                about_text          TEXT,
                website_url         TEXT,
                bse_code            TEXT,
                nse_symbol          TEXT
            )
        """)

        # 17. Financial Statements (Quarterly & Annual)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS financial_statements (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker             TEXT NOT NULL,
                period_type        TEXT NOT NULL,
                period_label       TEXT NOT NULL,
                revenue            REAL,
                operating_profit   REAL,
                opm_pct            REAL,
                net_profit         REAL,
                npm_pct            REAL,
                eps                REAL,
                balance_sheet_json TEXT,
                cash_flow_json     TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_fin_stmt_ticker ON financial_statements (ticker, period_type)")

        # 18. Financial Ratios
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS financial_ratios (
                ticker          TEXT PRIMARY KEY,
                pe_ratio        REAL,
                pb_ratio        REAL,
                roe_pct         REAL,
                roce_pct        REAL,
                debt_to_equity  REAL,
                opm_pct         REAL,
                npm_pct         REAL,
                sales_growth_3y REAL,
                profit_growth_3y REAL,
                cagr_5y         REAL
            )
        """)

        # 19. Shareholding Snapshots
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shareholding_snapshots (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker        TEXT NOT NULL,
                quarter_label TEXT NOT NULL,
                promoter_pct  REAL,
                fii_pct       REAL,
                dii_pct       REAL,
                public_pct    REAL,
                others_pct    REAL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_shareholding_ticker ON shareholding_snapshots (ticker)")

        # 20. Screener Precomputed Daily Metrics Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS screener_daily_metrics (
                ticker                TEXT PRIMARY KEY,
                name                  TEXT NOT NULL,
                sector                TEXT,
                industry              TEXT,
                market_cap_cr         REAL,
                market_cap_cat        TEXT,
                close_price           REAL NOT NULL,
                change_1d_pct         REAL,
                change_1w_pct         REAL,
                change_1m_pct         REAL,
                change_1y_pct         REAL,
                distance_52w_high_pct REAL,
                distance_52w_low_pct  REAL,
                rsi_14                REAL,
                macd_signal           TEXT,
                sma_20                REAL,
                sma_50                REAL,
                sma_200               REAL,
                volume_ratio_20d      REAL,
                pe_ratio              REAL,
                pb_ratio              REAL,
                roe_pct               REAL,
                roce_pct              REAL,
                debt_to_equity        REAL,
                sales_growth_3y       REAL,
                profit_growth_3y      REAL,
                pcr                   REAL,
                max_pain              REAL,
                iv                    REAL,
                ai_consensus_score    REAL,
                ai_signal             TEXT,
                ai_confidence_score   REAL,
                updated_at            TEXT NOT NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sdm_sector ON screener_daily_metrics (sector)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sdm_mcap ON screener_daily_metrics (market_cap_cr)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sdm_pe ON screener_daily_metrics (pe_ratio)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sdm_roce ON screener_daily_metrics (roce_pct)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sdm_rsi ON screener_daily_metrics (rsi_14)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sdm_ai_score ON screener_daily_metrics (ai_consensus_score)")

        # 21. User Screens & Formula AST
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_screens (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         TEXT NOT NULL DEFAULT 'default_user',
                name            TEXT NOT NULL,
                description     TEXT,
                formula_query   TEXT,
                filter_ast_json TEXT NOT NULL DEFAULT '{}',
                universe        TEXT NOT NULL DEFAULT 'NIFTY_500',
                sort_by         TEXT NOT NULL DEFAULT 'market_cap_cr',
                sort_dir        TEXT NOT NULL DEFAULT 'DESC',
                is_public       INTEGER NOT NULL DEFAULT 0,
                share_token     TEXT UNIQUE,
                created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
                updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_screens_user ON user_screens (user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_screens_token ON user_screens (share_token)")

        # Cleanup: purge any legacy intraday records that polluted the daily historical_prices table
        cursor.execute("DELETE FROM historical_prices WHERE length(date) != 10")

        conn.commit()
    logger.info("SQLite database initialization complete.")


def write_audit_log(
    action: str,
    entity: str,
    entity_id: str = None,
    details: str = None,
    user_id: str = "default_user",
) -> None:
    """
    Appends one immutable row to the audit_log table.
    Timestamps are stored as UTC ISO-8601 strings.
    Call this on every portfolio add/remove, paper order, alert create/trigger/delete.

    Args:
        action:    Verb describing the change, e.g. 'ADD', 'REMOVE', 'TRIGGERED', 'RESET'.
        entity:    Domain entity, e.g. 'portfolio', 'smart_alert', 'paper_order'.
        entity_id: ID of the affected row (can be str representation of int PK).
        details:   Optional JSON-serialisable string with extra context.
        user_id:   Owning user.
    """
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, details, ts_utc)
                VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
                """,
                (user_id, action.upper(), entity, str(entity_id) if entity_id is not None else None, details),
            )
            conn.commit()
    except Exception as e:
        # Audit write must never crash the caller; log and continue
        import logging
        logging.getLogger("stockoracle.db").error("audit_log write failed: %s", e)


# ── Historical Prices ──────────────────────────────────────────────────────────

def clear_ticker_history(ticker: str):
    """Deletes all historical price records for a specific ticker to clean stale/corrupted data."""
    if not ticker:
        return
    ticker = ticker.upper()
    with get_db_connection() as conn:
        conn.execute("DELETE FROM historical_prices WHERE ticker = ?", (ticker,))
        conn.commit()
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
    Saves a DataFrame of daily historical prices into the SQLite database.
    Uses executemany (bulk insert) for fast writes with unit normalization.
    Strictly accepts only daily dates (YYYY-MM-DD) matching DATE_REGEX.
    """
    if df is None or df.empty:
        return

    ticker = ticker.upper()
    rows = []
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
    Fetches historical daily price records for a ticker within a date range.
    Returns a Pandas DataFrame, or None if no records exist.
    """
    ticker = ticker.upper()
    start_date = str(start_date)[:10]
    end_date = str(end_date)[:10]

    query = """
        SELECT date, open, high, low, close, volume
        FROM historical_prices
        WHERE ticker = ? AND length(date) = 10 AND date BETWEEN ? AND ?
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


def get_all_stock_universe_tickers(limit: int = 1500) -> list[str]:
    """Returns all NSE tickers stored in the stock_universe table."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT ticker FROM stock_universe
            ORDER BY ticker ASC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()
    return [row["ticker"] for row in rows]


def get_all_stock_universe_records(limit: int = 1500) -> list[dict]:
    """Returns all NSE stock master records."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT ticker, name, exchange FROM stock_universe
            ORDER BY ticker ASC
            LIMIT ?
            """,
            (limit,)
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
        logger.error("Error saving live tick for %s: %s", ticker, e, exc_info=True)


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
        logger.warning("DB cache read error (%s): %s", table, e)
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
        logger.error("Error saving task status for %s: %s", task_id, e)


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
        logger.error("Error reading task status for %s: %s", task_id, e)
    return None


def cleanup_old_tasks(max_age_hours: int = 24):
    """Deletes task records older than max_age_hours to keep the table small."""
    cutoff = (datetime.now() - timedelta(hours=max_age_hours)).isoformat()
    try:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM task_status WHERE updated_at < ?", (cutoff,))
            conn.commit()
    except Exception as e:
        logger.error("Error cleaning old tasks: %s", e)


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
        logger.error("Error reading live ticks for %s: %s", ticker, e)
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
        logger.error("Error building live OHLCV for %s: %s", ticker, e)
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


# ── Portfolio Functions ────────────────────────────────────────────────────────

# ── Portfolio Functions ────────────────────────────────────────────────────────

def add_portfolio_position(ticker: str, shares: float, buy_price: float, user_id: str = "default_user") -> int:
    """Add a portfolio position and return the new row id."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO portfolio (user_id, ticker, shares, buy_price) VALUES (?, ?, ?, ?)",
            (user_id, ticker.upper(), shares, buy_price),
        )
        conn.commit()
        row_id = cursor.lastrowid
    write_audit_log("ADD", "portfolio", entity_id=row_id,
                    details=f"ticker={ticker} shares={shares} buy_price={buy_price}",
                    user_id=user_id)
    return row_id


def get_portfolio(user_id: str = "default_user") -> list:
    """Return all portfolio positions for a user as a list of dicts."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, user_id, ticker, shares, buy_price, added_at FROM portfolio WHERE user_id = ? ORDER BY added_at DESC",
            (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def remove_portfolio_position(position_id: int, user_id: str = "default_user"):
    """Delete a portfolio position by id and user_id."""
    with get_db_connection() as conn:
        conn.execute("DELETE FROM portfolio WHERE id = ? AND user_id = ?", (position_id, user_id))
        conn.commit()
    write_audit_log("REMOVE", "portfolio", entity_id=position_id, user_id=user_id)


# ── Smart Alert Functions ──────────────────────────────────────────────────────

def add_smart_alert(ticker: str, alert_type: str, param_value: dict, user_id: str = "default_user") -> int:
    """Add a smart alert and return the new row id."""
    import json as _json
    with get_db_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO smart_alerts (user_id, ticker, alert_type, param_value) VALUES (?, ?, ?, ?)",
            (user_id, ticker.upper(), alert_type, _json.dumps(param_value)),
        )
        conn.commit()
        row_id = cursor.lastrowid
    write_audit_log("ADD", "smart_alert", entity_id=row_id,
                    details=f"ticker={ticker} type={alert_type} params={param_value}",
                    user_id=user_id)
    return row_id


def get_smart_alerts(user_id: str = "default_user") -> list:
    """Return all smart alerts for a user as a list of dicts (param_value parsed from JSON)."""
    import json as _json
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, user_id, ticker, alert_type, param_value, created_at, triggered FROM smart_alerts WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        ).fetchall()
    result = []
    for r in rows:
        item = dict(r)
        try:
            item["param_value"] = _json.loads(item["param_value"] or "{}")
        except Exception:
            item["param_value"] = {}
        result.append(item)
    return result


def remove_smart_alert(alert_id: int, user_id: str = "default_user"):
    """Delete a smart alert by id and user_id."""
    with get_db_connection() as conn:
        conn.execute("DELETE FROM smart_alerts WHERE id = ? AND user_id = ?", (alert_id, user_id))
        conn.commit()
    write_audit_log("REMOVE", "smart_alert", entity_id=alert_id, user_id=user_id)


def mark_alert_triggered(alert_id: int):
    """Mark a smart alert as triggered."""
    with get_db_connection() as conn:
        # Fetch user_id for audit
        row = conn.execute("SELECT user_id, ticker, alert_type FROM smart_alerts WHERE id = ?", (alert_id,)).fetchone()
        conn.execute("UPDATE smart_alerts SET triggered = 1 WHERE id = ?", (alert_id,))
        conn.commit()
    if row:
        write_audit_log("TRIGGERED", "smart_alert", entity_id=alert_id,
                        details=f"ticker={row['ticker']} type={row['alert_type']}",
                        user_id=row["user_id"])


# ── Paper Trading Functions (₹10 Lakh Virtual Funds) ──────────────────────────

def get_paper_account(user_id: str = "default_user") -> dict:
    """Returns the paper trading account state, initializing with ₹1,000,000 if new."""
    now_str = datetime.now().isoformat()
    with get_db_connection() as conn:
        row = conn.execute("SELECT user_id, cash_balance, starting_balance, updated_at FROM paper_accounts WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            conn.execute(
                "INSERT INTO paper_accounts (user_id, cash_balance, starting_balance, updated_at) VALUES (?, 1000000.0, 1000000.0, ?)",
                (user_id, now_str)
            )
            conn.commit()
            return {"user_id": user_id, "cash_balance": 1000000.0, "starting_balance": 1000000.0, "updated_at": now_str}
        return dict(row)


def get_paper_positions(user_id: str = "default_user") -> list:
    """Returns active open paper trading positions."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, user_id, ticker, order_type, shares, avg_buy_price, stop_loss, target_price, opened_at FROM paper_positions WHERE user_id = ? ORDER BY opened_at DESC",
            (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def place_paper_order(ticker: str, order_type: str, action: str, shares: float, price: float, stop_loss: float = None, target_price: float = None, user_id: str = "default_user") -> dict:
    """
    Executes a paper order atomically:
    - Checks cash balance under transaction lock, debits cash, creates paper position.
    - Records order in paper_orders journal and audit logs.
    """
    ticker = ticker.upper().strip()
    action = action.upper().strip()
    order_type = order_type.upper().strip()
    total_cost = shares * price
    now_str = datetime.now().isoformat()

    if action != "BUY":
        raise ValueError("Direct SELL without position not supported. Use close_paper_position() to exit holdings.")

    if shares <= 0 or price <= 0:
        raise ValueError("Shares and price must be positive numbers.")

    with get_db_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT cash_balance FROM paper_accounts WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            conn.execute(
                "INSERT OR IGNORE INTO paper_accounts (user_id, cash_balance, starting_balance, updated_at) VALUES (?, 1000000.0, 1000000.0, ?)",
                (user_id, now_str)
            )
            row = conn.execute("SELECT cash_balance FROM paper_accounts WHERE user_id = ?", (user_id,)).fetchone()

        cash_balance = float(row["cash_balance"])
        if cash_balance < total_cost:
            raise ValueError(f"Insufficient virtual cash balance. Needed ₹{total_cost:,.2f}, Available ₹{cash_balance:,.2f}")

        new_cash = cash_balance - total_cost
        conn.execute("UPDATE paper_accounts SET cash_balance = ?, updated_at = ? WHERE user_id = ?", (new_cash, now_str, user_id))

        cursor = conn.execute(
            """
            INSERT INTO paper_positions (user_id, ticker, order_type, shares, avg_buy_price, stop_loss, target_price, opened_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, ticker, order_type, shares, price, stop_loss, target_price, now_str)
        )
        pos_id = cursor.lastrowid

        conn.execute(
            """
            INSERT INTO paper_orders (user_id, ticker, order_type, action, shares, executed_price, realized_pnl, status, executed_at)
            VALUES (?, ?, ?, 'BUY', ?, ?, 0.0, 'EXECUTED', ?)
            """,
            (user_id, ticker, order_type, shares, price, now_str)
        )
        conn.commit()

    write_audit_log("BUY", "paper_order", entity_id=pos_id,
                    details=f"ticker={ticker} shares={shares} price={price} cost={total_cost:.2f}",
                    user_id=user_id)
    return {"status": "SUCCESS", "position_id": pos_id, "action": "BUY", "ticker": ticker, "shares": shares, "price": price, "remaining_cash": new_cash}


def close_paper_position(position_id: int, current_price: float, user_id: str = "default_user") -> dict:
    """Closes an open position at current live price and calculates realized P&L atomically."""
    now_str = datetime.now().isoformat()
    with get_db_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        pos = conn.execute("SELECT id, user_id, ticker, order_type, shares, avg_buy_price FROM paper_positions WHERE id = ? AND user_id = ?", (position_id, user_id)).fetchone()
        if not pos:
            raise ValueError(f"Position #{position_id} not found.")

        shares = float(pos["shares"])
        buy_p  = float(pos["avg_buy_price"])
        pnl    = (current_price - buy_p) * shares
        proceeds = shares * current_price

        # Update Account Cash atomically
        acc = conn.execute("SELECT cash_balance FROM paper_accounts WHERE user_id = ?", (user_id,)).fetchone()
        current_cash = float(acc["cash_balance"]) if acc else 1000000.0
        new_cash = current_cash + proceeds
        conn.execute("UPDATE paper_accounts SET cash_balance = ?, updated_at = ? WHERE user_id = ?", (new_cash, now_str, user_id))

        # Record Close Order in Journal
        conn.execute(
            """
            INSERT INTO paper_orders (user_id, ticker, order_type, action, shares, executed_price, realized_pnl, status, executed_at)
            VALUES (?, ?, ?, 'SELL', ?, ?, ?, 'EXECUTED', ?)
            """,
            (user_id, pos["ticker"], pos["order_type"], shares, current_price, pnl, now_str)
        )

        # Delete Position
        conn.execute("DELETE FROM paper_positions WHERE id = ?", (position_id,))
        conn.commit()

    write_audit_log("SELL", "paper_order", entity_id=position_id,
                    details=f"ticker={pos['ticker']} shares={shares} exit_price={current_price} pnl={pnl:.2f}",
                    user_id=user_id)
    return {"status": "CLOSED", "position_id": position_id, "ticker": pos["ticker"], "shares": shares, "exit_price": current_price, "realized_pnl": round(pnl, 2), "new_cash": round(new_cash, 2)}


def get_paper_trade_history(user_id: str = "default_user", limit: int = 50) -> list:
    """Returns past executed orders journal."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, user_id, ticker, order_type, action, shares, executed_price, realized_pnl, status, executed_at FROM paper_orders WHERE user_id = ? ORDER BY executed_at DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
    return [dict(r) for r in rows]


def reset_paper_account(user_id: str = "default_user") -> dict:
    """Resets paper trading account back to ₹1,000,000 and clears positions/orders."""
    now_str = datetime.now().isoformat()
    with get_db_connection() as conn:
        conn.execute("DELETE FROM paper_positions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM paper_orders WHERE user_id = ?", (user_id,))
        conn.execute("UPDATE paper_accounts SET cash_balance = 1000000.0, starting_balance = 1000000.0, updated_at = ? WHERE user_id = ?", (now_str, user_id))
        conn.commit()
    write_audit_log("RESET", "paper_account", details="reset to ₹10,00,000", user_id=user_id)
    return {"status": "RESET", "cash_balance": 1000000.0}


# ── Saved Screener Scans Functions ───────────────────────────────────────────

def add_saved_scan(name: str, filters: dict, description: str = None, user_id: str = "default_user") -> int:
    """Saves a custom screener filter preset."""
    import json as _json
    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO saved_scans (user_id, name, description, filters_json)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, name.strip(), description, _json.dumps(filters)),
        )
        conn.commit()
        row_id = cursor.lastrowid
    write_audit_log("CREATE", "saved_scan", entity_id=row_id, details=f"name={name}", user_id=user_id)
    return row_id


def get_saved_scans(user_id: str = "default_user") -> list:
    """Returns all saved screener scans for a user."""
    import json as _json
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, user_id, name, description, filters_json, created_at
            FROM saved_scans
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()
    result = []
    for r in rows:
        item = dict(r)
        try:
            item["filters"] = _json.loads(item["filters_json"] or "{}")
        except Exception:
            item["filters"] = {}
        result.append(item)
    return result


def delete_saved_scan(scan_id: int, user_id: str = "default_user") -> bool:
    """Deletes a saved screener scan by ID."""
    with get_db_connection() as conn:
        conn.execute("DELETE FROM saved_scans WHERE id = ? AND user_id = ?", (scan_id, user_id))
        conn.commit()
    write_audit_log("DELETE", "saved_scan", entity_id=scan_id, user_id=user_id)
    return True


# ── Model Registry Functions ─────────────────────────────────────────────────

def register_model_version(
    ticker: str, model_type: str, version: str, artifact_path: str,
    mape: float = None, rmse: float = None, metrics: dict = None
) -> int:
    """Registers a newly trained ML model artifact and metrics lineage."""
    import json as _json
    now_str = datetime.now().isoformat()
    with get_db_connection() as conn:
        # Mark previous versions as inactive for this ticker and model_type
        conn.execute(
            "UPDATE model_registry SET is_active = 0 WHERE ticker = ? AND model_type = ?",
            (ticker.upper(), model_type)
        )
        cursor = conn.execute(
            """
            INSERT INTO model_registry (ticker, model_type, version, artifact_path, mape, rmse, metrics_json, trained_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (ticker.upper(), model_type, version, artifact_path, mape, rmse, _json.dumps(metrics or {}), now_str)
        )
        conn.commit()
        row_id = cursor.lastrowid
    write_audit_log("REGISTER", "model_version", entity_id=row_id, details=f"ticker={ticker} type={model_type} v={version} mape={mape}")
    return row_id


def get_registered_models(ticker: str = None) -> list:
    """Returns registered model artifacts and accuracy metrics."""
    import json as _json
    with get_db_connection() as conn:
        if ticker:
            rows = conn.execute(
                "SELECT id, ticker, model_type, version, artifact_path, mape, rmse, metrics_json, trained_at, is_active "
                "FROM model_registry WHERE ticker = ? ORDER BY id DESC",
                (ticker.upper(),)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, ticker, model_type, version, artifact_path, mape, rmse, metrics_json, trained_at, is_active "
                "FROM model_registry ORDER BY id DESC LIMIT 100"
            ).fetchall()

    result = []
    for r in rows:
        item = dict(r)
        try:
            item["metrics"] = _json.loads(item["metrics_json"] or "{}")
        except Exception:
            item["metrics"] = {}
        result.append(item)
    return result


# ── Screener Platform Database Operations ────────────────────────────────────

def upsert_screener_daily_metric(row_data: dict) -> None:
    """Inserts or updates precomputed daily metrics for a ticker."""
    now_str = datetime.now().isoformat()
    ticker = str(row_data.get("ticker", "")).upper().strip()
    if not ticker:
        return

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO screener_daily_metrics (
                ticker, name, sector, industry, market_cap_cr, market_cap_cat,
                close_price, change_1d_pct, change_1w_pct, change_1m_pct, change_1y_pct,
                distance_52w_high_pct, distance_52w_low_pct, rsi_14, macd_signal,
                sma_20, sma_50, sma_200, volume_ratio_20d, pe_ratio, pb_ratio,
                roe_pct, roce_pct, debt_to_equity, sales_growth_3y, profit_growth_3y,
                pcr, max_pain, iv, ai_consensus_score, ai_signal, ai_confidence_score, updated_at
            ) VALUES (
                :ticker, :name, :sector, :industry, :market_cap_cr, :market_cap_cat,
                :close_price, :change_1d_pct, :change_1w_pct, :change_1m_pct, :change_1y_pct,
                :distance_52w_high_pct, :distance_52w_low_pct, :rsi_14, :macd_signal,
                :sma_20, :sma_50, :sma_200, :volume_ratio_20d, :pe_ratio, :pb_ratio,
                :roe_pct, :roce_pct, :debt_to_equity, :sales_growth_3y, :profit_growth_3y,
                :pcr, :max_pain, :iv, :ai_consensus_score, :ai_signal, :ai_confidence_score, :updated_at
            )
            ON CONFLICT(ticker) DO UPDATE SET
                name=excluded.name, sector=excluded.sector, industry=excluded.industry,
                market_cap_cr=excluded.market_cap_cr, market_cap_cat=excluded.market_cap_cat,
                close_price=excluded.close_price, change_1d_pct=excluded.change_1d_pct,
                change_1w_pct=excluded.change_1w_pct, change_1m_pct=excluded.change_1m_pct,
                change_1y_pct=excluded.change_1y_pct, distance_52w_high_pct=excluded.distance_52w_high_pct,
                distance_52w_low_pct=excluded.distance_52w_low_pct, rsi_14=excluded.rsi_14,
                macd_signal=excluded.macd_signal, sma_20=excluded.sma_20, sma_50=excluded.sma_50,
                sma_200=excluded.sma_200, volume_ratio_20d=excluded.volume_ratio_20d,
                pe_ratio=excluded.pe_ratio, pb_ratio=excluded.pb_ratio, roe_pct=excluded.roe_pct,
                roce_pct=excluded.roce_pct, debt_to_equity=excluded.debt_to_equity,
                sales_growth_3y=excluded.sales_growth_3y, profit_growth_3y=excluded.profit_growth_3y,
                pcr=excluded.pcr, max_pain=excluded.max_pain, iv=excluded.iv,
                ai_consensus_score=excluded.ai_consensus_score, ai_signal=excluded.ai_signal,
                ai_confidence_score=excluded.ai_confidence_score, updated_at=excluded.updated_at
            """,
            {
                "ticker": ticker,
                "name": row_data.get("name", ticker),
                "sector": row_data.get("sector"),
                "industry": row_data.get("industry"),
                "market_cap_cr": row_data.get("market_cap_cr", 10000.0),
                "market_cap_cat": row_data.get("market_cap_cat", "MID"),
                "close_price": float(row_data.get("close_price", 100.0)),
                "change_1d_pct": row_data.get("change_1d_pct", 0.0),
                "change_1w_pct": row_data.get("change_1w_pct", 0.0),
                "change_1m_pct": row_data.get("change_1m_pct", 0.0),
                "change_1y_pct": row_data.get("change_1y_pct", 0.0),
                "distance_52w_high_pct": row_data.get("distance_52w_high_pct", -5.0),
                "distance_52w_low_pct": row_data.get("distance_52w_low_pct", 25.0),
                "rsi_14": row_data.get("rsi_14", 50.0),
                "macd_signal": row_data.get("macd_signal", "BULLISH"),
                "sma_20": row_data.get("sma_20"),
                "sma_50": row_data.get("sma_50"),
                "sma_200": row_data.get("sma_200"),
                "volume_ratio_20d": row_data.get("volume_ratio_20d", 1.0),
                "pe_ratio": row_data.get("pe_ratio"),
                "pb_ratio": row_data.get("pb_ratio"),
                "roe_pct": row_data.get("roe_pct"),
                "roce_pct": row_data.get("roce_pct"),
                "debt_to_equity": row_data.get("debt_to_equity"),
                "sales_growth_3y": row_data.get("sales_growth_3y"),
                "profit_growth_3y": row_data.get("profit_growth_3y"),
                "pcr": row_data.get("pcr"),
                "max_pain": row_data.get("max_pain"),
                "iv": row_data.get("iv"),
                "ai_consensus_score": row_data.get("ai_consensus_score", 60.0),
                "ai_signal": row_data.get("ai_signal", "BUY"),
                "ai_confidence_score": row_data.get("ai_confidence_score", 75.0),
                "updated_at": now_str,
            }
        )
        conn.commit()


def execute_screener_sql_query(
    where_clause: str = "1=1",
    params: dict = None,
    sort_by: str = "market_cap_cr",
    sort_dir: str = "DESC",
    limit: int = 50,
    offset: int = 0
) -> dict:
    """Executes indexed SQL filter query against screener_daily_metrics table."""
    params = params or {}
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

    with get_db_connection() as conn:
        total = conn.execute(count_sql, params).fetchone()["total_count"]
        rows = conn.execute(query_sql, params).fetchall()

    return {
        "total": total,
        "count": len(rows),
        "results": [dict(r) for r in rows],
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
    import json as _json
    share_token = str(uuid.uuid4())[:12]
    now_str = datetime.now().isoformat()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO user_screens (
                user_id, name, description, formula_query, filter_ast_json,
                universe, sort_by, sort_dir, is_public, share_token, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id, name.strip(), description, formula_query,
                _json.dumps(filter_ast or {}), universe, sort_by, sort_dir,
                1 if is_public else 0, share_token, now_str, now_str
            )
        )
        conn.commit()
        row_id = cursor.lastrowid

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
    import json as _json
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, user_id, name, description, formula_query, filter_ast_json,
                   universe, sort_by, sort_dir, is_public, share_token, created_at, updated_at
            FROM user_screens
            WHERE user_id = ? OR is_public = 1
            ORDER BY id DESC
            """,
            (user_id,)
        ).fetchall()

    res = []
    for r in rows:
        item = dict(r)
        try:
            item["filter_ast"] = _json.loads(item["filter_ast_json"] or "{}")
        except Exception:
            item["filter_ast"] = {}
        res.append(item)
    return res


def get_user_screen_by_share_token(token: str) -> Optional[dict]:
    """Retrieves public screen by share token."""
    import json as _json
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, user_id, name, description, formula_query, filter_ast_json,
                   universe, sort_by, sort_dir, is_public, share_token, created_at
            FROM user_screens
            WHERE share_token = ?
            """,
            (token,)
        ).fetchone()

    if not row:
        return None
    item = dict(row)
    try:
        item["filter_ast"] = _json.loads(item["filter_ast_json"] or "{}")
    except Exception:
        item["filter_ast"] = {}
    return item


def delete_user_screen_query(screen_id: int, user_id: str = "default_user") -> bool:
    """Deletes a saved user screen."""
    with get_db_connection() as conn:
        conn.execute("DELETE FROM user_screens WHERE id = ? AND user_id = ?", (screen_id, user_id))
        conn.commit()
    write_audit_log("DELETE", "user_screen", entity_id=screen_id, user_id=user_id)
    return True




