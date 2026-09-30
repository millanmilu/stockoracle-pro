"""
Backfills real coverage into `screener_daily_metrics` — no fabricated values.

The table has two disjoint populations with two different holes, which is why a
single naive "refresh" never fixed either:

  * **PARTIAL rows** — real OHLCV, real technicals, but no identity or
    fundamentals: `name == ticker`, `sector` unclassified, and
    `market_cap_cr`/`pe_ratio`/`roce_pct`/… NULL.
    -> filled from Screener.in via `get_fundamentals()`.

  * **NO_DATA rows** — a curated name/sector/market cap but no OHLCV at all,
    so there is no price and no technical is computable.
    -> filled by fetching 1Y daily OHLCV and running the same indicator engine
       the daily refresh uses.

Sector is classified only from real index membership (NIFTY IT, AUTO, PHARMA,
FMCG, METAL, ENERGY, INFRA, REALTY, BANK, PSU BANK). Everything else stays
unclassified rather than being relabelled.

Nothing here invents a number: the Screener.in path leaves a ratio NULL when it
is missing, the OHLCV path rejects synthesized frames, `compute_metrics_from_ohlcv`
passes curated fundamentals through untouched, and `upsert_screener_daily_metric`
derives `data_status` from the row's real contents. A ticker that cannot be
resolved is reported as still missing, not filled with a placeholder.

Usage:
    python backend/scripts/backfill_screener_coverage.py --all --limit 50
    python backend/scripts/backfill_screener_coverage.py --fundamentals --limit 200
    python backend/scripts/backfill_screener_coverage.py --technicals --tickers TCS,INFY
    python backend/scripts/backfill_screener_coverage.py --sectors --dry-run
"""
import argparse
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("StockOracle.Backfill")

# Screener.in exposes the valuation/return ratios under these names; the
# screener table stores them with an explicit unit suffix.
_FUNDAMENTAL_FIELD_MAP = {
    "market_cap_cr": "market_cap_cr",
    "pe_ratio": "pe_ratio",
    "pb_ratio": "pb_ratio",
    "roe": "roe_pct",
    "roce": "roce_pct",
    "debt_to_equity": "debt_to_equity",
}

# Index membership is real, sourced classification — the only sector source we
# trust. Labels are deliberately spelled the way the curated meta already spells
# them (`IT / Software`, `Banking / Finance`, `Energy / Oil & Gas`, …): a second
# vocabulary would split one economic sector across two rotation bars, which is
# exactly what the first pass of this script did ("Pharmaceuticals" vs
# "Pharma / Healthcare", "Energy" vs "Energy / Oil & Gas").
_SECTOR_INDEX_TO_LABEL = [
    ("NIFTY IT", "IT / Software"),
    ("NIFTY PHARMA", "Pharma / Healthcare"),
    ("NIFTY AUTO", "Automobile"),
    ("NIFTY FMCG", "FMCG"),
    ("NIFTY METAL", "Metals & Mining"),
    ("NIFTY REALTY", "Real Estate"),
    ("NIFTY INFRA", "Capital Goods / Infrastructure"),
    ("NIFTY ENERGY", "Energy / Oil & Gas"),
    ("NIFTY PSU BANK", "Banking / Finance"),
    ("BANK NIFTY", "Banking / Finance"),
]

# Every label this script can write. Used so a later pass may correct a label an
# earlier pass wrote, while never relabelling a richer curated-meta sector
# ("Capital Goods / Defence" must survive untouched).
SECTOR_LABEL_VOCABULARY = {label for _, label in _SECTOR_INDEX_TO_LABEL}

# Labels a first revision of this script wrote before the vocabulary was aligned
# with curated meta. They are script-owned too, so the repair pass replaces them
# instead of leaving the sector split across two rotation bars forever.
LEGACY_SECTOR_LABELS = {
    "information technology", "pharmaceuticals", "realty",
    "infrastructure", "energy", "banking", "banking (psu)",
}


def _coverage_snapshot() -> Dict[str, Any]:
    from backend.data.database import get_screener_overview_stats

    stats = get_screener_overview_stats()
    cov = stats.get("coverage") or {}
    return {
        "total": cov.get("total"),
        "ok": cov.get("ok"),
        "partial": cov.get("partial"),
        "no_data": cov.get("no_data"),
        "with_fundamentals": cov.get("with_fundamentals"),
        "priced": cov.get("priced"),
        "metrics_as_of": stats.get("metrics_as_of"),
    }


def _print_coverage(label: str, cov: Dict[str, Any]) -> None:
    print(f"\n[{label}] total={cov['total']} OK={cov['ok']} PARTIAL={cov['partial']} "
          f"NO_DATA={cov['no_data']} priced={cov['priced']} "
          f"with_fundamentals={cov['with_fundamentals']} as_of={cov['metrics_as_of']}")


