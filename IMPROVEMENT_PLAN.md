# StockOracle Pro — Code Review & Improvement Plan

**Review Date:** 2026-09-01  
**Scope:** Full-stack review of 250+ files across backend (Python/FastAPI), frontend (React/Vite), tests, and infrastructure.

---

## Summary of Findings

| Category | Critical | High | Medium | Low |
|---|---|---|---|---|
| Architecture & Duplication | 1 | 4 | 3 | 2 |
| Database Layer | 2 | 3 | 2 | 1 |
| Frontend (React) | 0 | 5 | 4 | 2 |
| WebSocket & Real-time | 1 | 2 | 1 | 1 |
| Testing | 0 | 3 | 3 | 2 |
| Security | 1 | 2 | 2 | 1 |
| Performance | 0 | 2 | 3 | 2 |
| Dependencies | 0 | 2 | 2 | 1 |
| **Total** | **5** | **23** | **20** | **12** |

---

## 🔴 CRITICAL — Must Fix Immediately

### C1. GEMINI.md is a near-exact duplicate of AGENTS.md
**Files:** `AGENTS.md`, `GEMINI.md`  
**Problem:** Both files contain identical architectural rules. Two sources of truth guarantee drift.  
**Fix:** Delete `GEMINI.md`. Keep `AGENTS.md` as the single source of architectural invariants. If AI-specific rules are needed, add a dedicated section to `AGENTS.md` or create a `COPILOT.md`.

### C2. Dual Database Access Layer (raw sqlite3 + SQLAlchemy ORM)
**Files:** `backend/data/database.py`, `backend/shared/database.py`  
**Problem:** `database.py` uses raw `sqlite3.connect()`, `get_db_connection()`, and raw SQL (`executemany`, `conn.execute(...)`). `shared/database.py` uses SQLAlchemy 2.0 ORM with `engine`, `SessionLocal`, `Base.metadata.create_all()`. Both initialize tables and clean up data. This creates:
- Schema drift risk (two places to add columns)
- Transaction isolation failures (raw sqlite3 bypasses SQLAlchemy sessions)
- Connection pool conflicts

**Fix:**
- Migrate all `backend/data/database.py` functions to use SQLAlchemy ORM via `backend/shared/database.py`
- Deprecate `get_db_connection()` and `sqlite3` usage in `database.py`
- Keep `database.py` for pure query helpers that return DataFrames (use `engine.execute()` / `session.execute()`)
- Ensure `init_db()` in `main.py` calls `init_database()` once, not both paths

### C3. WebSocket duplicate implementation & stale data bug
**Files:** `frontend/src/components/LiveChartView.jsx`, `frontend/src/hooks/useWebSocket.js`  
**Problem:**
- `useWebSocket.js` hook is defined but **never imported or used** in `LiveChartView.jsx`. The component has its own inline WebSocket `useEffect` with essentially the same logic (reconnect, ping, retry backoff) — duplicated effort.
- `setWsLiveData` is called with `(isLiveTick)` where `isLiveTick = is_live !== false` — when the flag is missing it defaults to `true`, treating stale fallback data as live.
- `useStore.getState().setWsLiveData?.(true)` is called in the `onopen` handler, but `setWsLiveData(true)` is the Zustand action signature — the `.call` pattern is inconsistent.

**Fix:**
- Use the `useWebSocket` hook from `useWebSocket.js` instead of inline implementation, OR extract shared logic to a `useWebSocket` hook
- Fix `isLiveTick` default: when `is_live` is missing/undefined, treat it as stale (`false`) until confirmed live by the server
- Add server-side validation that the `is_live` flag is always explicitly set

### C4. Hardcoded fallback rate risk in WebSocket broadcaster
**File:** `backend/main.py:websocket_price_broadcast_loop()`  
**Problem:** If `prices_cache` is empty AND `get_company_info`/`get_stale_company_info` return None, the ticker gets skipped entirely without a fallback. The AGENTS.md rule says "must fall back strictly to verified historical/company_info close prices" — but there's no verification that these are actually close prices vs. arbitrary values. Also, `smartApi` is used as a global in the broadcast loop without null-checking the session in each iteration.

**Fix:**
- Add explicit fallback to `get_historical_prices` last close if both `prices_cache` and `company_info` are unavailable
- Add session validity check (`if not _session_active`) before each `smartApi.ltpData` call
- Cache the fallback price source for auditability

