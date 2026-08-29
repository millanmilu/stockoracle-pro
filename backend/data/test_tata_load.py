import logging
logging.basicConfig(level=logging.INFO)
from backend.data.fetcher import fetch_stock_data, _synthesize_fallback_candles
from backend.analysis.indicators import enrich_stock_dataframe

print("Testing TATAMOTORS fetch...")
try:
    df = fetch_stock_data("TATAMOTORS", period="370D", interval="1d")
    print("Fetch result:", len(df) if df is not None else "None")
    if df is not None:
        enriched = enrich_stock_dataframe(df)
        print("Enriched length:", len(enriched))
except Exception as e:
    import traceback
    traceback.print_exc()
