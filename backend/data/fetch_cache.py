# StockOracle Pro - bounded TTL & LRU in-memory cache (leaf module).
# Imported by the fetch_* siblings and re-exported by backend.data.fetcher.
# NEVER import backend.data.fetcher from here (import cycle).
from .fetch_connection import *  # noqa: F401,F403

# ── Bounded TTL & LRU In-Memory Cache ──
_cache: dict = {}
CACHE_TTL_SECONDS = 120  # 2 minutes
MAX_CACHE_ENTRIES = 500  # Cap maximum items to prevent unbounded memory growth


def _prune_cache():
    """Removes expired items and enforces maximum cache capacity."""
    now = datetime.now()
    # 1. Evict expired entries
    expired_keys = [k for k, (_, expiry) in _cache.items() if now >= expiry]
    for k in expired_keys:
        _cache.pop(k, None)

    # 2. If still over capacity, evict oldest entries (FIFO/LRU insertion order)
    while len(_cache) > MAX_CACHE_ENTRIES:
        oldest_key = next(iter(_cache))
        _cache.pop(oldest_key, None)


def _get_cached(key: str):
    if key in _cache:
        data, expiry = _cache[key]
        if datetime.now() < expiry:
            return data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
        _cache.pop(key, None)
    return None


def _get_stale(key: str):
    """Returns cached data even if expired (used as fallback when API is unavailable)."""
    if key in _cache:
        data, _ = _cache[key]
        return data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
    return None


def _set_cached(key: str, data, ttl_seconds: Optional[int] = None):
    _prune_cache()
    cached_data = data.copy(deep=True) if isinstance(data, pd.DataFrame) else data
    ttl = ttl_seconds if ttl_seconds is not None else CACHE_TTL_SECONDS
    _cache[key] = (cached_data, datetime.now() + timedelta(seconds=ttl))
