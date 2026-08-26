"""
StockOracle Pro — Screener Daily Metrics Precomputation & Seeder
Populates screener_daily_metrics table with precomputed technical, fundamental, and AI consensus values.
"""
import logging
from backend.data.database import upsert_screener_daily_metric

logger = logging.getLogger("StockOracle.Data.SeedScreener")

SAMPLE_UNIVERSE = [
    {
        "ticker": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy / Oil & Gas", "industry": "Refineries",
        "market_cap_cr": 1780000.0, "market_cap_cat": "LARGE", "close_price": 1317.0, "change_1d_pct": 0.36,
        "change_1w_pct": 1.2, "change_1m_pct": 2.8, "change_1y_pct": 14.5, "distance_52w_high_pct": -4.2,
        "distance_52w_low_pct": 22.8, "rsi_14": 52.4, "macd_signal": "BULLISH", "sma_20": 1305.0, "sma_50": 1290.0,
        "sma_200": 1260.0, "volume_ratio_20d": 1.25, "pe_ratio": 24.8, "pb_ratio": 2.1, "roe_pct": 14.2,
        "roce_pct": 16.5, "debt_to_equity": 0.42, "sales_growth_3y": 16.2, "profit_growth_3y": 18.4,
        "pcr": 1.15, "max_pain": 1320.0, "iv": 18.5, "ai_consensus_score": 78.5, "ai_signal": "BUY", "ai_confidence_score": 82.0
    },
    {
        "ticker": "TCS", "name": "Tata Consultancy Services Ltd", "sector": "IT / Software", "industry": "IT Services",
        "market_cap_cr": 1420000.0, "market_cap_cat": "LARGE", "close_price": 2296.2, "change_1d_pct": 0.53,
        "change_1w_pct": -0.8, "change_1m_pct": 3.4, "change_1y_pct": 18.2, "distance_52w_high_pct": -3.1,
        "distance_52w_low_pct": 28.5, "rsi_14": 48.6, "macd_signal": "BULLISH", "sma_20": 2270.0, "sma_50": 2240.0,
        "sma_200": 2180.0, "volume_ratio_20d": 1.12, "pe_ratio": 28.4, "pb_ratio": 12.8, "roe_pct": 46.2,
        "roce_pct": 58.4, "debt_to_equity": 0.02, "sales_growth_3y": 13.8, "profit_growth_3y": 14.5,
        "pcr": 0.95, "max_pain": 2300.0, "iv": 16.2, "ai_consensus_score": 84.0, "ai_signal": "STRONG BUY", "ai_confidence_score": 88.0
    },
    {
        "ticker": "HDFCBANK", "name": "HDFC Bank Ltd", "sector": "Banking / Finance", "industry": "Private Banks",
        "market_cap_cr": 1240000.0, "market_cap_cat": "LARGE", "close_price": 768.5, "change_1d_pct": -0.45,
        "change_1w_pct": -1.5, "change_1m_pct": 1.2, "change_1y_pct": 8.4, "distance_52w_high_pct": -8.5,
        "distance_52w_low_pct": 14.2, "rsi_14": 44.2, "macd_signal": "BEARISH", "sma_20": 775.0, "sma_50": 780.0,
        "sma_200": 790.0, "volume_ratio_20d": 0.88, "pe_ratio": 18.2, "pb_ratio": 2.6, "roe_pct": 16.8,
        "roce_pct": 15.2, "debt_to_equity": 0.95, "sales_growth_3y": 24.5, "profit_growth_3y": 22.1,
        "pcr": 1.05, "max_pain": 770.0, "iv": 19.4, "ai_consensus_score": 68.0, "ai_signal": "HOLD", "ai_confidence_score": 72.0
    },
    {
        "ticker": "INFY", "name": "Infosys Ltd", "sector": "IT / Software", "industry": "IT Services",
        "market_cap_cr": 720000.0, "market_cap_cat": "LARGE", "close_price": 1102.3, "change_1d_pct": 0.82,
        "change_1w_pct": 2.1, "change_1m_pct": 5.4, "change_1y_pct": 22.6, "distance_52w_high_pct": -2.4,
        "distance_52w_low_pct": 34.2, "rsi_14": 58.6, "macd_signal": "BULLISH", "sma_20": 1080.0, "sma_50": 1060.0,
        "sma_200": 1020.0, "volume_ratio_20d": 1.45, "pe_ratio": 26.5, "pb_ratio": 8.4, "roe_pct": 32.4,
        "roce_pct": 41.2, "debt_to_equity": 0.05, "sales_growth_3y": 14.2, "profit_growth_3y": 12.8,
        "pcr": 1.25, "max_pain": 1100.0, "iv": 17.8, "ai_consensus_score": 86.5, "ai_signal": "STRONG BUY", "ai_confidence_score": 89.0
    },
    {
        "ticker": "ICICIBANK", "name": "ICICI Bank Ltd", "sector": "Banking / Finance", "industry": "Private Banks",
        "market_cap_cr": 840000.0, "market_cap_cat": "LARGE", "close_price": 1412.7, "change_1d_pct": 1.15,
        "change_1w_pct": 3.2, "change_1m_pct": 6.8, "change_1y_pct": 26.4, "distance_52w_high_pct": -1.2,
        "distance_52w_low_pct": 38.5, "rsi_14": 64.2, "macd_signal": "BULLISH", "sma_20": 1380.0, "sma_50": 1350.0,
        "sma_200": 1280.0, "volume_ratio_20d": 1.35, "pe_ratio": 17.8, "pb_ratio": 2.9, "roe_pct": 18.5,
        "roce_pct": 17.8, "debt_to_equity": 0.85, "sales_growth_3y": 26.2, "profit_growth_3y": 28.5,
        "pcr": 1.35, "max_pain": 1400.0, "iv": 18.2, "ai_consensus_score": 88.0, "ai_signal": "STRONG BUY", "ai_confidence_score": 91.0
    },
    {
        "ticker": "SBIN", "name": "State Bank of India", "sector": "Banking / Finance", "industry": "Public Banks",
        "market_cap_cr": 760000.0, "market_cap_cat": "LARGE", "close_price": 1042.2, "change_1d_pct": 0.65,
        "change_1w_pct": 1.4, "change_1m_pct": 4.5, "change_1y_pct": 32.1, "distance_52w_high_pct": -3.5,
        "distance_52w_low_pct": 42.0, "rsi_14": 56.4, "macd_signal": "BULLISH", "sma_20": 1020.0, "sma_50": 990.0,
        "sma_200": 920.0, "volume_ratio_20d": 1.18, "pe_ratio": 10.4, "pb_ratio": 1.5, "roe_pct": 17.2,
        "roce_pct": 16.0, "debt_to_equity": 1.10, "sales_growth_3y": 22.4, "profit_growth_3y": 34.5,
        "pcr": 1.12, "max_pain": 1040.0, "iv": 22.4, "ai_consensus_score": 81.0, "ai_signal": "BUY", "ai_confidence_score": 84.0
    },
    {
        "ticker": "BHARTIARTL", "name": "Bharti Airtel Ltd", "sector": "Telecom", "industry": "Telecom Services",
        "market_cap_cr": 980000.0, "market_cap_cat": "LARGE", "close_price": 1921.9, "change_1d_pct": -1.20,
        "change_1w_pct": -2.4, "change_1m_pct": 1.8, "change_1y_pct": 42.5, "distance_52w_high_pct": -5.6,
        "distance_52w_low_pct": 55.0, "rsi_14": 46.8, "macd_signal": "BEARISH", "sma_20": 1940.0, "sma_50": 1910.0,
        "sma_200": 1750.0, "volume_ratio_20d": 0.92, "pe_ratio": 45.2, "pb_ratio": 8.2, "roe_pct": 19.4,
        "roce_pct": 18.2, "debt_to_equity": 1.45, "sales_growth_3y": 18.6, "profit_growth_3y": 48.0,
        "pcr": 0.88, "max_pain": 1920.0, "iv": 20.5, "ai_consensus_score": 72.5, "ai_signal": "BUY", "ai_confidence_score": 76.0
    },
    {
        "ticker": "ITC", "name": "ITC Ltd", "sector": "FMCG", "industry": "Cigarettes & FMCG",
        "market_cap_cr": 580000.0, "market_cap_cat": "LARGE", "close_price": 282.4, "change_1d_pct": -0.35,
        "change_1w_pct": 0.5, "change_1m_pct": -1.2, "change_1y_pct": 6.8, "distance_52w_high_pct": -7.2,
        "distance_52w_low_pct": 12.4, "rsi_14": 45.2, "macd_signal": "BEARISH", "sma_20": 285.0, "sma_50": 288.0,
        "sma_200": 295.0, "volume_ratio_20d": 0.78, "pe_ratio": 24.2, "pb_ratio": 7.4, "roe_pct": 29.5,
        "roce_pct": 38.4, "debt_to_equity": 0.01, "sales_growth_3y": 12.4, "profit_growth_3y": 14.8,
        "pcr": 1.10, "max_pain": 285.0, "iv": 15.4, "ai_consensus_score": 70.0, "ai_signal": "HOLD", "ai_confidence_score": 75.0
    },
    {
        "ticker": "LT", "name": "Larsen & Toubro Ltd", "sector": "Capital Goods / Infrastructure", "industry": "Engineering",
        "market_cap_cr": 540000.0, "market_cap_cat": "LARGE", "close_price": 4007.5, "change_1d_pct": 1.45,
        "change_1w_pct": 3.8, "change_1m_pct": 8.2, "change_1y_pct": 34.5, "distance_52w_high_pct": -1.5,
        "distance_52w_low_pct": 48.0, "rsi_14": 66.8, "macd_signal": "BULLISH", "sma_20": 3920.0, "sma_50": 3840.0,
        "sma_200": 3650.0, "volume_ratio_20d": 1.62, "pe_ratio": 34.5, "pb_ratio": 5.8, "roe_pct": 16.8,
        "roce_pct": 19.5, "debt_to_equity": 0.65, "sales_growth_3y": 19.4, "profit_growth_3y": 22.6,
        "pcr": 1.45, "max_pain": 4000.0, "iv": 21.0, "ai_consensus_score": 89.5, "ai_signal": "STRONG BUY", "ai_confidence_score": 92.0
    },
    {
        "ticker": "HUL", "name": "Hindustan Unilever Ltd", "sector": "FMCG", "industry": "Diversified FMCG",
        "market_cap_cr": 510000.0, "market_cap_cat": "LARGE", "close_price": 2117.5, "change_1d_pct": -0.85,
        "change_1w_pct": -1.8, "change_1m_pct": -3.2, "change_1y_pct": -4.5, "distance_52w_high_pct": -14.2,
        "distance_52w_low_pct": 5.8, "rsi_14": 36.4, "macd_signal": "BEARISH", "sma_20": 2150.0, "sma_50": 2180.0,
        "sma_200": 2240.0, "volume_ratio_20d": 1.15, "pe_ratio": 48.6, "pb_ratio": 10.2, "roe_pct": 20.4,
        "roce_pct": 27.8, "debt_to_equity": 0.03, "sales_growth_3y": 8.5, "profit_growth_3y": 6.8,
        "pcr": 0.75, "max_pain": 2120.0, "iv": 16.8, "ai_consensus_score": 62.0, "ai_signal": "HOLD", "ai_confidence_score": 68.0
    },
    {
        "ticker": "TATAMOTORS", "name": "Tata Motors Ltd", "sector": "Automobile", "industry": "Commercial & Passenger Vehicles",
        "market_cap_cr": 340000.0, "market_cap_cat": "LARGE", "close_price": 945.0, "change_1d_pct": 2.10,
        "change_1w_pct": 4.5, "change_1m_pct": 11.2, "change_1y_pct": 56.4, "distance_52w_high_pct": -2.0,
        "distance_52w_low_pct": 68.0, "rsi_14": 68.2, "macd_signal": "BULLISH", "sma_20": 915.0, "sma_50": 880.0,
        "sma_200": 810.0, "volume_ratio_20d": 1.85, "pe_ratio": 14.8, "pb_ratio": 3.8, "roe_pct": 28.5,
        "roce_pct": 24.2, "debt_to_equity": 0.72, "sales_growth_3y": 28.4, "profit_growth_3y": 64.0,
        "pcr": 1.55, "max_pain": 940.0, "iv": 24.5, "ai_consensus_score": 92.0, "ai_signal": "STRONG BUY", "ai_confidence_score": 94.0
    },
    {
        "ticker": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "sector": "Pharma / Healthcare", "industry": "Pharmaceuticals",
        "market_cap_cr": 420000.0, "market_cap_cat": "LARGE", "close_price": 1685.0, "change_1d_pct": 0.95,
        "change_1w_pct": 2.8, "change_1m_pct": 7.4, "change_1y_pct": 44.2, "distance_52w_high_pct": -1.8,
        "distance_52w_low_pct": 52.0, "rsi_14": 62.4, "macd_signal": "BULLISH", "sma_20": 1650.0, "sma_50": 1610.0,
        "sma_200": 1480.0, "volume_ratio_20d": 1.30, "pe_ratio": 36.4, "pb_ratio": 5.4, "roe_pct": 16.5,
        "roce_pct": 18.9, "debt_to_equity": 0.08, "sales_growth_3y": 14.5, "profit_growth_3y": 24.8,
        "pcr": 1.28, "max_pain": 1680.0, "iv": 19.2, "ai_consensus_score": 87.0, "ai_signal": "BUY", "ai_confidence_score": 90.0
    }
]


def seed_screener_metrics_table():
    """Seeds the screener_daily_metrics table with top liquid stocks."""
    for s in SAMPLE_UNIVERSE:
        upsert_screener_daily_metric(s)
    logger.info("Successfully seeded %d stocks into screener_daily_metrics.", len(SAMPLE_UNIVERSE))


if __name__ == "__main__":
    seed_screener_metrics_table()
