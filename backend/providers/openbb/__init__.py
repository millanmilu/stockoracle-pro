"""
StockOracle Pro — OpenBB Integration Sub-Module
"""
from backend.providers.openbb.wrapper import OpenBBWrapper, get_openbb_client

__all__ = ["OpenBBWrapper", "get_openbb_client"]
