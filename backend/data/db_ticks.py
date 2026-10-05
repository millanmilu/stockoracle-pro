# StockOracle Pro - live tick storage & tick analytics.
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

# ── Live Ticks ─────────────────────────────────────────────────────────────────

def save_live_tick(ticker: str, price: float, change_pct: float):
    """Saves a single live tick update to the database using SQLAlchemy ORM."""
    ticker_u = ticker.upper()
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        with get_db_session() as session:
            session.add(LiveTick(
                ticker=ticker_u,
                timestamp=timestamp,
                price=float(price),
                change_pct=float(change_pct) if change_pct is not None else None,
            ))
    except Exception as e:
        logger.error("Error saving live tick for %s: %s", ticker_u, e, exc_info=True)


# ── Live Tick Analytics ────────────────────────────────────────────────────────

def get_recent_live_ticks(ticker: str, limit: int = 200) -> Optional[pd.DataFrame]:
    """Returns recent live tick records for a ticker as a DataFrame."""
    ticker_u = ticker.upper()
    try:
        with get_db_session() as session:
            stmt = select(LiveTick.timestamp, LiveTick.price, LiveTick.change_pct).where(
                LiveTick.ticker == ticker_u
            ).order_by(LiveTick.id.desc()).limit(limit)
            rows = session.execute(stmt).all()
            if not rows:
                return None
            return pd.DataFrame([{"timestamp": r[0], "price": r[1], "change_pct": r[2]} for r in rows])
    except Exception as e:
        logger.error("Error reading live ticks for %s: %s", ticker_u, e)
        return None


def get_live_tick_ohlcv(ticker: str) -> Optional[dict]:
    """Aggregates today's live ticks into a single synthetic OHLCV row with exact IST-to-UTC boundaries."""
    ticker_u = ticker.upper()
    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    today_str = now_ist.strftime("%Y-%m-%d")

    # Calculate exact UTC bounds for the entire IST calendar day
    start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    end_ist = now_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
    start_utc_iso = start_ist.astimezone(timezone.utc).isoformat()
    end_utc_iso = end_ist.astimezone(timezone.utc).isoformat()

    try:
        with get_db_session() as session:
            stmt = select(LiveTick.price, LiveTick.timestamp).where(
                LiveTick.ticker == ticker_u,
                LiveTick.timestamp >= start_utc_iso,
                LiveTick.timestamp <= end_utc_iso
            ).order_by(LiveTick.id.asc())
            rows = session.execute(stmt).all()
            if not rows:
                return None
            prices = [float(r[0]) for r in rows]
            return {
                "date": today_str,
                "open": prices[0],
                "high": max(prices),
                "low": min(prices),
                "close": prices[-1],
                "volume": len(prices),
            }
    except Exception as e:
        logger.error("Error building live OHLCV for %s: %s", ticker_u, e)
        return None


def purge_old_live_ticks(days: int = 3) -> int:
    """Removes live ticks older than `days` to keep database storage bounded."""
    cutoff_utc = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        with get_db_session() as session:
            from sqlalchemy import delete
            stmt = delete(LiveTick).where(LiveTick.timestamp < cutoff_utc)
            result = session.execute(stmt)
            return result.rowcount
    except Exception as e:
        logger.error("Error purging old live ticks: %s", e)
        return 0
