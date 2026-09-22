# 02 — Backend Modules (part 1: main, core, shared, guards)

## `backend/main.py` (sabse important file)
- `ConnectionManager`: per-client WS subscriptions, default = popular_tickers, cap 50/client, sirf subscribed ticker ko broadcast.
- Background loops (lifespan me start): price broadcaster (~15s), alert scheduler, session keepalive, buffered tick writer.
- Broadcaster invariant: **koi hardcoded rate nahi** — LTP na mile to company_info / historical close fallback.
- Security headers (nosniff, DENY, XSS) + CORS + GZip + SlowAPI rate limit.
- `GET /ws/prices`: client `{"subscribe": [...]}` bhejta hai.

## `backend/core/`
- `logging.py`: `configure_logging()` + `get_logger()` — LOG_FORMAT=json|console.
- `middleware.py`: `RequestIdMiddleware` — X-Request-ID + latency log.
- `config_loader.py`: sirf bridge — shared.config ko re-export karta hai.

## `backend/shared/` (single source of truth)
- `config.py`: Pydantic Settings — PORT/HOST, API_KEY, JWT_SECRET, DATABASE_URL, REDIS, Celery, Angel One creds, Gemini/OpenBB keys, Telegram, Terminal theme, LOG_LEVEL, CORS. Prod me JWT_SECRET missing to loud error.
- `database.py`: engine (QueuePool PG / NullPool SQLite + WAL), `init_database()` (create_all + Timescale + DELETE WHERE length(date)>10), `get_db_session()`, `get_db()` dep.
- `models.py`: ~25 tables. HistoricalPrice me CHECK: date len=10, price>0, low<=open/close, high>=open/close.
- `security.py`: single-user `default_user`, `verify_api_key()` (API_KEY set ho tabhi enforce), Fernet vault ENC:/OBF:/plaintext compat.

## `backend/api/_guards.py`
- `require_real_data(df, ticker, endpoint)` — synthetic `data_source` ho to HTTP 503. Har ML/backtest/analytics endpoint me fetch ke turant baad lagta hai.
