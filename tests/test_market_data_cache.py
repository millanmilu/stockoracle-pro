from unittest.mock import patch

from backend.services.market_data import MarketDataService


def make_service():
    service = MarketDataService.__new__(MarketDataService)
    service._cache = {}
    return service


def test_market_data_cache_evicts_expired_entry():
    service = make_service()
    with patch("backend.services.market_data.time.time", return_value=100.0):
        service._cache_set("quote:OLD", {"price": 1})

    with patch("backend.services.market_data.time.time", return_value=116.0):
        assert service._cache_get("quote:OLD", ttl=15.0) is None
        assert "quote:OLD" not in service._cache


def test_market_data_cache_refreshes_lru_order_and_caps_size():
    service = make_service()
    with patch.object(MarketDataService, "_CACHE_MAX_ENTRIES", 2):
        service._cache_set("quote:A", {"price": 1})
        service._cache_set("quote:B", {"price": 2})
        assert service._cache_get("quote:A", ttl=15.0) == {"price": 1}

        service._cache_set("quote:C", {"price": 3})

    assert list(service._cache) == ["quote:A", "quote:C"]
