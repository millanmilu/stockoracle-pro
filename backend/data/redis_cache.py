"""
StockOracle Pro — Redis-Backed Distributed Cache with In-Memory / SQLite Fallback
Provides zero-latency caching with automatic degradation if Redis is offline.
"""
import os
import json
import logging
from typing import Optional, Any

logger = logging.getLogger("StockOracle.Cache")

REDIS_URL = os.getenv("REDIS_URL", "").strip()

_redis_client = None
_local_memory_cache = {}

if REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
        _redis_client.ping()
        logger.info(f"✅ Redis distributed cache connected at: {REDIS_URL}")
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed ({e}) — falling back to local in-memory cache.")
        _redis_client = None


def cache_get(key: str) -> Optional[Any]:
    """Retrieves a cached JSON object by key."""
    if _redis_client:
        try:
            val = _redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.error(f"Redis get error: {e}")

    # Local fallback
    if key in _local_memory_cache:
        data, exp = _local_memory_cache[key]
        import time
        if time.time() < exp:
            return data
        del _local_memory_cache[key]

    return None


def cache_set(key: str, value: Any, ttl_seconds: int = 300):
    """Sets a cached JSON object with TTL."""
    if _redis_client:
        try:
            _redis_client.setex(key, ttl_seconds, json.dumps(value))
            return
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    # Local fallback
    import time
    _local_memory_cache[key] = (value, time.time() + ttl_seconds)


def cache_delete(key: str):
    """Deletes a key from cache."""
    if _redis_client:
        try:
            _redis_client.delete(key)
        except Exception:
            pass
    _local_memory_cache.pop(key, None)
