"""
StockOracle Pro — Unified Multi-Provider Configuration Loader
Merges Host Project, OpenBB Data Providers, and OpenTerminalUI settings into a unified, secure config.
"""
import os
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class UnifiedSettings(BaseSettings):
    """
    Centralized configuration management for StockOracle Pro, OpenBB engines, and Terminal UI.
    """
    # ── Host Application Settings ──
    APP_NAME: str = "StockOracle Pro"
    APP_ENV: str = Field(default="production", alias="ENVIRONMENT")
    DEBUG: bool = False
    PORT: int = Field(default=8000, alias="PORT")
    HOST: str = "0.0.0.0"
    API_V1_PREFIX: str = "/api"
    SECRET_KEY: str = Field(default="stockoracle-super-secret-key-prod", alias="SECRET_KEY")

    # ── Database & Cache ──
    DATABASE_URL: str = Field(default="sqlite:///./stockoracle.db", alias="DATABASE_URL")
    REDIS_URL: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/1", alias="CELERY_BROKER_URL")

    # ── Angel One SmartAPI Credentials ──
    ANGEL_API_KEY: Optional[str] = Field(default=None, alias="ANGEL_API_KEY")
    ANGEL_CLIENT_CODE: Optional[str] = Field(default=None, alias="ANGEL_CLIENT_CODE")
    ANGEL_PIN: Optional[str] = Field(default=None, alias="ANGEL_PIN")
    ANGEL_TOTP_KEY: Optional[str] = Field(default=None, alias="ANGEL_TOTP_KEY")

    # ── AI & LLM Providers ──
    GEMINI_API_KEY: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")

    # ── OpenBB Data Provider API Keys ──
    OPENBB_FMP_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_FMP_API_KEY")
    OPENBB_POLYGON_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_POLYGON_API_KEY")
    OPENBB_FRED_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_FRED_API_KEY")
    OPENBB_ALPHA_VANTAGE_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_ALPHA_VANTAGE_API_KEY")
    OPENBB_DEFAULT_PROVIDER: str = "yfinance"

    # ── OpenTerminalUI Presentation Settings ──
    TERMINAL_THEME: str = "dark"
    TERMINAL_REFRESH_RATE_MS: int = 15000
    TERMINAL_DEFAULT_SYMBOL: str = "RELIANCE"
    TERMINAL_ENABLE_ANIMATIONS: bool = True
    TERMINAL_SOUND_ALERTS: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# Global singleton instance
config = UnifiedSettings()


def get_openbb_provider_keys() -> Dict[str, str]:
    """Extracts all active API keys mapped for OpenBB SDK provider ingestion."""
    keys = {}
    if config.OPENBB_FMP_API_KEY:
        keys["fmp"] = config.OPENBB_FMP_API_KEY
    if config.OPENBB_POLYGON_API_KEY:
        keys["polygon"] = config.OPENBB_POLYGON_API_KEY
    if config.OPENBB_FRED_API_KEY:
        keys["fred"] = config.OPENBB_FRED_API_KEY
    if config.OPENBB_ALPHA_VANTAGE_API_KEY:
        keys["alpha_vantage"] = config.OPENBB_ALPHA_VANTAGE_API_KEY
    return keys
