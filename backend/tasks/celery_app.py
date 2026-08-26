"""
StockOracle Pro — Celery Application Instance & Task Registry
"""
import os
import logging
from celery import Celery
from backend.shared.config import settings

logger = logging.getLogger("StockOracle.Celery")

broker_url = settings.CELERY_BROKER_URL or settings.REDIS_URL or "redis://localhost:6379/1"
result_backend = settings.CELERY_RESULT_BACKEND or settings.REDIS_URL or "redis://localhost:6379/2"

celery_app = Celery(
    "stockoracle",
    broker=broker_url,
    backend=result_backend,
    include=[
        "backend.tasks.market_tasks",
        "backend.tasks.alert_tasks",
        "backend.tasks.ml_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1800,  # 30 minutes max per task
    task_soft_time_limit=1500,
    result_expires=3600,
    broker_connection_retry_on_startup=True,
)
