"""
StockOracle Pro — OpenBB & Market Data Async Terminal Service
Dedicated asynchronous financial data broker with TTL caching and multi-provider failover.
"""
import asyncio
import time
import logging
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd
import numpy as np

from backend.shared.config import settings, get_openbb_provider_keys
from backend.data.fetcher import fetch_stock_data, fetch_company_info
from backend.analysis.valuation import calculate_dcf_valuation
from backend.analysis.macro_terminal import get_sovereign_macro_dashboard
from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit
from backend.analysis.options_lab import calculate_strategy_payoff
from backend.research.screener_dsl import parse_screener_query
from backend.data.database import execute_screener_sql_query

logger = logging.getLogger("StockOracle.TerminalService")


class AsyncTerminalDataService:
    """
    High-performance asynchronous data manager for the Terminal UI.
    Provides non-blocking data fetching with memory caching and real-time streaming.
    """

    def __init__(self):
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._cache_ttl = 15.0  # 15 seconds cache for real-time responsiveness
        self._obb = None
        self._init_sdk()

    def _init_sdk(self):
        """Attempts initialization of OpenBB Platform SDK."""
        try:
            from openbb import obb
            self._obb = obb
            keys = get_openbb_provider_keys()
            for prov, k in keys.items():
                try:
                    self._obb.user.credentials[f"{prov}_api_key"] = k
                except Exception:
                    pass
            logger.info("OpenBB Platform SDK active in Terminal Service.")
        except Exception as e:
            logger.debug("OpenBB SDK not installed: %s. Using Native Quant Engine.", e)
            self._obb = None

    async def get_live_quote_async(self, symbol: str) -> Dict[str, Any]:
        """Asynchronously fetches real-time quote without blocking the UI event loop."""
        symbol = symbol.upper().strip()
        cache_key = f"quote_{symbol}"
        now = time.time()

        if cache_key in self._cache:
            ts, val = self._cache[cache_key]
            if now - ts < self._cache_ttl:
                return val

        # Offload sync I/O to thread pool
        loop = asyncio.get_running_loop()
        info = await loop.run_in_executor(None, fetch_company_info, symbol) or {}

        price = float(info.get("current_price") or info.get("price") or 0.0)
        prev_close = float(info.get("previous_close") or 0.0)
        high = float(info.get("day_high") or info.get("high") or price)
        low = float(info.get("day_low") or info.get("low") or price)
        open_val = float(info.get("open") or info.get("day_open") or price)
        volume = int(info.get("volume") or 0)

        if price > 0 and prev_close > 0:
            change = round(price - prev_close, 2)
            change_pct = round((change / prev_close) * 100, 2)
        else:
            change = float(info.get("change", 0.0))
            change_pct = float(info.get("change_pct", 0.0))

        result = {
            "symbol": symbol,
            "price": price,
            "change": change,
            "change_pct": change_pct,
            "high": high,
            "low": low,
            "open": open_val,
            "volume": volume,
            "provider": "AngelOne/NSE" if info else "Native Engine",
            "timestamp": time.strftime("%H:%M:%S")
        }
        self._cache[cache_key] = (now, result)
        return result

    async def get_ohlcv_history_async(self, symbol: str, period: str = "3M") -> pd.DataFrame:
        """Asynchronously fetches historical OHLCV data."""
        symbol = symbol.upper().strip()
        cache_key = f"ohlcv_{symbol}_{period}"
        now = time.time()

        if cache_key in self._cache:
            ts, df = self._cache[cache_key]
            if now - ts < 60.0:  # 1 min cache for history
                return df

        loop = asyncio.get_running_loop()
        df = await loop.run_in_executor(None, fetch_stock_data, symbol, period, "1d")
        if df is None or df.empty:
            df = pd.DataFrame()
        self._cache[cache_key] = (now, df)
        return df

    async def get_dcf_valuation_async(self, symbol: str, growth: float = 0.12, wacc: float = 0.11) -> Dict[str, Any]:
        """Asynchronously calculates DCF and Graham Number."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, calculate_dcf_valuation, symbol, growth, 0.05, wacc
        )

    async def get_macro_hub_async(self) -> Dict[str, Any]:
        """Asynchronously retrieves sovereign yields and inflation."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, get_sovereign_macro_dashboard)

    async def get_portfolio_risk_async(self, positions: List[Dict[str, Any]], value: float = 1000000.0) -> Dict[str, Any]:
        """Asynchronously computes Value at Risk (VaR 95%/99%) and Correlation Matrix."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, calculate_portfolio_risk_cockpit, positions, value
        )

    async def get_options_payoff_async(self, symbol: str, strategy: str = "BULL_CALL_SPREAD") -> Dict[str, Any]:
        """Asynchronously computes multi-leg options strategy payoff."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, calculate_strategy_payoff, symbol, strategy, 1317.0, None
        )


# Global singleton
_terminal_service: Optional[AsyncTerminalDataService] = None


def get_terminal_data_service() -> AsyncTerminalDataService:
    global _terminal_service
    if _terminal_service is None:
        _terminal_service = AsyncTerminalDataService()
    return _terminal_service
