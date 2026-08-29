import logging
logging.basicConfig(level=logging.INFO)
from backend.data.fetcher import get_token_info, ensure_session, smartApi, _call_api, _load_scrip_master, fetch_stock_data
from backend.data.database import clear_ticker_history

_load_scrip_master(force=True)
info = get_token_info("TATAMOTORS")
print("TOKEN INFO FOR TATAMOTORS:", info)

ensure_session()
if smartApi and info:
    param = {
        "exchange": info.get("exch_seg", "NSE"),
        "symboltoken": str(info.get("token")),
        "interval": "ONE_DAY",
        "fromdate": "2025-01-01 09:15",
        "todate": "2026-08-29 15:30"
    }
    print("Testing Angel API call with param:", param)
    res = _call_api(smartApi.getCandleData, param)
    print("Angel API response status:", res.get("status") if res else None)
    if res and res.get("data"):
        print("Angel candles count:", len(res["data"]))
        print("Last 3 candles from Angel One:")
        for c in res["data"][-3:]:
            print(c)
    else:
        print("Angel response error:", res)
