"""StockOracle Pro — screener row status, market-cap category & overview cards.


Split verbatim out of ``backend/research/screener_engines.py`` (pure code motion).
``derive_screener_data_status`` three-state contract and the single shared
``market_cap_category`` definition live here.
"""

from typing import Any, Dict, List, Optional

from .screener_shared import (
    FUNDAMENTAL_CORE_FIELDS,
    TECHNICAL_CORE_FIELDS,
    _card_num,
)

def market_cap_category(market_cap_cr: Optional[float]) -> Optional[str]:
    """LARGE / MID / SMALL from a real market cap, or None when it is unknown.

    Shared by the refresh pipeline and the coverage backfill — a row that gains a
    market cap from one path must not end up without a category because the
    thresholds lived somewhere only the other path knew about.
    """
    value = _card_num({"market_cap_cr": market_cap_cr}, "market_cap_cr")
    if value is None:
        return None
    if value >= 50000.0:
        return "LARGE"
    if value >= 10000.0:
        return "MID"
    return "SMALL"

def derive_screener_data_status(metrics: Dict[str, Any]) -> str:
    """Honest coverage label for one screener row — the single source of truth.

    * ``NO_DATA`` — no price, or the core technical set is absent: a placeholder
      row that exists only because its ticker is in the tracked universe.
    * ``PARTIAL`` — price + technicals present, fundamentals still missing.
    * ``OK``      — price, technicals and the core fundamental set all present.

    Every writer (seed, backfill, daily refresh) derives the flag here so the UI
    can trust it instead of guessing coverage per component. It used to be
    hardcoded ``"OK"`` on every row, including 200 with a fabricated price and
    no indicators at all.
    """
    if _card_num(metrics, "close_price") is None:
        return "NO_DATA"
    if any(_card_num(metrics, f) is None for f in TECHNICAL_CORE_FIELDS):
        return "NO_DATA"
    if any(_card_num(metrics, f) is None for f in FUNDAMENTAL_CORE_FIELDS):
        return "PARTIAL"
    return "OK"


def compute_overview_cards(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Clickable header cards — every count derived from real row fields.

    INVARIANT: each count MUST equal the number of rows the frontend gets when
    the matching card in ``frontend/src/components/screener/screenerColumns.js``
    (``OVERVIEW_CARDS``) is clicked and its ``dsl`` is executed by
    ``backend/research/screener_dsl.parse_screener_query``.

    Therefore:
      * every predicate below uses the SAME field and the SAME operator as the
        card DSL (``>`` stays ``>``, never silently promoted to ``>=``), and
      * NULL / missing values are excluded exactly like SQL does — never
        defaulted to a neutral value (a default would inflate the count and the
        card would lie about how many rows are behind it).

    Keep this table and OVERVIEW_CARDS in lockstep; change one, change both.
    """
    n = lambda r, k: _card_num(r, k)  # noqa: E731 - terse alias, local only

    def _cmp(r, key, op, val):
        v = n(r, key)
        if v is None:
            return False
        return v > val if op == ">" else v < val

    total = len(rows)                                                  # TOTAL
    bullish = sum(1 for r in rows if _cmp(r, "ai_consensus_score", ">", 65))          # AIConsensus > 65
    bearish = sum(1 for r in rows if _cmp(r, "ai_consensus_score", "<", 45))          # AIConsensus < 45
    neutral = sum(1 for r in rows if (lambda v: v is not None and 45 <= v <= 65)(n(r, "ai_consensus_score")))
    breakouts = sum(1 for r in rows if _cmp(r, "distance_52w_high_pct", ">", -2))      # Distance52WHigh > -2
    breakdowns = sum(1 for r in rows if _cmp(r, "distance_52w_low_pct", "<", 2))       # Distance52WLow < 2
    vol_surges = sum(1 for r in rows if _cmp(r, "volume_ratio_20d", ">", 1.5))         # VolumeRatio20D > 1.5
    oversold = sum(1 for r in rows if _cmp(r, "rsi_14", "<", 35))                      # RSI14 < 35
    overbought = sum(1 for r in rows if _cmp(r, "rsi_14", ">", 70))                    # RSI14 > 70
    high_mom = sum(                                                                   # RSI14 > 55 AND VolumeRatio20D > 1.2
        1 for r in rows if _cmp(r, "rsi_14", ">", 55) and _cmp(r, "volume_ratio_20d", ">", 1.2)
    )
    ai_high = sum(1 for r in rows if _cmp(r, "ai_consensus_score", ">", 80))           # AIConsensus > 80
    return {
        "total": total, "bullish": bullish, "bearish": bearish, "neutral": neutral,
        "breakouts": breakouts, "breakdowns": breakdowns, "volume_surges": vol_surges,
        "oversold": oversold, "overbought": overbought, "high_momentum": high_mom,
        "ai_high_confidence": ai_high,
    }
