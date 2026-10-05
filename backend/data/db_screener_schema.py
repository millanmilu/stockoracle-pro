# StockOracle Pro - screener_daily_metrics DDL, migrations & repairs.
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

SCREENER_EXTENDED_COLUMNS = [
    ("ema_9", "FLOAT"), ("ema_20", "FLOAT"), ("ema_50", "FLOAT"), ("ema_200", "FLOAT"),
    ("adx_14", "FLOAT"), ("atr_pct", "FLOAT"), ("bb_width_pct", "FLOAT"), ("bb_position", "FLOAT"),
    ("stoch_k", "FLOAT"), ("stoch_d", "FLOAT"), ("cci_20", "FLOAT"), ("roc_12", "FLOAT"),
    ("williams_r", "FLOAT"), ("macd_hist", "FLOAT"), ("macd_crossover", "VARCHAR(30)"),
    ("supertrend_dir", "FLOAT"), ("vwap_dist_pct", "FLOAT"), ("hist_vol_20", "FLOAT"),
    ("high_52w", "FLOAT"), ("low_52w", "FLOAT"), ("pos_52w_pct", "FLOAT"),
    ("structure_label", "VARCHAR(40)"), ("trend_hint", "VARCHAR(20)"),
    ("support_price", "FLOAT"), ("resistance_price", "FLOAT"),
    ("breakout_52w_high", "INTEGER DEFAULT 0"), ("breakdown_52w_low", "INTEGER DEFAULT 0"),
    ("resistance_breakout", "INTEGER DEFAULT 0"), ("support_breakdown", "INTEGER DEFAULT 0"),
    ("volume_breakout", "INTEGER DEFAULT 0"), ("breakout_strength", "FLOAT"),
    ("retest_status", "VARCHAR(20)"), ("consolidation", "INTEGER DEFAULT 0"),
    ("liquidity_sweep", "VARCHAR(20)"),
    ("momentum_state", "VARCHAR(20)"), ("ema_alignment", "VARCHAR(30)"),
    ("market_regime", "VARCHAR(30)"), ("regime_confidence", "FLOAT"),
    ("rs_vs_nifty_pct", "FLOAT"), ("rs_vs_sector_pct", "FLOAT"),
    ("confluence_score", "FLOAT"), ("ai_trend_score", "FLOAT"),
    ("ai_momentum_score", "FLOAT"), ("ai_volatility_score", "FLOAT"),
    ("ai_pattern_score", "FLOAT"),
    ("sentiment_score", "FLOAT"), ("sentiment_label", "VARCHAR(30)"),
    ("news_count", "INTEGER DEFAULT 0"),
    ("why_json", "TEXT"), ("confluence_json", "TEXT"), ("data_status", "VARCHAR(20) DEFAULT 'OK'"),
]


def _ensure_screener_extended_columns() -> None:
    """Adds institutional screener columns to legacy screener_daily_metrics tables."""
    with get_db_session() as session:
        try:
            existing = {row[1] for row in session.execute(text("PRAGMA table_info(screener_daily_metrics)")).fetchall()}
        except Exception:
            existing = set()
        for col, ddl in SCREENER_EXTENDED_COLUMNS:
            if col not in existing:
                try:
                    session.execute(text(f"ALTER TABLE screener_daily_metrics ADD COLUMN {col} {ddl}"))
                except Exception as exc:
                    logger.debug("Add screener column %s skipped: %s", col, exc)
        for idx_name, col in [
            ("idx_screener_regime", "market_regime"),
            ("idx_screener_structure", "structure_label"),
            ("idx_screener_confluence", "confluence_score"),
            ("idx_screener_adx", "adx_14"),
        ]:
            try:
                session.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON screener_daily_metrics ({col})"))
            except Exception:
                pass


SCREENER_TABLE = "screener_daily_metrics"

# The price the legacy upsert wrote when it had none (`or 100.0`). Any row still
# carrying it *with no computed indicators* is a placeholder, not a quote.
LEGACY_PLACEHOLDER_CLOSE_PRICE = 100.0


