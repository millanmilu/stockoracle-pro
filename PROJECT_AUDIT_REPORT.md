# PROJECT AUDIT REPORT — StockOracle Pro

**Date:** 2026-10-07
**Scope:** Full-stack audit — architecture, bugs, security, auth, APIs, DB, React, Python, error handling, deps, performance, env/secrets, production readiness, tests.

---

## PROJECT SUMMARY

- **Architecture:** FastAPI modular monolith (`backend/`, 11 routers) + React 18/Vite SPA (`frontend/`) + Textual/Rich CLI terminal (`terminal_ui/`) + SQLite (WAL) via SQLAlchemy + optional Redis/Celery. Deployment bespoke AWS EC2 (systemd + nginx) + Amplify for frontend. **No Docker.**
- **Main technologies:** Python 3.12, FastAPI, SQLAlchemy, PyTorch ML models, React 18, Zustand, lightweight-charts, Vite, ESLint 9, pytest, node --test.
- **Frontend:** ~100 component files, engine unit tests only (16 JS tests), no component tests.
- **Backend:** ~60 modules, 22 pytest files, one God-module `main.py` (~610 lines: WS manager, broadcast loop, lifespan, middleware, legacy routes).
- **Database:** SQLite primary (`historical_prices`, `intraday_candles`, screener tables, paper/portfolio/alerts), Alembic present but effectively bypassed (single revision = `create_all`; real migrations in imperative `init_db()`).
- **External services:** Angel One / Zerodha / Upstox / Fyers broker SDKs, LLM providers (6), Telegram bot, OpenBB, Binance WS, news APIs.

---

## CRITICAL ISSUES

### C1 — Production me API key fail-open
- **File:** `backend/shared/security.py:53-72` — `verify_api_key`
- **What:** `API_KEY` unset hai to har request allow (sirf ek baar log). Default `ENVIRONMENT` = production.
- **Impact:** prod host pe env missing ⇒ trading/broker/AI-provider surface poora unauthenticated writable.
- **Fix:** fail-closed — `ENVIRONMENT != development` me `API_KEY` unset ⇒ 500/403.

### C2 — IDOR via client-supplied `?user_id=`
- **Files:** `api/routers/alerts.py:33,45,63`, `system.py:58`, `research.py:288,300,315,491,527,579`, `portfolio.py` (L56,94,109), `paper.py` (har endpoint L50-159).
- **What:** `get_current_user_id()` header reject karta hai, par router me `effective_user = user_id or get_current_user_id(request)` se override wapas allow.
- **Impact:** `?user_id=victim` se kisi ka portfolio/paper/alerts/audit read-delete.
- **Fix:** `get_current_user_id(request)` use karo; `user_id` param hata do; `_ALLOWED_USER_IDS` enforce.

### C3 — `/ws/prices` WebSocket pe no auth/Origin check
- **File:** `backend/main.py:535-554` — `websocket_endpoint`
- **What:** HTTP me `X-API-Key` chahiye par WS connect pe koi check nahi.
- **Impact:** live broker prices unauthenticated broadcast + cross-site WS hijacking.
- **Fix:** connect pe token/API-key validate + Origin allowlist.

---

## HIGH PRIORITY ISSUES

### H1 — Rate limiting wire hi nahi hua
- **File:** `backend/main.py:19-21,496-498`
- `slowapi` limiter banaya, app.state me dala, par `@limiter.limit` ka **zero use**. Expensive routes (`/api/stock/{t}/predict`, `/api/screener/backtest`, `/api/ai/chat`, montecarlo) bina limit.
- **Fix:** app-wide default limit ya expensive routes pe decorators.

### H2 — `get_historical_prices` session scope se bahar execute
- **File:** `backend/data/db_history.py:299-322`
- `stmt.order_by` + `session.execute()` `with get_db_session()` block ke **baahar** (session close). NullPool pe detached session / leak.
- **Fix:** L316-322 ko `with` block ke andar indent karo.

### H3 — `_ensure_screener_extended_columns` PostgreSQL pe hamesha fail
- **File:** `backend/data/db_screener_schema.py:33-41`
- `PRAGMA table_info` PG pe transaction abort; baad ke saar `ALTER TABLE` fail.
- **Fix:** dialect branch — PG me `information_schema.columns`.

### H4 — Race conditions
- **Files:** `backend/data/db_screener.py:184-200` (read-merge-write non-atomic lost update), `backend/data/db_portfolio.py:215-224` (paper debit check-then-act; PG pe double-spend, SQLite pe `database is locked`).
- **Fix:** `with_for_update()` / atomic conditional `UPDATE ... WHERE cash_balance >= :cost` / single-statement `ON CONFLICT` merge.

