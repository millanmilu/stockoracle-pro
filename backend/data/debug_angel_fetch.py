from backend.data.fetcher import _load_scrip_master, _scrip_map

_load_scrip_master(force=True)
tata_matches = {k: v for k, v in _scrip_map.items() if "TATA" in k.upper()}
print("Total TATA keys in Angel One ScripMaster:", len(tata_matches))
for k in sorted(tata_matches.keys())[:25]:
    item = tata_matches[k]
    print(f"Key: {k:20} -> Symbol: {item.get('symbol')} | Token: {item.get('token')} | Name: {item.get('name')}")
