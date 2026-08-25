import os
import sys
import requests

resp = requests.get("https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json", timeout=30).json()

for sym in ["ZOMATO", "TATAMOTORS", "TRENT", "HAL", "M&M", "BAJAJ-AUTO"]:
    matches = [x for x in resp if sym in x.get("symbol", "") and x.get("exch_seg") == "NSE"]
    print(f"=== Matches for {sym} ({len(matches)} found) ===")
    for m in matches[:5]:
        print("  Symbol:", m.get("symbol"), "Name:", m.get("name"), "Token:", m.get("token"), "Instrument:", m.get("instrumenttype"))
