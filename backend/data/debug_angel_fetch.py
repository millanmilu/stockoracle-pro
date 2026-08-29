import requests

url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
data = requests.get(url, timeout=30).json()

print("Exact match search for TATA MOTORS in Angel One:")
for item in data:
    name = (item.get("name") or "").strip()
    sym = (item.get("symbol") or "").strip()
    token = str(item.get("token", ""))
    if token in ["3456", "3499", "3405", "500570"] or "TATA MOTORS" in name or sym.startswith("TATAMOTORS"):
        if item.get("exch_seg") in ["NSE", "BSE"]:
            print(f"Exch: {item.get('exch_seg')} | Symbol: {item.get('symbol')} | Token: {item.get('token')} | Name: {item.get('name')}")