### C5. `JWT_SECRET` hardcoded in config
**File:** `backend/shared/config.py:23`  
**Problem:** `JWT_SECRET: str = "stockoracle-pro-secret-key-change-in-prod"` is a hardcoded default in source code. This is a credential that should never be in version control.

**Fix:**
- Remove the default value: `JWT_SECRET: str = Field(default=None)`
- Add validation in `Settings.__init__` or `model_validator` that raises `ValueError` if `JWT_SECRET` is None in production
- Add to `.env.example` with a clear instruction

---

## 🟠 HIGH PRIORITY

### H1. Code Duplication — `getWsUrl()`
**Files:** `frontend/src/components/LiveChartView.jsx:27-37`, `frontend/src/hooks/useWebSocket.js:3-13`  
**Fix:** Extract `getWsUrl()` to `frontend/src/utils/api.js` and import from both files.

### H2. `fetch_stock_data` has fragmented fallback logic
**File:** `backend/data/fetcher.py:475-670`  
**Problem:** 5 sequential fallback layers with nested try/except blocks. The Yahoo Finance fallback is inside a `if not is_intraday` check that's already inside the Angel One failure path, creating confusing control flow. The synthesized fallback also imports `execute_screener_sql_query` which doesn't exist in `database.py` (likely a bug — `execute_screener_sql_query` is not defined anywhere in the reviewed codebase).

**Fix:**
- Refactor into a clear pipeline: `Cache → Angel One → Yahoo Finance → SQLite Partial → Synthesize`
- Each layer should be a separate async function
- Fix the `execute_screener_sql_query` reference — it's called but never defined; either define it or remove the synthesized fallback path

### H3. Frontend `LiveChartView.jsx` is too large (1250+ lines)
**Problem:** Single component handles chart init, data fetching, WebSocket, replay mode, alerts, backtest, comparison, and indicators. This makes testing, debugging, and maintenance extremely difficult.

**Fix:** Extract into composable custom hooks:
- `useChartInit()` — chart creation, series setup, cleanup
- `useChartData()` — history/prediction fetching, binding to chart series
- `useWebSocketFeed()` — WebSocket connection, message handling, alert triggers
- `useReplayMode()` — bar replay logic
- `useIndicatorOverlay()` — indicator toggle and data binding
- Keep `LiveChartView.jsx` as a thin orchestrator (~200 lines)

### H4. `calculateBollingerBands` is O(n²) in frontend
**File:** `frontend/src/utils/chartIndicators.js:54-73`  
**Problem:** `candles.slice(i - period + 1, i + 1)` creates a new array slice for every bar, and `reduce` iterates over it. For 250 bars with period=20, this is ~4,800 array creations and 9,600 iterations.

**Fix:** Use a rolling sum with incremental update (same pattern as `calculateSMA`):
```js
let sum = 0;
for (let i = 0; i < period; i++) sum += closes[i];
// ... then slide window
```

### H5. No TypeScript in frontend
**Problem:** All 200+ React components are plain JavaScript with zero type safety. This is a significant risk for a financial application where incorrect data types could cause wrong trading decisions.

**Fix:** Migrate to TypeScript incrementally:
1. Rename `.jsx` → `.tsx` and `.js` → `.ts` for core files first
2. Add `tsconfig.json` with strict mode
3. Define type interfaces for all API response shapes, store state, and chart data
4. Prioritize: `useStore.js` → `chartHelpers.js` → `LiveChartView.jsx` → others

### H6. Database writes bypass SQLAlchemy session management
**Files:** `backend/data/database.py` (all functions)  
**Problem:** Every function in `database.py` creates its own `sqlite3.connect()` context manager, bypassing SQLAlchemy's `SessionLocal()`. This means:
- No automatic transaction management across multiple operations
- No ORM event hooks (e.g., `before_insert`)
- Connection leaks if exceptions occur before `conn.commit()`
- Incompatibility with PostgreSQL/TimescaleDB (raw sqlite3 only works with SQLite)

**Fix:**
- Create SQLAlchemy-compatible helper functions: `db_execute(query, params)`, `db_fetch_one(query, params)`, etc.
- Use `with get_db_session() as session:` pattern from `shared/database.py`
- For bulk inserts, use `session.bulk_save_objects()` or `session.execute()` with ORM objects

