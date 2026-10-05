# StockOracle Pro - screener_daily_metrics operations (merge/upsert/query).
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

# ── Screener Platform Database Operations ────────────────────────────────────

def merge_screener_metric(existing: Optional[dict], incoming: dict,
                          ticker: Optional[str] = None,
                          clear_fields: Optional[Iterable[str]] = None) -> dict:
    """Gap-fill merge: an incoming payload may only make a row *better*.

    The upsert used to be a blind overwrite. Every base column is always present
    in the incoming dict, carrying ``None`` when the caller had no value for it,
    so any partial write erased good stored data. Concretely, a refresh of a row
    whose fundamentals could not be fetched NULLed the pe/roe/roce already on it,
    and the refresh loop — which gets ``sector``/``name`` only from curated meta —
    blanked the sector of the 382 rows that do have real technicals.

    Rules, in order:

    * a value the payload does not carry (``None``) never clears a stored one;
    * a placeholder sector label never replaces a real classification (it means
      "not classified", not "the sector is Diversified");
    * a name that is just the ticker never replaces a real company name.

    ``existing`` is a mapping of the stored row (or ``None`` for an insert).

    ``clear_fields`` is the escape hatch: a value can only be removed by naming
    it, because "absent" and "known to be wrong" are different things. A repair
    pass that determines a previously written sector was not a real
    classification must say so explicitly — the gap-fill rules would otherwise
    keep the wrong value forever.
    """
    incoming = dict(incoming)
    if existing:
        from backend.research.screener_engines import UNCLASSIFIED_SECTOR_LABELS
        for key in list(incoming.keys()):
            if key in ("ticker", "data_status"):
                continue
            value = incoming[key]
            stored = existing.get(key)
            if value is None and stored is not None:
                incoming[key] = stored
            elif key == "sector" and stored is not None:
                if str(value or "").strip().lower() in UNCLASSIFIED_SECTOR_LABELS:
                    incoming[key] = stored
            elif key == "name" and value == ticker and stored not in (None, ticker):
                incoming[key] = stored

    for key in (clear_fields or ()):
        if key in incoming and key not in ("ticker", "name"):
            incoming[key] = None

    # `name` is NOT NULL — a row with no real name still needs a usable label.
    if not incoming.get("name"):
        incoming["name"] = incoming.get("ticker") or ticker
    return incoming


