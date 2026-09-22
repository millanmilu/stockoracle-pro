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