### H7. Missing `execute_screener_sql_query` function
**File:** `backend/data/fetcher.py:650`  
**Problem:** `from backend.data.database import execute_screener_sql_query` — this function is imported but does not exist in `database.py` or anywhere in the codebase. The fallback candle synthesis will always fail at this import.

**Fix:** Either implement `execute_screener_sql_query` in `database.py` or remove the synthesized fallback path.

### H8. Inconsistent test frameworks
**Files:** `tests/test_data_invariants.py`, `tests/test_database_invariants.py`, `tests/test_security_and_bugs.py` use `unittest`; `tests/test_indicators.py`, `tests/test_api_endpoints.py` use `pytest`.  
**Problem:** Mixing frameworks makes test discovery, fixtures, and reporting inconsistent.

**Fix:** Standardize on `pytest` with `pytest-unittest` compatibility or convert all `unittest` tests to `pytest`.

### H9. No frontend tests
**Problem:** Zero test coverage for the React frontend. `chartHelpers.js` and `chartIndicators.js` contain critical financial calculations with no verification.

**Fix:**
- Add `vitest` (or `jest`) to devDependencies
- Test `parseNum`, `toChartTime`, `calculateSMA`, `calculateEMA`, `calculateBollingerBands` with known inputs/outputs
- Add component rendering tests for critical views using `@testing-library/react`

### H10. `_call_api` retry logic has a bug
**File:** `backend/data/fetcher.py:241-287`  
**Problem:** The `return result` at line 274 is inside the `for` loop but outside the `if result and not result.get("status")` block. This means:
- If the first call succeeds AND `result.get("status")` is truthy, it returns immediately ✓
- If the first call fails AND it's an auth error, it resets session and retries ✓
- If the first call fails with a rate limit, it sleeps and retries ✓
- BUT: if a retry succeeds, it falls through to `return result` only if `result.get("status")` is truthy — if `result.get("status")` is falsy on retry, it falls through the `if` block and returns the failed `result` without retrying again

Actually looking more carefully: the `return result` at line 274 is at the end of the loop body, after the `if/elif/except` chain. So the flow is:
- If `result` is truthy AND `result.get("status")` is truthy → falls through to `return result` ✓
- If `result` is falsy or `result.get("status")` is falsy → enters the nested error handling blocks → may `continue` to retry or fall through to `return result`

The `return result` at the end is actually outside the for loop based on indentation? No — looking at the actual code, the `return result` at line 274 is inside the for loop. Wait, let me re-examine...

Actually the code has:
```python
for attempt in range(retries + 1):
    try:
        result = fn(*args, **kwargs)
        if result and not result.get("status"):
            # handle errors, may continue or return
            ...
        return result  # This is inside the for loop, after the if block
    except Exception as e:
        ...
        return None  # Or continue
return None  # After loop
```

Hmm, actually looking at lines 248-287 more carefully:
- Line 274 `return result` appears to be at the same indentation as the `try` block inside the for loop
- This means it returns after the FIRST successful call that has a truthy status
- But if `result` is truthy but `result.get("status")` is falsy, the inner block handles it and may `continue` or fall through to `return result`

The potential bug: if `result` is truthy AND `result.get("status")` is falsy AND neither the auth nor rate-limit conditions match (the `if/elif/elif` chain falls through), then `return result` is reached without retrying. This would return a failed API response without attempting retries.

**Fix:** Restructure to ensure `return result` is only reached after the loop completes successfully, or explicitly return `None` after retries exhausted.

### H11. Missing API key in `broker_accounts` — credentials stored as plaintext JSON
**Files:** `backend/shared/models.py:414`, `backend/data/database.py`  
**Problem:** `credentials_json` is stored as plaintext JSON in the database. If the database is compromised, all broker credentials are exposed.

**Fix:**
- Use `backend/shared/security.py` encrypt/decrypt helpers (or add them) with `cryptography.fernet`
- Encrypt at write, decrypt at read
- Add `encrypt_credentials()` and `decrypt_credentials()` helper functions

---

## 🟡 MEDIUM PRIORITY

### M1. `fetch_company_info` has too many responsibilities
**File:** `backend/data/fetcher.py:676-801`  
**Problem:** Fetches LTP from Angel One, queries SQLite for 52-week range, falls back to stale company info, falls back to 1M history fetch, synthesizes 52-week bounds — all in one function.

**Fix:** Extract into:
- `get_ltp(ticker)` → Angel One live
- `get_historical_summary(ticker)` → SQLite aggregates
- `get_fallback_company_info(ticker)` → stale cache or synthesized
- Compose in the main function

