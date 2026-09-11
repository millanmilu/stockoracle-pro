"""
StockOracle Pro — API Data-Quality Guards

Provides reusable helpers that enforce data-source integrity at the API
router level.  Any endpoint that feeds price data into ML training,
backtesting, or analytics MUST call require_real_data() before proceeding.

Background
----------
fetch_stock_data() cascades through several sources:
    1. Memory cache
    2. SQLite historical records
    3. Angel One broker API
    4. Stale SQLite fallback

Previously a fifth path — _synthesize_fallback_candles — generated a
random-walk OHLCV DataFrame and returned it silently.  That path has been
removed.  This guard file exists as an additional safety net: if any future
code reintroduces synthetic generation, the tag check here will block it
from reaching compute-heavy consumers.

Synthetic source keys (kept here as a single source of truth):
    "synthesized"                — set inside the old generator function
    "synthesized_market_baseline"— set at the fetch_stock_data call site
"""

import logging
from typing import Optional

import pandas as pd
from fastapi import HTTPException

logger = logging.getLogger("StockOracle.API.Guards")

# All data_source values that indicate synthesized / random-walk data.
_SYNTHETIC_SOURCES: frozenset = frozenset(
    {"synthesized", "synthesized_market_baseline"}
)


def require_real_data(
    df: Optional[pd.DataFrame],
    ticker: str,
    endpoint: str,
) -> None:
    """
    Raise HTTP 503 if *df* originated from a synthetic / random-walk source.

    This must be called immediately after fetch_stock_data() and the standard
    None/empty check in every endpoint that feeds data into:
      - ML predictor / trainer
      - Backtester
      - Monte Carlo simulation
      - Pattern detection
      - Volatility / support-resistance analytics
      - Screener metric computation
      - AI consensus engine

    Parameters
    ----------
    df:
        The DataFrame returned by fetch_stock_data().  May be None — the
        caller's None/empty guard should already have raised 404 before
        reaching this call, but we handle it defensively.
    ticker:
        NSE ticker symbol for logging / error context.
    endpoint:
        Short name of the calling endpoint, e.g. ``"backtest"`` or
        ``"predict"``.  Used in the error detail so the client knows which
        operation was blocked.

    Raises
    ------
    HTTPException(503)
        When the DataFrame's ``data_source`` attribute is synthetic.
    """
    if df is None:
        # Caller should already have raised 404; guard is a no-op here.
        return

    source: str = df.attrs.get("data_source") or "unknown"

    if source in _SYNTHETIC_SOURCES:
        logger.warning(
            "Blocked %s/%s — data_source='%s' (synthetic). "
            "Broker offline or no verified historical records available.",
            endpoint,
            ticker,
            source,
        )
        raise HTTPException(
            status_code=503,
            detail={
                "error": "data_unavailable",
                "ticker": ticker,
                "endpoint": endpoint,
                "data_source": source,
                "message": (
                    f"Verified market data for '{ticker}' is currently unavailable "
                    f"(broker offline or no cached records exist). "
                    f"The '{endpoint}' endpoint requires real OHLCV data and will not "
                    f"operate on synthesized prices. "
                    f"Please retry once the broker connection is restored."
                ),
            },
        )
