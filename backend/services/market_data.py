"""
StockOracle Pro — MarketDataService
Central async market-data service integrating OpenBB SDK, AngelOne/NSE live feeds,
Screener.in fundamentals, and NSE options chain with multi-layer TTL caching.

This is the canonical PHASE 2 Backend Data Engine described in the architecture doc.
"""
import asyncio
import time
import logging
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd

from backend.shared.config import settings, get_openbb_provider_keys
from backend.data.fetcher import fetch_stock_data, fetch_company_info
from backend.analysis.valuation import calculate_dcf_valuation
from backend.analysis.macro_terminal import get_sovereign_macro_dashboard
from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit
from backend.data.fundamentals import get_fundamentals
from backend.data.options import get_options_chain

logger = logging.getLogger("StockOracle.MarketDataService")


class MarketDataService:
    """
    High-performance async market-data broker.

    Features:
    - OpenBB SDK dual-dispatch with native NSE fallover
    - In-memory TTL cache (15s quotes, 60s OHLCV, 4h fundamentals)
    - Thread-pool offloading for all blocking I/O
    - Graceful degradation — never throws, always returns a dict/df
    """

    _QUOTE_TTL      = 15.0       # 15 seconds  — live quotes
    _OHLCV_TTL      = 60.0       # 1 minute    — historical bars
    _FUNDAMENTALS_TTL = 14400.0  # 4 hours     — balance sheet / ratios
    _OPTIONS_TTL    = 120.0      # 2 minutes   — options chain

    def __init__(self):
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._obb = None
        self._init_openbb_sdk()

    # ──────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────

    def _init_openbb_sdk(self) -> None:
        """Attempt to initialize the OpenBB Platform SDK (optional)."""
        try:
            from openbb import obb
            self._obb = obb
            for prov, key in get_openbb_provider_keys().items():
                try:
                    self._obb.user.credentials[f"{prov}_api_key"] = key
                except Exception:
                    pass
            logger.info("OpenBB SDK active in MarketDataService.")
        except Exception as e:
            logger.debug("OpenBB SDK unavailable (%s). Native engine active.", e)
            self._obb = None

    def _cache_get(self, key: str, ttl: float) -> Optional[Any]:
        """Returns cached value if still fresh, else None."""
        entry = self._cache.get(key)
        if entry is not None:
            ts, val = entry
            if time.time() - ts < ttl:
                return val
        return None

    def _cache_set(self, key: str, val: Any) -> None:
        self._cache[key] = (time.time(), val)

    async def _run(self, fn, *args, **kwargs) -> Any:
        """Offload synchronous blocking I/O to default ThreadPoolExecutor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    # ──────────────────────────────────────────────────────────────────────
    # Public Async API
    # ──────────────────────────────────────────────────────────────────────

    async def get_live_quote(self, symbol: str) -> Dict[str, Any]:
        """
        Real-time equity quote.
        Priority: OpenBB SDK → AngelOne/NSE → DB cached close.
        """
        symbol = symbol.upper().strip()
        cached = self._cache_get(f"quote:{symbol}", self._QUOTE_TTL)
        if cached is not None:
            return cached

        # 1. Try OpenBB SDK
        if self._obb is not None:
            try:
                obb_sym = f"{symbol}.NS" if not symbol.endswith(".NS") else symbol
                res = await self._run(
                    self._obb.equity.price.quote,
                    symbol=obb_sym,
                    provider=settings.OPENBB_DEFAULT_PROVIDER,
                )
                if res and hasattr(res, "results") and res.results:
                    item = res.results[0]
                    price = float(getattr(item, "last_price", None) or getattr(item, "price", 0) or 0)
                    if price > 0:
                        result = {
                            "symbol":     symbol,
                            "price":      price,
                            "change":     float(getattr(item, "change", 0) or 0),
                            "change_pct": float(getattr(item, "percent_change", 0) or 0),
                            "high":       float(getattr(item, "high", 0) or 0),
                            "low":        float(getattr(item, "low", 0) or 0),
                            "open":       float(getattr(item, "open", 0) or 0),
                            "volume":     int(getattr(item, "volume", 0) or 0),
                            "provider":   f"OpenBB-{settings.OPENBB_DEFAULT_PROVIDER}",
                            "timestamp":  time.strftime("%H:%M:%S"),
                        }
                        self._cache_set(f"quote:{symbol}", result)
                        return result
            except Exception as e:
                logger.debug("OpenBB quote failed for %s: %s", symbol, e)

        # 2. Native AngelOne / Yahoo fallback
        info = await self._run(fetch_company_info, symbol) or {}
        price      = float(info.get("current_price") or info.get("price") or 0.0)
        prev_close = float(info.get("previous_close") or 0.0)
        high       = float(info.get("day_high") or info.get("high") or price)
        low        = float(info.get("day_low") or info.get("low") or price)
        open_val   = float(info.get("open") or info.get("day_open") or price)
        volume     = int(info.get("volume") or 0)

        if price > 0 and prev_close > 0:
            change     = round(price - prev_close, 2)
            change_pct = round((change / prev_close) * 100, 2)
        else:
            change     = float(info.get("change", 0.0))
            change_pct = float(info.get("change_pct", 0.0))

        result = {
            "symbol":     symbol,
            "price":      price,
            "change":     change,
            "change_pct": change_pct,
            "high":       high,
            "low":        low,
            "open":       open_val,
            "volume":     volume,
            "provider":   "AngelOne/NSE" if info else "Native Fallback",
            "timestamp":  time.strftime("%H:%M:%S"),
        }
        self._cache_set(f"quote:{symbol}", result)
        return result

    async def get_ohlcv(self, symbol: str, period: str = "3M", interval: str = "1d") -> pd.DataFrame:
        """
        Historical OHLCV bars.
        Priority: OpenBB SDK → native fetcher (yfinance / DB).
        """
        symbol = symbol.upper().strip()
        key    = f"ohlcv:{symbol}:{period}:{interval}"
        cached = self._cache_get(key, self._OHLCV_TTL)
        if cached is not None:
            return cached

        df: Optional[pd.DataFrame] = None

        # 1. Try OpenBB SDK
        if self._obb is not None:
            try:
                obb_sym = f"{symbol}.NS" if not symbol.endswith(".NS") else symbol
                res = await self._run(
                    self._obb.equity.price.historical,
                    symbol=obb_sym,
                    interval=interval,
                    provider=settings.OPENBB_DEFAULT_PROVIDER,
                )
                if res and hasattr(res, "to_df"):
                    tmp = res.to_df()
                    if tmp is not None and not tmp.empty:
                        tmp.columns = [c.lower() for c in tmp.columns]
                        df = tmp
            except Exception as e:
                logger.debug("OpenBB historical failed for %s: %s", symbol, e)

        # 2. Native fetcher
        if df is None or df.empty:
            df = await self._run(fetch_stock_data, symbol, period, interval)

        if df is None:
            df = pd.DataFrame()

        self._cache_set(key, df)
        return df

    async def get_fundamentals(self, symbol: str) -> Dict[str, Any]:
        """
        Company fundamentals from Screener.in (P/E, P/B, EPS, ROE, Debt/Equity, promoter %).
        Cached for 4 hours.
        """
        symbol = symbol.upper().strip()
        key    = f"fundamentals:{symbol}"
        cached = self._cache_get(key, self._FUNDAMENTALS_TTL)
        if cached is not None:
            return cached

        data = await self._run(get_fundamentals, symbol)
        self._cache_set(key, data or {})
        return data or {}

    async def get_dcf_valuation(
        self,
        symbol: str,
        growth: float = 0.12,
        terminal_growth: float = 0.05,
        wacc: float = 0.11,
    ) -> Dict[str, Any]:
        """Multi-stage DCF + Graham Number valuation."""
        key    = f"dcf:{symbol}:{growth}:{wacc}"
        cached = self._cache_get(key, self._FUNDAMENTALS_TTL)
        if cached is not None:
            return cached

        result = await self._run(calculate_dcf_valuation, symbol, growth, terminal_growth, wacc)
        self._cache_set(key, result or {})
        return result or {}

    async def get_options_chain(self, symbol: str, expiry: Optional[str] = None) -> Dict[str, Any]:
        """
        NSE Options chain with max pain and Put/Call Ratio.
        Cached for 2 minutes.
        """
        symbol = symbol.upper().strip()
        key    = f"options:{symbol}:{expiry}"
        cached = self._cache_get(key, self._OPTIONS_TTL)
        if cached is not None:
            return cached

        data = await self._run(get_options_chain, symbol)
        self._cache_set(key, data or {"error": "Options unavailable"})
        return data or {"error": "Options unavailable"}

    async def get_macro_dashboard(self) -> Dict[str, Any]:
        """Sovereign yields, RBI repo rate, and cross-asset macro data."""
        cached = self._cache_get("macro:global", self._FUNDAMENTALS_TTL)
        if cached is not None:
            return cached

        data = await self._run(get_sovereign_macro_dashboard)
        self._cache_set("macro:global", data or {})
        return data or {}

    async def get_portfolio_risk(
        self,
        positions: List[Dict[str, Any]],
        portfolio_value: float = 1_000_000.0,
    ) -> Dict[str, Any]:
        """Parametric & Historical VaR 95%/99%, CVaR, Sharpe, Beta."""
        return await self._run(calculate_portfolio_risk_cockpit, positions, portfolio_value)

    async def get_multi_quote(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """Fetch quotes for multiple symbols concurrently."""
        tasks = [self.get_live_quote(sym) for sym in symbols]
        return list(await asyncio.gather(*tasks, return_exceptions=False))


# ─────────────────────────────────────────────────────────────────────────────
# Singleton accessor
# ─────────────────────────────────────────────────────────────────────────────
_market_data_service: Optional[MarketDataService] = None


def get_market_data_service() -> MarketDataService:
    """Returns the application-wide MarketDataService singleton."""
    global _market_data_service
    if _market_data_service is None:
        _market_data_service = MarketDataService()
    return _market_data_service