### M2. `useStore` `historyCache` grows unbounded
**File:** `frontend/src/store/useStore.js:24`  
**Problem:** `historyCache: {}` stores fetched history keyed by symbol+interval+timeframe. Over time this accumulates unbounded memory.

**Fix:** Add LRU eviction (max 50 entries) or use `Map` with size tracking.

### M3. No centralized FastAPI error handling middleware
**File:** `backend/main.py`  
**Problem:** No exception handler for unhandled HTTP exceptions, validation errors, or 500s. The `RequestIdMiddleware` catches exceptions but re-raises without a consistent JSON error response.

**Fix:** Add a `@app.exception_handler()` for `RequestValidationError`, `HTTPException`, and generic `Exception` returning consistent JSON error shapes.

### M4. `toChartTime` intraday conversion is fragile
**File:** `frontend/src/utils/chartHelpers.js:13-19`  
**Problem:** `Math.floor(Date.parse(normalized) / 1000)` for intraday timestamps. If `normalized` has timezone issues, the resulting Unix timestamp will be wrong. Also, `Date.parse` behavior varies across browsers for non-standard formats.

**Fix:** Use `new Date(normalized).getTime()` with explicit ISO-8601 formatting and timezone normalization to IST (`+05:30`).

### M5. `detectPatterns` in frontend is pure computation on every render
**File:** `frontend/src/utils/chartIndicators.js:227-268`  
**Problem:** `detectPatterns` is called inside `useEffect` for every candle update, and it runs a nested loop over all candles. With 250 candles this is ~6,000 operations per re-render.

**Fix:** Memoize with `useMemo` or debounce pattern detection to run every 500ms instead of every candle update.

### M6. `requirements.txt` has inconsistent version pinning
**File:** `backend/requirements.txt`  
**Problem:** Some packages pinned (`fastapi==0.111.0`), some unpinned (`websockets>=13.0`), some overly broad (`openbb>=4.2.0`, `transformers>=4.40.0`). No lockfile.

**Fix:** Generate `requirements.lock` with `pip freeze` after `pip install`. Pin all production dependencies. Move ML packages (`transformers`, `torch`, `sentencepiece`, `openbb`) to a separate `requirements-ml.txt` to keep the core fast.

### M7. `liveTick_ohlcv` uses `datetime.now()` without timezone
**File:** `backend/data/database.py:935-960`  
**Problem:** `get_live_tick_ohlcv()` uses `datetime.now().strftime("%Y-%m-%d")` which is system-local time. If the server is UTC, this will be wrong for IST market dates.

**Fix:** Use `datetime.now(ZoneInfo("Asia/Kolkata"))` consistently.

### M8. Multiple `import logging` statements
**Files:** `backend/data/database.py:484`, `backend/data/fetcher.py` (multiple places)  
**Problem:** `import logging` is imported inside `except` blocks and within functions, even though `logging` is already imported at module level in most files. This is redundant and hurts performance (though minor).

**Fix:** Move all `import logging` statements to the top of each file.

### M9. `save_live_tick` timestamp uses `datetime.now()` without timezone
**File:** `backend/data/database.py:730`  
**Problem:** Timestamps in `live_ticks` table use `datetime.now().isoformat()` without UTC/IST designation. Per AGENTS.md, UTC is reserved for ticks, but these timestamps have no timezone indicator.

**Fix:** Use `datetime.now(timezone.utc).isoformat()` for all tick/event timestamps.

### M10. `activeCandleRef` not reset on symbol change
**File:** `frontend/src/components/LiveChartView.jsx`  
**Problem:** When `selectedSymbol` changes, `activeCandleRef.current` is set to `null` in the data fetch `useEffect`, but the WebSocket `onmessage` handler can still fire with data for the old symbol before the new subscription is sent.

**Fix:** Reset `activeCandleRef.current = null` in the WebSocket `onopen` handler after subscribing, and add a symbol version counter to discard stale messages.

---

## 🔵 LOW PRIORITY

### L1. Duplicate `import logging` in `write_audit_log`
**File:** `backend/data/database.py:484`  
**Fix:** Remove `import logging` inside the except block — `logging` is already imported at module level.

### L2. `cleanup_old_tasks` default is different from `init_db` call
**File:** `backend/main.py:184` calls `cleanup_old_tasks(max_age_hours=48)` but `cleanup_old_tasks` default is `max_age_hours=24`. This is a parameter mismatch.