def _ensure_screener_close_price_nullable() -> None:
    """Drops the legacy NOT NULL constraint on ``screener_daily_metrics.close_price``.

    ``Base.metadata.create_all()`` never ALTERs an existing table, so a database
    created before the column became nullable keeps ``close_price NOT NULL`` and
    every honest write of an unknown price would fail. SQLite cannot drop a
    NOT NULL constraint in place, so the table is rebuilt from the current model
    metadata inside a single transaction, with the row count verified before the
    swap. Idempotent: once the column is nullable this is a no-op.
    """
    from sqlalchemy import MetaData
    from sqlalchemy import inspect as sa_inspect
    from sqlalchemy.schema import CreateIndex, CreateTable

    try:
        inspector = sa_inspect(engine)
        if SCREENER_TABLE not in inspector.get_table_names():
            return
        cols = {c["name"]: c for c in inspector.get_columns(SCREENER_TABLE)}
        col = cols.get("close_price")
        if col is None or col.get("nullable", True):
            return  # already nullable (or table absent) — nothing to do
    except Exception as exc:
        logger.debug("close_price nullability probe skipped: %s", exc)
        return

    if engine.dialect.name == "postgresql":
        try:
            with engine.begin() as conn:
                conn.execute(text(
                    f"ALTER TABLE {SCREENER_TABLE} ALTER COLUMN close_price DROP NOT NULL"
                ))
            logger.info("✅ screener_daily_metrics.close_price is now nullable (postgres).")
        except Exception as exc:
            logger.warning("close_price DROP NOT NULL failed: %s", exc)
        return

    # SQLite: rebuild the table from current metadata (no in-place ALTER support).
    table = ScreenerDailyMetric.__table__
    tmp = f"{SCREENER_TABLE}__nullable_rebuild"
    staging = table.to_metadata(MetaData(), name=tmp)
    shared = [c.name for c in table.columns if c.name in cols]
    col_list = ", ".join(f'"{c}"' for c in shared)
    try:
        with engine.begin() as conn:
            # Replay the indexes that actually exist rather than regenerating them
            # from the model: this table carries hand-created idx_sdm_* indexes
            # that no longer appear in metadata, and losing them would silently
            # slow every screener scan.
            idx_sql = [
                r[0]
                for r in conn.execute(
                    text(
                        "SELECT sql FROM sqlite_master "
                        "WHERE type='index' AND tbl_name=:t AND sql IS NOT NULL"
                    ),
                    {"t": SCREENER_TABLE},
                ).fetchall()
                if r[0]
            ]
            conn.execute(text(f'DROP TABLE IF EXISTS "{tmp}"'))
            conn.execute(CreateTable(staging))
            conn.execute(text(
                f'INSERT INTO "{tmp}" ({col_list}) SELECT {col_list} FROM "{SCREENER_TABLE}"'
            ))
            src = int(conn.execute(text(f'SELECT COUNT(*) FROM "{SCREENER_TABLE}"')).scalar() or 0)
            moved = int(conn.execute(text(f'SELECT COUNT(*) FROM "{tmp}"')).scalar() or 0)
            if moved != src:
                raise RuntimeError(f"row count mismatch during rebuild ({moved} != {src})")
            conn.execute(text(f'DROP TABLE "{SCREENER_TABLE}"'))
            conn.execute(text(f'ALTER TABLE "{tmp}" RENAME TO "{SCREENER_TABLE}"'))
            for stmt in idx_sql:
                conn.execute(text(stmt))
            # Top up any model-declared index the legacy table was missing.
            for idx in table.indexes:
                try:
                    conn.execute(CreateIndex(idx, if_not_exists=True))
                except TypeError:  # older SQLAlchemy without if_not_exists
                    conn.execute(CreateIndex(idx))
        logger.info(
            "✅ screener_daily_metrics rebuilt — close_price is now nullable (%d rows, %d indexes replayed).",
            src, len(idx_sql),
        )
    except Exception as exc:
        logger.warning("screener_daily_metrics nullable migration failed (data untouched): %s", exc)


