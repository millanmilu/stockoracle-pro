"""StockOracle Pro — sector rotation, sector exclusions & market breadth.


Split verbatim out of ``backend/research/screener_engines.py`` (pure code motion).
NULL is never a neutral observation: missing data is reported, never invented.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .screener_shared import MIN_SECTOR_STOCKS, _card_num, logger

# ═══════════════════════════════════════════════════════════════════════════
# 7. SECTOR ROTATION + MARKET BREADTH (from real screener rows)
# ═══════════════════════════════════════════════════════════════════════════

# Sector labels the pipeline writes when it has no real classification. They are
# NOT sectors: "Diversified" alone covered 382 rows (60% of the tracked universe)
# and mixed Auto, Pharma, IT and Consumer into a single rotation bar. Treating
# them as unclassified keeps the chart honest about what is actually known.
UNCLASSIFIED_SECTOR_LABELS = {"", "-", "n/a", "na", "none", "unknown", "diversified", "other"}


def real_sector(row: Dict[str, Any]) -> Optional[str]:
    """The row's sector, or None when it only carries a placeholder label."""
    sec = str(row.get("sector") or "").strip()
    return None if sec.lower() in UNCLASSIFIED_SECTOR_LABELS else sec


def _mean_of(items: List[Dict[str, Any]], key: str) -> Optional[float]:
    """Mean over the rows that actually have ``key``; None when none do.

    Deliberately NOT ``or <neutral>``: substituting 50.0 for a missing AI score
    (or 0.0 for a missing change) makes an empty sector look like a measured
    neutral one, and every such sector then reports the same composite.
    """
    vals = [_card_num(x, key) for x in items]
    vals = [v for v in vals if v is not None]
    return (sum(vals) / len(vals)) if vals else None


def _coverage_status(items: List[Dict[str, Any]], keys: Tuple[str, ...]) -> str:
    """OK / PARTIAL / NO_DATA for how many of ``keys`` the bucket actually has."""
    def present(key: str) -> bool:
        return any(_card_num(x, key) is not None for x in items)
    hits = sum(1 for k in keys if present(k))
    if hits == 0:
        return "NO_DATA"
    return "OK" if hits == len(keys) else "PARTIAL"

def measured_sector_stocks(items: List[Dict[str, Any]]) -> int:
    """How many rows can actually vote in a sector's composite.

    Shared by :func:`compute_sector_rotation` (which needs it to decide whether a
    sector is rankable) and :func:`compute_sector_exclusions` (which needs it to
    report the sectors that were dropped) — one predicate, so the two can never
    disagree about which sectors made it onto the chart.
    """
    return sum(
        1 for x in items
        if _card_num(x, "change_1d_pct") is not None
        and _card_num(x, "ai_consensus_score") is not None
        and _card_num(x, "close_price") is not None
        and _card_num(x, "sma_50") is not None
    )


