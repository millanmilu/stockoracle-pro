# 04 — Database Schema

## Engine
- Prod: PostgreSQL/TimescaleDB (`DATABASE_URL` set ho to). Dev/test: SQLite `backend/data/stockoracle.db`.
- `init_database()` = create_all + Timescale extension + `DELETE FROM historical_prices WHERE length(date) > 10`.

## Tables (backend/shared/models.py)
| Table | Key | Kaam |
|-------|-----|------|
| `historical_prices` | (ticker, date) | **Sirf DAILY** OHLCV, date `YYYY-MM-DD` (len 10). CHECK: price>0, low<=open/close, high>=open/close, vol>=0 |
| `intraday_candles` | (ticker, interval, ts) | 1m/5m/15m/1h bars (SQLite me kabhi historical_prices me nahi) |
| `live_ticks` | id | WS tick stream (ticker, timestamp UTC, price, change_pct) |
| `stock_universe` | ticker | NSE listings (name, symbol, token, exchange, updated_at) |
| `company_info` | ticker | profile snapshot cache (JSON + fetched_at) |
| `predictions` | ticker | 7-day forecast cache |
| `screener_results` | id=1 | last scan output cache |
| `monte_carlo` | ticker | sim output cache |
| `portfolio_positions` | id | user holdings (user_id, ticker, shares, buy_price) |
| `paper_accounts` | user_id | virtual cash (start ₹10,00,000) |
| `paper_positions` | id | open virtual positions |
| `paper_orders` | id | order journal |
| `smart_alerts` | id | (user_id, ticker, alert_type, param JSON, triggered) |
| `task_status` | task_id | training jobs (ticker, status, progress, mape, error) |
| `model_registry` | id | versioned artifacts + accuracy |
| `saved_scans` | id | user screener filters |
| `companies` | ticker | master company |
| `financial_statements` | id | P&L/BS/CF rows |
| `financial_ratios` | id | PE/PB/EPS/ROE/D-E |
| `shareholding_snapshots` | id | promoter/FII/DII % |
| `screener_daily_metrics` | (ticker, date) | heatmap/screener metrics |
| `user_screens` | id | custom screens |
| `broker_accounts` | broker unique | creds JSON (encrypted) + session JSON |
| `broker_audit_logs` | id | CONNECT/TEST/CLEAR events |
| `ai_providers` | provider_name unique | LLM key (encrypted+masked), model, active, requests count |
| `audit_log` | id | (user_id, action, entity, entity_id, details, ts_utc) |

## Cache TTL (database.py helpers)
company_info 5 min, predictions 10 min, screener 5 min. `_get_stale_json()` TTL ignore karke fallback deta hai jab upstream down ho.

## Invariants (detail me 07 me)
Daily date len==10 IST; intraday kabhi historical_prices me nahi; price>0 + unit normalize (paise→rupees); OHLC consistency; init pe auto-clean.
