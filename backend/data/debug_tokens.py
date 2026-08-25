import requests

resp = requests.get("https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json", timeout=30).json()

for sym in ["ZOMATO", "TATAMOTORS", "HAL", "ETERNAL"]:
    matches = [x for x in resp if sym.lower() in x.get("symbol", "").lower() or sym.lower() in x.get("name", "").lower()]
    print(f"=== Matches for {sym} ({len(matches)} found) ===")
    for m in matches[:6]:
        print(f"  Exch: {m.get('exch_seg')} | Symbol: {m.get('symbol')} | Name: {m.get('name')} | Token: {m.get('token')}")