### H5 — Unguarded routes
- **Files:** `api/routers/ai_providers.py:60,255` (`GET /api/ai/providers`, `/usage` leak configured providers/masked keys), `backend/main.py:585-601` (3 legacy GETs router auth skip).
- **Fix:** router-level `dependencies=[Security(verify_api_key)]`; legacy routes routers me move/guard.

---

## MEDIUM PRIORITY ISSUES

- **M1 —** Legacy hardcoded vault secret `backend/shared/security.py:121` (`b"stockoracle_master_vault_key_2026"`) decrypt-only shim — document/expire.
- **M2 —** Broker creds runtime pe plaintext `.env` me (`api/routers/broker.py:101-171`), file perms `0o600` nahi (`security.py:151` vault key pe hota hai).
- **M3 —** Deprecated `?api_key=` query auth accept (`security.py:75-82`) — keys access logs me.
- **M4 —** `execute_screener_sql_query` raw `where_clause` f-string interpolate (`db_screener.py:269-273`) — DSL translator se aane wale trusted; test add karo (`;`/`--` reject).
- **M5 —** `IntradayCandle` unique constraint sirf runtime DDL (`database.py:44`), model me `UniqueConstraint` nahi — fresh DB pe `ON CONFLICT` fail.
- **M6 —** `idx_hist_ticker_date` non-unique `Index` model me (`models.py:32`) + UNIQUE DDL `IF NOT EXISTS` conflict — intended UNIQUE index never created (latent).
- **M7 —** `get_db_connection()` raw sqlite3 connection leak (`db_connection.py:45-51`) — `with` sirf commit/rollback, close nahi; `test_data_pipeline.py` me use.
- **M8 —** Unbounded inputs: `ai_chat.py` question, ticker fields (`alerts.py:21`, `paper.py:21`, `portfolio.py:44`), `alert_type` free string, formula `ast.Pow` → `close ** 999999999` CPU DoS (`indicator_formula.py:59-60`).
- **M9 —** Raw `str(exc)` HTTP responses me: `broker.py:277,310,345,380,608`, `market.py:435`, `research.py:830,833`, `paper.py:77,98,115`.
- **M10 —** Intraday timestamp format mixing (`db_intraday.py:69-72`) — `"2026-10-07T09:15:00+05:30"` vs `"2026-10-07 09:15:00"` same bar split.
- **M11 —** Alembic bypassed; schema boot pe imperative mutate; `init_db()` full-table DELETEs har boot (`main.py:438-439`, `database.py:30-46`).
- **M12 —** Date validation length-only (`models.py:33`, `DATE_REGEX`) — `"2026-99-99"` pass.

---

## LOW PRIORITY / CODE QUALITY

- **L1 —** `live-chart/SmcProLayer.jsx:102-115` pan/zoom pe 2× setState per frame — rAF throttle.
- **L2 —** ErrorBoundary sirf top-level (`App.jsx:169-191`) — chart subtree (LiveChartView/SmcProLayer) alag boundary me.
- **L3 —** `chart-tools/DrawingSettingsHost.jsx:60`, `DrawingToolsComponent.jsx:537` unguarded `JSON.parse(localStorage)`.
- **L4 —** `live-chart/LivePriceBadge.jsx:10-16` render-prop memo defeat — full ChartToolbar har tick re-render.
- **L5 —** `hooks/useWebSocket.js:85,117` reconnect timer untracked; L99 vs L134 `cryptoWsRef` use-before-declare.
- **L6 —** Dead probe `ISeriesApi.data()` (`chart/canvas/imperativeApi.js:35-37`) — lightweight-charts v4 me nahi.
- **L7 —** `get_live_tick_ohlcv` fabricates `volume = len(prices)` (`db_ticks.py:71`).
- **L8 —** Duplicate indexes (`Index` + `index=True` same columns; `models.py` portfolio/audit/savedscan/paper/smartalert) + redundant `idx_intraday_lookup`.
- **L9 —** Silent `except Exception: pass` bar bar (`screener_ta_engines.py`, `screener_pipeline.py`, `shared/cache.py`).
- **L10 —** `backend/data/test_data_pipeline.py` galat jagah — `tests/` me move.
- **L11 —** `components/LiveChartView.jsx` 4-line shim + real file same path — two import paths same component.
- **L12 —** `deploy_remote.sh:10` hardcoded prod IP + `stock.pem` root.

---

## PERFORMANCE ISSUES

- **P1 —** N+1 in `get_paper_positions` (`db_portfolio.py:113,117,142`) — `get_company_info` + `session.get(ScreenerDailyMetric)` + `get_live_tick_ohlcv` per position. Batch `IN` query.
- **P2 —** No busy_timeout PRAGMA / NullPool (`shared/database.py:50-67`) — SQLite writer contention pe `database is locked`.
- **P3 —** Boot-time full-table DELETE + purge har startup (`database.py:30-46`).
- **P4 —** SmcProLayer full SVG rebuild per pan frame (L1 ke saath).
- **P5 —** LivePriceBadge whole toolbar re-render ~1-10×/s (L4 ke saath).

