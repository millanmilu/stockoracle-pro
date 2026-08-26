"""
StockOracle Pro — Structured JSON Logger
Emits one JSON line per log record for easy grep, parsing, and forwarding.
Falls back to a human-readable console format when LOG_FORMAT=console (default for dev).
"""
import logging
import json
import os
import uuid
from datetime import datetime, timezone

LOG_FORMAT = os.getenv("LOG_FORMAT", "console")   # "json" | "console"
LOG_LEVEL  = os.getenv("LOG_LEVEL", "INFO").upper()


class JsonFormatter(logging.Formatter):
    """Emits one compact JSON line per record."""
    def format(self, record: logging.LogRecord) -> str:
        obj = {
            "ts":      datetime.now(timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "msg":     record.getMessage(),
        }
        # Attach request_id if injected via LogRecord.extra
        if hasattr(record, "request_id"):
            obj["request_id"] = record.request_id
        if record.exc_info:
            obj["exc"] = self.formatException(record.exc_info)
        return json.dumps(obj, ensure_ascii=False)


def configure_logging() -> None:
    """
    Call once at application startup (in main.py before any module imports loggers).
    Replaces basicConfig so all loggers inherit the same handler + formatter.
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    # Remove any existing handlers to avoid duplicate output
    root.handlers.clear()

    handler = logging.StreamHandler()
    if LOG_FORMAT == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        ))
    root.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    """Convenience wrapper — use instead of logging.getLogger() in every module."""
    return logging.getLogger(name)
