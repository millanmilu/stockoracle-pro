"""
StockOracle Pro — Unified Config Loader (Bridge)
Re-exports singleton Settings from backend.shared.config for unified configuration.
"""
from backend.shared.config import settings, Settings, get_openbb_provider_keys

# Backward-compatibility alias
config = settings
UnifiedSettings = Settings

__all__ = ["config", "settings", "UnifiedSettings", "Settings", "get_openbb_provider_keys"]
