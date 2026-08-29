"""
StockOracle Pro — SQLAlchemy 2.0 Dual-Engine Database Layer
Seamlessly switches between PostgreSQL / TimescaleDB (production) and SQLite (dev/testing).
"""
import os
import logging
from contextlib import contextmanager
from typing import Generator, Optional

from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool, NullPool, StaticPool

from backend.shared.config import settings
from backend.shared.models import Base

logger = logging.getLogger("StockOracle.DB")

# SQLite fallback path
DEFAULT_SQLITE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "stockoracle.db"
)


def get_database_url() -> str:
    """Returns the effective database URL."""
    if settings.DATABASE_URL and settings.DATABASE_URL.strip():
        url = settings.DATABASE_URL.strip()
        # Normalise postgres:// to postgresql:// for SQLAlchemy 2.0
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    return f"sqlite:///{DEFAULT_SQLITE_PATH}"


DATABASE_URL = get_database_url()
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

# Create engine with appropriate pooling
if IS_POSTGRES:
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 15.0},
        poolclass=NullPool,
        echo=settings.DEBUG,
    )

    # Enable WAL mode for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.close()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_database() -> None:
    """
    Initializes database tables from SQLAlchemy Base metadata.
    If PostgreSQL/TimescaleDB is active, initializes Timescale hypertables.
    Auto-cleans legacy non-daily candle rows (AGENTS.md invariant).
    """
    logger.info("Initializing database with engine: %s (Postgres=%s)", engine.url.drivername, IS_POSTGRES)
    Base.metadata.create_all(bind=engine)

    if IS_POSTGRES:
        try:
            with engine.connect() as conn:
                # Enable TimescaleDB extension if available
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
                conn.commit()
                logger.info("✅ TimescaleDB extension verified/enabled.")
        except Exception as e:
            logger.warning("TimescaleDB extension setup notice: %s (Standard PostgreSQL active)", e)

    # Invariant: Auto-cleansing on init to purge legacy non-daily candle strings
    try:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM historical_prices WHERE length(date) > 10;"))
    except Exception as e:
        logger.debug("Historical prices auto-cleansing check notice: %s", e)

    logger.info("✅ Database schema initialization complete.")


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Context manager for safe session handling with auto-commit and rollback."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency for database session injection."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
