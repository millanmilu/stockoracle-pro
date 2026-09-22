"""
Regenerates backend/data/index_constituents.py from official NSE index CSVs.

NSE rebalances these indices semi-annually (Mar/Sep) — re-run this script
after each review to keep categorical scans accurate:

    python backend/scripts/refresh_index_constituents.py [/path/to/csv_dir]

CSV source: https://www.niftyindices.com/IndexConstituent/<file>.csv
Expected files (Symbol column):
    ind_nifty50list.csv, ind_niftynext50list.csv, ind_nifty200list.csv,
    ind_niftymidcap150list.csv, ind_niftysmallcap250list.csv,
    ind_nifty500list.csv, ind_niftybanklist.csv, ind_niftypsubanklist.csv,
    ind_niftyitlist.csv, ind_niftyautolist.csv, ind_niftypharmalist.csv,
    ind_niftyfmcglist.csv, ind_niftymetallist.csv, ind_niftyenergylist.csv,
    ind_niftyinfralist.csv, ind_niftyrealtylist.csv
"""
import csv
import datetime
import os
import sys

CSV_DIR_DEFAULT = "/tmp/idx"
OUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "data", "index_constituents.py"
)

# universe id (frontend display name) -> csv file
UNIVERSE_FILES = {
    "NIFTY 50": "ind_nifty50list.csv",
    "NIFTY NEXT 50": "ind_niftynext50list.csv",
    "NIFTY 200": "ind_nifty200list.csv",
    "NIFTY MIDCAP": "ind_niftymidcap150list.csv",
    "NIFTY SMALLCAP": "ind_niftysmallcap250list.csv",
    "NIFTY 500": "ind_nifty500list.csv",
    "BANK NIFTY": "ind_niftybanklist.csv",
    "NIFTY PSU BANK": "ind_niftypsubanklist.csv",
    "NIFTY IT": "ind_niftyitlist.csv",
    "NIFTY AUTO": "ind_niftyautolist.csv",
    "NIFTY PHARMA": "ind_niftypharmalist.csv",
    "NIFTY FMCG": "ind_niftyfmcglist.csv",
    "NIFTY METAL": "ind_niftymetallist.csv",
    "NIFTY ENERGY": "ind_niftyenergylist.csv",
    "NIFTY INFRA": "ind_niftyinfralist.csv",
    "NIFTY REALTY": "ind_niftyrealtylist.csv",
}

# Underscore aliases accepted by the API (legacy NIFTY_500 style)
ALIASES = {
    "NIFTY_50": "NIFTY 50",
    "NIFTY_100": "NIFTY 100",
    "NIFTY_200": "NIFTY 200",
    "NIFTY_500": "NIFTY 500",
    "NIFTY_NEXT_50": "NIFTY NEXT 50",
    "NIFTY_MIDCAP_150": "NIFTY MIDCAP",
    "NIFTY_MIDCAP": "NIFTY MIDCAP",
    "NIFTY_SMALLCAP_250": "NIFTY SMALLCAP",
    "NIFTY_SMALLCAP": "NIFTY SMALLCAP",
    "BANKNIFTY": "BANK NIFTY",
    "NIFTY_BANK": "BANK NIFTY",
    "NIFTY_IT": "NIFTY IT",
    "NIFTY_AUTO": "NIFTY AUTO",
    "NIFTY_PHARMA": "NIFTY PHARMA",
    "NIFTY_FMCG": "NIFTY FMCG",
    "NIFTY_METAL": "NIFTY METAL",
    "NIFTY_ENERGY": "NIFTY ENERGY",
    "NIFTY_INFRA": "NIFTY INFRA",
    "NIFTY_REALTY": "NIFTY REALTY",
    "NIFTY_PSU_BANK": "NIFTY PSU BANK",
}