def upsert_screener_daily_metric(row_data: dict,
                                 clear_fields: Optional[Iterable[str]] = None) -> None:
    """Inserts or updates precomputed daily metrics for a ticker via SQLAlchemy ORM.

    Three honesty rules are enforced here, on the one write path every producer
    (seed, backfill, daily refresh) goes through:

    * **a missing price is stored as NULL, never as a placeholder.** This used to
      default to      ``100.0``, which made 200 seeded rows render a fabricated
      ``₹100.00`` quote in the screener's Price column;
    * **a payload may only make the row better** — a field the caller does not
      carry never clears a stored value. See `merge_screener_metric`; the
      ``clear_fields`` argument is the explicit way to remove one;
    * **``data_status`` is derived from the row's real coverage**, not taken from
      the caller, so no row can claim ``OK`` while its price or core indicators
      are missing.
    """
    now_str = datetime.now().isoformat()
    ticker = str(row_data.get("ticker", "")).upper().strip()
    if not ticker:
        return

    _close_raw = row_data.get("close_price")
    _close_val: Optional[float] = None
    if _close_raw not in (None, ""):
        try:
            _parsed = float(_close_raw)
            # A non-positive price is not a quote.
            _close_val = _parsed if _parsed > 0 else None
        except (TypeError, ValueError):
            _close_val = None

    metric_dict = {
        "ticker": ticker,
        "name": row_data.get("name", ticker),
        "sector": row_data.get("sector"),
        "industry": row_data.get("industry"),
        "market_cap_cr": float(row_data["market_cap_cr"]) if row_data.get("market_cap_cr") is not None else None,
        "market_cap_cat": str(row_data["market_cap_cat"]) if row_data.get("market_cap_cat") else None,
        "close_price": _close_val,
        "change_1d_pct": float(row_data["change_1d_pct"]) if row_data.get("change_1d_pct") is not None else None,
        "change_1w_pct": float(row_data["change_1w_pct"]) if row_data.get("change_1w_pct") is not None else None,
        "change_1m_pct": float(row_data["change_1m_pct"]) if row_data.get("change_1m_pct") is not None else None,
        "change_1y_pct": float(row_data["change_1y_pct"]) if row_data.get("change_1y_pct") is not None else None,
        "distance_52w_high_pct": float(row_data["distance_52w_high_pct"]) if row_data.get("distance_52w_high_pct") is not None else None,
        "distance_52w_low_pct": float(row_data["distance_52w_low_pct"]) if row_data.get("distance_52w_low_pct") is not None else None,
        "rsi_14": float(row_data["rsi_14"]) if row_data.get("rsi_14") is not None else None,
        "macd_signal": str(row_data["macd_signal"]) if row_data.get("macd_signal") else None,
        "sma_20": float(row_data["sma_20"]) if row_data.get("sma_20") is not None else None,
        "sma_50": float(row_data["sma_50"]) if row_data.get("sma_50") is not None else None,
        "sma_200": float(row_data["sma_200"]) if row_data.get("sma_200") is not None else None,
        "volume_ratio_20d": float(row_data["volume_ratio_20d"]) if row_data.get("volume_ratio_20d") is not None else None,
        "pe_ratio": float(row_data["pe_ratio"]) if row_data.get("pe_ratio") is not None else None,
        "pb_ratio": float(row_data["pb_ratio"]) if row_data.get("pb_ratio") is not None else None,
        "roe_pct": float(row_data["roe_pct"]) if row_data.get("roe_pct") is not None else None,
        "roce_pct": float(row_data["roce_pct"]) if row_data.get("roce_pct") is not None else None,
        "debt_to_equity": float(row_data["debt_to_equity"]) if row_data.get("debt_to_equity") is not None else None,
        "sales_growth_3y": float(row_data["sales_growth_3y"]) if row_data.get("sales_growth_3y") is not None else None,
        "profit_growth_3y": float(row_data["profit_growth_3y"]) if row_data.get("profit_growth_3y") is not None else None,
        "pcr": float(row_data["pcr"]) if row_data.get("pcr") is not None else None,
        "max_pain": float(row_data["max_pain"]) if row_data.get("max_pain") is not None else None,
        "iv": float(row_data["iv"]) if row_data.get("iv") is not None else None,
        "ai_consensus_score": float(row_data["ai_consensus_score"]) if row_data.get("ai_consensus_score") is not None else None,
        "ai_signal": str(row_data["ai_signal"]) if row_data.get("ai_signal") else None,
        "ai_confidence_score": float(row_data["ai_confidence_score"]) if row_data.get("ai_confidence_score") is not None else None,
        "updated_at": now_str,
    }

    # Institutional extension: copy any known extended metric when provided.
    # Unknown keys are ignored so legacy callers keep working unchanged.
    _extended_float_keys = [
        "ema_9", "ema_20", "ema_50", "ema_200", "adx_14", "atr_pct",
        "bb_width_pct", "bb_position", "stoch_k", "stoch_d", "cci_20",
        "roc_12", "williams_r", "macd_hist", "supertrend_dir",
        "vwap_dist_pct", "hist_vol_20", "high_52w", "low_52w",
        "pos_52w_pct", "support_price", "resistance_price",
        "breakout_strength", "regime_confidence", "rs_vs_nifty_pct",
        "rs_vs_sector_pct", "confluence_score", "ai_trend_score",
        "ai_momentum_score", "ai_volatility_score", "ai_pattern_score",
        "sentiment_score",
    ]
    for _k in _extended_float_keys:
        if row_data.get(_k) is not None:
            try:
                metric_dict[_k] = float(row_data[_k])
            except Exception:
                pass
    # NOTE: data_status is deliberately absent — it is derived below, never
    # copied from the caller.
    _extended_str_keys = [
        "macd_crossover", "structure_label", "trend_hint", "retest_status",
        "liquidity_sweep", "momentum_state", "ema_alignment",
        "market_regime", "sentiment_label",
    ]
    for _k in _extended_str_keys:
        if row_data.get(_k) is not None:
            metric_dict[_k] = str(row_data[_k])[:40]
    _extended_int_keys = [
        "breakout_52w_high", "breakdown_52w_low", "resistance_breakout",
        "support_breakdown", "volume_breakout", "consolidation", "news_count",
    ]
    for _k in _extended_int_keys:
        if row_data.get(_k) is not None:
            try:
                metric_dict[_k] = int(bool(row_data[_k])) if _k != "news_count" else int(row_data[_k])
            except Exception:
                pass
    for _k in ["why_json", "confluence_json"]:
        if row_data.get(_k) is not None:
            metric_dict[_k] = str(row_data[_k])[:4000]

    with get_db_session() as session:
        dialect = session.bind.dialect.name if session.bind else "sqlite"
        table = ScreenerDailyMetric.__table__

        # ── Gap-fill merge (third honesty rule) ──────────────────────────────
        # The upsert was a blind overwrite: every base column is always present
        # in `metric_dict`, carrying None when the caller had no value for it,
        # so ANY partial payload erased good stored data. That made every
        # backfill destructive — refreshing a row whose fundamentals could not
        # be fetched NULLed the pe/roe/roce already on it, and the refresh loop
        # (which gets sector/name only from curated meta) blanked the sector of
        # the 382 rows that have real technicals. Merge first, so a producer can
        # supply a subset and still make the row strictly better.
        existing = session.execute(
            select(*[table.c[k] for k in metric_dict if k != "ticker"])
            .where(table.c.ticker == ticker)
        ).mappings().first()

        metric_dict = merge_screener_metric(existing, metric_dict, ticker=ticker,
                                            clear_fields=clear_fields)

        # Derived last, from the MERGED row, so the flag describes what the row
        # will actually contain after this write rather than this payload alone.
        from backend.research.screener_engines import derive_screener_data_status
        metric_dict["data_status"] = derive_screener_data_status(metric_dict)

        if dialect == "sqlite":
            stmt = sqlite_insert(ScreenerDailyMetric).values(metric_dict)
            update_cols = {k: v for k, v in metric_dict.items() if k != "ticker"}
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker"],
                set_=update_cols
            )
            session.execute(stmt)
        elif dialect == "postgresql":
            stmt = pg_insert(ScreenerDailyMetric).values(metric_dict)
            update_cols = {k: v for k, v in metric_dict.items() if k != "ticker"}
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker"],
                set_=update_cols
            )
            session.execute(stmt)
        else:
            session.merge(ScreenerDailyMetric(**metric_dict))