def _sector_map() -> Tuple[Dict[str, str], Dict[str, List[str]]]:
    """(ticker -> sector, ambiguous ticker -> the labels it matched).

    A company can belong to several sector indices (NIFTY ENERGY *and* NIFTY
    INFRA), and the index providers rank them by primary business — a judgement
    this script cannot reconstruct. Those rows are reported as ambiguous and
    left unclassified rather than assigned an arbitrary one of the two.
    """
    from backend.data.index_constituents import INDEX_CONSTITUENTS

    candidates: Dict[str, List[str]] = {}
    for index_name, label in _SECTOR_INDEX_TO_LABEL:
        for symbol in INDEX_CONSTITUENTS.get(index_name, []) or []:
            ticker = str(symbol).upper().strip()
            if not ticker:
                continue
            labels = candidates.setdefault(ticker, [])
            if label not in labels:
                labels.append(label)

    unambiguous = {t: labels[0] for t, labels in candidates.items() if len(labels) == 1}
    ambiguous = {t: labels for t, labels in candidates.items() if len(labels) > 1}
    return unambiguous, ambiguous


def _current_sectors(tickers: List[str]) -> Dict[str, Optional[str]]:
    """Current stored sector for each ticker, in one query."""
    if not tickers:
        return {}
    from backend.shared.database import get_db_session
    from backend.shared.models import ScreenerDailyMetric
    from sqlalchemy import select

    with get_db_session() as session:
        rows = session.execute(
            select(ScreenerDailyMetric.ticker, ScreenerDailyMetric.sector)
            .where(ScreenerDailyMetric.ticker.in_(tickers))
        ).all()
    return {str(t): s for t, s in rows}


def _rows_needing(mode: str, tickers: Optional[List[str]]) -> List[str]:
    """Tickers whose stored row is actually missing what `mode` fills."""
    from backend.shared.database import get_db_session
    from backend.shared.models import ScreenerDailyMetric
    from sqlalchemy import select

    if mode == "fundamentals":
        # A ratio is the signal: any is NULL means it was never sourced.
        condition = ScreenerDailyMetric.pe_ratio.is_(None) | ScreenerDailyMetric.roce_pct.is_(None)
    elif mode == "technicals":
        condition = ScreenerDailyMetric.close_price.is_(None)
    elif mode == "names":
        # `name == ticker` is what the pipeline writes when it has no real name.
        from sqlalchemy import func

        condition = func.upper(func.trim(ScreenerDailyMetric.name)) == ScreenerDailyMetric.ticker
    else:  # sectors — no real classification, or one this script wrote before
        from sqlalchemy import func
        from backend.research.screener_engines import UNCLASSIFIED_SECTOR_LABELS

        rewritable = sorted(
            {label.lower() for label in UNCLASSIFIED_SECTOR_LABELS if label}
            | {label.lower() for label in SECTOR_LABEL_VOCABULARY}
            | LEGACY_SECTOR_LABELS
        )
        condition = ScreenerDailyMetric.sector.is_(None) | (
            func.lower(func.trim(ScreenerDailyMetric.sector)).in_(rewritable)
        )

    with get_db_session() as session:
        stmt = select(ScreenerDailyMetric.ticker).where(condition)
        if tickers:
            stmt = stmt.where(ScreenerDailyMetric.ticker.in_(tickers))
        return [str(r[0]) for r in session.execute(stmt.order_by(ScreenerDailyMetric.ticker))]


def _fill_fundamentals(ticker: str, dry_run: bool,
                       name_only: bool = False) -> Optional[Dict[str, Any]]:
    """Real ratios (and the company name) from Screener.in.

    Returns None when nothing verifiable came back, so the caller can report the
    row as still missing rather than pretending it was filled.
    """
    from backend.data.fundamentals import get_fundamentals

    raw = get_fundamentals(ticker) or {}
    payload: Dict[str, Any] = {"ticker": ticker}

    # The real company name, so the row stops displaying its ticker as a name.
    # `name == ticker` only ever means "unknown", so the merge never lets a bare
    # ticker overwrite a real stored name either.
    scraped_name = str(raw.get("company_name") or "").strip()
    if scraped_name and scraped_name.upper() != ticker:
        payload["name"] = scraped_name

    if not name_only:
        from backend.research.screener_engines import market_cap_category

        for source_key, column in _FUNDAMENTAL_FIELD_MAP.items():
            value = raw.get(source_key)
            if value is None or value == "":
                continue
            try:
                payload[column] = float(value)
            except (TypeError, ValueError):
                continue
        # A market cap without a category is a half-filled field: derive the
        # category from the same thresholds the pipeline uses.
        if payload.get("market_cap_cr") is not None:
            category = market_cap_category(payload["market_cap_cr"])
            if category:
                payload["market_cap_cat"] = category

        # A price is also verifiable here and never overwrites a real stored
        # quote with nothing, thanks to the gap-fill merge.
        price = raw.get("current_price")
        if price not in (None, ""):
            try:
                parsed = float(price)
                if parsed > 0:
                    payload["close_price"] = parsed
            except (TypeError, ValueError):
                pass

    if len(payload) <= 1:
        return None
    if not dry_run:
        from backend.data.database import upsert_screener_daily_metric

        upsert_screener_daily_metric(payload)
    return payload