def load_symbols(csv_path: str):
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if "Symbol" not in (reader.fieldnames or []):
            raise ValueError(f"{csv_path}: no Symbol column (got {reader.fieldnames})")
        syms = [str(r["Symbol"]).upper().strip().replace(" ", "") for r in reader]
    # De-dupe preserving order
    seen, out = set(), []
    for s in syms:
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def main(csv_dir: str) -> None:
    universes = {}
    for uid, fname in UNIVERSE_FILES.items():
        path = os.path.join(csv_dir, fname)
        if not os.path.exists(path):
            print(f"SKIP {uid}: {path} not found")
            continue
        universes[uid] = load_symbols(path)
        print(f"{uid}: {len(universes[uid])} symbols from {fname}")

    if "NIFTY 50" in universes and "NIFTY NEXT 50" in universes:
        universes["NIFTY 100"] = universes["NIFTY 50"] + [
            s for s in universes["NIFTY NEXT 50"] if s not in set(universes["NIFTY 50"])
        ]
        print(f"NIFTY 100: {len(universes['NIFTY 100'])} symbols (50 + Next 50)")

    # Consistency checks against official composition
    errors = []
    if {"NIFTY 500", "NIFTY 100", "NIFTY MIDCAP", "NIFTY SMALLCAP"} <= set(universes):
        n500, n100 = set(universes["NIFTY 500"]), set(universes["NIFTY 100"])
        mid, small = set(universes["NIFTY MIDCAP"]), set(universes["NIFTY SMALLCAP"])
        if n500 != (n100 | mid | small):
            errors.append(
                f"NIFTY 500 != N100+MID150+SMALL250 "
                f"(500={len(n500)}, union={len(n100 | mid | small)})"
            )
    if {"NIFTY 100", "NIFTY 200"} <= set(universes):
        if not set(universes["NIFTY 100"]) <= set(universes["NIFTY 200"]):
            errors.append("NIFTY 100 is not a subset of NIFTY 200")
    for uid, syms in universes.items():
        if len(syms) != len(set(syms)):
            errors.append(f"{uid} has duplicate symbols")
    if errors:
        raise SystemExit("Consistency check FAILED:\n- " + "\n- ".join(errors))
    print("Consistency checks passed.")

    as_of = datetime.date.today().isoformat()
    lines = [
        '"""',
        "StockOracle Pro — Official NSE index constituents (categorical scan universes).",
        "",
        f"Source: https://www.niftyindices.com (AS_OF = {as_of}).",
        "NSE rebalances semi-annually — regenerate via:",
        "    python backend/scripts/refresh_index_constituents.py",
        '"""',
        "",
        f"AS_OF = {as_of!r}",
        "",
        "INDEX_CONSTITUENTS = {",
    ]
    order = [u for u in list(UNIVERSE_FILES) + ["NIFTY 100"] if u in universes]
    for uid in order:
        syms = universes[uid]
        lines.append(f"    {uid!r}: [")
        for i in range(0, len(syms), 10):
            chunk = ", ".join(repr(s) for s in syms[i : i + 10])
            lines.append(f"        {chunk},")
        lines.append("    ],")
    lines += [
        "}",
        "",
        "UNIVERSE_ALIASES = {",
    ]
    for alias, target in ALIASES.items():
        lines.append(f"    {alias!r}: {target!r},")
    lines += [
        "}",
        "",
        "",
        "def resolve_universe(universe_id):",
        '    """Returns the ticker list for a universe id (or alias), or None if unknown."""',
        "    if not universe_id:",
        "        return None",
        "    key = str(universe_id).upper().strip()",
        "    if key in INDEX_CONSTITUENTS:",
        "        return list(INDEX_CONSTITUENTS[key])",
        "    target = UNIVERSE_ALIASES.get(key)",
        "    if target and target in INDEX_CONSTITUENTS:",
        "        return list(INDEX_CONSTITUENTS[target])",
        "    return None",
        "",
        "",
        "def list_universes():",
        '    """Returns [{id, count}] for every known universe (drives the UI dropdown)."""',
        "    return [",
        "        {'id': uid, 'count': len(syms)}",
        "        for uid, syms in INDEX_CONSTITUENTS.items()",
        "        if uid != 'NIFTY NEXT 50'",
        "    ]",
        "",
    ]
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else CSV_DIR_DEFAULT)
