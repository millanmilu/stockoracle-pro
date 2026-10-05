# StockOracle Pro - fetcher bootstrap, env & logging core (leaf module).
# Imported by the fetch_* siblings and re-exported by backend.data.fetcher.
# NEVER import backend.data.fetcher from here (import cycle).
#
# Loads .env before any sibling runs os.getenv(), builds the module logger,
# binds the IST zone, the third-party imports and the shared DB helpers.
import os
import time
import asyncio
import requests
import pyotp
import pandas as pd
import numpy as np
from threading import Lock
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

_IST = ZoneInfo("Asia/Kolkata")
from typing import Optional, Dict, Tuple
from dotenv import load_dotenv
from backend.core.logging import get_logger

logger = get_logger("stockoracle.fetcher")

# Load .env file automatically
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
else:
    load_dotenv()

from SmartApi import SmartConnect
from backend.data.market_calendar import is_trading_day
from backend.data.database import (
    save_historical_prices, get_historical_prices, get_history_coverage,
    save_company_info, get_company_info, get_stale_company_info,
    get_live_tick_ohlcv, save_stock_universe, search_stock_universe,
    get_stock_universe_token, purge_stale_partial_history,
    get_intraday_candles, save_intraday_candles,
)

# Clean any 1-row or partial fragment rows from historical_prices
try:
    purge_stale_partial_history(5)
except Exception as exc:
    logger.debug("Startup partial-history purge skipped: %s", exc)
