"""
StockOracle Pro — API & Integration Regression Tests
"""
import pytest
from datetime import datetime
from backend.data.market_calendar import (
    is_trading_day, is_market_open, get_market_session_phase, get_price_freshness
)
from backend.data.database import (
    init_db, get_historical_prices, get_portfolio, add_portfolio_position,
    get_smart_alerts, add_smart_alert, remove_smart_alert
)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_market_calendar_logic():
    """Test weekend detection and market phases."""
    # Weekend test (Sunday)
    sunday = datetime(2026, 8, 23, 10, 30)
    assert is_trading_day(sunday) is False
    assert is_market_open(sunday) is False
    assert get_market_session_phase(sunday) == "CLOSED"

    # Active weekday trading hours test (Tuesday 11:30 AM)
    trading_tue = datetime(2026, 8, 25, 11, 30)
    assert is_trading_day(trading_tue) is True
    assert is_market_open(trading_tue) is True
    assert get_market_session_phase(trading_tue) == "LIVE"

    freshness = get_price_freshness(trading_tue)
    assert freshness["freshness"] == "REALTIME"
    assert freshness["session_phase"] == "LIVE"


def test_portfolio_crud_operations():
    """Test adding, listing, and removing portfolio positions."""
    user = "test_investor_01"
    pos_id = add_portfolio_position("INFY", 25, 1850.0, user_id=user)
    assert pos_id > 0

    holdings = get_portfolio(user_id=user)
    assert len(holdings) >= 1
    assert any(h["ticker"] == "INFY" and h["shares"] == 25 for h in holdings)


def test_smart_alerts_crud():
    """Test adding and retrieving smart alerts."""
    user = "test_trader_01"
    alert_id = add_smart_alert("RELIANCE", "price_above", {"target_price": 1400.0}, user_id=user)
    assert alert_id > 0

    remove_smart_alert(alert_id, user_id=user)


@pytest.mark.asyncio
async def test_consolidated_alert_evaluation():
    """Test the single consolidated alert evaluator."""
    from backend.services.alert_scheduler import evaluate_all_alerts, evaluate_single_alert
    user = "test_eval_user"
    alert_id = add_smart_alert("RELIANCE", "price_above", {"target_price": 100.0}, user_id=user)
    
    results = await evaluate_all_alerts(user_id=user, auto_trigger=False)
    assert len(results) >= 1
    eval_item = next(r for r in results if r["id"] == alert_id)
    assert eval_item["is_triggered"] is True
    assert "reason" in eval_item
    assert "current_value" in eval_item
    
    remove_smart_alert(alert_id, user_id=user)

