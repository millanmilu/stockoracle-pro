#!/usr/bin/env python3
"""StockOracle Pro — brain/ drift checker.

`brain/*.md` ke claims ko current repo ke against verify karta hai, taaki docs
silently stale na ho jayein (purana naam, purana count, hataya hua file).

Kya check hota hai:
  1. Path claims  — har inline `backticked` path exist karta hai? (plus fenced
                    ASCII trees ke `├── path` entries)
  2. Count claims — "N domain routers" (backend/main.py se),
                    "N files in tests/", "`x.py` (~N lines)" (wc -l se).
  3. Marker claims— `<!-- check: name=N -->` (jaise frontend_tests=7).
  4. Behavioural probes — screener ka honesty contract: no-op sentinel
                    (`ALL`/`1=1`) parse hota hai, `data_status` teen states deta
                    hai, aur aggregators NULL ko neutral observation nahi maante
                    (path/count checks ye nahi pakad sakte — dekho
                    screener_invariant_probes() ka docstring).

Usage:
    python scripts/check_brain.py             # line counts pe 10% tolerance
    python scripts/check_brain.py --strict    # line counts bhi exact chahiye

Exit: 0 = sab green, 1 = drift mila.

Design notes (kyun aise likha hai):
  - Path resolution order: repo-root exact -> koi bhi nested suffix match
    (`chart/ChartCanvas.jsx` bhi chalega, `src/store` bhi). Single-segment naam
    (`fetcher.py`) ka matlab hai "repo me kahin bhi is naam ki file ho".
  - Runtime/build artifacts exist nahi karte fresh clone me, isliye skip:
    .log .db .pt .pem .sqlite .csv  +  backend/.env
  - Fenced code blocks ke sirf tree-glyph lines scan hote hain (bash commands
    nahi), aur tree line me `#` comment ke baad ka hissa ignore hota hai.
  - Ye script stdlib-only hai — CI me bina extra deps chalti hai.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAIN = ROOT / "brain"

# Source/config extensions: inka exist karna zaroori hai.
CHECKABLE_EXT = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".md", ".json", ".sh", ".ps1",
    ".yml", ".yaml", ".css", ".html", ".toml", ".txt", ".service",
}
# Runtime / build artifacts: fresh clone me nahi hote, isliye ignore.
SKIP_EXT = {".log", ".db", ".sqlite", ".sqlite3", ".pt", ".pem", ".csv", ".xlsx"}
SKIP_TOKENS = {"backend/.env", ".env", "brain/"}
# Bahut noisy dirs (basename/suffix search se hata diye).
SKIP_DIRS = {
    "node_modules", "venv", "dist", "build", "__pycache__", "htmlcov",
    "coverage", "saved_models",
}
# Dot-dirs: ye index me nahi jaate (warna doosre agent ke git worktree ki copy
# se paths "match" ho jaate hain) — sirf .github exception hai.
ALLOWED_DOT_DIRS = {".github"}
# Ye dirs pehli training/chalan par bante hain — exist na karna normal hai.
OPTIONAL_DIRS = {"backend/ml/saved_models"}
# In chars wala token path nahi hai — code snippet / endpoint / placeholder hai.
NOT_A_PATH = set(" {}<>?*=[]|!+~\"'`(),;:\t")
TREE_GLYPHS = "│├└─┬┌┐┘┴"


def build_index() -> set[str]:
    """Saare repo-relative files + dirs (posix) — path claims isi se match hote hain."""
    out: set[str] = set()
    for p in ROOT.rglob("*"):
        rel = p.relative_to(ROOT)
        parts = rel.parts
        if any(part in SKIP_DIRS for part in parts):
            continue
        if any(part.startswith(".") and part not in ALLOWED_DOT_DIRS
               for part in parts[:-1]):
            continue
        if parts and parts[-1].startswith(".") and parts[-1] not in ALLOWED_DOT_DIRS:
            continue
        out.add(rel.as_posix())
    return out


def norm(token: str) -> str:
    return token.strip().strip("`").strip().rstrip("/")


def looks_like_path(token: str) -> bool:
    if not token or token in SKIP_TOKENS:
        return False
    if token.startswith("/"):          # /api/health, /ws/prices
        return False
    if any(ch in NOT_A_PATH for ch in token):
        return False
    if "://" in token or token.startswith("--") or token.startswith("$"):
        return False
    if token.startswith("-"):
        return False
    if Path(token).suffix.lower() in SKIP_EXT:
        return False
    return Path(token).suffix.lower() in CHECKABLE_EXT


def path_exists(token: str, index: set[str]) -> bool:
    t = norm(token)
    if not t or t in OPTIONAL_DIRS:
        return True
    if t in index:
        return True
    suffix = "/" + t
    return any(p == t or p.endswith(suffix) for p in index)


class Report:
    def __init__(self) -> None:
        self.problems: list[str] = []
        self.checks: list[str] = []
        self.path_claims = 0

    def ok(self, msg: str) -> None:
        self.checks.append(f"  OK   {msg}")

    def fail(self, msg: str) -> None:
        self.problems.append(msg)

    def claim_ok(self, msg: str) -> None:
        self.checks.append(f"  OK   {msg}")

    def claim_fail(self, msg: str) -> None:
        self.problems.append(msg)


def strip_comment(line: str) -> str:
    return line.split("#", 1)[0]


def iter_claims(md: Path):
    """(line_no, kind, token) yields karta hai — kind = 'inline' | 'tree'."""
    in_fence = False
    for i, raw in enumerate(md.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.replace("\t", "    ")
        if line.strip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            stripped = line.lstrip()
            if stripped and stripped[0] in TREE_GLYPHS:
                body = strip_comment(re.sub(f"[{re.escape(TREE_GLYPHS)}]+", " ", stripped))
                for piece in body.split(","):
                    piece = piece.strip()
                    if piece:
                        yield i, "tree", piece
            continue
        for token in re.findall(r"`([^`\n]+)`", line):
            yield i, "inline", token


def count_lines(path: Path) -> int:
    return len(path.read_text(encoding="utf-8", errors="ignore").splitlines())


def screener_invariant_probes(rep: Report) -> None:
    """Behavioural probes of the screener honesty contract.

    Path/count checks cannot catch these: the aggregators once read NULL as a
    *neutral observation* (24 of 40 sectors reported an identical composite) and
    the "no filter" sentinel did not parse at all, so "All NSE Equities" silently
    dropped 60% of the table. These probes pin the contract that brain/ describes.

    The DSL probe is a HARD check: ``screener_dsl`` is stdlib-only, so failing to
    import it is a real breakage, not a missing dependency. The aggregator probes
    need numpy/pandas and are skipped-with-a-note on a bare interpreter (CI
    installs them, so they run for real there).
    """
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    def probe(name: str, ok: bool, detail: str = "") -> None:
        (rep.claim_ok if ok else rep.claim_fail)(f"{name} {detail}".rstrip())

    # 1. A true no-op sentinel exists (so "show everything" means everything).
    #    stdlib-only module -> import failure is a genuine problem.
    try:
        from backend.research.screener_dsl import is_no_op_query, parse_screener_query
    except Exception as exc:
        rep.claim_fail(f"screener_dsl import failed ({type(exc).__name__}: {exc})")
        return
    for literal in ("ALL", "1=1"):
        parsed = parse_screener_query(literal)
        probe(f"screener no-op sentinel `{literal}` -> 1=1",
              bool(parsed.get("success")) and parsed.get("where_clause") == "1=1")
    probe("screener `MarketCap > 0` is NOT treated as a no-op",
          is_no_op_query("MarketCap > 0") is False)

    try:
        from backend.research.screener_engines import (
            compute_market_breadth,
            compute_sector_rotation,
            derive_screener_data_status,
        )
    except Exception as exc:  # pragma: no cover - dependency dependent
        rep.claim_ok(f"aggregator probes SKIPPED (cannot load engines: {type(exc).__name__})")
        return

    # 2. Coverage flag follows real contents, not a hardcoded "OK".
    full = {
        "close_price": 100.0, "rsi_14": 50.0, "sma_20": 99.0, "sma_50": 98.0,
        "sma_200": 90.0, "volume_ratio_20d": 1.2,
        "pe_ratio": 20.0, "roe_pct": 15.0, "roce_pct": 18.0, "debt_to_equity": 0.4,
    }
    probe(
        "derive_screener_data_status distinguishes OK/PARTIAL/NO_DATA",
        derive_screener_data_status(full) == "OK"
        and derive_screener_data_status({**full, "pe_ratio": None}) == "PARTIAL"
        and derive_screener_data_status({**full, "close_price": None}) == "NO_DATA",
    )

    # 3. NULL is never a neutral observation in the aggregators.
    blank = {
        "close_price": None, "rsi_14": None, "change_1d_pct": None,
        "ai_consensus_score": None, "ai_signal": None,
        "volume_ratio_20d": None, "sma_50": None,
    }
    unmeasured = [{"ticker": f"X{i}", "sector": "Chemicals", **blank} for i in range(3)]
    probe("unmeasured sector is not plotted as a neutral bar",
          compute_sector_rotation(unmeasured) == [])
    placeholder = [{"ticker": f"D{i}", "sector": "Diversified", **blank} for i in range(3)]
    probe("placeholder sector label is not a sector",
          compute_sector_rotation(placeholder) == [])
    breadth = compute_market_breadth([{"change_1d_pct": None}])
    probe("missing change is no_data, never unchanged",
          breadth["unchanged"] == 0 and breadth["no_data"] == 1)

    def _thin_sector(measured):
        rows = []
        for i in range(15):
            row = {"ticker": f"F{i}", "sector": "Finance"}
            if i < measured:
                row.update({"close_price": 100.0 + i, "sma_50": 95.0,
                            "change_1d_pct": 1.0, "ai_consensus_score": 70.0,
                            "volume_ratio_20d": 1.2})
            rows.append(row)
        return rows

    from backend.research.screener_engines import (
        compute_sector_exclusions, market_cap_category,
    )
    probe("market-cap category is one shared definition (unknown stays None)",
          market_cap_category(60000.0) == "LARGE"
          and market_cap_category(20000.0) == "MID"
          and market_cap_category(5000.0) == "SMALL"
          and market_cap_category(None) is None)

    thin_rows = _thin_sector(2)
    probe("a sector is not ranked from 2 measured rows out of 15",
          compute_sector_rotation(thin_rows) == [])
    probe("the dropped sector is accounted for, never silently omitted",
          compute_sector_exclusions(thin_rows)["below_measured_sectors"] == 1)
    plotted = compute_sector_rotation(_thin_sector(4))
    probe("plotting exposes measured vs tracked stock counts",
          len(plotted) == 1 and plotted[0]["stocks"] == 15
          and plotted[0]["stocks_measured"] == 4)

    # 3b. A partial upsert may only make a screener row better, never erase it.
    try:
        from backend.data.database import merge_screener_metric
    except Exception as exc:  # pragma: no cover - dependency dependent
        rep.claim_ok(f"screener merge probe SKIPPED (cannot load: {type(exc).__name__})")
        return

    stored = {"pe_ratio": 25.0, "roce_pct": 22.0, "sector": "Chemicals",
              "name": "Real Name Ltd", "market_cap_cr": 12000.0,
              "close_price": 500.0}
    merged = merge_screener_metric(stored, {
        "ticker": "X", "name": "X", "sector": "Diversified",
        "close_price": 510.0, "pe_ratio": None, "market_cap_cr": None,
    }, ticker="X")
    probe("partial upsert keeps stored metrics instead of NULLing them",
          merged["pe_ratio"] == 25.0
          and merged["market_cap_cr"] == 12000.0
          # A column the payload never mentions is not in the UPDATE at all.
          and "roce_pct" not in merged)
    probe("placeholder sector/name never overwrite a real value",
          merged["sector"] == "Chemicals" and merged["name"] == "Real Name Ltd")
    probe("a real new value still lands", merged["close_price"] == 510.0)
    insert_case = merge_screener_metric(None, {"ticker": "Y", "name": None}, ticker="Y")
    probe("insert still gets a usable NOT NULL name", insert_case["name"] == "Y")

    # 4. Deep fundamentals: the resilience baseline must not invent statements,
    # and "Verified" must be derived from what was actually parsed.
    try:
        from backend.data.fundamentals_deep import (
            _fetch_universe_fallback,
            _finalize_freshness_status,
        )
        from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE
    except Exception as exc:  # pragma: no cover - dependency dependent
        rep.claim_ok(f"deep-financials probes SKIPPED (cannot load module: {type(exc).__name__})")
        return

    first = next((str(r.get("ticker", "")).upper().strip() for r in (MASTER_NSE_UNIVERSE or [])
                  if str(r.get("ticker", "")).strip()), None)
    if first:
        ref = _fetch_universe_fallback(first)
        fabricated = [f for f in ("annual_pl", "quarterly_results", "balance_sheet",
                                  "cash_flow", "shareholding") if ref.get(f)]
        probe("reference baseline fabricates no statements",
              ref and not fabricated)

    honest = {"data_freshness": {"data_source": "Unavailable"},
              "annual_pl": [], "balance_sheet": [], "shareholding": []}
    _finalize_freshness_status(honest)
    verified = {"data_freshness": {"data_source": "Screener.in Consolidated (live scrape)"},
                "annual_pl": [{"Sales": 1.0}], "balance_sheet": [{"Assets": 1.0}],
                "shareholding": [{"quarter": "Mar 2026"}]}
    _finalize_freshness_status(verified)
    probe("Verified requires parsed statements, not an empty profile",
          honest["data_freshness"]["status"] != "Verified"
          and verified["data_freshness"]["status"] == "Verified")


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify brain/ docs against the repo.")
    ap.add_argument("--strict", action="store_true",
                    help="line counts ka exact match maango (default 10%% tolerance)")
    ap.add_argument("--quiet", action="store_true", help="sirf failures dikhao")
    args = ap.parse_args()

    if not BRAIN.is_dir():
        print(f"FAIL: brain/ folder nahi mila ({BRAIN})")
        return 1

    md_files = sorted(BRAIN.glob("*.md"))
    if not md_files:
        print("FAIL: brain/ me koi .md file nahi hai")
        return 1

    index = build_index()
    rep = Report()
    seen_paths: set[str] = set()

    for md in md_files:
        rel_md = md.relative_to(ROOT).as_posix()
        for line_no, kind, token in iter_claims(md):
            t = norm(token)
            if not looks_like_path(t):
                continue
            if t in seen_paths:
                continue
            seen_paths.add(t)
            rep.path_claims += 1
            if not path_exists(t, index):
                rep.fail(f"{rel_md}:{line_no}  path nahi mila -> `{t}` ({kind})")

    # ── Count claims ────────────────────────────────────────────────────────
    def claim(name: str, claimed: int, actual: int, detail: str) -> None:
        if claimed == actual:
            rep.claim_ok(f"{name} = {claimed} ({detail})")
        else:
            rep.claim_fail(f"{name}: brain me {claimed}, asli {actual} ({detail})")

    main_py = ROOT / "backend" / "main.py"
    if main_py.is_file():
        routers = len(re.findall(r"include_router\(", main_py.read_text(encoding="utf-8")))
        for md in md_files:
            for m in re.finditer(r"(\d+)\s+domain routers", md.read_text(encoding="utf-8")):
                claim(f"domain routers ({md.relative_to(ROOT).as_posix()})",
                      int(m.group(1)), routers, "backend/main.py include_router(…)")

    tests_dir = ROOT / "tests"
    if tests_dir.is_dir():
        n_tests = len(list(tests_dir.glob("test_*.py")))
        forms = {
            r"(\d+)\s+files in tests/": n_tests,
            r"(\d+)\s+test_\*\.py": n_tests,
        }
        for md in md_files:
            text = md.read_text(encoding="utf-8")
            for pattern, actual in forms.items():
                for m in re.finditer(pattern, text):
                    claim(f"tests ({md.relative_to(ROOT).as_posix()})",
                          int(m.group(1)), actual, "tests/test_*.py count")

    fe_utils = ROOT / "frontend" / "src" / "utils"
    if fe_utils.is_dir():
        n_fe = len(list(fe_utils.glob("*.test.js")))
        for md in md_files:
            for m in re.finditer(r"<!--\s*check:\s*frontend_tests=(\d+)\s*-->",
                                 md.read_text(encoding="utf-8")):
                claim(f"frontend_tests ({md.relative_to(ROOT).as_posix()})",
                      int(m.group(1)), n_fe, "frontend/src/utils/*.test.js")

    # Line-count claims: `file.py` (~N lines)
    for md in md_files:
        text = md.read_text(encoding="utf-8")
        for m in re.finditer(r"`([A-Za-z0-9_./-]+\.py)`\s*\(~(\d+) lines", text):
            token, claimed = m.group(1), int(m.group(2))
            want = norm(token)
            # shallowest match jeetta hai (worktree/duplicate copies se bachne ke liye)
            target = next((p for p in sorted(index, key=lambda s: (s.count("/"), s))
                           if (p == want or p.endswith("/" + want))
                           and (ROOT / p).is_file()), None)
            if target is None:
                rep.claim_fail(f"line count: `{token}` file hi nahi mili")
                continue
            actual = count_lines(ROOT / target)
            if args.strict:
                claim(f"lines {target}", claimed, actual, "wc -l (--strict)")
            else:
                drift = abs(actual - claimed) / max(claimed, 1)
                if drift <= 0.10:
                    rep.claim_ok(f"lines {target} ~{claimed} (asli {actual}, "
                                 f"{drift * 100:.1f}% drift)")
                else:
                    rep.claim_fail(f"lines {target}: brain me ~{claimed}, asli {actual} "
                                   f"({drift * 100:.0f}% drift — brain update karo)")

    # ── Behavioural probes (screener honesty contract) ─────────────────────
    screener_invariant_probes(rep)

    if not args.quiet:
        print(f"brain drift check — {len(md_files)} files, "
              f"{rep.path_claims} unique path claims")
        for line in rep.checks:
            print(line)

    if rep.problems:
        print(f"\n{len(rep.problems)} problem(s) mili:\n")
        for p in rep.problems:
            print(f"  FAIL {p}")
        print("\nFix: brain/ me path ya count theek karo (ya code wapas sahi karo).")
        return 1

    print(f"\nAll good — {rep.path_claims} paths verified, "
          f"{len(rep.checks)} claims green.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
