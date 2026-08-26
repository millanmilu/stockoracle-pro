"""
StockOracle Pro — HTTP Request-ID & Access-Log Middleware
"""
import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("stockoracle.access")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    1. Reads X-Request-ID header if the client sends one, else generates a UUID.
    2. Stores it on request.state.request_id.
    3. Adds X-Request-ID to the response headers.
    4. Emits a single structured access-log line with method, path, status, latency.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = rid

        t0 = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "Unhandled exception in request",
                extra={"request_id": rid},
            )
            raise

        latency_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "%s %s \u2192 %s (%.1f ms)",
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
            extra={"request_id": rid},
        )
        response.headers["X-Request-ID"] = rid
        return response