def execute_screener_sql_query(
    where_clause: str = "1=1",
    params: Any = None,
    sort_by: str = "market_cap_cr",
    sort_dir: str = "DESC",
    limit: int = 50,
    offset: int = 0
) -> dict:
    """Executes indexed SQL filter query against screener_daily_metrics table."""
    if params is None:
        params = {} if ":" in where_clause else ()
    elif isinstance(params, list):
        params = tuple(params)

    allowed_sorts = {
        "market_cap_cr", "close_price", "change_1d_pct", "change_1w_pct",
        "change_1m_pct", "rsi_14", "pe_ratio",
        "pb_ratio", "roe_pct", "roce_pct", "debt_to_equity", "volume_ratio_20d",
        "sales_growth_3y", "profit_growth_3y", "ai_consensus_score",
        "ai_confidence_score", "confluence_score", "adx_14", "atr_pct",
        "pos_52w_pct", "distance_52w_high_pct", "ema_50", "ema_200",
        "stoch_k", "cci_20", "roc_12", "hist_vol_20", "breakout_strength",
        "regime_confidence", "rs_vs_nifty_pct", "ticker", "sector",
        # ── Must cover EVERY sortable column the screener UI exposes ──
        # Any key missing here is silently ORDER BY'd by market_cap_cr while the
        # client still re-sorts the returned page, so the user sees a truncated
        # (wrong) ranking. Keep this set a superset of
        # frontend/src/components/screener/screenerColumns.js ALL_COLUMNS keys.
        "name", "trend_hint", "ai_signal", "macd_hist", "macd_crossover",
        "ema_9", "ema_20", "ema_alignment", "supertrend_dir", "stoch_d",
        "williams_r", "momentum_state", "volume_breakout", "structure_label",
        "market_regime", "support_price", "resistance_price", "retest_status",
        "bb_width_pct", "bb_position", "vwap_dist_pct", "high_52w", "low_52w",
        "ai_trend_score", "ai_momentum_score", "ai_pattern_score",
        "sentiment_label", "news_count", "distance_52w_low_pct",
    }
    safe_sort = sort_by if sort_by in allowed_sorts else "market_cap_cr"
    safe_dir = "ASC" if str(sort_dir).upper() == "ASC" else "DESC"

    try:
        # Convert positional ? placeholders to named :p0, :p1 for SQLAlchemy portability across SQLite & PostgreSQL
        named_where = where_clause
        if isinstance(params, dict):
            bind_params = params
        else:
            bind_params = {}
        if params and not isinstance(params, dict):
            for i, p in enumerate(params):
                named_where = named_where.replace("?", f":p{i}", 1)
                bind_params[f"p{i}"] = p

        query_sql = f"""
            SELECT *
            FROM screener_daily_metrics
            WHERE {named_where}
            ORDER BY {safe_sort} {safe_dir}
            LIMIT {max(1, min(limit, 5000))} OFFSET {max(0, offset)}
        """

        count_sql = f"""
            SELECT COUNT(*) as total_count
            FROM screener_daily_metrics
            WHERE {named_where}
        """

        with get_db_session() as session:
            total_res = session.execute(text(count_sql), bind_params).first()
            total = int(total_res[0]) if total_res and total_res[0] is not None else 0
            rows = session.execute(text(query_sql), bind_params).mappings().all()
            results = [dict(r) for r in rows]
            # Unfiltered universe size so callers can show "N of M stocks" and
            # users can tell filter-excluded apart from missing-data rows.
            univ_res = session.execute(text("SELECT COUNT(*) FROM screener_daily_metrics")).first()
            universe_total = int(univ_res[0]) if univ_res and univ_res[0] is not None else 0

        return {
            "total": total,
            "count": len(results),
            "results": results,
            "universe_total": universe_total,
        }
    except Exception as e:
        logger.warning("execute_screener_sql_query error for where=%s: %s", where_clause, e)
        return {
            "total": 0,
            "count": 0,
            "results": [],
            "universe_total": 0,
        }