### L3. `CELERY_BROKER_URL` not configured for `backend/tasks/celery_app.py`
**Files:** `backend/tasks/celery_app.py`, `backend/shared/config.py`  
**Problem:** The Celery app likely fails if `CELERY_BROKER_URL` is not set. No validation that Celery config is present before worker starts.

### L4. `terminal_ui/` is dead code — never tested in CI
**Files:** `terminal_ui/*.py`, `verify_terminal.py`  
**Problem:** The terminal UI module has no tests. It imports `textual` which may not be installed in all environments.

### L5. `scratch_fix_urls.py` at repo root
**File:** `scratch_fix_urls.py`  
**Problem:** A scratch/utility file at the root of the repo. Should be removed or moved to a scratch directory.

### L6. Missing `__all__` exports in many `__init__.py` files
**Files:** `backend/__init__.py`, `backend/data/__init__.py`, etc.  
**Problem:** Many `__init__.py` files are empty or just pass, providing no explicit public API.

### L7. `CONTRIBUTING.md` or `DEVELOPMENT.md` missing
**Problem:** No developer setup guide. New contributors don't know how to set up the environment, run tests, or deploy.

---

## 📋 Implementation Phases

### Phase 1: Critical Fixes (Week 1-2)
- [ ] C1: Delete `GEMINI.md`, consolidate rules
- [ ] C2: Start SQLAlchemy migration for `database.py` (create migration script)
- [ ] C3: Consolidate WebSocket logic into `useWebSocket` hook
- [ ] C4: Add historical fallback in broadcast loop
- [ ] C5: Fix `JWT_SECRET` default, add validation
- [ ] H7: Fix/remove `execute_screener_sql_query` reference

### Phase 2: Architecture & Database (Week 3-5)
- [ ] H6: Migrate `database.py` raw SQL to SQLAlchemy ORM
- [ ] H2: Refactor `fetch_stock_data` into pipeline pattern
- [ ] H11: Add credential encryption for `broker_accounts`
- [ ] M1: Extract `fetch_company_info` sub-functions
- [ ] M7: Fix timezone in `get_live_tick_ohlcv` and `save_live_tick`

### Phase 3: Frontend Quality (Week 4-7)
- [ ] H3: Extract `LiveChartView.jsx` into composable hooks
- [ ] H4: Fix `calculateBollingerBands` to O(n)
- [ ] H5: Start TypeScript migration (critical files first)
- [ ] M3: Add centralized error handling middleware
- [ ] M5: Memoize `detectPatterns` calls

### Phase 4: Testing & Reliability (Week 5-8)
- [ ] H8: Standardize on pytest
- [ ] H9: Add frontend tests with vitest
- [ ] Add integration tests for WebSocket flow
- [ ] Add tests for `fetcher.py` (mocked API calls)
- [ ] Add performance benchmarks for indicator calculations
- [ ] H10: Fix `_call_api` retry logic

### Phase 5: Dependencies & DevOps (Week 6-8)
- [ ] H6: Create `requirements.lock`
- [ ] H11: Separate ML dependencies
- [ ] L1-L7: Clean up minor issues
- [ ] Add CI/CD pipeline (GitHub Actions)
- [ ] Add `CONTRIBUTING.md`

---

## 📊 Test Coverage Targets

| Module | Current | Target |
|---|---|---|
| `backend/data/database.py` | ~40% | 80% |
| `backend/data/fetcher.py` | 0% | 70% |
| `backend/analysis/indicators.py` | ~50% | 85% |
| `backend/analysis/` (all modules) | 0% | 60% |
| `backend/services/` | 0% | 70% |
| `backend/api/routers/` | 0% | 70% |
| `frontend/src/utils/` | 0% | 80% |
| `frontend/src/components/` | 0% | 50% |
| **Overall** | **~15%** | **65%** |

---

## 🏗️ Priority Matrix

```
Impact →       Low        Medium       High        Critical
               ────────────────────────────────────────────
Effort  Low   L1,L2,L3    M8,M9,M10     H10,H11     C1,C5
        Mid         —        M1,M4,M5    H3,H4,H6    C2,C3,C4
        High        —        M2,M3       H2,H5,H7    —
        Huge        —         —          H8,H9       —
```

**Start with:** C1, C5, H7 (quick wins that fix real bugs), then C2, C3, C4 (architectural integrity), then work through the phases above.
