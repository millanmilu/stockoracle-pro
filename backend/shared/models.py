"""
StockOracle Pro — Declarative SQLAlchemy 2.0 Models
Compatible with PostgreSQL / TimescaleDB and SQLite.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, BigInteger, Text, DateTime,
    Index, UniqueConstraint, PrimaryKeyConstraint, func
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class HistoricalPrice(Base):
    """
    Daily OHLCV records.
    INVARIANT: Date must strictly be formatted as 'YYYY-MM-DD' representing NSE/IST market day.
    Intraday bars are NEVER stored in this table.
    """
    __tablename__ = "historical_prices"

    ticker = Column(String(20), primary_key=True, nullable=False)
    date = Column(String(10), primary_key=True, nullable=False)  # Strict YYYY-MM-DD
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_hist_ticker_date", "ticker", "date"),
    )


class StockUniverse(Base):
    """Full NSE indexed stock universe."""
    __tablename__ = "stock_universe"

    ticker = Column(String(20), primary_key=True, nullable=False)
    name = Column(String(255), nullable=False)
    symbol = Column(String(50), nullable=False)
    token = Column(String(50), nullable=True)
    exchange = Column(String(20), nullable=False, default="NSE")
    updated_at = Column(String(50), nullable=False)

    __table_args__ = (
        Index("idx_universe_name", "name"),
        Index("idx_universe_symbol", "symbol"),
    )


class LiveTick(Base):
    """High-frequency tick stream from WebSocket feeds."""
    __tablename__ = "live_ticks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    timestamp = Column(String(50), nullable=False, index=True)
    price = Column(Float, nullable=False)
    change_pct = Column(Float, nullable=True)

    __table_args__ = (
        Index("idx_ticks_ticker_time", "ticker", "timestamp"),
    )


class IntradayCandle(Base):
    """Intraday OHLCV bars (1m, 5m, 15m, 1h). Suitable for TimescaleDB hypertable."""
    __tablename__ = "intraday_candles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    interval = Column(String(10), nullable=False, index=True)  # '1m', '5m', '15m', '1h'
    timestamp = Column(String(50), nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_intraday_lookup", "ticker", "interval", "timestamp"),
    )


class PortfolioPosition(Base):
    """User portfolio holdings with multi-user isolation."""
    __tablename__ = "portfolio"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    ticker = Column(String(20), nullable=False)
    shares = Column(Float, nullable=False)
    buy_price = Column(Float, nullable=False)
    added_at = Column(String(50), default=lambda: datetime.now(timezone.utc).isoformat())

    __table_args__ = (
        Index("idx_portfolio_user", "user_id"),
    )


class SmartAlert(Base):
    """User smart technical & price alerts."""
    __tablename__ = "smart_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    ticker = Column(String(20), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)
    param_value = Column(Text, nullable=False, default="{}")
    triggered = Column(Integer, nullable=False, default=0)
    created_at = Column(String(50), default=lambda: datetime.now(timezone.utc).isoformat())

    __table_args__ = (
        Index("idx_smart_alerts_user_ticker", "user_id", "ticker"),
    )


class PaperAccount(Base):
    """Virtual paper trading account (default ₹10 Lakhs)."""
    __tablename__ = "paper_accounts"

    user_id = Column(String(100), primary_key=True, nullable=False)
    cash_balance = Column(Float, nullable=False, default=1000000.0)
    starting_balance = Column(Float, nullable=False, default=1000000.0)
    updated_at = Column(String(50), nullable=False)


class PaperPosition(Base):
    """Open active virtual positions."""
    __tablename__ = "paper_positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, index=True)
    ticker = Column(String(20), nullable=False)
    order_type = Column(String(20), nullable=False, default="BUY")
    shares = Column(Float, nullable=False)
    avg_buy_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    opened_at = Column(String(50), nullable=False)

    __table_args__ = (
        Index("idx_paper_pos_user", "user_id"),
    )


class PaperOrder(Base):
    """Executed paper trading journal."""
    __tablename__ = "paper_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, index=True)
    ticker = Column(String(20), nullable=False)
    order_type = Column(String(20), nullable=False)
    action = Column(String(20), nullable=False)
    shares = Column(Float, nullable=False)
    executed_price = Column(Float, nullable=False)
    realized_pnl = Column(Float, nullable=False, default=0.0)
    status = Column(String(30), nullable=False, default="EXECUTED")
    executed_at = Column(String(50), nullable=False)

    __table_args__ = (
        Index("idx_paper_ord_user", "user_id"),
    )


class AuditLog(Base):
    """Immutable audit trail for all user and system transactions."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    action = Column(String(50), nullable=False)
    entity = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ts_utc = Column(String(50), nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_ts", "ts_utc"),
    )


class TaskStatus(Base):
    """Background model training and backfill task status registry."""
    __tablename__ = "task_status"

    task_id = Column(String(100), primary_key=True, nullable=False)
    ticker = Column(String(20), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    mape = Column(Float, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=False)


class ModelRegistry(Base):
    """ML model versioning, artifacts, and validation lineage."""
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    model_type = Column(String(50), nullable=False)  # 'xgboost', 'lstm', 'transformer', 'ensemble'
    version = Column(String(20), nullable=False)
    artifact_path = Column(String(255), nullable=False)
    mape = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    metrics_json = Column(Text, nullable=True)
    trained_at = Column(String(50), nullable=False)
    is_active = Column(Integer, nullable=False, default=1)
