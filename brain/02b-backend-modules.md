# 02b — Backend Modules (part 2: data, analysis, ml, ai, services)

## `backend/data/` — data layer
- `fetcher.py` (~1266 lines — facade jo Angel One session/auth/scrip + orchestration rakhta hai; `broker.py` is module par credentials likhta hai aur tests yahin monkeypatch karte hain, isliye live-state wali functions yahin rehti hain) + `fetch_cache.py` (47), `fetch_connection.py` (46, `load_dotenv()` sabse pehle import — credential order lock), `fetch_slot_fill.py` (85), `fetch_symbols.py` (132), `fetch_crypto.py` (445), `xauusd.py` (explicit `XAUUSD=X` adapter; never PAXG proxy), `fetch_cursor_helpers.py` (157): memory cache → SQLite → Angel One → stale fallback. Synthetic crypto seed data is never served. Crypto klines paginated (endTime walk-back, max 12 pages) taaki `period` honor ho — BTC 5m ab poora 7D deta hai (~2018 bars, pehle single 1000-cap ~3.5d). Cursor windows (`fetch_history_window` + `CURSOR_CHUNK_LIMITS`): `?before=&limit=` pe strictly-older slice, live-edge merge nahi.
- Intraday gap-fill: `FILLABLE = {1m,5m,15m,30m,1h}`, MAX 30 slots, flat carry-forward (vol 0). Equity sirf 09:15–15:30 weekdays; crypto 24/7.
- `get_combined_stock_data()`: live tick sirf weekday + >=9AM IST pe merge, weekend pe kabhi nahi.
- Intraday cache key `hist_{ticker}_{period}_{interval}` (memory only).
- Crypto/Gold: Binance live → historical close fallback. BTC/XAU pseudo-entries in search.
- SmartAPI: TOTP login + keepalive + reset/ensure_session.
- `database.py` (~132 lines — facade + `init_db()` aur AGENTS.md §1 invariants yahin) + 12 sibling modules `db_connection.py` (51, connection core/`DB_PATH`), `db_history.py` (354), `db_intraday.py` (132), `db_ticks.py` (89), `db_universe.py` (201), `db_caches.py` (138), `db_alerts.py` (160), `db_portfolio.py` (461), `db_scans.py` (164), `db_registry.py` (355), `db_screener.py` (419), `db_screener_schema.py` (254): history, intraday, ticks, universe, caches, portfolio, paper ledger, alerts, tasks, registry, broker, AI providers. Sibling modules kabhi facade ko import nahi karte (cycle), sab `db_connection` se judte hain; facade `from .db_* import *` se public names re-export karta hai (import sites ~250, unchanged). Startup pe `purge_stale_partial_history(5)`.
- `market_calendar.py`: NSE holidays 2025–26, is_trading_day, is_market_open (09:15–15:30 IST), session phase, freshness.
- `options.py` (chain+Greeks+MaxPain+PCR), `fundamentals*.py` (Screener.in; `fundamentals_deep.py` ab 24-line facade hai — `funddeep_helpers.py` (125), `funddeep_scores.py` (348), `funddeep_fetch.py` (172), `funddeep_pipeline.py` (604) me asli logic, facade par `_fetch_universe_fallback`/`_finalize_freshness_status` jaise naam import karte rehna zaroori hai), `news_multi_source.py` (RSS+TTL), `streamer.py`, `redis_cache.py`, `index_constituents.py`, seed scripts.

## `backend/analysis/` — indicators + quant
- `indicators.py` (~75 lines facade) + `indicator_trend.py` (359), `indicator_volume.py` (125), `indicator_momentum.py` (171), `indicator_patterns.py` (245), `indicator_formula.py` (106), `indicator_enrich.py` (199, `enrich_stock_dataframe()`), `indicator_cache.py` (35): SMA/EMA/RSI(neutral-50 fix)/MACD/BB/ATR/ADX/Stoch/CCI/Williams/ROC/MFI/Keltner/Donchian/Ichimoku/VWAP/OBV/Supertrend/PSAR/CMF/Elder/Fib/Divergence/Regime — sab `min_periods=1`, zero drop, LRU cache. `evaluate_custom_formula()` AST-safe hai.
- `backtester.py` v3 (~66 lines facade) + `backtest_registry.py` (128), `backtest_features.py` (140), `backtest_engine.py` (527, `run_backtest`), `backtest_smc.py` (causal MTF SMC signals + structural long/short simulator), `backtest_execution.py` (76), `backtest_analytics.py` (122), `backtest_ai.py` (95): 7 builtin strategies + custom plugin registry (`custom_strategies.py` me `@register_strategy`/`@register_exit`, `GET /api/backtest/strategies`), causal features, 70/30 split, slippage+commission, Sharpe/Sortino/Calmar/Alpha/Beta/CAGR/DD/WinRate/ProfitFactor, monthly matrix, 500-perm Monte Carlo.
- Baaki: patterns, levels (S/R+Fib+pivot), quant_risk (VaR/CVaR), monte_carlo, volatility_forecast (GARCH), volume_profile (VPVR), market_heatmap, rrg_rotation, options_lab, sentiment, sentiment_market (Fear&Greed), macro + macro_terminal (ticker-tape), valuation (DCF+Graham), anomaly, explainer (SHAP), feature_engineer, trainer, tuning, supply_chain, constants.

## `backend/ml/` — forecasting
- `predictor.py` StockPredictor: BiLSTM+Attention + Transformer + GBDT ensemble → 7-day return + bounds + signal. Model na mile to heuristic fallback (label me "Uncalibrated", confidence None).
- `lstm_model.py`, `transformer_model.py`, `benchmarking.py` (5-fold vs Naive/SMA), `forecast_bands.py` (80/95% bands). Models `backend/ml/saved_models/` me bante hain **pehli training par** — abhi koi `.pt` trained nahi hai, isliye predictor heuristic fallback par hai.

## `backend/ai/` — LLM layer
- `provider.py`: 6 providers (gemini/openai/anthropic/mistral/cohere/groq), PROVIDERS registry, `ask_ai()` auto-fallback, test/mask/encrypt, `extract_json_from_ai_response()`.
- `chat.py` (grounded prompt), `news_summarizer.py` (sentiment/risks/impact).

## `backend/services/` + `tasks/` + `providers/`
- `market_data.py`: MarketDataService singleton — async, TTL (quote 15s, OHLCV 60s, funda 4h, options 2m), threadpool offload, bounded 256-entry LRU cache (expired reads are evicted; oldest unused entry drops on overflow).
- `ai_consensus.py`: 3-engine consensus — Technical (RSI/EMA/MACD/ADX) + ML (XGBoost-bundle `predict_future`, confidence = validation MAPE se) + Fundamental (PE/ROE) → single score. ML me certified confidence na ho to engine UNAVAILABLE mark karke 2-engine reweight hota hai.
- `alert_scheduler.py`: loop + evaluate_all_alerts + status. `telegram_bot.py`: push + test. `crypto_universe.py`: hourly cached Binance Top-20 USDT quote-volume ranking. `smc_agent.py`: optional 24/7 closed-candle SMC monitor, durable setup fingerprint and retried Telegram delivery; it is separate from the NSE-hours alert scheduler.
- `tasks/`: celery_app + ml_tasks (train_stock_model_task).
- `providers/openbb/`: wrapper (dual-dispatch) + terminal_service (async quote+OHLCV).
- `scripts/`: backup_db, refresh_index, clear_price_data. `alembic/`: env + 0001_initial_schema.
