"""
StockOracle Pro — Market Heatmap & Sectoral Analytics Engine
Groups stocks by sector, computes weighted market breadth, multi-metric sorting,
and formats data for Bloomberg/Finviz-style interactive treemap heatmaps.
"""
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.shared.database import get_db_session
from backend.shared.models import ScreenerDailyMetric
from sqlalchemy import select

logger = logging.getLogger("StockOracle.Analysis.Heatmap")

INDEX_CONSTITUENTS: Dict[str, List[str]] = {
    "NIFTY 50": [
        "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "HUL",
        "TATAMOTORS", "MARUTI", "AXISBANK", "WIPRO", "HCLTECH", "SUNPHARMA", "BAJFINANCE", "KOTAKBANK",
        "TATASTEEL", "NTPC", "POWERGRID", "ONGC", "COALINDIA", "TITAN", "ULTRACEMCO", "ADANIENT",
        "JSWSTEEL", "HDFCLIFE", "BPCL", "HEROMOTOCO", "BAJAJFINSV", "INDUSINDBK", "NESTLEIND", "HINDALCO",
        "GRASIM", "TECHM", "CIPLA", "EICHERMOT", "DIVISLAB", "BRITANNIA", "TATACONSUM", "APOLLOHOSP",
        "DRREDDY", "ADANIPORTS", "SBILIFE", "LTIM", "BEL", "SHRIRAMFIN", "ASIANPAINT", "M&M"
    ],
    "BANK NIFTY": [
        "HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK",
        "PNB", "BANKBARODA", "FEDERALBNK", "IDFCFIRSTB", "AUBANK", "BANDHANBNK"
    ],
    "NIFTY IT": [
        "TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "PERSISTENT", "COFORGE",
        "LTTS", "MPHASIS", "TATAELXSI", "KPITTECH", "CYIENT", "SONACOMS", "ZENSARTECH", "BSOFT"
    ],
    "NIFTY AUTO": [
        "TATAMOTORS", "MARUTI", "M&M", "BAJAJ-AUTO", "EICHERMOT", "HEROMOTOCO",
        "TVSMOTOR", "BHARATFORG", "ASHOKLEY", "MOTHERSON", "MRF", "BALKRISIND", "BOSCHLTD", "APOLLOTYRE", "EXIDEIND"
    ],
    "NIFTY PHARMA": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP", "LUPIN",
        "AUROPHARMA", "TORNTPHARM", "ZYDUSLIFE", "BIOCON", "MANKIND", "ALKEM", "GLENMARK", "ABBOTINDIA", "IPCALAB"
    ],
    "NIFTY FMCG": [
        "ITC", "HUL", "NESTLEIND", "BRITANNIA", "TATACONSUM", "DABUR", "GODREJCP", "MARICO",
        "COLPAL", "VBL", "PGHH", "EMAMILTD", "RADICO", "UBL", "BALRAMCHIN"
    ],
    "NIFTY METAL": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "JINDALSTEL", "VEDL", "COALINDIA", "NMDC",
        "SAIL", "NATIONALUM", "APLAPOLLO", "HINDZINC", "RATNAMANI"
    ],
    "NIFTY ENERGY": [
        "RELIANCE", "NTPC", "POWERGRID", "ONGC", "BPCL", "IOC", "GAIL", "ADANIGREEN",
        "TATAPOWER", "ADANIPOWER", "NHPC", "OIL", "PETRONET"
    ],
    "NIFTY INFRA": [
        "LT", "ADANIPORTS", "ULTRACEMCO", "GRASIM", "BHARTIARTL", "NTPC", "POWERGRID",
        "AMBUJACEM", "SHREECEM", "ACC", "DLF", "LODHA", "GODREJPROP"
    ],
    "NIFTY REALTY": [
        "DLF", "GODREJPROP", "LODHA", "OBEROIRLTY", "PHOENIXLTD", "PRESTIGE",
        "BRIGADE", "SOBHA", "SIGNATURE", "SUNTECK"
    ],
}


