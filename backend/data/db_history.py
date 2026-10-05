# StockOracle Pro - daily historical_prices storage (strict YYYY-MM-DD).
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

# ── Historical Prices ──────────────────────────────────────────────────────────

def clear_ticker_history(ticker: str):
    """Deletes all historical price records for a specific ticker to clean stale/corrupted data."""
    if not ticker:
        return
    ticker = ticker.upper()
    with get_db_session() as session:
        session.execute(delete(HistoricalPrice).where(HistoricalPrice.ticker == ticker))
    logger.info("Cleared old historical DB records for %s.", ticker)


def purge_stale_partial_history(min_rows: int = 5):
    """Purges tickers that only have fewer than min_rows daily records, allowing fresh backfills."""
    try:
        with get_db_session() as session:
            session.execute(text("""
                DELETE FROM historical_prices 
                WHERE ticker IN (
                    SELECT ticker FROM historical_prices GROUP BY ticker HAVING count(*) < :min_rows
                )
            """), {"min_rows": min_rows})
    except Exception as e:
        logger.debug("purge_stale_partial_history notice: %s", e)


def clear_all_stored_price_data():
    """
    Clears all stored historical and cached price data across the database:
    - historical_prices
    - intraday_candles
    - live_ticks
    - company_info
    - predictions
    - screener_results
    - screener_daily_metrics
    - monte_carlo
    Preserves stock_universe (instrument tokens) and broker_accounts!
    """
    tables_to_clear = [
        "historical_prices",
        "intraday_candles",
        "live_ticks",
        "company_info",
        "predictions",
        "screener_results",
        "screener_daily_metrics",
        "monte_carlo",
    ]
    with get_db_session() as session:
        for table in tables_to_clear:
            try:
                session.execute(text(f"DELETE FROM {table};"))
            except Exception as e:
                logger.warning("Could not clear table %s: %s", table, e)
        session.commit()
    logger.info("Successfully cleared all stored price data from database.")



def _normalize_price(v):
    try:
        val = float(v)
        if np.isnan(val) or val <= 0:
            return None
        return round(val, 2)
    except Exception:
        return None


def validate_and_sanitize_candles(df: pd.DataFrame) -> pd.DataFrame:
    """
    Validates and sanitizes an OHLCV DataFrame:
    1. Ensures all prices are positive and normalized.
    2. Enforces OHLC invariant: low <= min(open, close) and high >= max(open, close).
    3. Removes duplicate timestamps preserving the latest record.
    """
    if df is None or df.empty:
        return pd.DataFrame()

    clean_df = df.copy()
    if "date" in clean_df.columns:
        clean_df = clean_df.drop_duplicates(subset=["date"], keep="last")

    # Enforce positive prices
    for col in ["open", "high", "low", "close"]:
        if col in clean_df.columns:
            clean_df[col] = pd.to_numeric(clean_df[col], errors="coerce")
            clean_df = clean_df[clean_df[col] > 0]

    if clean_df.empty:
        return clean_df

    # Sanitize high and low bounds
    clean_df["high"] = clean_df[["high", "open", "close"]].max(axis=1)
    clean_df["low"] = clean_df[["low", "open", "close"]].min(axis=1)
    return clean_df


def _sanitize_volume(v) -> int:
    """Coerces volume to a non-negative int (NaN/negative/invalid -> 0)."""
    try:
        f = float(v)
        if np.isnan(f) or f < 0:
            return 0
        return int(f)
    except Exception:
        return 0


def _get_db_close_median(ticker: str) -> Optional[float]:
    """Returns median close for ticker from historical_prices, or None if unavailable."""
    try:
        with get_db_session() as session:
            stmt = select(HistoricalPrice.close).where(HistoricalPrice.ticker == ticker.upper())
            rows = session.execute(stmt).all()
            if not rows:
                return None
            vals = [float(r[0]) for r in rows if r[0] is not None and float(r[0]) > 0]
            if not vals:
                return None
            return float(pd.Series(vals).median())
    except Exception:
        return None


