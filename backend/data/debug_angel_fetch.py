from backend.data.fetcher import ensure_session, smartApi, _call_api

ensure_session()
param = {
    "exchange": "NSE",
    "symboltoken": "3456",
    "interval": "ONE_DAY",
    "fromdate": "2024-01-01 09:15",
    "todate": "2026-08-29 15:30"
}
res = _call_api(smartApi.getCandleData, param)
print("Angel API response status:", res.get("status") if res else None)
if res and res.get("data"):
    print(f"Total REAL Angel One candles for Tata Motors (Token 3456): {len(res['data'])}")
    print("Latest 3 real candles:")
    for c in res["data"][-3:]:
        print(c)
else:
    print("Angel API error:", res)
