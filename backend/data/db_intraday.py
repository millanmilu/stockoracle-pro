# StockOracle Pro - intraday_candles storage (never historical_prices).
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

def get_intraday_candles(ticker: str, interval: str, from_ts: Optional[str] = None) -> Optional[pd.DataFrame]:
    """
    Fetches stored intraday candles from the intraday_candles table.
    Returns a DataFrame with columns [date, open, high, low, close, volume] where
    'date' holds the ISO timestamp string (YYYY-MM-DD HH:MM:SS).
    Returns None if no records exist.

    NOTE: Intraday candles are NEVER stored in historical_prices (AGENTS.md invariant).
    """
    ticker = ticker.upper().strip()
    interval = interval.lower().strip()
    with get_db_session() as session:
        stmt = select(
            IntradayCandle.timestamp,
            IntradayCandle.open,
            IntradayCandle.high,
            IntradayCandle.low,
            IntradayCandle.close,
            IntradayCandle.volume,
        ).where(
            IntradayCandle.ticker == ticker,
            IntradayCandle.interval == interval,
        )
        if from_ts:
            stmt = stmt.where(IntradayCandle.timestamp >= from_ts)
        stmt = stmt.order_by(IntradayCandle.timestamp.asc())
        rows = session.execute(stmt).all()
        if not rows:
            return None
        return pd.DataFrame([
            {
                "date": r[0],
                "open": float(r[1]),
                "high": float(r[2]),
                "low": float(r[3]),
                "close": float(r[4]),
                "volume": int(r[5] or 0),
            }
            for r in rows
        ])


def save_intraday_candles(ticker: str, interval: str, df: pd.DataFrame) -> None:
    """
    Upserts intraday OHLCV candles into the intraday_candles table.
    df must contain columns: date (ISO timestamp str), open, high, low, close, volume.

    NOTE: This function must NEVER be called with daily ('1d') data — daily data belongs
    in historical_prices only (AGENTS.md invariant). The intraday_candles table is strictly
    for 1m, 5m, 15m, 30m, 1h intervals.
    """
    if df is None or df.empty:
        return
    ticker = ticker.upper().strip()
    interval = interval.lower().strip()

    # Guard: never persist daily data here
    if interval in ("1d", "1D"):
        logger.warning("save_intraday_candles called with '1d' interval for %s — skipping (use historical_prices).", ticker)
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    rows = []
    # Fast dict iteration (~10x faster than df.iterrows())
    for r in df.to_dict("records"):
        ts = str(r.get("date", "")).strip()
        if not ts:
            continue
        try:
            o = float(r.get("open", 0) or 0)
            h = float(r.get("high", 0) or 0)
            l = float(r.get("low", 0) or 0)
            c = float(r.get("close", 0) or 0)
            v = int(r.get("volume", 0) or 0)
        except (ValueError, TypeError):
            continue
        # OHLC sanity: skip corrupt candles
        if o <= 0 or h <= 0 or l <= 0 or c <= 0:
            continue
        if l > min(o, c) or h < max(o, c):
            continue
        rows.append({
            "ticker": ticker,
            "interval": interval,
            "timestamp": ts,
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": v,
        })

    if not rows:
        return

    with get_db_session() as session:
        dialect = session.bind.dialect.name if session.bind else "sqlite"
        if dialect in ("sqlite", "postgresql"):
            insert = sqlite_insert if dialect == "sqlite" else pg_insert
            for i in range(0, len(rows), 1000):
                stmt = insert(IntradayCandle).values(rows[i:i + 1000])
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker", "interval", "timestamp"],
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
            for r in rows:
                existing = session.execute(
                    select(IntradayCandle).where(
                        IntradayCandle.ticker == r["ticker"],
                        IntradayCandle.interval == r["interval"],
                        IntradayCandle.timestamp == r["timestamp"],
                    )
                ).scalar_one_or_none()
                if existing:
                    for k, v in r.items():
                        setattr(existing, k, v)
                else:
                    session.add(IntradayCandle(**r))
        session.commit()
    logger.debug("Upserted %d intraday candles for %s/%s into DB.", len(rows), ticker, interval)