def get_screener_overview_stats() -> dict:
    """Aggregated institutional overview directly from real screener rows.

    Returns overview cards, market breadth, sector rotation and an explicit
    coverage breakdown computed from the screener_daily_metrics table (no fake
    values; empty table -> zeros).

    ``coverage`` exists so the UI can say "N of M with data" instead of
    presenting a tracked-universe count as if every row carried metrics — the
    difference is the reason a screen can legitimately match only a handful of
    stocks. ``sectors_excluded`` reports the rows the rotation chart refuses to
    plot rather than silently absorbing them into one bar.
    """
    empty = {
        "cards": {}, "breadth": {"total": 0, "data_status": "N/A"},
        "sectors": [], "total": 0, "data_status": "N/A",
        "coverage": {"total": 0, "ok": 0, "partial": 0, "no_data": 0,
                     "with_fundamentals": 0, "priced": 0},
        "sectors_excluded": None,
        "latest_updated_at": None,
        "metrics_as_of": None,
    }
    try:
        from backend.research.screener_engines import (
            compute_overview_cards, compute_market_breadth, compute_sector_rotation,
            compute_sector_exclusions, derive_screener_data_status,
            FUNDAMENTAL_CORE_FIELDS,
        )
        with get_db_session() as session:
            rows = session.execute(text("SELECT * FROM screener_daily_metrics LIMIT 2000")).mappings().all()
            all_rows = [dict(r) for r in rows]
        if not all_rows:
            return dict(empty)

        coverage = {
            "total": len(all_rows), "ok": 0, "partial": 0, "no_data": 0,
            "with_fundamentals": 0, "priced": 0,
        }
        latest = None
        covered_dates: List[str] = []
        for r in all_rows:
            status = str(r.get("data_status") or "").upper()
            if status not in ("OK", "PARTIAL", "NO_DATA"):
                status = derive_screener_data_status(r)
            coverage[{"OK": "ok", "PARTIAL": "partial", "NO_DATA": "no_data"}[status]] += 1
            if r.get("close_price") is not None:
                coverage["priced"] += 1
            if all(r.get(f) is not None for f in FUNDAMENTAL_CORE_FIELDS):
                coverage["with_fundamentals"] += 1
            # Staleness is judged over rows that actually carry metrics. Rows
            # with NO_DATA hold no computed values, so re-writing them says
            # nothing about freshness; including them made an old table look
            # current after any rescrape. ``latest_updated_at`` is reported for
            # display, but ``metrics_as_of`` (the median covered date) is what
            # the stale flag uses: a handful of freshly rewritten rows must not
            # be able to declare the whole table current.
            if status == "NO_DATA":
                continue
            ts = str(r.get("updated_at") or "")
            if ts:
                covered_dates.append(ts[:10])
                if latest is None or ts > latest:
                    latest = ts

        metrics_as_of = None
        if covered_dates:
            covered_dates.sort()
            metrics_as_of = covered_dates[len(covered_dates) // 2]

        return {
            "cards": compute_overview_cards(all_rows),
            "breadth": compute_market_breadth(all_rows),
            "sectors": compute_sector_rotation(all_rows),
            "total": len(all_rows),
            "coverage": coverage,
            "sectors_excluded": compute_sector_exclusions(all_rows),
            "latest_updated_at": latest,
            "metrics_as_of": metrics_as_of,
            "data_status": "OK" if coverage["no_data"] < len(all_rows) else "N/A",
        }
    except Exception as exc:
        logger.warning("get_screener_overview_stats failed: %s", exc)
        return {**empty, "data_status": "STALE"}


def get_screener_detail(ticker: str) -> Optional[dict]:
    """Full institutional detail row for the side panel, including why/notes."""
    import json as _json
    t = (ticker or "").upper().strip()
    if not t:
        return None
    try:
        with get_db_session() as session:
            row = session.execute(
                text("SELECT * FROM screener_daily_metrics WHERE ticker = :t LIMIT 1"),
                {"t": t},
            ).mappings().first()
            if not row:
                return None
            detail = dict(row)
        for _jk in ("why_json", "confluence_json"):
            raw = detail.get(_jk)
            if isinstance(raw, str) and raw:
                try:
                    detail[_jk.replace("_json", "_parsed")] = _json.loads(raw)
                except Exception:
                    detail[_jk.replace("_json", "_parsed")] = None
        return detail
    except Exception as exc:
        logger.warning("get_screener_detail(%s) failed: %s", t, exc)
        return None