def compute_sector_rotation(
    rows: List[Dict[str, Any]],
    min_stocks: int = MIN_SECTOR_STOCKS,
    include_unmeasured: bool = False,
) -> List[Dict[str, Any]]:
    """Groups real screener rows by sector into Strong/Improving/Weakening/Weak.

    Score ingredients (all real): avg 1D change, % above EMA proxy
    (price > sma_50), avg AI score, avg relative volume, breadth.

    ``stocks`` is how many rows carry the sector label; ``stocks_measured`` is
    how many of them have the data the bar is actually drawn from.

    Invariants:
      * a row with **no sector** is not attributed to one. It used to fall into a
        fabricated ``"Diversified"`` bucket that became the chart's largest
        sector (60% of the tracked universe) while mixing unrelated industries;
        those rows are reported by :func:`compute_sector_exclusions` instead.
      * averages are computed **only over rows that have the field**. NULL is
        never substituted with a neutral constant — that produced whole sectors
        reporting identical ``0.0 / 50.0 / 1.0 / -11.8`` fingerprints.
      * ``composite`` is ``None`` (and the quadrant ``"No Data"``) when an
        ingredient is unavailable, so an unmeasured sector can never rank as
        Strong or Weak.
      * sectors smaller than ``min_stocks`` are excluded — a one-stock sector is
        noise, not rotation.
      * sectors with **no measurable data at all** are excluded by default
        (pass ``include_unmeasured=True`` to see them) and reported by
        :func:`compute_sector_exclusions`. Twenty "No Data" bars next to eight
        real ones is not a rotation chart; it is a coverage report.
      * the ``min_stocks`` test counts rows that are actually **measured**, not
        rows that merely carry the sector name. ``"Finance"`` had 15 tracked
        rows but only 2 with data, and those 2 were enough to rank a whole
        sector — a bar labelled 15 stocks whose composite came from 2 of them.
        ``stocks_measured`` is returned so the UI can show both numbers.
    """
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        sec = real_sector(r)
        if not sec:
            continue  # unclassified — reported separately, never a sector
        buckets.setdefault(sec, []).append(r)

    out = []
    for sec, items in buckets.items():
        n = len(items)
        if n < min_stocks:
            continue
        # Rows that can actually vote in the composite. A sector whose row count
        # comes mostly from placeholder rows cannot be ranked from the rest —
        # unless the caller explicitly opted into seeing unmeasured bars.
        measured_stocks = measured_sector_stocks(items)
        if not include_unmeasured and measured_stocks < min_stocks:
            continue
        try:
            avg_chg = _mean_of(items, "change_1d_pct")
            avg_ai = _mean_of(items, "ai_consensus_score")
            avg_rv = _mean_of(items, "volume_ratio_20d")
            above = 0
            measured = 0
            for x in items:
                px = _card_num(x, "close_price")
                sma = _card_num(x, "sma_50")
                if px is None or sma is None:
                    continue
                measured += 1
                if px > sma:
                    above += 1
            breadth_pct = round(above / measured * 100.0, 1) if measured else None
            bullish = sum(1 for x in items if str(x.get("ai_signal") or "").upper() in ("BUY", "STRONG BUY"))

            # Composite -100..+100 — all three ingredients required.
            if avg_chg is None or avg_ai is None or breadth_pct is None:
                composite = None
                quadrant = "No Data"
            else:
                composite = (
                    max(-30.0, min(30.0, avg_chg * 8.0)) * 0.35
                    + (avg_ai - 55.0) * 0.35
                    + (breadth_pct - 50.0) * 0.20
                    + max(-10.0, min(10.0, ((avg_rv if avg_rv is not None else 1.0) - 1.0) * 10.0)) * 0.10
                )
                if composite >= 12:
                    quadrant = "Strong"
                elif composite >= 2:
                    quadrant = "Improving"
                elif composite > -6:
                    quadrant = "Weakening"
                else:
                    quadrant = "Weak"
            data_status = _coverage_status(
                items, ("change_1d_pct", "ai_consensus_score", "volume_ratio_20d", "sma_50")
            )
            if data_status == "NO_DATA" and not include_unmeasured:
                continue
            out.append({
                "sector": sec,
                "stocks": n,
                "stocks_measured": measured_stocks,
                "avg_change_1d_pct": round(avg_chg, 2) if avg_chg is not None else None,
                "avg_ai_score": round(avg_ai, 1) if avg_ai is not None else None,
                "avg_rel_volume": round(avg_rv, 2) if avg_rv is not None else None,
                "breadth_pct": breadth_pct,
                "bullish": bullish,
                "bearish": sum(1 for x in items if str(x.get("ai_signal") or "").upper() in ("SELL", "AVOID")),
                "quadrant": quadrant,
                "composite": round(composite, 1) if composite is not None else None,
                "data_status": data_status,
            })
        except Exception as exc:
            logger.debug("sector %s failed: %s", sec, exc)
    # Measured sectors first (composite desc); unmeasured ones trail.
    out.sort(key=lambda x: (x["composite"] is not None, x["composite"] if x["composite"] is not None else 0.0), reverse=True)
    return out


