# 05 — API Endpoints (full list)

## System (`system.py`)
- `GET /` → status/version
- `GET /api/health` → status, database, angel_one_api, alert_scheduler, environment
- `GET /api/db/status` (auth) → row counts
- `GET /api/audit-log?limit&user_id` (auth)
- `GET /api/system/disclaimer` → SEBI/risk text

## Market (`market.py`, prefix /api, auth)
- `GET /api/stock/{t}/history?period&interval&full` → candles + indicators (trimmed)
- `GET /api/stock/{t}/company` → profile+LTP
- `GET /api/stocks/search?q` → universe + BTC/XAU
- `GET /api/stocks/session` → Angel session status
- `GET /api/stock/{t}/news`, `GET /api/market/news` → multi-source
- `GET /api/market/heatmap?universe&metric`
- `POST /api/stock/{t}/custom-indicator` {formula, interval, period}

## Research (`research.py`, prefix /api)
- `GET /api/stock/{t}/fundamentals`, `/options-chain?expiry`, `/patterns?period&lookback`, `/levels`
- Screener: `POST /api/screener/scan`, `GET /api/screener/results`, saved-scans CRUD
- `GET /api/stock/{t}/volatility`, `/monte-carlo`, `/anomalies`, `/macro`, `/supply-chain`, `/dcf`
- `POST /api/portfolio/risk-cockpit`, `GET /api/terminal/ticker-tape`, `POST /api/stock/{t}/simulate`

## Portfolio (`portfolio.py` /api/portfolio, auth)
- `GET /api/portfolio` → live P&L + sector
- `POST /api/portfolio` {ticker, shares, buy_price}
- `DELETE /api/portfolio/{id}`

## Paper (`paper.py` /api/paper, auth)
- `GET /api/paper/account`, `/positions`, `/history?limit`, `/analytics`
- `POST /api/paper/order` {ticker, MARKET|LIMIT, BUY, shares, price, SL, target, notes}
- `POST /api/paper/sell` {position_id, shares, current_price}
- `POST /api/paper/close` {position_id, current_price}
- `POST /api/paper/reset` → ₹10L reset

## Alerts (`alerts.py` /api/smart-alerts, auth)
- `GET /`, `POST /` {ticker, alert_type, param_value}, `DELETE /{id}`, `GET /evaluate`

## ML (`ml.py` /api, auth)
- `GET /api/stock/{s}/predict` (7-day + bounds + MAPE, cache 10m)
- `GET /api/stock/{s}/explain`, `/shap-drivers`
- `POST /api/train/{t}?epochs` → task_id (Celery ya background)
- `GET /api/task/{task_id}`, `/api/models/registry?ticker`
- `GET /api/stock/{t}/backtest?strategy&...` (6 strategies + risk params)
- `GET /api/stock/{t}/ai-consensus`, `/ml/benchmark/{t}`, `/stock/{t}/forecast-bands`

## AI Chat (`ai_chat.py` /api, auth)
- `POST /api/ai/chat` {ticker, question}
- `GET /api/stock/{t}/news-summary`, `/stock/{s}/ai-trade-explain`

## Sentiment TA (`sentiment_ta.py` /api, auth, cache 5m)
- `GET /api/stock/{t}/sentiment-ta?period`
- `GET /api/stock/sentiment-ta/compare?tickers` (max 6)
- `GET /api/sentiment/market-overview?tickers` (max 20, Fear&Greed)

## Broker (`broker.py` /api/broker, auth)
- `GET /api/broker/status`, `/accounts`, `/audit?broker`
- `POST /api/broker/test`, `/apply` (persist_to_disk), `/connect`, `/clear`
- Upstox callback endpoint bhi hai.

## AI Providers (`ai_providers.py` /api/ai/providers)
- `GET /`, `POST /test`, `POST /save`, `POST /activate`, `DELETE /delete`, `GET /usage`

## Legacy (backend/main.py me direct)
- `GET /api/sentiment/market`, `/api/screener/advanced`, `/api/market/heatmap`, `POST /api/settings/telegram-test`

## WebSocket
- `WS /ws/prices` — connect → default popular tickers; send `{"subscribe": ["RELIANCE","BTC"]}` (max 50). Tick: {ticker, price/ltp, change_pct, ts}.
