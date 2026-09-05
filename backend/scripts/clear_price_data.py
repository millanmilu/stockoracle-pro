"""
StockOracle Pro — Database Price & Cache Purge Script
Safely purges historical candles, intraday candles, live ticks, and analysis caches
from BOTH SQLAlchemy (PostgreSQL in production) and local SQLite fallback.
Preserves stock_universe (token mapping) and broker_accounts!
"""
import os
import sqlite3
from sqlalchemy import text
from backend.shared.database import get_db_session, DATABASE_URL, IS_POSTGRES

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "stockoracle.db")

TABLES_TO_PURGE = [
    "historical_prices",
    "intraday_candles",
    "live_ticks",
    "company_info",
    "predictions",
    "screener_results",
    "screener_daily_metrics",
    "monte_carlo",
]

def purge_database():
    print(f"Purging database via SQLAlchemy: IS_POSTGRES={IS_POSTGRES}")
    with get_db_session() as session:
        for tbl in TABLES_TO_PURGE:
            try:
                cnt = session.execute(text(f'SELECT COUNT(*) FROM "{tbl}"')).scalar()
                session.execute(text(f'DELETE FROM "{tbl}"'))
                session.commit()
                print(f"  ✓ {tbl}: purged {cnt} rows (now 0)")
            except Exception as e:
                print(f"  - {tbl}: error ({e})")
                session.rollback()

        # Check stock_universe preserved
        try:
            univ_cnt = session.execute(text('SELECT COUNT(*) FROM "stock_universe"')).scalar()
            print(f"  ★ stock_universe preserved: {univ_cnt} tokens ready for on-demand fetch.")
        except Exception as e:
            print(f"  ⚠️ stock_universe check: {e}")

    # Also clean local SQLite fallback if it exists
    if os.path.exists(DB_PATH):
        print(f"Purging local SQLite fallback: {DB_PATH}")
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        for tbl in TABLES_TO_PURGE:
            try:
                cur.execute(f'DELETE FROM "{tbl}"')
            except sqlite3.OperationalError:
                pass
        conn.commit()
        cur.execute("VACUUM")
        conn.close()
        print("  ✓ SQLite fallback purged and vacuumed.")

    print("Purge completed successfully.")

if __name__ == "__main__":
    purge_database()
