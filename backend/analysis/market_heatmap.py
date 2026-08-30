"""
StockOracle Pro — Market Heatmap & Sectoral Analytics Engine
Groups stocks by sector, computes weighted market breadth, multi-metric sorting,
and formats data for Bloomberg/Finviz-style interactive treemap heatmaps.
"""
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.data.database import get_db_connection

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

    valid_tickers = INDEX_CONSTITUENTS.get(universe_clean)

    with get_db_connection() as conn:
        if valid_tickers:
            placeholders = ",".join(["?"] * len(valid_tickers))
            rows = conn.execute(
                f"""
                SELECT * FROM screener_daily_metrics
                WHERE ticker IN ({placeholders})
                ORDER BY market_cap_cr DESC
                """,
                valid_tickers
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM screener_daily_metrics
                ORDER BY market_cap_cr DESC
                """
            ).fetchall()

    stock_list = [dict(r) for r in rows]

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

        # Determine metric value
        metric_val = float(s.get(metric) if s.get(metric) is not None else s.get("change_1d_pct", 0.0))

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
            "change_1w_pct": float(s.get("change_1w_pct") or 0.0),
            "change_1m_pct": float(s.get("change_1m_pct") or 0.0),
            "change_1y_pct": float(s.get("change_1y_pct") or 0.0),
            "rsi_14": float(s.get("rsi_14") or 50.0),
            "volume_ratio_20d": float(s.get("volume_ratio_20d") or 1.0),
            "pe_ratio": float(s.get("pe_ratio") or 20.0),
            "pb_ratio": float(s.get("pb_ratio") or 2.5),
            "roce_pct": float(s.get("roce_pct") or 15.0),
            "roe_pct": float(s.get("roe_pct") or 14.0),
            "debt_to_equity": float(s.get("debt_to_equity") or 0.5),
            "distance_52w_high_pct": float(s.get("distance_52w_high_pct") or -5.0),
            "distance_52w_low_pct": float(s.get("distance_52w_low_pct") or 25.0),
            "market_cap_cr": mcap,
            "mcap_tier": mcap_tier,
            "ai_consensus_score": float(s.get("ai_consensus_score") or 50.0),
            "ai_signal": s.get("ai_signal") or "NEUTRAL",
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
