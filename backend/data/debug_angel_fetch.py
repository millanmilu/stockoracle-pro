import requests

url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
print("Downloading Angel One master...")
data = requests.get(url, timeout=30).json()

print("Searching for MOTORS in Angel One...")
found = []
for item in data:
    name = (item.get("name") or "").upper()
    sym = (item.get("symbol") or "").upper()
    if "MOTOR" in name or "MOTOR" in sym:
        found.append(item)

print(f"Total MOTOR items found: {len(found)}")
for item in found[:30]:
    print(f"Exch: {item.get('exch_seg'):5} | Sym: {item.get('symbol'):20} | Token: {item.get('token'):8} | Name: {item.get('name')}")
