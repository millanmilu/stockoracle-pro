"""
StockOracle Pro — Phase 2 Modular Architecture & SQLAlchemy Regression Tests
"""
import pytest
from datetime import datetime, timezone

from backend.shared.config import settings
from backend.shared.models import (
    Base, HistoricalPrice, PortfolioPosition, SmartAlert,
    PaperAccount, PaperPosition, PaperOrder, AuditLog
)
from backend.shared.database import engine, get_db_session, init_database
from backend.main import app


@pytest.fixture(autouse=True, scope="module")
def setup_models():
    """Ensure database schema is created from models."""
    init_database()


def test_settings_initialization():
    """Verify centralized settings load without error."""
    assert settings.APP_NAME == "StockOracle Pro"
    assert settings.APP_VERSION == "2.0.0"
    assert settings.DB_POOL_SIZE >= 5


def test_sqlalchemy_historical_price_crud():
    """Verify SQLAlchemy HistoricalPrice model with strict daily format."""
    with get_db_session() as session:
        # Create
        record = HistoricalPrice(
            ticker="TEST_RELIANCE_MOD",
            date="2026-08-25",
            open=1400.0,
            high=1420.0,
            low=1390.0,
            close=1415.0,
            volume=500000,
        )
        session.merge(record)

    with get_db_session() as session:
        # Read
        found = session.query(HistoricalPrice).filter_by(ticker="TEST_RELIANCE_MOD", date="2026-08-25").first()
        assert found is not None
        assert found.close == 1415.0
        assert len(found.date) == 10

        # Cleanup
        session.delete(found)


def test_sqlalchemy_portfolio_isolation():
    """Verify SQLAlchemy PortfolioPosition multi-user isolation."""
    with get_db_session() as session:
        pos_a = PortfolioPosition(user_id="user_orm_a", ticker="INFY", shares=10.0, buy_price=1800.0)
        pos_b = PortfolioPosition(user_id="user_orm_b", ticker="TCS", shares=5.0, buy_price=3500.0)
        session.add_all([pos_a, pos_b])

    with get_db_session() as session:
        user_a_holdings = session.query(PortfolioPosition).filter_by(user_id="user_orm_a").all()
        user_b_holdings = session.query(PortfolioPosition).filter_by(user_id="user_orm_b").all()

        assert len(user_a_holdings) == 1
        assert user_a_holdings[0].ticker == "INFY"
        assert len(user_b_holdings) == 1
        assert user_b_holdings[0].ticker == "TCS"

        # Cleanup
        session.query(PortfolioPosition).filter(PortfolioPosition.user_id.in_(["user_orm_a", "user_orm_b"])).delete()


def test_sqlalchemy_audit_log():
    """Verify SQLAlchemy AuditLog model."""
    now_utc = datetime.now(timezone.utc).isoformat()
    with get_db_session() as session:
        log_entry = AuditLog(
            user_id="user_audit_orm",
            action="TEST_BUY",
            entity="paper_order",
            entity_id="101",
            details="shares=10 price=1400",
            ts_utc=now_utc,
        )
        session.add(log_entry)

    with get_db_session() as session:
        found = session.query(AuditLog).filter_by(user_id="user_audit_orm").first()
        assert found is not None
        assert found.action == "TEST_BUY"
        assert found.entity == "paper_order"

        # Cleanup
        session.delete(found)


def test_modular_routes_mounted():
    """Verify all domain routers are properly mounted in FastAPI app."""
    routes = [route.path for route in app.routes]

    # System
    assert "/api/health" in routes
    assert "/api/db/status" in routes
    assert "/api/audit-log" in routes

    # Market Data
    assert "/api/stock/{ticker}/info" in routes
    assert "/api/stock/{ticker}/history" in routes
    assert "/api/stocks/search" in routes

    # Research
    assert "/api/stock/{ticker}/fundamentals" in routes
    assert "/api/stock/{ticker}/options-chain" in routes
    assert "/api/macro" in routes

    # Portfolio & Paper
    assert "/api/portfolio" in routes
    assert "/api/paper/account" in routes
    assert "/api/paper/order" in routes

    # Alerts
    assert "/api/smart-alerts" in routes
    assert "/api/smart-alerts/evaluate" in routes

    # ML & AI Chat
    assert "/api/stock/{symbol}/predict" in routes
    assert "/api/ai/chat" in routes


def test_celery_task_registry():
    """Verify Celery task registry contains all defined background tasks."""
    import backend.tasks.market_tasks
    import backend.tasks.alert_tasks
    import backend.tasks.ml_tasks
    from backend.tasks.celery_app import celery_app
    tasks = list(celery_app.tasks.keys())

    assert "tasks.backfill_5y_history" in tasks
    assert "tasks.prefetch_popular_tickers" in tasks
    assert "tasks.evaluate_all_alerts" in tasks
    assert "tasks.train_stock_model" in tasks

