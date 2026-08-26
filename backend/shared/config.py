"""
StockOracle Pro — Centralized Application Configuration
Pydantic Settings model reading from .env and environment variables.
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # App
    APP_NAME: str = "StockOracle Pro"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False

    # Security & Auth
    API_KEY: Optional[str] = Field(default=None, alias="API_KEY")
    JWT_SECRET: str = "stockoracle-pro-secret-key-change-in-prod"
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
    ANGEL_PASSWORD: Optional[str] = Field(default=None, alias="ANGEL_PASSWORD")
    ANGEL_TOTP_SECRET: Optional[str] = Field(default=None, alias="ANGEL_TOTP_SECRET")

    # AI & External APIs
    GEMINI_API_KEY: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")

    # Telegram Bot Alerts
    TELEGRAM_BOT_TOKEN: Optional[str] = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    TELEGRAM_CHAT_ID: Optional[str] = Field(default=None, alias="TELEGRAM_CHAT_ID")

    # Observability & Logging
    LOG_FORMAT: str = "console"  # "json" | "console"
    LOG_LEVEL: str = "INFO"

    # CORS
    ALLOWED_ORIGINS: Optional[str] = Field(default=None, alias="ALLOWED_ORIGINS")

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