def clean_paise_and_outliers(ticker: str = None):
    """
    Scans historical_prices table, auto-corrects paise-to-rupee unit mismatches
    (close > 50 * median), and deletes corrupt/non-positive price rows via SQLAlchemy ORM.

    NOTE: HistoricalPrice PK is (ticker, date) — there is no `id` column,
    so paise rows are keyed on (ticker, date).
    """
    try:
        with get_db_session() as session:
            stmt = select(
                HistoricalPrice.ticker, HistoricalPrice.date,
                HistoricalPrice.open, HistoricalPrice.high,
                HistoricalPrice.low, HistoricalPrice.close,
            )
            if ticker:
                stmt = stmt.where(HistoricalPrice.ticker == ticker.upper())
            rows = session.execute(stmt).all()
            if not rows:
                return

            df = pd.DataFrame([
                {"ticker": r[0], "date": r[1], "close": float(r[5])} for r in rows
            ])
            if df.empty:
                return

            for t, group in df.groupby("ticker"):
                median_val = group["close"].median()
                try:
                    median_f = float(median_val)
                except (TypeError, ValueError):
                    continue
                if np.isnan(median_f) or median_f <= 0:
                    continue

                # Identify candidates (> 50x median, likely paise mismatch)
                paise_candidates = group[group["close"] > median_f * 50]
                if not paise_candidates.empty:
                    for _, prow in paise_candidates.iterrows():
                        session.execute(
                            text("UPDATE historical_prices SET open = open/100.0, high = high/100.0, low = low/100.0, close = close/100.0 WHERE ticker = :t AND date = :d"),
                            {"t": t, "d": prow["date"]}
                        )
                    logger.info("Normalized %d paise records to rupees for %s.", len(paise_candidates), t)
    except Exception as e:
        logger.error("Error in clean_paise_and_outliers: %s", e)

    # Always run invalid-row purge even if the paise pass above failed
    try:
        with get_db_session() as session:
            session.execute(text("DELETE FROM historical_prices WHERE close <= 0 OR high <= 0 OR open <= 0 OR low <= 0 OR length(date) != 10"))
    except Exception as e:
        logger.error("Error purging invalid rows in clean_paise_and_outliers: %s", e)


def save_historical_prices(ticker: str, df: pd.DataFrame):
    """
    Saves a DataFrame of daily historical prices into the database using SQLAlchemy 2.0 ORM.
    Strictly accepts only daily dates (YYYY-MM-DD) matching DATE_REGEX.
    Applies paise-to-rupee normalization (> 50x median) on the write path.
    """
    if df is None or df.empty:
        return

    ticker = ticker.upper()
    # Reference median for paise detection: prefer existing DB history,
    # fall back to the incoming batch median for partial-batch contamination.
    db_median = _get_db_close_median(ticker)
    try:
        batch_closes = pd.to_numeric(df["close"], errors="coerce")
        batch_closes = batch_closes[batch_closes > 0]
        batch_median = float(batch_closes.median()) if not batch_closes.empty else None
        if batch_median is not None and (np.isnan(batch_median) or batch_median <= 0):
            batch_median = None
    except Exception:
        batch_median = None
    ref_median = db_median if db_median else batch_median

    records = []
    for _, row in df.iterrows():
        try:
            raw_d = str(row["date"]).strip()
            if not DATE_REGEX.fullmatch(raw_d):
                # Reject any non-daily format (intraday timestamps, invalid strings)
                continue
            d_str = raw_d

            o_val = _normalize_price(row["open"])
            h_val = _normalize_price(row["high"])
            l_val = _normalize_price(row["low"])
            c_val = _normalize_price(row["close"])
            vol = _sanitize_volume(row.get("volume", 0))

            if o_val is None or h_val is None or l_val is None or c_val is None:
                continue
            # Paise-to-rupee normalization: outlier closes > 50x median are /100
            if ref_median and c_val > ref_median * 50:
                o_val = round(o_val / 100.0, 2)
                h_val = round(h_val / 100.0, 2)
                l_val = round(l_val / 100.0, 2)
                c_val = round(c_val / 100.0, 2)
                if o_val <= 0 or h_val <= 0 or l_val <= 0 or c_val <= 0:
                    continue
            records.append({
                "ticker": ticker,
                "date": d_str,
                "open": o_val,
                "high": max(h_val, o_val, c_val),
                "low": min(l_val, o_val, c_val),
                "close": c_val,
                "volume": vol,
            })
        except Exception:
            continue

    if not records:
        return

    # Chunked upserts: a single multi-row INSERT of a multi-year daily series
    # (7 vars x ~7000+ bars) exceeds SQLite's SQLITE_MAX_VARIABLE_NUMBER and
    # aborts the whole history write with "too many SQL variables", which in
    # turn 500s the chart history endpoint. 400 rows/chunk stays far below
    # the limit on both sqlite and postgres while keeping identical semantics.
    with get_db_session() as session:
        dialect = session.bind.dialect.name if session.bind else "sqlite"
        if dialect == "sqlite":
            for i in range(0, len(records), 400):
                chunk = records[i:i + 400]
                stmt = sqlite_insert(HistoricalPrice).values(chunk)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker", "date"],
                    set_={
                        "open": stmt.excluded.open,
                        "high": stmt.excluded.high,
                        "low": stmt.excluded.low,
                        "close": stmt.excluded.close,
                        "volume": stmt.excluded.volume,
                    }
                )
                session.execute(stmt)
        elif dialect == "postgresql":
            for i in range(0, len(records), 400):
                chunk = records[i:i + 400]
                stmt = pg_insert(HistoricalPrice).values(chunk)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker", "date"],
                    set_={
                        "open": stmt.excluded.open,
                        "high": stmt.excluded.high,
                        "low": stmt.excluded.low,
                        "close": stmt.excluded.close,
                        "volume": stmt.excluded.volume,
                    }
                )
                session.execute(stmt)
        else:
            for r in records:
                session.merge(HistoricalPrice(**r))