def _fill_technicals(ticker: str, sector_hint: Optional[str], dry_run: bool) -> Optional[str]:
    """1Y daily OHLCV -> real indicators. Returns a failure reason, or None on success."""
    from backend.data.fetcher import fetch_stock_data
    from backend.research.screener_pipeline import compute_metrics_from_ohlcv

    try:
        df = fetch_stock_data(ticker, period="1Y", interval="1d")
    except Exception as exc:
        return f"fetch failed: {type(exc).__name__}"
    if df is None or df.empty or len(df) < 5:
        return "no OHLCV available"

    # Synthesis must never reach the screener table.
    if df.attrs.get("data_source") in {"synthesized", "synthesized_market_baseline"}:
        return "synthesized data rejected"

    meta = {"sector": sector_hint} if sector_hint else None
    metrics = compute_metrics_from_ohlcv(ticker, df, meta, use_live_price=False)
    if not metrics:
        return "indicators could not be computed"
    if not dry_run:
        from backend.data.database import upsert_screener_daily_metric

        upsert_screener_daily_metric(metrics)
    return None


def _fill_sector(ticker: str, label: str, dry_run: bool) -> None:
    if dry_run:
        return
    from backend.data.database import upsert_screener_daily_metric

    # Carries the sector alone; the merge leaves every other column untouched.
    upsert_screener_daily_metric({"ticker": ticker, "sector": label})


