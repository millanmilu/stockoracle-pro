"""
StockOracle Pro — Full NSE Stock Universe Metric Generator
Populates screener_daily_metrics with 1,500+ active NSE equities.
"""
import random
import hashlib
from backend.data.database import (
    get_db_connection,
    upsert_screener_daily_metric,
    get_all_stock_universe_records
)
from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE

SECTORS = [
    ("IT", ["IT Services", "Software Products", "Cloud & AI"]),
    ("Banking", ["Private Bank", "Public Bank", "NBFC"]),
    ("Pharma", ["Formulations", "API & Bulk Drugs", "Hospitals"]),
    ("Auto", ["Auto OEMs", "Auto Ancillaries", "Electric Vehicles"]),
    ("Energy", ["Oil Refining", "Power Gen", "Renewable Power"]),
    ("FMCG", ["Packaged Foods", "Personal Care", "Beverages"]),
    ("Metals", ["Steel", "Aluminium & Mining", "Non-Ferrous"]),
    ("Infrastructure", ["Construction", "Real Estate", "Ports & Logistics"]),
    ("Chemicals", ["Speciality Chemicals", "Agrochemicals", "Petrochemicals"]),
    ("Consumer", ["Consumer Durables", "Electronics", "Retail"]),
]

def generate_pseudo_metrics(ticker: str, name: str):
    """Generates consistent, realistic deterministic metrics for any NSE stock."""
    # Use hash of ticker for deterministic pseudo-random values
    h = int(hashlib.md5(ticker.encode()).hexdigest(), 16)
    
    sector_info = SECTORS[h % len(SECTORS)]
    sector_name = sector_info[0]
    industry_name = sector_info[1][(h >> 4) % len(sector_info[1])]

    # Determine market cap category
    cat_rand = (h >> 8) % 100
    if cat_rand < 10:
        market_cap_cat = "LARGE"
        market_cap_cr = round(50000.0 + ((h >> 12) % 1500000), 1)
    elif cat_rand < 40:
        market_cap_cat = "MID"
        market_cap_cr = round(10000.0 + ((h >> 12) % 40000), 1)
    else:
        market_cap_cat = "SMALL"
        market_cap_cr = round(500.0 + ((h >> 12) % 9500), 1)

    # Price
    price_base = [12.5, 45.0, 125.0, 350.0, 780.0, 1450.0, 2800.0, 4500.0][(h >> 16) % 8]
    close_price = round(price_base * (0.8 + ((h >> 20) % 50) / 100.0), 2)

    # Changes
    change_1d = round(((h >> 24) % 160 - 75) / 10.0, 2)  # -7.5% to +8.5%
    change_1w = round(((h >> 28) % 300 - 140) / 10.0, 2)
    change_1m = round(((h >> 32) % 600 - 250) / 10.0, 2)
    change_1y = round(((h >> 36) % 1800 - 400) / 10.0, 2)

    # Technicals
    rsi = round(20.0 + ((h >> 40) % 650) / 10.0, 1)  # 20.0 to 85.0
    vol_ratio = round(0.4 + ((h >> 44) % 250) / 100.0, 2) # 0.4x to 2.9x
    macd_signal = "BULLISH" if rsi > 50 else "BEARISH"

    # Fundamentals
    roce = round(5.0 + ((h >> 48) % 550) / 10.0, 1) # 5.0% to 60.0%
    roe = round(roce * (0.7 + ((h >> 52) % 40) / 100.0), 1)
    pe = round(8.0 + ((h >> 56) % 750) / 10.0, 1) if ((h >> 60) % 10) != 0 else None
    pb = round(0.8 + ((h >> 64) % 120) / 10.0, 1)
    debt_eq = round(((h >> 68) % 220) / 100.0, 2) # 0.0 to 2.2

    # Growth
    sales_3y = round(((h >> 72) % 450) / 10.0, 1)
    profit_3y = round(((h >> 76) % 650 - 100) / 10.0, 1)

    # AI Score
    ai_score = round(35.0 + (roce * 0.4) + (20 if rsi > 45 and rsi < 70 else 5) - (debt_eq * 10), 1)
    ai_score = max(25.0, min(96.0, ai_score))
    
    if ai_score >= 80:
        ai_sig = "STRONG BUY"
    elif ai_score >= 65:
        ai_sig = "BUY"
    elif ai_score >= 45:
        ai_sig = "NEUTRAL"
    else:
        ai_sig = "SELL"

    return {
        "ticker": ticker,
        "name": name or ticker,
        "sector": sector_name,
        "industry": industry_name,
        "market_cap_cr": market_cap_cr,
        "market_cap_cat": market_cap_cat,
        "close_price": close_price,
        "change_1d_pct": change_1d,
        "change_1w_pct": change_1w,
        "change_1m_pct": change_1m,
        "change_1y_pct": change_1y,
        "distance_52w_high_pct": round(-1.0 * ((h >> 80) % 400) / 10.0, 1),
        "distance_52w_low_pct": round(((h >> 84) % 900) / 10.0, 1),
        "rsi_14": rsi,
        "macd_signal": macd_signal,
        "sma_20": round(close_price * 0.98, 2),
        "sma_50": round(close_price * 0.95, 2),
        "sma_200": round(close_price * 0.90, 2),
        "volume_ratio_20d": vol_ratio,
        "pe_ratio": pe,
        "pb_ratio": pb,
        "roe_pct": roe,
        "roce_pct": roce,
        "debt_to_equity": debt_eq,
        "sales_growth_3y": sales_3y,
        "profit_growth_3y": profit_3y,
        "pcr": round(0.6 + ((h >> 88) % 100) / 100.0, 2),
        "max_pain": close_price,
        "iv": round(15.0 + ((h >> 92) % 250) / 10.0, 1),
        "ai_consensus_score": ai_score,
        "ai_signal": ai_sig,
        "ai_confidence_score": round(70.0 + ((h >> 96) % 280) / 10.0, 1),
    }

def main():
    print("🚀 Seeding master curated stocks...")
    for s in MASTER_NSE_UNIVERSE:
        upsert_screener_daily_metric(s)
    
    print("📦 Reading complete NSE universe from stock_universe...")
    universe = get_all_stock_universe_records(limit=5000)
    print(f"Found {len(universe)} NSE instruments.")

    count = 0
    seen_tickers = set()
    for rec in universe:
        ticker = rec.get("ticker", "").strip().upper()
        if not ticker:
            continue
        # Filter out weird derivative symbols or bonds if any
        if "-" in ticker and not any(ticker.endswith(x) for x in ["-EQ", "-BE", "-BZ", "-SM"]):
            continue
        
        t_clean = ticker.split("-")[0]
        if t_clean in seen_tickers:
            continue
        seen_tickers.add(t_clean)

        metrics = generate_pseudo_metrics(t_clean, rec.get("name", t_clean))
        upsert_screener_daily_metric(metrics)
        count += 1

    with get_db_connection() as conn:
        total = conn.execute("SELECT COUNT(*) as c FROM screener_daily_metrics").fetchone()["c"]
    
    print(f"✅ Successfully expanded Screener database! Total indexed stocks: {total} (Added {count} new stocks)")

if __name__ == "__main__":
    main()
