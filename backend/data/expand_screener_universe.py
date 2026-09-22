"""
StockOracle Pro — Screener Universe Backfill (REAL OHLCV only).

Fills screener_daily_metrics for every official index constituent (and the
curated master universe) that has no metrics row yet, computing all metrics
from actual 1Y daily OHLCV via the screener pipeline.

Zero fake data:
  * fundamentals (PE/PB/ROCE/ROE/D-E/growth) stay NULL for tickers without
    curated fundamentals — nothing is invented;
  * synthesized broker data is rejected outright;
  * legacy ticker rows (HUL, ZOMATO, TATAMOTORS) are migrated out once their
    renamed replacements exist in the official constituent universe.

Usage:
    python -m backend.data.expand_screener_universe                 # backfill all missing
    python -m backend.data.expand_screener_universe --universe "NIFTY 50"
    python -m backend.data.expand_screener_universe --limit 60      # first 60 missing only
    python -m backend.data.expand_screener_universe --dry-run       # list, don't write
"""
import argparse

from backend.data.database import init_db
from backend.research.screener_pipeline import (
    build_refresh_targets,
    refresh_screener_metrics_for_tickers,
)


def _existing_tickers() -> set:
    from sqlalchemy import select as _select

    from backend.shared.database import get_db_session
    from backend.shared.models import ScreenerDailyMetric

    with get_db_session() as session:
        rows = session.execute(_select(ScreenerDailyMetric.ticker)).all()
    return {str(r[0]).upper().strip() for r in rows}


def migrate_stale_symbols() -> list:
    """Deletes rows keyed by pre-rename symbols (official constituent rows replace them)."""
    from sqlalchemy import delete as _delete

    from backend.data.seed_screener_metrics import SYMBOL_MIGRATIONS
    from backend.shared.database import get_db_session
    from backend.shared.models import ScreenerDailyMetric

    migrated = []
    with get_db_session() as session:
        for old, new in SYMBOL_MIGRATIONS.items():
            try:
                res = session.execute(
                    _delete(ScreenerDailyMetric).where(ScreenerDailyMetric.ticker == old)
                )
                if res.rowcount:
                    migrated.append(f"{old} -> {new}")
            except Exception as exc:  # keep migrating siblings
                print(f"  ! migration {old}->{new} failed: {exc}")
    print(f"♻  Migrated {len(migrated)} stale symbols: {migrated}")
    return migrated


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill screener metrics from real OHLCV")
    parser.add_argument("--universe", default=None, help="restrict to one index universe, e.g. 'NIFTY 50'")
    parser.add_argument("--limit", type=int, default=None, help="backfill at most N missing tickers")
    parser.add_argument("--sleep", type=float, default=1.2, help="seconds between broker fetches")
    parser.add_argument("--dry-run", action="store_true", help="list missing tickers without writing")
    args = parser.parse_args()

    init_db()

    all_targets = [m["ticker"] for m in build_refresh_targets()]
    if args.universe:
        from backend.data.index_constituents import resolve_universe

        scoped = resolve_universe(args.universe)
        if scoped is None:
            raise SystemExit(f"Unknown universe: {args.universe}")
        universe_set = set(scoped)
        curated_set = set(all_targets)
        all_targets = [t for t in all_targets if t in universe_set]
        all_targets += [t for t in scoped if t not in curated_set]

    existing = _existing_tickers()
    missing = [t for t in all_targets if t not in existing]
    print(
        f"🎯 Universe targets: {len(all_targets)} | already covered: "
        f"{len(all_targets) - len(missing)} | missing: {len(missing)}"
    )
    if args.dry_run:
        for t in missing[: args.limit or len(missing)]:
            print("   would backfill:", t)
        return

    migrate_stale_symbols()

    batch = missing[: args.limit] if args.limit else missing
    print(f"🚀 Backfilling {len(batch)} tickers from real OHLCV (sleep {args.sleep}s)...")
    results = refresh_screener_metrics_for_tickers(batch, sleep_s=args.sleep)
    summary = {k: v for k, v in results.items() if k != "errors"}
    print("✅ Backfill complete:", summary)
    if results.get("errors"):
        print("⚠  errors (first 10):")
        for err in results["errors"][:10]:
            print("   -", err)


if __name__ == "__main__":
    main()
