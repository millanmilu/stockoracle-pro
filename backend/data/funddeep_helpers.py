"""Backend/data internals for fundamentals deep pipeline. AUTO-SPLIT from
fundamentals_deep.py -- content unchanged. Must never import
backend.data.fundamentals_deep (import cycle).
"""
import re
import math
import time
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.shared.cache import cache_get, cache_set
from backend.data.fundamentals import _calc_cagr

logger = logging.getLogger("StockOracle.Data.FundamentalsDeep")
_CACHE_TTL = 4 * 3600  # 4 hours
_RETRYABLE_STATUS = {403, 429, 500, 502, 503, 504}
def _normalize_pct_field(value: Any, digits: int = 2) -> Optional[float]:
    """Normalizes a yfinance fraction-or-percent field into a percent number.

    Newer yfinance versions sometimes return an already-percent value (e.g.
    3.5 for 3.5%) instead of a fraction (0.035). Values with abs > 1 are
    treated as already-percent; anything else is scaled by 100.
    """
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    if abs(v) > 1.0:
        return round(v, digits)
    return round(v * 100.0, digits)


def _screener_get(url: str, headers: Dict[str, str], timeout: int):
    """GETs a Screener.in page with one retry (1.5s backoff) on 403/5xx/timeouts."""
    import requests
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        logger.debug("Screener request failed for %s: %s — retrying once", url, exc)
        time.sleep(1.5)
        return requests.get(url, headers=headers, timeout=timeout)
    if resp.status_code in _RETRYABLE_STATUS:
        logger.debug("Screener returned %s for %s — retrying once", resp.status_code, url)
        time.sleep(1.5)
        return requests.get(url, headers=headers, timeout=timeout)
    return resp


def _parse_num(val_text: str) -> Optional[float]:
    if not val_text:
        return None
    cleaned = re.sub(r"[₹%CrLakh\s,]+", "", val_text).strip()
    match = re.search(r"-?\d+\.?\d*", cleaned)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def _sector_peers_from_universe(ticker: str, limit: int = 8) -> List[Dict[str, Any]]:
    """Derives sector peers from verified screener_daily_metrics universe rows.

    Same-sector constituents ordered by market cap (self excluded), shaped
    exactly like Screener peer rows ({name, price, pe_ratio, market_cap,
    roce}). Real stored metrics only — returns [] when the ticker's sector
    is unknown so callers keep the honest empty-peers behaviour.
    """
    t = (ticker or "").upper().strip()
    if not t:
        return []
    sector = None
    try:
        from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE
        for item in MASTER_NSE_UNIVERSE or []:
            if str(item.get("ticker", "")).upper() == t:
                sector = (item.get("sector") or "").strip() or None
                break
    except Exception as exc:
        logger.debug("Peer sector lookup failed for %s: %s", t, exc)
    if not sector:
        try:
            from backend.data.database import get_screener_detail
            own = get_screener_detail(t) or {}
            sector = (own.get("sector") or "").strip() or None
        except Exception as exc:
            logger.debug("Peer sector DB lookup failed for %s: %s", t, exc)
    if not sector or sector.lower() == "diversified":
        return []
    try:
        from backend.shared.database import get_db_session
        from sqlalchemy import text as _text
        with get_db_session() as session:
            rows = session.execute(
                _text(
                    "SELECT ticker, name, close_price, pe_ratio, market_cap_cr, roce_pct "
                    "FROM screener_daily_metrics "
                    "WHERE sector = :sec AND ticker != :t "
                    "ORDER BY market_cap_cr DESC LIMIT :lim"
                ),
                {"sec": sector, "t": t, "lim": max(1, min(int(limit), 20))},
            ).mappings().all()
    except Exception as exc:
        logger.debug("Sector peers DB query failed for %s: %s", t, exc)
        return []
    peers: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        peers.append({
            "name": d.get("name") or d.get("ticker"),
            "price": d.get("close_price"),
            "pe_ratio": d.get("pe_ratio"),
            "market_cap": d.get("market_cap_cr"),
            "roce": d.get("roce_pct"),
            "source": "sector-universe",
        })
    return peers


