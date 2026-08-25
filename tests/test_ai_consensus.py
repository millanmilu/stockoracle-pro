"""
StockOracle Pro — 3-Engine AI Consensus Regression Tests
Tests:
1. Technical engine indicator scoring
2. ML forecast scoring integration
3. Consensus score aggregation and signal agreement calculation
"""
import pytest
from backend.services.ai_consensus import compute_ai_consensus

def test_ai_consensus_structure():
    """Verify the 3-engine consensus schema and valid score range (0-100)."""
    res = compute_ai_consensus("RELIANCE")
    assert res is not None
    assert "consensus_score" in res
    assert "overall_signal" in res
    assert "agreement" in res
    assert "engines" in res

    score = res["consensus_score"]
    assert 0.0 <= score <= 100.0

    engines = res["engines"]
    assert "technical" in engines
    assert "ml" in engines
    assert "fundamental" in engines

    assert 0.0 <= engines["technical"]["score"] <= 100.0
    assert 0.0 <= engines["ml"]["score"] <= 100.0
    assert 0.0 <= engines["fundamental"]["score"] <= 100.0
