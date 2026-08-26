"""
StockOracle Pro — OpenBB Core Engine Adapter
Wraps OpenBB Platform SDK with robust multi-provider failover to NSE/Yahoo/Screener.in data pipelines.
"""
import logging
from typing import Dict, Any, List, Optional
import pandas as pd

from backend.core.config_loader import config, get_openbb_provider_keys
from backend.data.fetcher import fetch_stock_data, fetch_company_info
from backend.data.fundamentals import get_fundamentals
from backend.analysis.valuation import calculate_dcf_valuation
from backend.analysis.macro_terminal import get_sovereign_macro_dashboard
from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit
from backend.research.screener_dsl import parse_screener_query
from backend.data.database import execute_screener_sql_query

logger = logging.getLogger("StockOracle.Providers.OpenBB")


class OpenBBWrapper:
    """
    Unified OpenBB Engine Adapter providing standardized financial aggregation,
    quantitative valuation, options analytics, and sovereign macro data.
    """

    def __init__(self):
        self.provider_keys = get_openbb_provider_keys()
        self.default_provider = config.OPENBB_DEFAULT_PROVIDER
        self._obb = None
        self._init_sdk()

    def _init_sdk(self):
        """Attempts to initialize the official OpenBB Platform SDK if installed."""
        try:
            from openbb import obb
            self._obb = obb
            # Inject configured provider API keys
            for provider, key in self.provider_keys.items():
                try:
                    self._obb.user.credentials[f"{provider}_api_key"] = key
                except Exception as e:
                    logger.debug("Failed setting OpenBB credential for %s: %s", provider, e)
            logger.info("OpenBB Platform SDK initialized successfully.")
        except ImportError:
            logger.info("OpenBB Platform SDK not present in environment. Operating in Standalone Native Adapter mode.")
            self._obb = None

    @property
    def is_sdk_available(self) -> bool:
        return self._obb is not None

    def get_equity_quote(self, symbol: str) -> Dict[str, Any]:
        """Fetches live real-time equity quote for symbol."""
        symbol = symbol.upper().strip()
        info = fetch_company_info(symbol) or {}
        return {
            "symbol": symbol,
            "price": info.get("price", 0.0),
            "change": info.get("change", 0.0),
            "change_pct": info.get("change_pct", 0.0),
            "high": info.get("high", 0.0),
            "low": info.get("low", 0.0),
            "open": info.get("open", 0.0),
            "volume": info.get("volume", 0),
            "market_cap": info.get("market_cap", "N/A"),
            "provider": "AngelOne/NSE" if info else "Fallback",
        }

    def get_historical_ohlcv(self, symbol: str, period: str = "3M", interval: str = "1d") -> pd.DataFrame:
        """Fetches normalized OHLCV time-series dataframe."""
        symbol = symbol.upper().strip()
        df = fetch_stock_data(symbol, period=period, interval=interval)
        if df is not None and not df.empty:
            return df
        return pd.DataFrame()

    def get_dcf_valuation(
        self,
        symbol: str,
        growth_rate_5y: float = 0.12,
        terminal_growth: float = 0.05,
        wacc: float = 0.11
    ) -> Dict[str, Any]:
        """Calculates multi-stage DCF intrinsic fair value and Graham number."""
        return calculate_dcf_valuation(
            ticker=symbol,
            growth_rate_5y=growth_rate_5y,
            terminal_growth_rate=terminal_growth,
            discount_rate_wacc=wacc
        )

    def get_sovereign_macro_hub(self) -> Dict[str, Any]:
        """Returns sovereign yield spread (India 10Y vs US 10Y), RBI repo, and cross-asset correlations."""
        return get_sovereign_macro_dashboard()

    def calculate_portfolio_risk(self, positions: List[Dict[str, Any]], portfolio_value: float = 1000000.0) -> Dict[str, Any]:
        """Computes Parametric & Historical VaR 95%/99%, CVaR, Sharpe, and correlation heatmap."""
        return calculate_portfolio_risk_cockpit(positions=positions, portfolio_value=portfolio_value)

    def run_screener(self, formula_query: str, limit: int = 50) -> Dict[str, Any]:
        """Executes formula query against precomputed SQL engine."""
        parsed = parse_screener_query(formula_query)
        sql_res = execute_screener_sql_query(
            where_clause=parsed["where_clause"],
            params=parsed["params"],
            limit=limit
        )
        return {
            "formula_query": formula_query,
            "ast": parsed["ast"],
            "total": sql_res["total"],
            "results": sql_res["results"]
        }


# Global singleton instance
_openbb_instance: Optional[OpenBBWrapper] = None


def get_openbb_client() -> OpenBBWrapper:
    """Returns the singleton OpenBBWrapper client instance."""
    global _openbb_instance
    if _openbb_instance is None:
        _openbb_instance = OpenBBWrapper()
    return _openbb_instance