def _clear_wrong_sector(ticker: str, dry_run: bool) -> None:
    """Resets a label this script wrote when it no longer has any basis.

    A ticker with no single sector index (or none at all) must not keep the
    label an earlier pass guessed from an ambiguous one — otherwise the rotation
    chart still draws a bar built from a stale guess. `clear_fields` names the
    field explicitly, since a gap-fill would otherwise preserve it forever.
    """
    if dry_run:
        return
    from backend.data.database import upsert_screener_daily_metric

    upsert_screener_daily_metric({"ticker": ticker}, clear_fields=["sector"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fundamentals", action="store_true",
                        help="fill market cap + pe/pb/roe/roce/debt from Screener.in")
    parser.add_argument("--technicals", action="store_true",
                        help="fill price + indicators from 1Y daily OHLCV")
    parser.add_argument("--sectors", action="store_true",
                        help="classify sector from real index membership")
    parser.add_argument("--names", action="store_true",
                        help="fill the real company name for rows still showing their ticker")
    parser.add_argument("--all", action="store_true", help="run every stage")
    parser.add_argument("--limit", type=int, default=None, help="max tickers per stage")
    parser.add_argument("--sleep", type=float, default=1.0, help="seconds between network calls")
    parser.add_argument("--tickers", type=str, default=None, help="comma-separated subset")
    parser.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    parser.add_argument("--force", action="store_true",
                        help="include rows that already look covered")
    args = parser.parse_args()

    if not any((args.fundamentals, args.technicals, args.sectors, args.names, args.all)):
        parser.error("choose at least one of --fundamentals / --technicals / --sectors "
                     "/ --names / --all")

    stages = {
        "fundamentals": args.all or args.fundamentals,
        "technicals": args.all or args.technicals,
        "sectors": args.all or args.sectors,
        "names": args.all or args.names,
    }
    subset = [t.strip().upper() for t in args.tickers.split(",")] if args.tickers else None

    before = _coverage_snapshot()
    _print_coverage("before", before)
    if args.dry_run:
        # Worth stating plainly: dry-run still performs the real network fetches,
        # it only skips the writes. So a dry run of 380 rows is a 380-request run.
        print("\n(dry run — nothing will be written, but real data is still fetched; "
              "combine with --limit to bound the cost)")

    summary: Dict[str, Dict[str, int]] = {}

    if stages["sectors"]:
        sector_map, ambiguous = _sector_map()
        needs = list(_rows_needing("sectors", subset))
        needs_set = set(needs)

        # Only rows with no real classification, or one this script wrote, are
        # touched: a curated-meta sector is never relabelled from an index name.
        targets = sorted(t for t in sector_map if t in needs_set)
        if args.limit is not None:
            targets = targets[:args.limit]

        corrected = 0
        for ticker in targets:
            _fill_sector(ticker, sector_map[ticker], args.dry_run)
            corrected += 1

        # Rows still holding a label this script wrote, but that no single index
        # supports, go back to unclassified instead of keeping a stale guess.
        current = _current_sectors(needs)
        stale = [
            t for t in needs
            if t not in sector_map
            and str(current.get(t) or "").strip().lower() in LEGACY_SECTOR_LABELS
        ]
        for ticker in stale:
            _clear_wrong_sector(ticker, args.dry_run)

        unresolved = [t for t in needs if t not in sector_map and t not in set(stale)]
        no_index = [t for t in unresolved if t not in ambiguous]
        undecidable = [t for t in unresolved if t in ambiguous]
        summary["sectors"] = {"classified": corrected,
                              "cleared_stale": len(stale),
                              "ambiguous": len(undecidable),
                              "no_sector_index": len(no_index)}
        print(f"\n[sectors] {corrected} row(s) labelled from a single real sector index.")
        if stale:
            print(f"[sectors] {len(stale)} row(s) held a label an earlier pass wrote and no "
                  f"single index supports — reset to unclassified rather than kept.")
        print(f"[sectors] {len(undecidable)} row(s) sit in more than one sector index — "
              f"index providers rank them by primary business and this script cannot "
              f"reconstruct that, so they stay unclassified.")
        print(f"[sectors] {len(no_index)} row(s) belong to no sector index at all — "
              f"a real answer, not a guess.")
        if no_index and subset is None:
            print(f"    no index: {', '.join(no_index[:12])}")
        if undecidable and subset is None:
            sample = ", ".join(
                "{} ({})".format(t, "/".join(ambiguous[t])) for t in undecidable[:6]
            )
            print(f"    ambiguous: {sample}")

    for mode in ("fundamentals", "names", "technicals"):
        if not stages[mode]:
            continue
        targets = _rows_needing(mode, subset)
        if args.force:
            targets = subset or targets
        if args.limit is not None:
            targets = targets[:args.limit]

        if not targets:
            print(f"\n[{mode}] nothing missing — every row already has it.")
            summary[mode] = {"attempted": 0, "filled": 0, "unavailable": 0}
            continue

        print(f"\n[{mode}] {len(targets)} row(s) missing this; starting...")
        filled = 0
        unavailable: List[Tuple[str, str]] = []
        for idx, ticker in enumerate(targets, start=1):
            try:
                if mode in ("fundamentals", "names"):
                    result = _fill_fundamentals(ticker, args.dry_run,
                                                name_only=(mode == "names"))
                    if result:
                        filled += 1
                    else:
                        unavailable.append((ticker, "no verifiable fundamentals"))
                else:
                    hint = None
                    try:
                        from backend.data.database import get_screener_detail

                        hint = (get_screener_detail(ticker) or {}).get("sector")
                    except Exception:
                        hint = None
                    reason = _fill_technicals(ticker, hint, args.dry_run)
                    if reason is None:
                        filled += 1
                    else:
                        unavailable.append((ticker, reason))
            except Exception as exc:
                unavailable.append((ticker, f"{type(exc).__name__}: {exc}"))

            if idx % 10 == 0 or idx == len(targets):
                print(f"    {idx}/{len(targets)} — {filled} filled, {len(unavailable)} unavailable")
            if args.sleep > 0:
                time.sleep(args.sleep)

        summary[mode] = {"attempted": len(targets), "filled": filled,
                         "unavailable": len(unavailable)}
        print(f"[{mode}] filled {filled}/{len(targets)}.")
        if unavailable:
            print(f"[{mode}] still missing ({len(unavailable)}):")
            for ticker, reason in unavailable[:25]:
                print(f"    {ticker}: {reason}")
            if len(unavailable) > 25:
                print(f"    … and {len(unavailable) - 25} more")

    after = _coverage_snapshot()
    _print_coverage("after", after)

    print("\n=== delta ===")
    for key in ("ok", "partial", "no_data", "with_fundamentals", "priced"):
        delta = (after.get(key) or 0) - (before.get(key) or 0)
        print(f"  {key}: {before.get(key)} -> {after.get(key)}  ({delta:+d})")

    remaining = [f"{k}: {v['unavailable']} unavailable" for k, v in summary.items()
                 if isinstance(v, dict) and v.get("unavailable")]
    if remaining:
        print("\nStill missing real data (no value was invented to hide it):")
        for line in remaining:
            print(f"  {line}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
