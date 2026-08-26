"""
StockOracle Pro — Redis Distributed Cache & Pub/Sub Client
Provides high-throughput distributed caching with automatic in-memory fallback.
"""
import json
import time
import logging
from typing import Optional, Any
from backend.shared.config import settings

logger = logging.getLogger("StockOracle.Cache")

_redis_client = None
_local_memory_cache = {}

if settings.REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(
            settings.REDIS_URL, decode_responses=True, socket_timeout=2.0
        )
        _redis_client.ping()
        logger.info("✅ Redis distributed cache connected at: %s", settings.REDIS_URL)
    except Exception as e:
        logger.warning("⚠️ Redis connection failed (%s) — falling back to local memory cache.", e)
        _redis_client = None


def cache_get(key: str) -> Optional[Any]:
    """Retrieves a cached JSON object by key."""
    if _redis_client:
        try:
            val = _redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.error("Redis get error for key %s: %s", key, e)

    # Local in-memory fallback
    if key in _local_memory_cache:
        data, exp = _local_memory_cache[key]
        if time.time() < exp:
            return data
        del _local_memory_cache[key]

    return None


def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> None:
    """Sets a cached JSON object with TTL."""
    if _redis_client:
        try:
            _redis_client.setex(key, ttl_seconds, json.dumps(value, default=str))
            return
        except Exception as e:
            logger.error("Redis set error for key %s: %s", key, e)

    # Local fallback
    _local_memory_cache[key] = (value, time.time() + ttl_seconds)


def cache_delete(key: str) -> None:
    """Deletes a key from cache."""
    if _redis_client:
        try:
            _redis_client.delete(key)
        except Exception:
            pass
    _local_memory_cache.pop(key, None)


def get_redis_client():
    """Returns the raw redis client instance if available."""
    return _redis_client
