"""
StockOracle Pro - NSE Stock Universe Seeder
Downloads the complete Angel One ScripMaster and indexes all 2000+ NSE equity symbols into SQLite.
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.data.fetcher import _load_scrip_master
from backend.data.database import get_all_stock_universe_tickers

def main():
    print("🚀 Starting NSE Stock Universe Seeding...")
    _load_scrip_master(force=True)
    tickers = get_all_stock_universe_tickers(limit=5000)
    print(f"✅ Total indexed NSE stocks in database: {len(tickers)}")

if __name__ == "__main__":
    main()