def get_historical_prices(ticker: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Optional[pd.DataFrame]:
    """
    Fetches historical daily price records for a ticker within an optional date range.
    Returns a Pandas DataFrame, or None if no records exist.
    """
    ticker = ticker.upper().strip()

    with get_db_session() as session:
        stmt = select(
            HistoricalPrice.date,
            HistoricalPrice.open,
            HistoricalPrice.high,
            HistoricalPrice.low,
            HistoricalPrice.close,
            HistoricalPrice.volume
        ).where(
            HistoricalPrice.ticker == ticker,
            func.length(HistoricalPrice.date) == 10
        )
        if start_date:
            stmt = stmt.where(HistoricalPrice.date >= str(start_date)[:10])
        if end_date:
            stmt = stmt.where(HistoricalPrice.date <= str(end_date)[:10])

        stmt = stmt.order_by(HistoricalPrice.date.asc())
        rows = session.execute(stmt).all()
        if not rows:
            return None
        return pd.DataFrame(
            [{"date": r[0], "open": float(r[1]), "high": float(r[2]), "low": float(r[3]), "close": float(r[4]), "volume": int(r[5] or 0)} for r in rows]
        )


def get_history_coverage(ticker: str) -> Tuple[int, str]:
    """
    Cheap whole-table coverage probe for a ticker's daily history.

    Returns (row_count, max_date_str) over ALL verified daily rows
    (length(date) == 10). Single aggregate query — no row materialization,
    safe on 7k+ row tables.

    Used by the fetcher's DB fast-path: bounded requests (e.g. 2Y ≈ 500 rows)
    must judge full-history/up-to-date state on the WHOLE table, never on the
    requested slice length (a 2Y slice is always < 2500 rows even when the DB
    holds complete inception history).
    """
    ticker = ticker.upper().strip()
    try:
        with get_db_session() as session:
            stmt = select(
                func.count(HistoricalPrice.date),
                func.max(HistoricalPrice.date),
            ).where(
                HistoricalPrice.ticker == ticker,
                func.length(HistoricalPrice.date) == 10,
            )
            row = session.execute(stmt).one()
            count = int(row[0] or 0)
            max_date = str(row[1] or "")[:10]
            return (count, max_date)
    except Exception as exc:
        logger.debug("get_history_coverage failed for %s: %s", ticker, exc)
        return (0, "")