def compute_market_heatmap_data(
    universe: str = "ALL",
    metric: str = "change_1d_pct"
) -> Dict[str, Any]:
    """
    Fetches screener daily metrics, filters by chosen index universe,
    groups into sectors, and returns structured data for the interactive Treemap heatmap.
    """
    universe_clean = universe.upper().strip()
    if universe_clean == "ALL NSE":
        universe_clean = "ALL"

    # Official NSE membership (backend/data/index_constituents.py) — the local
    # INDEX_CONSTITUENTS below only covers 10 legacy index ids and is fallback.
    # Without this, NIFTY MIDCAP/SMALLCAP/500/200/100 silently returned ALL.
    valid_tickers = None
    try:
        from backend.data.index_constituents import resolve_universe as _resolve_universe
        valid_tickers = _resolve_universe(universe_clean)
    except Exception as exc:
        logger.debug("Official universe resolve failed for %s: %s", universe, exc)
    if valid_tickers is None and universe_clean not in ("ALL", ""):
        valid_tickers = INDEX_CONSTITUENTS.get(universe_clean)

    with get_db_session() as session:
        stmt = select(ScreenerDailyMetric)
        if valid_tickers:
            stmt = stmt.where(ScreenerDailyMetric.ticker.in_(valid_tickers))
        stmt = stmt.order_by(ScreenerDailyMetric.market_cap_cr.desc())
        metric_objs = session.scalars(stmt).all()
        stock_list = [{
            "ticker": m.ticker,
            "company_name": m.name,
            "sector": m.sector,
            "close_price": m.close_price,
            "change_1d_pct": m.change_1d_pct,
            "change_1w_pct": m.change_1w_pct,
            "change_1m_pct": m.change_1m_pct,
            "change_1y_pct": m.change_1y_pct,
            "market_cap_cr": m.market_cap_cr,
            "pe_ratio": m.pe_ratio,
            "pb_ratio": m.pb_ratio,
            "roce_pct": m.roce_pct,
            "roe_pct": m.roe_pct,
            "debt_to_equity": m.debt_to_equity,
            "dividend_yield": None,
            "rsi_14": m.rsi_14,
            "sma_20": m.sma_20,
            "sma_50": m.sma_50,
            "sma_200": m.sma_200,
            "volume_vs_avg_pct": m.volume_ratio_20d,
            "volume_ratio_20d": m.volume_ratio_20d,
            "macd_signal_cross": m.macd_signal,
            "distance_52w_high_pct": m.distance_52w_high_pct,
            "distance_52w_low_pct": m.distance_52w_low_pct,
            "ai_consensus_score": m.ai_consensus_score,
            "ai_signal": m.ai_signal,
        } for m in metric_objs]

    # If database is empty, return structured fallback
    if not stock_list:
        from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE
        stock_list = list(MASTER_NSE_UNIVERSE)

    # Market Breadth Calculation
    total_count = len(stock_list)
    advancers = 0
    decliners = 0
    unchanged = 0
    total_change = 0.0

    sector_map: Dict[str, Dict[str, Any]] = {}

    for s in stock_list:
        chg = float(s.get("change_1d_pct") or 0.0)
        total_change += chg
        if chg > 0.05:
            advancers += 1
        elif chg < -0.05:
            decliners += 1
        else:
            unchanged += 1

        sec = s.get("sector") or "Diversified"
        if sec not in sector_map:
            sector_map[sec] = {
                "sector": sec,
                "total_mcap_cr": 0.0,
                "stocks": [],
                "metric_sum": 0.0,
                "advancers": 0,
                "decliners": 0,
            }

        mcap = float(s.get("market_cap_cr") or 5000.0)
        sector_map[sec]["total_mcap_cr"] += mcap

        # Assign Market Cap Tier for Visual Sizing
        if mcap >= 200000.0:
            mcap_tier = 3  # Large Mega-Cap (Reliance, TCS, HDFC)
        elif mcap >= 50000.0:
            mcap_tier = 2  # Mid-Large Cap
        else:
            mcap_tier = 1  # Standard Cap

        # Determine metric value — None-safe (200/633 rows lack technicals).
        # Missing metric falls back to the 1D change for tile coloring;
        # drawer/tooltip fields below stay None so UI shows '—', never fake.
        raw_metric = s.get(metric)
        metric_val = float(raw_metric) if raw_metric is not None else chg

        if chg > 0.05:
            sector_map[sec]["advancers"] += 1
        elif chg < -0.05:
            sector_map[sec]["decliners"] += 1

        sector_map[sec]["metric_sum"] += metric_val

        stock_obj = {
            "ticker": s.get("ticker"),
            "name": s.get("name") or s.get("ticker"),
            "sector": sec,
            "industry": s.get("industry", "General"),
            "price": float(s.get("close_price") or 0.0),
            "change_pct": chg,
            "change_1d_pct": chg,
            # Raw passthrough — None stays None so tiles/drawer render '—'
            # instead of fabricated 0.0/50.0/20.0/15.0 defaults.
            "change_1w_pct": s.get("change_1w_pct"),
            "change_1m_pct": s.get("change_1m_pct"),
            "change_1y_pct": s.get("change_1y_pct"),
            "rsi_14": s.get("rsi_14"),
            "volume_ratio_20d": s.get("volume_ratio_20d"),
            "pe_ratio": s.get("pe_ratio"),
            "pb_ratio": s.get("pb_ratio"),
            "roce_pct": s.get("roce_pct"),
            "roe_pct": s.get("roe_pct"),
            "debt_to_equity": s.get("debt_to_equity"),
            "distance_52w_high_pct": s.get("distance_52w_high_pct"),
            "distance_52w_low_pct": s.get("distance_52w_low_pct"),
            "market_cap_cr": mcap,
            "mcap_tier": mcap_tier,
            "ai_consensus_score": s.get("ai_consensus_score"),
            "ai_signal": s.get("ai_signal"),
            "metric_value": metric_val
        }
        sector_map[sec]["stocks"].append(stock_obj)

    # Format Sectors List
    formatted_sectors = []
    for sec_name, data in sector_map.items():
        stk_count = len(data["stocks"])
        avg_met = round(data["metric_sum"] / max(1, stk_count), 2)
        avg_chg = round(sum(s["change_pct"] for s in data["stocks"]) / max(1, stk_count), 2)
        
        # Sort stocks within sector by market cap descending
        sorted_stocks = sorted(data["stocks"], key=lambda x: x["market_cap_cr"], reverse=True)

        formatted_sectors.append({
            "sector": sec_name,
            "avg_change_pct": avg_chg,
            "avg_metric_value": avg_met,
            "total_mcap_cr": round(data["total_mcap_cr"], 2),
            "advancers": data["advancers"],
            "decliners": data["decliners"],
            "stock_count": stk_count,
            "stocks": sorted_stocks
        })

    # Sort sectors by total market cap descending
    formatted_sectors.sort(key=lambda x: x["total_mcap_cr"], reverse=True)

    avg_market_change = round(total_change / max(1, total_count), 2)

    return {
        "universe": universe,
        "metric": metric,
        "market_breadth": {
            "total_stocks": total_count,
            "advancing": advancers,
            "declining": decliners,
            "unchanged": unchanged,
            "advancers": advancers,
            "decliners": decliners,
            "advance_decline_ratio": round(advancers / max(1, decliners), 2),
            "avg_change_pct": avg_market_change
        },
        "sectors": formatted_sectors,
        "timestamp": datetime.now().isoformat()
    }
