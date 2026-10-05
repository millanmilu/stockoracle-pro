# StockOracle Pro - JSON caches (company info, predictions, screener,
# monte carlo). Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

# ── Generic JSON Cache Helpers ─────────────────────────────────────────────────

def _save_json(table: str, key_col: str, key_val: str, data: Any, ttl_minutes: int = 5):
    """Saves any JSON-serialisable data into L1 Redis cache and L2 ORM entity."""
    ticker_key = str(key_val).upper()
    cache_k = f"{table}:{ticker_key}"
    try:
        from backend.data.redis_cache import cache_set
        cache_set(cache_k, data, ttl_seconds=int(ttl_minutes * 60))
    except Exception as exc:
        logger.debug("L1 cache write skipped (%s:%s): %s", table, ticker_key, exc)

    payload = json.dumps(data, default=str)
    now_str = datetime.now().isoformat()
    model = CACHE_MODEL_MAP.get(table)
    if not model:
        return

    with get_db_session() as session:
        if table == "screener_results":
            existing = session.get(ScreenerResultCache, 1)
            if existing:
                existing.data_json = payload
                existing.fetched_at = now_str
            else:
                session.add(ScreenerResultCache(id=1, data_json=payload, fetched_at=now_str))
        else:
            existing = session.get(model, ticker_key)
            if existing:
                existing.data_json = payload
                existing.fetched_at = now_str
            else:
                session.add(model(ticker=ticker_key, data_json=payload, fetched_at=now_str))


def _get_json(table: str, key_col: str, key_val: str, ttl_minutes: int = 5) -> Optional[Any]:
    """Returns cached JSON data from L1 Redis cache or L2 ORM table if within TTL."""
    ticker_key = str(key_val).upper()
    cache_k = f"{table}:{ticker_key}"
    try:
        from backend.data.redis_cache import cache_get
        cached_val = cache_get(cache_k)
        if cached_val is not None:
            return cached_val
    except Exception as exc:
        logger.debug("L1 cache read skipped (%s:%s): %s", table, ticker_key, exc)

    expiry = (datetime.now() - timedelta(minutes=ttl_minutes)).isoformat()
    model = CACHE_MODEL_MAP.get(table)
    if not model:
        return None

    try:
        with get_db_session() as session:
            if table == "screener_results":
                row = session.get(ScreenerResultCache, 1)
            else:
                row = session.get(model, ticker_key)
            if row and row.fetched_at and row.fetched_at > expiry:
                val = json.loads(row.data_json)
                try:
                    from backend.data.redis_cache import cache_set
                    cache_set(cache_k, val, ttl_seconds=int(ttl_minutes * 60))
                except Exception as exc:
                    logger.debug("L1 cache backfill skipped (%s:%s): %s", table, ticker_key, exc)
                return val
    except Exception as e:
        logger.warning("DB cache read error (%s): %s", table, e)
    return None



def _get_stale_json(table: str, key_col: str, key_val: str) -> Optional[Any]:
    """Returns cached data regardless of TTL (fallback when upstream is down)."""
    model = CACHE_MODEL_MAP.get(table)
    if not model:
        return None

    try:
        with get_db_session() as session:
            if table == "screener_results":
                row = session.get(ScreenerResultCache, 1)
            else:
                row = session.get(model, str(key_val).upper())
            if row and row.data_json:
                return json.loads(row.data_json)
    except Exception as e:
        logger.error("DB stale-cache read error (%s): %s", table, e)
    return None



# ── Company Info ───────────────────────────────────────────────────────────────

def save_company_info(ticker: str, data: dict, ttl_minutes: int = 5):
    _save_json("company_info", "ticker", ticker.upper(), data, ttl_minutes)


def get_company_info(ticker: str, ttl_minutes: int = 5) -> Optional[dict]:
    return _get_json("company_info", "ticker", ticker.upper(), ttl_minutes)


def get_stale_company_info(ticker: str) -> Optional[dict]:
    return _get_stale_json("company_info", "ticker", ticker.upper())


# ── Predictions ────────────────────────────────────────────────────────────────

def save_prediction(ticker: str, data: dict, ttl_minutes: int = 10):
    _save_json("predictions", "ticker", ticker.upper(), data, ttl_minutes)


def get_prediction_cached(ticker: str, ttl_minutes: int = 10) -> Optional[dict]:
    return _get_json("predictions", "ticker", ticker.upper(), ttl_minutes)


# ── Screener Results ───────────────────────────────────────────────────────────

def save_screener_results(data: list, ttl_minutes: int = 5):
    _save_json("screener_results", "id", "1", data, ttl_minutes)


def get_screener_results(ttl_minutes: int = 5) -> Optional[list]:
    return _get_json("screener_results", "id", "1", ttl_minutes)


# ── Monte Carlo ────────────────────────────────────────────────────────────────

def save_monte_carlo(ticker: str, data: dict, ttl_minutes: int = 30):
    _save_json("monte_carlo", "ticker", ticker.upper(), data, ttl_minutes)


def get_monte_carlo_cached(ticker: str, ttl_minutes: int = 30) -> Optional[dict]:
    return _get_json("monte_carlo", "ticker", ticker.upper(), ttl_minutes)
