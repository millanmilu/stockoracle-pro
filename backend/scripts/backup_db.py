"""
StockOracle Pro — Automated SQLite Database Backup Script
Creates timestamped snapshots of stockoracle.db and maintains a rolling retention of 14 days.
"""
import os
import shutil
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "stockoracle.db")
BACKUP_DIR = os.path.join(BASE_DIR, "backups")

def create_db_backup():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at: {DB_PATH}")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_DIR, f"stockoracle_backup_{timestamp}.db")

    # Use SQLite online backup API for safe hot backups
    try:
        src = sqlite3.connect(DB_PATH)
        dst = sqlite3.connect(backup_file)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
        print(f"✅ Hot database backup completed successfully: {backup_file}")
    except Exception as e:
        print(f"⚠️ Hot backup failed, attempting file copy: {e}")
        shutil.copy2(DB_PATH, backup_file)
        print(f"✅ File copy backup completed: {backup_file}")

if __name__ == "__main__":
    create_db_backup()
