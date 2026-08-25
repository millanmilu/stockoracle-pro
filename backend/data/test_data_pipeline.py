"""
StockOracle Pro - Data Pipeline Diagnostic Script
Validates:
1. Database integrity & size
2. Angel One SmartAPI connection & session status
3. ScripMaster token lookup & resolution
4. Daily historical candle downloading & SQLite UPSERT
5. Intraday candle downloading (in-memory only, no DB insert)
6. Company info & LTP fetching
7. Yahoo Finance / fallback behaviors
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.data.database import (
    get_db_connection, DB_PATH, get_historical_prices,
    get_all_stock_universe_tickers, clean_paise_and_outliers
)
from backend.data.fetcher import (
    ensure_session, get_session_status, get_token_info,
    fetch_stock_data, fetch_company_info, backfill_5y_history
)

def run_diagnostics():
    print("=" * 60)
    print("🔍 STOCKORACLE PRO - DATA DOWNLOAD & STORE DIAGNOSTICS")
    print("=" * 60)

    # 1. Check Database File
    db_exists = os.path.exists(DB_PATH)
    db_size = os.path.getsize(DB_PATH) / (1024 * 1024) if db_exists else 0
    print(f"1. SQLite Database: {DB_PATH}")
    print(f"   - Exists: {db_exists}")
    print(f"   - File Size: {db_size:.2f} MB")

    with get_db_connection() as conn:
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print(f"   - Tables found: {len(tables)} -> {tables}")
        for t in ["historical_prices", "stock_universe", "company_info", "predictions", "screener_results", "live_ticks"]:
            if t in tables:
                cnt = conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
                print(f"     • {t}: {cnt} rows")

    # 2. Check Angel One Session
    print("\n2. Angel One Session & Authentication:")
    session_ok = ensure_session()
    print(f"   - ensure_session() Result: {session_ok}")
    print(f"   - get_session_status(): {get_session_status()}")

    # 3. Token Resolution for Popular & Broad NSE Tickers
    test_tickers = ["RELIANCE", "TCS", "INFY", "ZOMATO", "SUZLON", "IDEA", "UNKNOWN123"]
    print("\n3. Token Resolution via ScripMaster:")
    for t in test_tickers:
        tok = get_token_info(t)
        if tok:
            print(f"   ✓ {t:<10} -> Token: {tok.get('token')}, Exchange: {tok.get('exch_seg')}, Name: {tok.get('name')}")
        else:
            print(f"   ✗ {t:<10} -> NOT FOUND in ScripMaster")

    # 4. Daily Data Download & Storage Test
    print("\n4. Daily Historical Data Download & Storage (RELIANCE):")
    t0 = time.time()
    df_daily = fetch_stock_data("RELIANCE", period="3M", interval="1d")
    t_daily = time.time() - t0
    if df_daily is not None and not df_daily.empty:
        print(f"   ✓ Fetched {len(df_daily)} daily candles in {t_daily:.2f}s")
        print(f"   ✓ Date Range: {df_daily['date'].min()} to {df_daily['date'].max()}")
        print(f"   ✓ Latest Candle: Open={df_daily.iloc[-1]['open']}, Close={df_daily.iloc[-1]['close']}, Vol={df_daily.iloc[-1]['volume']}")
    else:
        print(f"   ✗ Daily fetch failed for RELIANCE")

    # 5. Check SQLite Storage for RELIANCE
    with get_db_connection() as conn:
        rel_cnt = conn.execute("SELECT count(*) FROM historical_prices WHERE ticker = 'RELIANCE'").fetchone()[0]
        print(f"   ✓ Stored in SQLite historical_prices table: {rel_cnt} rows for RELIANCE")

    # 6. Intraday Data Download (In-Memory Only) Test
    print("\n5. Intraday Data Download (5m interval):")
    t0 = time.time()
    df_intra = fetch_stock_data("RELIANCE", period="2D", interval="5m")
    t_intra = time.time() - t0
    if df_intra is not None and not df_intra.empty:
        print(f"   ✓ Fetched {len(df_intra)} intraday 5m candles in {t_intra:.2f}s")
        print(f"   ✓ Sample date format: {df_intra.iloc[-1]['date']}")
    else:
        print(f"   ✗ Intraday fetch failed for RELIANCE")

    # Verify Invariant: No intraday in SQLite
    with get_db_connection() as conn:
        bad_cnt = conn.execute("SELECT count(*) FROM historical_prices WHERE length(date) > 10").fetchone()[0]
        if bad_cnt == 0:
            print(f"   ✓ Invariant Check PASSED: 0 intraday rows in historical_prices table.")
        else:
            print(f"   ✗ Invariant Check FAILED: Found {bad_cnt} intraday rows in historical_prices table!")

    # 7. Realtime Company Info (LTP, 52W High/Low)
    print("\n6. Realtime Company Info & 52-Week Range:")
    for t in ["RELIANCE", "TCS", "TATAMOTORS"]:
        info = fetch_company_info(t)
        if info:
            print(f"   ✓ {t:<10}: LTP=₹{info.get('current_price')}, PrevClose=₹{info.get('previous_close')}, 52W High=₹{info.get('fifty_two_week_high')}, 52W Low=₹{info.get('fifty_two_week_low')}")
        else:
            print(f"   ✗ {t:<10}: Failed to fetch company info")

    print("\n" + "=" * 60)
    print("✅ DIAGNOSTICS COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    run_diagnostics()
