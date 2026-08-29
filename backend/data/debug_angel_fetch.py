from backend.data.fetcher import fetch_stock_data, get_token_info
from backend.data.database import clear_ticker_history

# Clear any old fake/synthetic history for TATAMOTORS
clear_ticker_history("TATAMOTORS")

info = get_token_info("TATAMOTORS")
print("Resolved Token Info:", info)

# Fetch fresh from Angel One
df = fetch_stock_data("TATAMOTORS", period="1Y", interval="1d")
print("Data Source:", df.attrs.get("data_source"))
print("Candles Count:", len(df) if df is not None else 0)
print("Latest 3 candles:")
print(df.tail(3))
