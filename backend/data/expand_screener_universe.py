"""
StockOracle Pro — Full NSE Stock Universe Seeder (1500+ Stocks)
"""
import hashlib
from backend.data.database import (
    get_db_connection,
    upsert_screener_daily_metric
)
from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE

SECTORS = [
    ("IT / Software", ["IT Services", "Software Products", "Cloud & AI", "Cybersecurity", "Fintech"]),
    ("Banking & Financials", ["Private Bank", "Public Bank", "NBFC", "Housing Finance", "Wealth Management"]),
    ("Pharma & Healthcare", ["Formulations", "API & Bulk Drugs", "Hospitals", "Diagnostics", "Biotech"]),
    ("Automobiles", ["Auto OEMs", "Auto Ancillaries", "Electric Vehicles", "Tyres", "Commercial Vehicles"]),
    ("Energy & Utilities", ["Oil Refining", "Power Gen", "Renewable Energy", "Gas Distribution", "Power Grid"]),
    ("FMCG & Retail", ["Packaged Foods", "Personal Care", "Beverages", "Retail Chains", "Agro Foods"]),
    ("Metals & Mining", ["Steel", "Aluminium", "Mining & Minerals", "Non-Ferrous Metals", "Pipes"]),
    ("Infrastructure & Realty", ["Construction", "Real Estate", "Ports & Logistics", "Cement", "Roads & Highways"]),
    ("Chemicals & Materials", ["Speciality Chemicals", "Agrochemicals", "Petrochemicals", "Polymers", "Dyes"]),
    ("Consumer Durables", ["Electronics", "Appliances", "Footwear", "Textiles & Apparel", "Jewellery"]),
    ("Telecom & Media", ["Telecom Services", "Media & Entertainment", "Broadcasting", "Digital Platforms"]),
]

def generate_stock_metrics(ticker: str, name: str):
    """Generates consistent, realistic deterministic metrics for any NSE stock."""
    h = int(hashlib.md5(ticker.encode()).hexdigest(), 16)
    
    sector_info = SECTORS[h % len(SECTORS)]
    sector_name = sector_info[0]
    industry_name = sector_info[1][(h >> 4) % len(sector_info[1])]

    cat_rand = (h >> 8) % 100
    if cat_rand < 15:
        market_cap_cat = "LARGE"
        market_cap_cr = round(45000.0 + ((h >> 12) % 1200000), 1)
    elif cat_rand < 55:
        market_cap_cat = "MID"
        market_cap_cr = round(8000.0 + ((h >> 12) % 37000), 1)
    else:
        market_cap_cat = "SMALL"
        market_cap_cr = round(300.0 + ((h >> 12) % 7700), 1)

    price_base = [18.5, 42.0, 95.0, 240.0, 560.0, 1150.0, 2450.0, 3800.0, 6200.0][(h >> 16) % 9]
    close_price = round(price_base * (0.85 + ((h >> 20) % 35) / 100.0), 2)

    change_1d = round(((h >> 24) % 150 - 70) / 10.0, 2)
    change_1w = round(((h >> 28) % 280 - 130) / 10.0, 2)
    change_1m = round(((h >> 32) % 550 - 220) / 10.0, 2)
    change_1y = round(((h >> 36) % 1600 - 350) / 10.0, 2)

    rsi = round(22.0 + ((h >> 40) % 620) / 10.0, 1)
    vol_ratio = round(0.5 + ((h >> 44) % 230) / 100.0, 2)
    macd_signal = "BULLISH" if rsi > 50 else "BEARISH"

    roce = round(6.0 + ((h >> 48) % 520) / 10.0, 1)
    roe = round(roce * (0.75 + ((h >> 52) % 35) / 100.0), 1)
    pe = round(9.0 + ((h >> 56) % 680) / 10.0, 1) if ((h >> 60) % 12) != 0 else None
    pb = round(0.9 + ((h >> 64) % 110) / 10.0, 1)
    debt_eq = round(((h >> 68) % 210) / 100.0, 2)

    sales_3y = round(((h >> 72) % 420) / 10.0, 1)
    profit_3y = round(((h >> 76) % 600 - 80) / 10.0, 1)

    ai_score = round(38.0 + (roce * 0.45) + (18 if 45 < rsi < 70 else 4) - (debt_eq * 12), 1)
    ai_score = max(22.0, min(97.0, ai_score))
    
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
        "distance_52w_high_pct": round(-1.0 * ((h >> 80) % 380) / 10.0, 1),
        "distance_52w_low_pct": round(((h >> 84) % 850) / 10.0, 1),
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
        "pcr": round(0.65 + ((h >> 88) % 95) / 100.0, 2),
        "max_pain": close_price,
        "iv": round(16.0 + ((h >> 92) % 240) / 10.0, 1),
        "ai_consensus_score": ai_score,
        "ai_signal": ai_sig,
        "ai_confidence_score": round(72.0 + ((h >> 96) % 260) / 10.0, 1),
    }

def main():
    print("🚀 Seeding master curated stocks...")
    for s in MASTER_NSE_UNIVERSE:
        upsert_screener_daily_metric(s)
    
    with get_db_connection() as conn:
        rows = conn.execute("SELECT ticker, name FROM stock_universe WHERE exchange = 'NSE'").fetchall()
    
    print(f"📦 Found {len(rows)} raw tickers in stock_universe table.")

    seen_tickers = set()
    added = 0
    for r in rows:
        ticker = str(r["ticker"]).strip().upper()
        name = str(r["name"] or ticker).strip()

        # Clean symbol
        t_clean = ticker.replace("-EQ", "").replace("-BE", "").replace("-SM", "").strip()
        if not t_clean or len(t_clean) > 20:
            continue
        
        # Skip if already processed or is derivative
        if t_clean in seen_tickers:
            continue
        seen_tickers.add(t_clean)

        metrics = generate_stock_metrics(t_clean, name)
        upsert_screener_daily_metric(metrics)
        added += 1

    with get_db_connection() as conn:
        total = conn.execute("SELECT COUNT(*) as c FROM screener_daily_metrics").fetchone()["c"]
    
    print(f"🎉 Successfully seeded {total} total stocks into screener_daily_metrics! (Added {added} new symbols)")

if __name__ == "__main__":
    main()
