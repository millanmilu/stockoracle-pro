# 00 — Project Overview (StockOracle Pro)

## Ye project kya hai?
**StockOracle Pro** ek full-stack AI stock forecasting + trading terminal hai.
- **NSE (India)** stocks + **BTC crypto** + **Gold (XAU/USD)** support karta hai.
- Live charts (lightweight-charts), AI predictions (LSTM/Transformer/GBDT ensemble),
  backtesting, paper trading (₹10 lakh virtual), screener, options chain,
  sentiment, portfolio, alerts, broker connect (Angel One / Zerodha / Upstox / Fyers),
  aur Bloomberg-style CLI terminal — sab ek repo me.

## Tech Stack
| Layer | Tech |
|-------|------|
| Backend | FastAPI + Uvicorn, SQLAlchemy 2.0 (Postgres/TimescaleDB ya SQLite fallback), Celery + Redis, PyTorch (BiLSTM+Attention, Transformer), XGBoost, scikit-learn, arch, statsmodels |
| Data source | Angel One SmartAPI (live), yfinance fallback, Screener.in (fundamentals), NSE options, Binance (BTC/Gold), Google News RSS (sentiment) |
| Frontend | React 18 + Vite, lightweight-charts v4 (candles), Zustand (state), Axios, Recharts/Chart.js, Tailwind-style CSS |
| Terminal UI | Textual + Rich + Typer + plotext (ASCII candles, VPVR) |
| AI | Gemini (default), OpenAI, Anthropic, Mistral, Cohere, Groq — encrypted vault me keys |
| Deploy | AWS EC2 (systemd `stockoracle.service` + Nginx), Amplify (frontend), `deploy_remote.sh` se 1-click deploy |
| Timezone | **IST (Asia/Kolkata)** for market dates; UTC sirf ticks/logs ke liye |

## Entry Points
| File | Kaam |
|------|------|
| `main.py` | Master entry: `--mode web` (FastAPI), `--mode terminal` (CLI), `--mode worker` (Celery) |
| `backend/main.py` | FastAPI app: lifespan, CORS, GZip, RateLimit, RequestIdMiddleware, WS `/ws/prices`, 11 routers mount |
| `terminal_ui/institutional_terminal.py` | CLI terminal launch |
| `frontend/src/main.jsx` | React entry |
| `verify_terminal.py` | EC2 integration check (imports + async quote + OHLCV + ASCII chart) |

## Kaise chalaye (local)
```bash
./run_local.sh        # backend :8000 + frontend :5173 ek saath
./stop_local.sh       # dono band
python main.py --mode web                 # sirf backend
python main.py --mode terminal --symbol RELIANCE   # CLI terminal
python main.py --mode worker              # celery worker
```

## Health check
- Backend: `GET http://127.0.0.1:8000/api/health` → `{status, database, angel_one_api, alert_scheduler}`
- Docs: `http://127.0.0.1:8000/docs`
- Frontend: `http://localhost:5173`

## Popular tickers (default WS subscribe)
`BTC, XAUUSD, GOLD, RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, BHARTIARTL, ITC, LT, HUL`
