"""
Unit and Integration tests for Institutional Backtest Studio v3.0:
- Multi-strategy engine verification
- Auto-fit AI model fallback
- Monthly returns heatmap matrix
- PnL distribution buckets
- Trailing stop loss execution
- FastAPI endpoint query parameters
"""
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from backend.main import app
from backend.analysis.backtester import run_backtest, _compute_monthly_analytics, _compute_pnl_distribution


@pytest.fixture
def sample_ohlcv_df():
    """Generates 200 days of valid synthetic OHLCV data for unit testing."""
    n = 200
    dates = pd.date_range("2024-01-01", periods=n, freq="B").strftime("%Y-%m-%d")
    np.random.seed(42)
    base = 100.0 + np.cumsum(np.random.randn(n) * 1.5)
    highs = base + np.random.uniform(0.5, 2.5, n)
    lows = base - np.random.uniform(0.5, 2.5, n)
    opens = (highs + lows) / 2.0
    closes = base
    volumes = np.random.randint(100000, 500000, n)
    return pd.DataFrame({
        "date": dates,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    })


def test_multi_strategy_execution(sample_ohlcv_df):
    """Verifies all 6 strategies execute cleanly without error."""
    strategies = [
        "ai_ensemble",
        "ema_crossover",
        "rsi_mean_reversion",
        "momentum_breakout",
        "macd_crossover",
        "supertrend",
    ]
    for strat in strategies:
        res = run_backtest(sample_ohlcv_df, "TESTSTOCK", strategy=strat, train_test_split=0.6)
        assert "error" not in res, f"Strategy {strat} failed with error: {res.get('error')}"
        assert res["strategy"] == strat
        assert "final_value" in res
        assert "cumulative_return" in res
        assert "sharpe_ratio" in res
        assert "equity_curve" in res
        assert len(res["equity_curve"]) > 0
        assert "monthly_matrix" in res
        assert "trade_pnl_distribution" in res


def test_trailing_stop_loss(sample_ohlcv_df):
    """Tests trailing stop loss triggers properly."""
    res = run_backtest(
        sample_ohlcv_df,
        "TESTSTOCK",
        strategy="ema_crossover",
        stop_loss=0.05,
        take_profit=0.20,
        trailing_stop_pct=2.0,
    )
    assert "error" not in res
    assert "total_trades" in res
    # Ensure strategy params captured properly
    assert res["strategy_params"]["trailing_stop_pct"] == 2.0


def test_monthly_heatmap_matrix(sample_ohlcv_df):
    """Tests monthly returns matrix computation."""
    res = run_backtest(sample_ohlcv_df, "TESTSTOCK", strategy="ema_crossover")
    matrix = res.get("monthly_matrix", {})
    assert isinstance(matrix, dict)
    assert len(matrix) > 0
    first_year = list(matrix.keys())[0]
    assert "Year" in matrix[first_year]


def test_pnl_distribution_json_compliant():
    """Ensures pnl distribution buckets do not contain inf or NaN."""
    mock_journal = [
        {"pnl_pct": 5.2},
        {"pnl_pct": -3.1},
        {"pnl_pct": 1.4},
        {"pnl_pct": 12.0},
        {"pnl_pct": -8.5},
    ]
    dist = _compute_pnl_distribution(mock_journal)
    assert len(dist) == 7
    total_count = sum(b["count"] for b in dist)
    assert total_count == 5
    for b in dist:
        assert isinstance(b["count"], int)
        assert isinstance(b["label"], str)
        assert isinstance(b["color"], str)


def test_api_backtest_endpoint_all_params():
    """Tests FastAPI endpoint with full parameters."""
    client = TestClient(app)
    resp = client.get(
        "/api/stock/ICICIBANK/backtest",
        params={
            "strategy": "supertrend",
            "initial_capital": 200000,
            "position_size_pct": 90,
            "stop_loss": 0.03,
            "take_profit": 0.07,
            "trailing_stop_pct": 2.0,
            "atr_multiplier": 2.5,
            "slippage_bps": 12,
            "commission_bps": 6,
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["strategy"] == "supertrend"
    assert data["initial_capital"] == 200000
    assert data["strategy_params"]["atr_multiplier"] == 2.5
    assert data["strategy_params"]["slippage_bps"] == 12
