import os
import sqlite3
import pandas as pd
from datetime import datetime
from typing import Optional

# Absolute path for the SQLite database file
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stockoracle.db")

def get_db_connection() -> sqlite3.Connection:
    """Returns a connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema and creates tables if they do not exist."""
    print(f"📦 Initializing SQLite database at: {DB_PATH}")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Historical Prices Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS historical_prices (
                ticker TEXT,
                date TEXT,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume INTEGER,
                PRIMARY KEY (ticker, date)
            )
        """)
        
        # Index for faster range query lookups
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hist_ticker_date ON historical_prices (ticker, date)")
        
        # 2. Live Ticks Table (for WebSocket streaming records)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS live_ticks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT,
                timestamp TEXT,
                price REAL,
                change_pct REAL
            )
        """)
        
        # Index for live tick analytics
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ticks_ticker_time ON live_ticks (ticker, timestamp)")
        
        conn.commit()
    print("✅ SQLite database initialization complete.")

def save_historical_prices(ticker: str, df: pd.DataFrame):
    """
    Saves a DataFrame of historical prices into the SQLite database.
    Updates existing records if dates overlap (UPSERT).
    """
    if df is None or df.empty:
        return
        
    ticker = ticker.upper()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for _, row in df.iterrows():
            cursor.execute("""
                INSERT OR REPLACE INTO historical_prices (ticker, date, open, high, low, close, volume)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                ticker,
                str(row["date"]),
                float(row["open"]),
                float(row["high"]),
                float(row["low"]),
                float(row["close"]),
                int(row["volume"])
            ))
        conn.commit()

def get_historical_prices(ticker: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
    """
    Fetches historical price records for a ticker within a date range from the database.
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
        
    if df.empty:
        return None
        
    return df

def save_live_tick(ticker: str, price: float, change_pct: float):
    """Saves a single live tick update to the database."""
    ticker = ticker.upper()
    timestamp = datetime.now().isoformat()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO live_ticks (ticker, timestamp, price, change_pct)
                VALUES (?, ?, ?, ?)
            """, (ticker, timestamp, price, change_pct))
            conn.commit()
    except Exception as e:
        print(f"Error saving live tick to database: {e}")
