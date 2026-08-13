"""
supply_chain.py — Supply Chain Analysis
Maps upstream (suppliers) and downstream (customers/partners) relationships
for NSE-listed companies using a curated knowledge base.
Computes rolling price correlations between the target stock and its chain.
"""

import logging
import math
from typing import Dict, Any, List, Optional

logger = logging.getLogger("stockoracle.supply_chain")

# ── Curated NSE Supply Chain Knowledge Base ──────────────────────────────────
# Format: ticker → {upstream: [...], downstream: [...], sector: str}
# Based on publicly available annual reports, SEBI disclosures, and sector analysis.
SUPPLY_CHAIN_MAP: Dict[str, Dict] = {
    "RELIANCE": {
        "sector": "Energy / Conglomerate",
        "upstream": [
            {"ticker": "ONGC",       "name": "Oil & Natural Gas Corp",   "relationship": "Crude oil supplier"},
            {"ticker": "IOC",        "name": "Indian Oil Corporation",   "relationship": "Refining peer / feedstock"},
            {"ticker": "BPCL",       "name": "Bharat Petroleum",         "relationship": "Downstream peer"},
        ],
        "downstream": [
            {"ticker": "BHARTIARTL", "name": "Bharti Airtel",            "relationship": "Telecom competitor (Jio)"},
            {"ticker": "ITC",        "name": "ITC Limited",              "relationship": "FMCG competitor (retail)"},
            {"ticker": "TCS",        "name": "Tata Consultancy Services","relationship": "Tech partner / IT services"},
        ]
    },
    "TCS": {
        "sector": "Information Technology",
        "upstream": [
            {"ticker": "INFY",       "name": "Infosys",                  "relationship": "Industry peer / talent pool"},
            {"ticker": "HCLTECH",    "name": "HCL Technologies",         "relationship": "IT services peer"},
            {"ticker": "WIPRO",      "name": "Wipro",                    "relationship": "IT services peer"},
        ],
        "downstream": [
            {"ticker": "HDFCBANK",   "name": "HDFC Bank",                "relationship": "Major banking client"},
            {"ticker": "ICICIBANK",  "name": "ICICI Bank",               "relationship": "Banking sector client"},
            {"ticker": "RELIANCE",   "name": "Reliance Industries",      "relationship": "Enterprise client (Jio)"},
        ]
    },
    "HDFCBANK": {
        "sector": "Banking & Finance",
        "upstream": [
            {"ticker": "SBIN",       "name": "State Bank of India",      "relationship": "Interbank peer / liquidity"},
            {"ticker": "ICICIBANK",  "name": "ICICI Bank",               "relationship": "Banking sector peer"},
            {"ticker": "AXISBANK",   "name": "Axis Bank",                "relationship": "Banking sector peer"},
        ],
        "downstream": [
            {"ticker": "TCS",        "name": "Tata Consultancy Services","relationship": "Core banking tech provider"},
            {"ticker": "INFY",       "name": "Infosys",                  "relationship": "IT services partner"},
            {"ticker": "LT",         "name": "Larsen & Toubro",          "relationship": "Infrastructure loan client"},
        ]
    },
    "INFY": {
        "sector": "Information Technology",
        "upstream": [
            {"ticker": "TCS",        "name": "Tata Consultancy Services","relationship": "Industry peer"},
            {"ticker": "WIPRO",      "name": "Wipro",                    "relationship": "IT services peer"},
            {"ticker": "HCLTECH",    "name": "HCL Technologies",         "relationship": "IT services peer"},
        ],
        "downstream": [
            {"ticker": "HDFCBANK",   "name": "HDFC Bank",                "relationship": "Banking sector client"},
            {"ticker": "ICICIBANK",  "name": "ICICI Bank",               "relationship": "Banking sector client"},
        ]
    },
    "ICICIBANK": {
        "sector": "Banking & Finance",
        "upstream": [
            {"ticker": "SBIN",       "name": "State Bank of India",      "relationship": "Interbank peer"},
            {"ticker": "HDFCBANK",   "name": "HDFC Bank",                "relationship": "Banking peer"},
            {"ticker": "AXISBANK",   "name": "Axis Bank",                "relationship": "Banking peer"},
        ],
        "downstream": [
            {"ticker": "TCS",        "name": "TCS",                      "relationship": "IT partner"},
            {"ticker": "INFY",       "name": "Infosys",                  "relationship": "IT partner"},
        ]
    },
    "SBIN": {
        "sector": "Banking & Finance (PSU)",
        "upstream": [
            {"ticker": "HDFCBANK",   "name": "HDFC Bank",                "relationship": "Private sector peer"},
            {"ticker": "ICICIBANK",  "name": "ICICI Bank",               "relationship": "Private sector peer"},
        ],
        "downstream": [
            {"ticker": "LT",         "name": "Larsen & Toubro",          "relationship": "Infra project financing"},
            {"ticker": "RELIANCE",   "name": "Reliance Industries",      "relationship": "Corporate loan client"},
            {"ticker": "BHARTIARTL", "name": "Bharti Airtel",            "relationship": "Telecom financing"},
        ]
    },
    "BHARTIARTL": {
        "sector": "Telecom",
        "upstream": [
            {"ticker": "RELIANCE",   "name": "Reliance (Jio)",           "relationship": "Telecom competitor / spectrum peer"},
            {"ticker": "LT",         "name": "Larsen & Toubro",          "relationship": "Network infrastructure provider"},
        ],
        "downstream": [
            {"ticker": "HDFCBANK",   "name": "HDFC Bank",                "relationship": "Fintech partner (Airtel Payments)"},
            {"ticker": "INFY",       "name": "Infosys",                  "relationship": "IT services partner"},
        ]
    },
    "ITC": {
        "sector": "FMCG / Conglomerate",
        "upstream": [
            {"ticker": "HUL",        "name": "Hindustan Unilever",       "relationship": "FMCG competitor"},
        ],
        "downstream": [
            {"ticker": "RELIANCE",   "name": "Reliance Retail",          "relationship": "Retail distribution channel"},
        ]
    },
    "LT": {
        "sector": "Infrastructure / Engineering",
        "upstream": [
            {"ticker": "SBIN",       "name": "State Bank of India",      "relationship": "Project financing"},
            {"ticker": "HDFCBANK",   "name": "HDFC Bank",                "relationship": "Project financing"},
        ],
        "downstream": [
            {"ticker": "TCS",        "name": "TCS",                      "relationship": "IT arm (L&T Technology)"},
            {"ticker": "BHARTIARTL", "name": "Bharti Airtel",            "relationship": "Telecom infrastructure client"},
        ]
    },
    "HUL": {
        "sector": "FMCG",
        "upstream": [
            {"ticker": "ITC",        "name": "ITC Limited",              "relationship": "FMCG competitor"},
        ],
        "downstream": [
            {"ticker": "RELIANCE",   "name": "Reliance Retail",          "relationship": "Distribution channel"},
        ]
    },
}

