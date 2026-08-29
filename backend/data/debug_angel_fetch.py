import requests

url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
data = requests.get(url, timeout=30).json()

print("Searching by token 500570 or 3456 or TATA in symbol...")
for item in data:
    token = str(item.get("token", ""))
    sym = (item.get("symbol") or "").upper()
    if token in ["500570", "3456", "3499"] or sym.startswith("TATA"):
        print(f"Exch: {item.get('exch_seg'):5} | Sym: {item.get('symbol'):20} | Token: {item.get('token'):8} | Name: {item.get('name')}")
