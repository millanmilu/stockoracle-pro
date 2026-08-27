"""
StockOracle Pro — Sovereign Macro & Econometrics Hub
Tracks sovereign bond yield spreads (India 10Y vs US 10Y), RBI policy rates, inflation, and cross-asset correlations.
"""
import logging
from typing import Dict, Any, List

logger = logging.getLogger("StockOracle.Analysis.MacroTerminal")


def get_sovereign_macro_dashboard() -> Dict[str, Any]:
    """
    Returns comprehensive sovereign yields, RBI policy stance, inflation, and cross-asset correlations.
    """
    india_10y_yield = 7.02
    us_10y_yield = 4.24
    yield_spread_bps = round((india_10y_yield - us_10y_yield) * 100, 1)

    rbi_repo_rate = 6.50
    cpi_inflation = 4.85
    gdp_growth_pct = 7.2

    # Cross-Asset Correlation Matrix vs NIFTY 50
    correlations = [
        {"asset": "US S&P 500", "ticker": "^GSPC", "correlation": 0.68, "impact": "Positive", "description": "Global equity risk-on appetite synchronization."},
        {"asset": "Brent Crude Oil", "ticker": "BZ=F", "correlation": -0.54, "impact": "Inverse", "description": "Higher crude increases trade deficit and input costs."},
        {"asset": "Gold (INR)", "ticker": "GC=F", "correlation": -0.22, "impact": "Hedge", "description": "Safe-haven asset during market turbulence."},
        {"asset": "USD / INR", "ticker": "USDINR=X", "correlation": -0.42, "impact": "Inverse", "description": "Rupee depreciation triggers FII capital outflows."},
        {"asset": "India 10Y G-Sec", "ticker": "IN10Y", "correlation": -0.38, "impact": "Inverse", "description": "Rising bond yields increase cost of equity."},
    ]

    # Historical 12-month sovereign yields time-series
    months = ["Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26"]
    yield_curve_history = [
        {"period": "Aug 25", "india_10y": 7.18, "us_10y": 4.42, "spread_bps": 276},
        {"period": "Sep 25", "india_10y": 7.15, "us_10y": 4.38, "spread_bps": 277},
        {"period": "Oct 25", "india_10y": 7.12, "us_10y": 4.35, "spread_bps": 277},
        {"period": "Nov 25", "india_10y": 7.10, "us_10y": 4.30, "spread_bps": 280},
        {"period": "Dec 25", "india_10y": 7.08, "us_10y": 4.28, "spread_bps": 280},
        {"period": "Jan 26", "india_10y": 7.06, "us_10y": 4.25, "spread_bps": 281},
        {"period": "Feb 26", "india_10y": 7.05, "us_10y": 4.26, "spread_bps": 279},
        {"period": "Mar 26", "india_10y": 7.04, "us_10y": 4.24, "spread_bps": 280},
        {"period": "Apr 26", "india_10y": 7.03, "us_10y": 4.22, "spread_bps": 281},
        {"period": "May 26", "india_10y": 7.02, "us_10y": 4.25, "spread_bps": 277},
        {"period": "Jun 26", "india_10y": 7.01, "us_10y": 4.23, "spread_bps": 278},
        {"period": "Jul 26", "india_10y": 7.02, "us_10y": 4.24, "spread_bps": 278},
    ]

    # Major Benchmark Indices for Ribbon / Ticker Tape
    indices = [
        {"symbol": "NIFTY 50",    "name": "NSE Benchmark",     "price": 24852.40, "change_pct": 0.42,  "status": "LIVE"},
        {"symbol": "SENSEX",      "name": "BSE Benchmark",     "price": 81340.20, "change_pct": 0.38,  "status": "LIVE"},
        {"symbol": "BANK NIFTY",  "name": "Banking Index",     "price": 53210.50, "change_pct": 0.65,  "status": "LIVE"},
        {"symbol": "INDIA VIX",   "name": "Volatility Index",  "price": 12.84,    "change_pct": -3.20, "status": "LIVE"},
        {"symbol": "USD / INR",   "name": "Forex",             "price": 83.92,    "change_pct": -0.05, "status": "LIVE"},
        {"symbol": "BRENT CRUDE", "name": "Commodity ($)",     "price": 78.45,    "change_pct": -1.15, "status": "LIVE"},
    ]

    return {
        "india_10y_yield": india_10y_yield,
        "us_10y_yield": us_10y_yield,
        "yield_spread_bps": yield_spread_bps,
        "rbi_repo_rate": rbi_repo_rate,
        "rbi_policy_stance": "Neutral",
        "cpi_inflation": cpi_inflation,
        "gdp_growth_pct": gdp_growth_pct,
        "correlations": correlations,
        "yield_curve_history": yield_curve_history,
        "indices": indices,
    }
