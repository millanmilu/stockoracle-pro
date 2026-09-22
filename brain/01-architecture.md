# 01 — Architecture Map

```
stockoracle-pro /
├── main.py                  # multi-mode entry (web / terminal / worker)
├── AGENTS.md                # 5 architecture locks (brain/07 iska faithful copy hai)
├── brain/                   # ← YE FOLDER (project memory; README.md se shuru karo)
├── scripts/check_brain.py   # brain ke claims verify karta hai (CI invariants job me chalta hai)
├── backend/
│   ├── main.py              # FastAPI app + WS broadcaster + router mount + 4 legacy routes
│   ├── core/                # logging, middleware, config_loader (bridge)
│   ├── shared/              # SINGLE SOURCE OF TRUTH: config, database, models, security
│   ├── api/
│   │   ├── _guards.py       # require_real_data() synthetic-block guard
│   │   └── routers/         # 11 domain routers (neeche table)
│   ├── data/                # fetcher, database, market_calendar, options, fundamentals, news, streamer, redis_cache
│   ├── analysis/            # indicators, patterns, levels, backtester, quant_risk, monte_carlo, ...
│   ├── research/            # screener_dsl, screener_engines, screener_pipeline, ai_screener, screener_backtest
│   ├── ml/                  # predictor (+saved_models/*.pt), lstm_model, transformer_model, benchmarking, forecast_bands
│   ├── models/              # per-symbol XGBoost/ElasticNet JSON bundles (trainer/backtester/explainer padhte hain)
│   ├── ai/                  # provider (6 LLMs), chat, news_summarizer
│   ├── services/            # market_data, ai_consensus, alert_scheduler, telegram_bot
│   ├── tasks/               # celery_app, ml_tasks
│   ├── providers/openbb/    # OpenBB wrapper + terminal_service
│   ├── scripts/             # backup_db, refresh_index, refresh_index_constituents, clear_price_data
│   └── alembic/             # DB migrations
├── frontend/
│   ├── src/components/      # LiveChartView.jsx (sabse important) + 6 sub-folders
│   │   ├── chart/           # ChartCanvas, OscillatorPane, VolumePane, IndicatorModal, AIDashboard, indicatorDefinitions
│   │   ├── chart-tools/     # drawing tools, smcEngine, AIPatternRecognition
│   │   ├── terminal/        # Bloomberg-style views + terminal/mit (Market Intelligence)
│   │   └── screener/, paper/, heatmap/
│   ├── src/store/           # zustand (useStore.js) — SINGULAR, `src/stores/` nahi
│   ├── src/hooks/           # useStock.js, useWebSocket.js
│   ├── src/constants/       # screenerConfig.js
│   └── src/utils/           # engines (indicatorEngine, chartIndicators, aiIndicatorEngine, aiSignalEngine) + *.test.js
├── terminal_ui/             # institutional_terminal, chart_widget (ASCII)
├── tests/                   # 19 test_*.py + conftest.py (invariants + features)
└── logs/, aws/, .github/workflows/ci.yml
```

**Detail files:** chart + AI engine layer → `11-chart-and-ai-engines.md`; screener/research layer + model artifacts → `12-research-screener.md`.

## 11 API Routers (`backend/main.py` me mount order)
| Router file | Prefix | Kaam |
|-------------|--------|------|
| `system.py` | `/`, `/api/health`, `/api/db/status`, `/api/audit-log`, `/api/system/disclaimer` | health + observability |
| `market.py` | `/api` | history, company info, search, news, heatmap, custom-indicator |
| `research.py` | `/api` | fundamentals, options-chain, patterns, levels, screener, macro, DCF, simulate |
| `portfolio.py` | `/api/portfolio` | holdings CRUD + live P&L |
| `paper.py` | `/api/paper` | ₹10L virtual trading (order/sell/close/history/analytics/reset) |
| `alerts.py` | `/api/smart-alerts` | price/RSI/volume alerts + evaluate |
| `ml.py` | `/api` | predict, explain, train, backtest, ai-consensus, benchmark, forecast-bands |
| `ai_chat.py` | `/api` | Gemini chat, news-summary, ai-trade-explain |
| `sentiment_ta.py` | `/api` | sentiment+TA hub, compare, market-overview |
| `broker.py` | `/api/broker` | 4 brokers save/test/connect/clear, .env persist |
| `ai_providers.py` | `/api/ai/providers` | 6 LLM keys manage/test/activate/delete/usage |

## Core vs Shared (confuse mat hona)
- `backend/core/` = app plumbing: `logging.py` (JSON/console logger), `middleware.py` (RequestId + access log), `config_loader.py` (sirf `shared.config` ko re-export karta hai — backward compat bridge).
- `backend/shared/` = asli single source: `config.py` (Pydantic Settings, .env), `database.py` (engine + session + init), `models.py` (saari tables), `security.py` (API key, user, Fernet vault).

## Layering rule
`routers → services/analysis/ml → data/fetcher → shared/database`
Router kabhi seedha SmartAPI/YFinance ko touch nahi karta — hamesha `fetcher.py` se.
ML/analytics kabhi synthetic data pe nahi chalega — pehle `require_real_data()`.

## Note: do model stores hain (confuse mat hona)
- `backend/models/<SYMBOL>.json` — XGBoost + ElasticNet bundle per symbol, `validation_mape` ke saath. `analysis/trainer.py`, `analysis/backtester.py`, `analysis/explainer.py` ise `MODEL_DIR` se padhte hain.
- `backend/ml/saved_models/<ticker>.pt` — PyTorch checkpoints jo `ml/predictor.py` (LSTM/Transformer ensemble) use karta hai.
Inme se koi bhi update ho to `12-research-screener.md` bhi dekhna.
