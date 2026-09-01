"""
StockOracle Pro — Centralized Application Configuration (Single Source of Truth)
Pydantic Settings model reading from .env and environment variables for Host, OpenBB, and Terminal.
"""
import os
from typing import Optional, Dict
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator


class Settings(BaseSettings):
    # App
    APP_NAME: str = "StockOracle Pro"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    PORT: int = Field(default=8000, alias="PORT")
    HOST: str = "0.0.0.0"
    API_V1_PREFIX: str = "/api"

    # Security & Auth
    API_KEY: Optional[str] = Field(default=None, alias="API_KEY")
    JWT_SECRET: Optional[str] = Field(default=None, alias="JWT_SECRET")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database (PostgreSQL/TimescaleDB or fallback SQLite)
    DATABASE_URL: Optional[str] = Field(default=None, alias="DATABASE_URL")
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # Redis Cache & Pub/Sub
    REDIS_URL: Optional[str] = Field(default=None, alias="REDIS_URL")

    # Celery Broker & Backend
    CELERY_BROKER_URL: Optional[str] = Field(default=None, alias="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: Optional[str] = Field(default=None, alias="CELERY_RESULT_BACKEND")

    # Angel One SmartAPI Credentials
    ANGEL_API_KEY: Optional[str] = Field(default=None, alias="ANGEL_API_KEY")
    ANGEL_CLIENT_ID: Optional[str] = Field(default=None, alias="ANGEL_CLIENT_ID")
    ANGEL_CLIENT_CODE: Optional[str] = Field(default=None, alias="ANGEL_CLIENT_CODE")
    ANGEL_PASSWORD: Optional[str] = Field(default=None, alias="ANGEL_PASSWORD")
    ANGEL_PIN: Optional[str] = Field(default=None, alias="ANGEL_PIN")
    ANGEL_TOTP_SECRET: Optional[str] = Field(default=None, alias="ANGEL_TOTP_SECRET")
    ANGEL_TOTP_KEY: Optional[str] = Field(default=None, alias="ANGEL_TOTP_KEY")

    # AI & External APIs
    GEMINI_API_KEY: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")

    # OpenBB Data Provider API Keys
    OPENBB_FMP_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_FMP_API_KEY")
    OPENBB_POLYGON_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_POLYGON_API_KEY")
    OPENBB_FRED_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_FRED_API_KEY")
    OPENBB_ALPHA_VANTAGE_API_KEY: Optional[str] = Field(default=None, alias="OPENBB_ALPHA_VANTAGE_API_KEY")
    OPENBB_DEFAULT_PROVIDER: str = "yfinance"

    # Telegram Bot Alerts
    TELEGRAM_BOT_TOKEN: Optional[str] = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    TELEGRAM_CHAT_ID: Optional[str] = Field(default=None, alias="TELEGRAM_CHAT_ID")

    # Terminal UI Settings
    TERMINAL_THEME: str = "dark"
    TERMINAL_DEFAULT_SYMBOL: str = "RELIANCE"
    TERMINAL_REFRESH_RATE_MS: int = 15000
    TERMINAL_ENABLE_ANIMATIONS: bool = True
    TERMINAL_SOUND_ALERTS: bool = False

    # Observability & Logging
    LOG_FORMAT: str = "console"  # "json" | "console"
    LOG_LEVEL: str = "INFO"

    # CORS
    ALLOWED_ORIGINS: Optional[str] = Field(default=None, alias="ALLOWED_ORIGINS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @model_validator(mode="after")
    def validate_security(self):
        if not self.JWT_SECRET:
            env_val = os.environ.get("JWT_SECRET")
            if env_val:
                self.JWT_SECRET = env_val
            elif self.is_production:
                import secrets
                self.JWT_SECRET = secrets.token_urlsafe(32)
            else:
                self.JWT_SECRET = "stockoracle-dev-secret-key-non-prod"
        return self

    @property
    def is_sqlite(self) -> bool:
        return not self.DATABASE_URL or self.DATABASE_URL.startswith("sqlite")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod")


# Global singleton instance
settings = Settings()


def get_openbb_provider_keys() -> Dict[str, str]:
    """Extracts all active API keys mapped for OpenBB SDK provider ingestion."""
    keys = {}
    if settings.OPENBB_FMP_API_KEY:
        keys["fmp"] = settings.OPENBB_FMP_API_KEY
    if settings.OPENBB_POLYGON_API_KEY:
        keys["polygon"] = settings.OPENBB_POLYGON_API_KEY
    if settings.OPENBB_FRED_API_KEY:
        keys["fred"] = settings.OPENBB_FRED_API_KEY
    if settings.OPENBB_ALPHA_VANTAGE_API_KEY:
        keys["alpha_vantage"] = settings.OPENBB_ALPHA_VANTAGE_API_KEY
    return keys