def repair_screener_placeholder_rows() -> int:
    """Clears prices fabricated by the legacy ``close_price or 100.0`` defaults.

    Only rows that are *unambiguously* placeholders are touched: the exact legacy
    sentinel price AND no computed indicators. A real ₹100.00 stock has
    technicals once refreshed, so it is never affected. Idempotent — a second
    run matches nothing. Returns the number of rows repaired.
    """
    try:
        with get_db_session() as session:
            res = session.execute(
                text(
                    f"UPDATE {SCREENER_TABLE} "
                    "SET close_price = NULL "
                    "WHERE close_price = :ph AND rsi_14 IS NULL AND change_1d_pct IS NULL"
                ),
                {"ph": LEGACY_PLACEHOLDER_CLOSE_PRICE},
            )
            repaired = int(res.rowcount or 0)
        if repaired:
            logger.info(
                "🧹 Cleared %d fabricated screener prices (legacy ₹%.0f placeholder).",
                repaired, LEGACY_PLACEHOLDER_CLOSE_PRICE,
            )
        return repaired
    except Exception as exc:
        logger.debug("screener placeholder repair skipped: %s", exc)
        return 0


def reconcile_screener_market_cap_category() -> int:
    """Derives ``market_cap_cat`` for rows that hold a cap but no category.

    A market cap without its LARGE/MID/SMALL label is a half-filled field: the
    cap screens work while the category filter silently misses the row. Thresholds
    live in `screener_engines.market_cap_category`, so this repair and every
    writer share one definition. Idempotent. Returns the number of rows fixed.
    """
    try:
        from backend.research.screener_engines import market_cap_category
    except Exception as exc:
        logger.debug("market-cap category reconciliation skipped: %s", exc)
        return 0
    try:
        fixed = 0
        with get_db_session() as session:
            rows = session.execute(
                text(f"SELECT ticker, market_cap_cr FROM {SCREENER_TABLE} "
                     "WHERE market_cap_cr IS NOT NULL AND market_cap_cat IS NULL")
            ).all()
            updates = [
                {"t": t, "c": market_cap_category(cap)}
                for t, cap in rows
                if market_cap_category(cap) is not None
            ]
            if updates:
                session.execute(
                    text(f"UPDATE {SCREENER_TABLE} SET market_cap_cat = :c WHERE ticker = :t"),
                    updates,
                )
                fixed = len(updates)
        if fixed:
            logger.info("✅ screener market-cap categories reconciled for %d rows.", fixed)
        return fixed
    except Exception as e:
        logger.debug("market-cap category reconciliation notice: %s", e)
        return 0


def reconcile_screener_data_status() -> int:
    """Re-derives ``data_status`` for stored rows instead of trusting the old value.

    ``upsert_screener_daily_metric`` derives the flag on every write, which
    covers new data but not rows written before the rule existed — those still
    claimed ``OK`` while missing a price or fundamentals. Runs on init because it
    is cheap (one pass over the metric table) and self-heals after any bulk
    import. Idempotent. Returns the number of rows corrected.
    """
    try:
        from backend.research.screener_engines import derive_screener_data_status
    except Exception as exc:
        logger.debug("data_status reconciliation skipped (engines unavailable): %s", exc)
        return 0
    try:
        fixed = 0
        with get_db_session() as session:
            rows = session.execute(text(f"SELECT * FROM {SCREENER_TABLE}")).mappings().all()
            updates = []
            for r in rows:
                row = dict(r)
                want = derive_screener_data_status(row)
                if str(row.get("data_status") or "") != want:
                    updates.append({"t": row.get("ticker"), "s": want})
            if updates:
                session.execute(
                    text(f"UPDATE {SCREENER_TABLE} SET data_status = :s WHERE ticker = :t"),
                    updates,
                )
                fixed = len(updates)
        if fixed:
            logger.info("🏷  Re-derived data_status for %d screener rows.", fixed)
        return fixed
    except Exception as exc:
        logger.debug("screener data_status reconciliation skipped: %s", exc)
        return 0