# Default fallback for unknown tickers
_DEFAULT_CHAIN = {
    "sector": "Diversified",
    "upstream": [
        {"ticker": "RELIANCE", "name": "Reliance Industries", "relationship": "Market leader / sector bellwether"},
        {"ticker": "HDFCBANK", "name": "HDFC Bank",           "relationship": "Banking partner"},
    ],
    "downstream": [
        {"ticker": "TCS",  "name": "Tata Consultancy Services", "relationship": "Technology partner"},
        {"ticker": "INFY", "name": "Infosys",                   "relationship": "IT services partner"},
    ]
}


def _pearson_correlation(xs: List[float], ys: List[float]) -> float:
    """Computes Pearson correlation coefficient between two return series."""
    n = min(len(xs), len(ys))
    if n < 5:
        return 0.0
    xs, ys = xs[-n:], ys[-n:]
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
    if den_x == 0 or den_y == 0:
        return 0.0
    return round(num / (den_x * den_y), 4)


def _get_price_returns(ticker: str, period: str = "3M") -> Optional[List[float]]:
    """Returns a list of daily % returns for the given ticker."""
    try:
        from backend.data.fetcher import fetch_stock_data
        df = fetch_stock_data(ticker, period=period)
        if df is None or df.empty or len(df) < 5:
            return None
        closes = df["close"].tolist()
        returns = [(closes[i] - closes[i-1]) / closes[i-1] for i in range(1, len(closes))]
        return returns
    except Exception as e:
        logger.warning("Price fetch failed for %s: %s", ticker, e)
        return None


def _get_ticker_price(ticker: str) -> Dict[str, Any]:
    """Returns latest price info for a node in the supply chain graph."""
    try:
        from backend.data.fetcher import fetch_stock_data
        df = fetch_stock_data(ticker, period="7D")
        if df is not None and len(df) >= 2:
            last = float(df["close"].iloc[-1])
            prev = float(df["close"].iloc[-2])
            change_pct = round((last - prev) / prev * 100, 3) if prev > 0 else 0.0
            return {"price": round(last, 2), "change_pct": change_pct}
    except Exception:
        pass
    return {"price": None, "change_pct": None}


def get_supply_chain(ticker: str) -> Dict[str, Any]:
    """
    Returns the supply chain analysis for the given ticker.

    Structure:
    {
      "ticker": str,
      "sector": str,
      "upstream": [...],         # Suppliers / raw material providers
      "downstream": [...],       # Customers / distribution partners
      "correlations": {ticker: float},
      "target_price": float,
      "target_change_pct": float
    }
    """
    t = ticker.upper().strip()
    chain = SUPPLY_CHAIN_MAP.get(t, _DEFAULT_CHAIN)

    all_related = chain.get("upstream", []) + chain.get("downstream", [])

    # ── Fetch target stock returns ────────────────────────────────────────────
    target_returns = _get_price_returns(t)
    target_info = _get_ticker_price(t)

    # ── Enrich related tickers with price + correlation ───────────────────────
    correlations: Dict[str, float] = {}
    enriched_upstream: List[Dict] = []
    enriched_downstream: List[Dict] = []

    for group_key, raw_group in [("upstream", chain.get("upstream", [])), ("downstream", chain.get("downstream", []))]:
        enriched_group: List[Dict] = []
        for item in raw_group:
            related_ticker = item["ticker"]
            price_info = _get_ticker_price(related_ticker)

            # Correlation
            corr = 0.0
            if target_returns:
                related_returns = _get_price_returns(related_ticker)
                if related_returns:
                    corr = _pearson_correlation(target_returns, related_returns)
            correlations[related_ticker] = corr

            # Impact score: |correlation| * 100
            impact = int(abs(corr) * 100)

            enriched_group.append({
                **item,
                "price": price_info.get("price"),
                "change_pct": price_info.get("change_pct"),
                "correlation": corr,
                "impact_score": impact,
            })

        if group_key == "upstream":
            enriched_upstream = enriched_group
        else:
            enriched_downstream = enriched_group

    # Sort by |correlation| descending
    enriched_upstream.sort(key=lambda x: abs(x.get("correlation", 0)), reverse=True)
    enriched_downstream.sort(key=lambda x: abs(x.get("correlation", 0)), reverse=True)

    return {
        "ticker": t,
        "sector": chain.get("sector", "Diversified"),
        "upstream": enriched_upstream,
        "downstream": enriched_downstream,
        "correlations": correlations,
        "target_price": target_info.get("price"),
        "target_change_pct": target_info.get("change_pct"),
    }