def compute_sector_exclusions(
    rows: List[Dict[str, Any]],
    min_stocks: int = MIN_SECTOR_STOCKS,
    include_unmeasured_in_rotation: bool = False,
) -> Dict[str, Any]:
    """Rows/sectors the rotation chart cannot honestly plot, and why.

    ``unclassified`` = rows with no real sector (they would otherwise inflate a
    fabricated bucket — the placeholders alone were 60% of the universe);
    ``below_min_*`` = sectors too small to read as rotation; ``no_data_*`` =
    measurable-size sectors with nothing computed yet. Surfacing the counts lets
    the UI say so out loud instead of quietly absorbing the universe.
    """
    unclassified = 0
    placeholder = 0
    sized: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        sec = real_sector(r)
        if not sec:
            unclassified += 1
            if str(r.get("sector") or "").strip():
                placeholder += 1
        else:
            sized.setdefault(sec, []).append(r)

    small = {s: len(v) for s, v in sized.items() if len(v) < min_stocks}
    # Uses the SAME predicate as `compute_sector_rotation`, so a sector dropped
    # from the chart is always accounted for here. They drifted apart once: a
    # 15-row sector with 2 measured stocks was silently omitted from the chart
    # while no exclusion counter mentioned it, which is precisely the "quietly
    # absorbs the universe" failure this function exists to prevent.
    # "Some rows measured, but fewer than a sector needs" — distinct from
    # "nothing measured at all", which deserves its own louder label.
    thin = {
        s: len(v) for s, v in sized.items()
        if len(v) >= min_stocks and 0 < measured_sector_stocks(v) < min_stocks
    }
    no_data = {
        s: len(v) for s, v in sized.items()
        if len(v) >= min_stocks and measured_sector_stocks(v) == 0
    }
    return {
        "unclassified": unclassified,
        "unclassified_placeholder_label": placeholder,
        "below_min_sectors": len(small),
        "below_min_stocks": sum(small.values()),
        # Tracked, but too few of their rows are measured to rank the sector.
        "below_measured_sectors": len(thin),
        "below_measured_stocks": sum(thin.values()),
        "no_data_sectors": 0 if include_unmeasured_in_rotation else len(no_data),
        "no_data_stocks": 0 if include_unmeasured_in_rotation else sum(no_data.values()),
        "min_stocks": min_stocks,
    }


def compute_market_breadth(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Advancing/declining, new highs/lows, above-EMA counts, bull/bear %.

    Missing data is reported as ``no_data`` and excluded from every ratio — the
    old code defaulted a NULL change to 0.0, so every row with no computed
    change was counted as *unchanged* and dragged the advance/decline read
    toward the middle.
    """
    total = len(rows)
    if total == 0:
        return {
            "total": 0, "advancing": 0, "declining": 0, "unchanged": 0, "no_data": 0,
            "new_highs": 0, "new_lows": 0, "above_ema20": 0, "above_ema50": 0,
            "above_ema200": 0, "bullish_pct": 0.0, "bearish_pct": 0.0,
            "data_status": "N/A",
        }
    changes = [_card_num(r, "change_1d_pct") for r in rows]
    scored = [c for c in changes if c is not None]
    adv = sum(1 for c in scored if c > 0.05)
    dec = sum(1 for c in scored if c < -0.05)
    flat = len(scored) - adv - dec
    new_highs = sum(1 for r in rows if (_card_num(r, "distance_52w_high_pct") or -1e9) >= -1.0)
    new_lows = sum(1 for r in rows if (_card_num(r, "distance_52w_low_pct") or 1e9) <= 1.0)

    def _above(key: str) -> Tuple[int, int]:
        hits = 0
        seen = 0
        for r in rows:
            px = _card_num(r, "close_price")
            sma = _card_num(r, key)
            if px is None or sma is None:
                continue
            seen += 1
            if px > sma:
                hits += 1
        return hits, seen

    above20, seen20 = _above("sma_20")
    above50, seen50 = _above("sma_50")
    above200, seen200 = _above("sma_200")
    signal_rows = [r for r in rows if str(r.get("ai_signal") or "").strip()]
    bull = sum(1 for r in signal_rows if str(r.get("ai_signal") or "").upper() in ("BUY", "STRONG BUY"))
    bear = sum(1 for r in signal_rows if str(r.get("ai_signal") or "").upper() in ("SELL", "AVOID"))
    return {
        "total": total,
        "advancing": adv,
        "declining": dec,
        "unchanged": flat,
        # Rows with no computed change — shown separately instead of being
        # counted as "unchanged".
        "no_data": total - len(scored),
        "changes_available": len(scored),
        "new_highs": new_highs,
        "new_lows": new_lows,
        "above_ema20": above20,
        "above_ema50": above50,
        "above_ema200": above200,
        "above_ema20_pct": round(above20 / seen20 * 100.0, 1) if seen20 else None,
        "above_ema50_pct": round(above50 / seen50 * 100.0, 1) if seen50 else None,
        "above_ema200_pct": round(above200 / seen200 * 100.0, 1) if seen200 else None,
        "bullish_pct": round(bull / len(signal_rows) * 100.0, 1) if signal_rows else None,
        "bearish_pct": round(bear / len(signal_rows) * 100.0, 1) if signal_rows else None,
        "signals_available": len(signal_rows),
        "data_status": _coverage_status(rows, ("change_1d_pct", "rsi_14", "ai_consensus_score")),
        "timestamp": datetime.now().isoformat(),
    }
