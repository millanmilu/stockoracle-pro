# StockOracle Pro - database facade & core module.
#
# The connection/config core lives in db_connection.py; cohesive sections were
# split into sibling db_*.py modules (pure code motion). Every public name and
# the underscore helpers remain importable from backend.data.database.
from .db_connection import *  # noqa: F401,F403
from .db_screener_schema import *  # noqa: F401,F403
from .db_history import *  # noqa: F401,F403
from .db_intraday import *  # noqa: F401,F403
from .db_universe import *  # noqa: F401,F403
from .db_ticks import *  # noqa: F401,F403
from .db_caches import *  # noqa: F401,F403
from .db_alerts import *  # noqa: F401,F403
from .db_portfolio import *  # noqa: F401,F403
from .db_scans import *  # noqa: F401,F403
from .db_registry import *  # noqa: F401,F403
from .db_screener import *  # noqa: F401,F403

# `import *` skips underscore names; bind them explicitly so
# `from backend.data.database import _normalize_price` keeps working.
from .db_screener_schema import _ensure_screener_extended_columns, _ensure_screener_close_price_nullable  # noqa: F401
from .db_history import _normalize_price, _sanitize_volume, _get_db_close_median  # noqa: F401
from .db_caches import _save_json, _get_json, _get_stale_json  # noqa: F401

def init_db():
    """Initializes the database schema and creates all tables via SQLAlchemy ORM."""
    logger.info("Initializing database with unified SQLAlchemy engine: %s", DB_PATH)
    init_database()
    # Invariant: Auto-cleansing on init to purge legacy non-daily candle strings
    try:
        with get_db_session() as session:
            session.execute(text("DELETE FROM historical_prices WHERE length(date) > 10 OR length(date) != 10"))
            # Ensure UNIQUE index exists on (ticker, date) for SQLite ON CONFLICT upsert support
            session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_ticker_date ON historical_prices (ticker, date)"))
            # Clean corrupt 1-row / single-candle fragments that block full backfills
            session.execute(text("""
                DELETE FROM historical_prices 
                WHERE ticker IN (
                    SELECT ticker FROM historical_prices GROUP BY ticker HAVING count(*) < 5
                )
            """))
            # Ensure UNIQUE index on intraday_candles for ON CONFLICT upserts
            session.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_intraday_unique "
                "ON intraday_candles (ticker, interval, timestamp)"
            ))
    except Exception as e:
        logger.debug("Historical prices auto-cleansing check notice: %s", e)

    # Institutional screener extension: add missing columns to pre-existing DBs
    try:
        _ensure_screener_extended_columns()
    except Exception as e:
        logger.debug("Screener extended-columns ensure notice: %s", e)

    # Screener honesty migrations (order matters: the column must be nullable
    # before a placeholder price can be cleared to NULL).
    try:
        _ensure_screener_close_price_nullable()
        repair_screener_placeholder_rows()
        reconcile_screener_data_status()
        reconcile_screener_market_cap_category()
    except Exception as e:
        logger.debug("Screener honesty migration notice: %s", e)


    # Auto-seed broker_accounts from existing .env credentials if table is currently empty
    try:
        existing_brokers = get_all_broker_accounts_orm()
        angel_key = (os.environ.get("ANGEL_API_KEY") or "").strip()
        angel_client = (os.environ.get("ANGEL_CLIENT_ID") or "").strip()
        angel_pass = (os.environ.get("ANGEL_PASSWORD") or "").strip()
        angel_totp = (os.environ.get("ANGEL_TOTP_SECRET") or "").strip()
        if "angel_one" not in existing_brokers and all([angel_key, angel_client, angel_pass, angel_totp]):
            save_broker_account_orm("angel_one", {
                "api_key": angel_key,
                "client_id": angel_client,
                "password": angel_pass,
                "totp_secret": angel_totp,
            }, is_active=True)
            logger.info("Auto-seeded active Angel One credentials from .env into broker_accounts table.")
    except Exception as e:
        logger.debug("Broker auto-seed notice: %s", e)

    logger.info("Database initialization complete.")


def get_db_stats() -> dict:
    """Returns a summary of DB table sizes and telemetry via SQLAlchemy 2.0 ORM."""
    stats = {}
    with get_db_session() as session:
        for name, model in [
            ("historical_prices", HistoricalPrice),
            ("stock_universe", StockUniverse),
            ("live_ticks", LiveTick),
            ("portfolio", PortfolioPosition),
            ("smart_alerts", SmartAlert),
            ("paper_accounts", PaperAccount),
            ("paper_positions", PaperPosition),
            ("paper_orders", PaperOrder),
            ("task_status", TaskStatus),
            ("saved_scans", SavedScan),
            ("user_screens", UserScreen),
            ("audit_log", AuditLog),
            ("ai_providers", AIProvider),
            ("broker_audit_logs", BrokerAuditLog),
        ]:
            try:
                cnt = session.execute(select(func.count()).select_from(model)).scalar() or 0
                stats[name] = cnt
            except Exception:
                stats[name] = 0

        # Per-ticker historical summary
        try:
            stmt = select(
                HistoricalPrice.ticker,
                func.count().label("rows"),
                func.min(HistoricalPrice.date).label("min_date"),
                func.max(HistoricalPrice.date).label("max_date")
            ).group_by(HistoricalPrice.ticker).order_by(HistoricalPrice.ticker.asc())
            ticker_rows = session.execute(stmt).all()
            stats["historical_by_ticker"] = [
                {"ticker": r[0], "rows": r[1], "from": r[2], "to": r[3]}
                for r in ticker_rows
            ]
        except Exception:
            stats["historical_by_ticker"] = []

    stats["db_path"] = DB_PATH
    stats["engine"] = engine.url.drivername
    return stats