---

## SECURITY ISSUES (consolidated)

S1 C1 fail-open API key · S2 C2 IDOR `?user_id=` · S3 C3 WS no auth/Origin · S4 H1 no rate limit · S5 M3 `?api_key=` · S6 M2 plaintext `.env` perms · S7 M4 raw `where_clause` · S8 formula `ast.Pow` DoS · S9 raw `str(exc)` leaks · S10 CORS OK · S11 no eval/Function (good) · S12 `stock.pem`/prod IP local only (gitignored).

---

## PRODUCTION READINESS

- No Dockerfile/docker-compose — containerize ya systemd-only document.
- Alembic incomplete (single `create_all` revision); imperative boot migrations.
- Logging: `exc_info=True` mostly server-side only (good); no structured log config check needed.
- CI: 3 jobs (backend pytest+flake8, frontend test+lint+build, invariants+check_brain) — solid; no Docker build step.
- Secrets: `.env`, `.vault_dev.key`, `stock.pem` gitignored (verified).
- Health: `/api/health` present; DB/Redis readiness check add.
- Missing: request size limits, partial rate limiting, WS auth.

---

## FILES THAT SHOULD NOT BE CHANGED

- `AGENTS.md` (5 architecture locks)
- `brain/*.md` (unless updating facts — `check_brain.py` enforce)
- `backend/analysis/indicators.py` (min_periods=1, zero-drop invariant)
- `backend/data/database.py` daily-date invariant (`YYYY-MM-DD`, no intraday in daily table)
- `frontend/src/utils/customIndicatorEngine.js` DSL (validated, security-sensitive)
- `frontend/src/hooks/useWebSocket.js` backoff/jitter/URL rotation core
- `frontend/src/utils/smc/*` (SMC correctness fixes just landed, tests green)
- `scripts/check_brain.py`
- `aws/nginx.conf`, `aws/stockoracle.service` (verify before touch)

---

## RECOMMENDED FIX ORDER

1. C2 IDOR `?user_id=`
2. C1 fail-open API key
3. C3 WS auth/Origin
4. H1 rate limiter wire-up
5. H2 `get_historical_prices` session-scope bug
6. H4 paper-trading debit atomicity + screener merge race
7. H3 PG dialect branch in screener columns
8. H5 guard ai_providers + legacy routes
9. M5/M6 unique constraints into models
10. M9 sanitize error messages
11. M10/M12 timestamp + date validation
12. P1 paper positions N+1
13. L4/L1/P4 React re-render/jank
14. L2 chart ErrorBoundary
15. L7-L9 cleanup/tests/logging

---

## STEP-BY-STEP ACTION PLAN (safest → highest impact)

1. Remove client `?user_id=` override in `alerts.py`, `paper.py`, `portfolio.py`, `system.py`, `research.py` — use `get_current_user_id(request)`.
2. Fail-closed `verify_api_key` when `ENVIRONMENT != development` and `API_KEY` unset.
3. WS auth: validate `X-API-Key`/token on `/ws/prices` + Origin allowlist.
4. Wire `slowapi`: app-wide default (`100/minute`) + stricter on `/api/ai/chat`, `/api/screener/backtest`, `/api/stock/{t}/predict`.
5. Fix `get_historical_prices`: indent `stmt.order_by`/`session.execute()` inside `with get_db_session()`.
6. Atomic paper debit: `UPDATE paper_account SET cash_balance = cash_balance - :cost WHERE user_id=:u AND cash_balance >= :cost`; check rowcount.
7. Screener merge: `SELECT ... FOR UPDATE` ya single-statement `ON CONFLICT` merge.
8. PG dialect branch in `_ensure_screener_extended_columns` (use `information_schema.columns`).
9. Promote unique constraints to models (`IntradayCandle`, `idx_hist_ticker_date` → `UniqueConstraint`).
10. Sanitize HTTP errors: `detail="Failed to ..."` + server log with exc_info.
11. Bound inputs: `max_length=100` ticker, enum `alert_type`, cap `ast.Pow` exponent.
12. Timestamp canonical format validation in `save_intraday_candles`.
13. Batch paper positions: `IN` query for live prices/sectors.
14. React: memoize `LivePriceBadge` children subtree, rAF-throttle SmcProLayer, wrap chart in ErrorBoundary, guard `JSON.parse` in DrawingSettingsHost.
15. Tests: WS-auth test, IDOR regression test, formula-DoS test, PG screener-column test (skipif no PG), timestamp canonicalization test.
16. Production: Dockerfile + compose, Alembic baseline migration, remove boot-time DELETEs from `init_db`, hardcoded prod IP → env, chmod 600 broker `.env`.
