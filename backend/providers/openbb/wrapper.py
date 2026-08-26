"""
StockOracle Pro — OpenBB Core Engine Adapter
Wraps OpenBB Platform SDK with robust multi-provider failover to NSE/Yahoo/Screener.in data pipelines.
"""
import logging
from typing import Dict, Any, List, Optional
import pandas as pd

from backend.shared.config import settings, get_openbb_provider_keys
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
    Executes via official OpenBB SDK when available, falling back seamlessly to native NSE engines.
    """

    def __init__(self):
        self.provider_keys = get_openbb_provider_keys()
        self.default_provider = settings.OPENBB_DEFAULT_PROVIDER
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
        except (ImportError, Exception) as e:
            logger.info("OpenBB Platform SDK not present or skipped (%s). Operating in Standalone Native Adapter mode.", e)
            self._obb = None

    @property
    def is_sdk_available(self) -> bool:
        return self._obb is not None

    def get_equity_quote(self, symbol: str) -> Dict[str, Any]:
        """Fetches live real-time equity quote for symbol with dual SDK and AngelOne/NSE support."""
        symbol = symbol.upper().strip()

        # 1. Try official OpenBB SDK if initialized
        if self._obb is not None:
            try:
                obb_sym = f"{symbol}.NS" if not symbol.endswith(".NS") else symbol
                res = self._obb.equity.price.quote(symbol=obb_sym, provider=self.default_provider)
                if res and hasattr(res, "results") and res.results:
                    item = res.results[0]
                    last_price = getattr(item, "last_price", None) or getattr(item, "price", 0.0)
                    if last_price and float(last_price) > 0:
                        return {
                            "symbol": symbol,
                            "price": float(last_price),
                            "change": float(getattr(item, "change", 0.0) or 0.0),
                            "change_pct": float(getattr(item, "percent_change", 0.0) or 0.0),
                            "high": float(getattr(item, "high", 0.0) or 0.0),
                            "low": float(getattr(item, "low", 0.0) or 0.0),
                            "open": float(getattr(item, "open", 0.0) or 0.0),
                            "volume": int(getattr(item, "volume", 0) or 0),
                            "market_cap": str(getattr(item, "market_cap", "N/A")),
                            "provider": f"OpenBB-{self.default_provider}",
                        }
            except Exception as e:
                logger.debug("OpenBB SDK quote failed for %s: %s. Falling back to native feed.", symbol, e)

        # 2. Native high-fidelity AngelOne / DB / Yahoo fallback
        info = fetch_company_info(symbol) or {}
        price = float(info.get("current_price") or info.get("price") or 0.0)
        prev_close = float(info.get("previous_close") or 0.0)
        high = float(info.get("day_high") or info.get("high") or price)
        low = float(info.get("day_low") or info.get("low") or price)
        open_val = float(info.get("open") or info.get("day_open") or price)
        volume = int(info.get("volume") or 0)

        # Compute change accurately if previous close is known
        if price > 0 and prev_close > 0:
            change = round(price - prev_close, 2)
            change_pct = round((change / prev_close) * 100, 2)
        else:
            change = float(info.get("change", 0.0))
            change_pct = float(info.get("change_pct", 0.0))

        return {
            "symbol": symbol,
            "price": price,
            "change": change,
            "change_pct": change_pct,
            "high": high,
            "low": low,
            "open": open_val,
            "volume": volume,
            "market_cap": info.get("market_cap", "N/A"),
            "provider": "AngelOne/NSE" if info else "Native Fallback",
        }

    def get_historical_ohlcv(self, symbol: str, period: str = "3M", interval: str = "1d") -> pd.DataFrame:
        """Fetches normalized OHLCV time-series dataframe via OpenBB SDK or native fetcher."""
        symbol = symbol.upper().strip()

        # 1. Try OpenBB SDK
        if self._obb is not None:
            try:
                obb_sym = f"{symbol}.NS" if not symbol.endswith(".NS") else symbol
                res = self._obb.equity.price.historical(symbol=obb_sym, interval=interval, provider=self.default_provider)
                if res and hasattr(res, "to_df"):
                    df = res.to_df()
                    if df is not None and not df.empty:
                        # Normalize columns
                        df.columns = [c.lower() for c in df.columns]
                        return df
            except Exception as e:
                logger.debug("OpenBB SDK historical failed for %s: %s. Falling back to native fetcher.", symbol, e)

        # 2. Native high-fidelity fetcher
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
