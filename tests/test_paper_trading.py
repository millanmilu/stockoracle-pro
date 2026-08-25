"""
StockOracle Pro — Paper Trading Simulator Regression Tests
Tests:
1. Account initialization with ₹1,000,000 virtual cash
2. Order placement & cash balance debit
3. Position closing with realized P&L calculation
4. Account reset back to starting balance
"""
import pytest
from backend.data.database import (
    init_db, get_paper_account, place_paper_order,
    close_paper_position, get_paper_positions, get_paper_trade_history,
    reset_paper_account
)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_paper_account_initialization():
    """Verify fresh paper trading account starts with ₹10,00,000."""
    user = "test_trader_init"
    acc = get_paper_account(user_id=user)
    assert acc["cash_balance"] == 1000000.0
    assert acc["starting_balance"] == 1000000.0


def test_paper_order_execution_and_closing():
    """Verify Buy order, position creation, cash debit, and exit with profit."""
    user = "test_trader_exec"
    reset_paper_account(user_id=user)

    # 1. Place Buy Order: 100 shares of RELIANCE @ ₹1,400 = ₹140,000
    res = place_paper_order(
        ticker="RELIANCE",
        order_type="BUY",
        action="BUY",
        shares=100,
        price=1400.0,
        stop_loss=1350.0,
        target_price=1500.0,
        user_id=user
    )
    assert res["status"] == "SUCCESS"
    pos_id = res["position_id"]
    assert res["remaining_cash"] == 1000000.0 - 140000.0

    # 2. Verify Position is Active
    positions = get_paper_positions(user_id=user)
    assert len(positions) == 1
    assert positions[0]["ticker"] == "RELIANCE"
    assert positions[0]["shares"] == 100

    # 3. Close Position at ₹1,450 (Profit of ₹50 * 100 = ₹5,000)
    close_res = close_paper_position(pos_id, current_price=1450.0, user_id=user)
    assert close_res["status"] == "CLOSED"
    assert close_res["realized_pnl"] == 5000.0
    assert close_res["new_cash"] == 1000000.0 + 5000.0

    # 4. Verify Trade History
    history = get_paper_trade_history(user_id=user)
    assert len(history) == 2  # 1 Buy + 1 Sell
    assert any(h["realized_pnl"] == 5000.0 for h in history)

    # 5. Reset Account
    reset_res = reset_paper_account(user_id=user)
    assert reset_res["cash_balance"] == 1000000.0
    assert len(get_paper_positions(user_id=user)) == 0
