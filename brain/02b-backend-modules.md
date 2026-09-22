# 02b — Backend Modules (part 2: data, analysis, ml, ai, services)

## `backend/data/` — data layer
- `fetcher.py` (~1627 lines, project ka dil): memory cache → SQLite → Angel One → stale fallback. Synthetic path REMOVED.
- Intraday gap-fill: `FILLABLE = {1m,5m,15m,30m,1h}`, MAX 30 slots, flat carry-forward (vol 0). Equity sirf 09:15–15:30 weekdays; crypto 24/7.
- `get_combined_stock_data()`: live tick sirf weekday + >=9AM IST pe merge, weekend pe kabhi nahi.
- Intraday cache key `hist_{ticker}_{period}_{interval}` (memory only).
- Crypto/Gold: Binance live → historical close fallback. BTC/XAU pseudo-entries in search.
- SmartAPI: TOTP login + keepalive + reset/ensure_session.
- `database.py` (~2468 lines): history, intraday, ticks, universe, caches, portfolio, paper ledger, alerts, tasks, registry, broker, AI providers. Startup pe `purge_stale_partial_history(5)`.
- `market_calendar.py`: NSE holidays 2025–26, is_trading_day, is_market_open (09:15–15:30 IST), session phase, freshness.
- `options.py` (chain+Greeks+MaxPain+PCR), `fundamentals*.py` (Screener.in), `news_multi_source.py` (RSS+TTL), `streamer.py`, `redis_cache.py`, `index_constituents.py`, seed scripts.

## `backend/analysis/` — indicators + quant
- `indicators.py` (~1161 lines): SMA/EMA/RSI(neutral-50 fix)/MACD/BB/ATR/ADX/Stoch/CCI/Williams/ROC/MFI/Keltner/Donchian/Ichimoku/VWAP/OBV/Supertrend/PSAR/CMF/Elder/Fib/Divergence/Regime — sab `min_periods=1`, zero drop, LRU cache. `evaluate_custom_formula()` AST-safe hai.
- `backtester.py` v3: 6 strategies, causal features, 70/30 split, slippage+commission, Sharpe/Sortino/Calmar/Alpha/Beta/CAGR/DD/WinRate/ProfitFactor, monthly matrix, 500-perm Monte Carlo.
- Baaki: patterns, levels (S/R+Fib+pivot), quant_risk (VaR/CVaR), monte_carlo, volatility_forecast (GARCH), volume_profile (VPVR), market_heatmap, rrg_rotation, options_lab, sentiment, sentiment_market (Fear&Greed), macro + macro_terminal (ticker-tape), valuation (DCF+Graham), anomaly, explainer (SHAP), feature_engineer, trainer, tuning, supply_chain, constants.

## `backend/ml/` — forecasting
- `predictor.py` StockPredictor: BiLSTM+Attention + Transformer + GBDT ensemble → 7-day return + bounds + signal. Model na mile to heuristic fallback (label me "Uncalibrated", confidence None).
- `lstm_model.py`, `transformer_model.py`, `benchmarking.py` (5-fold vs Naive/SMA), `forecast_bands.py` (80/95% bands). Models `backend/ml/saved_models/` me bante hain **pehli training par** — abhi koi `.pt` trained nahi hai, isliye predictor heuristic fallback par hai.

## `backend/ai/` — LLM layer
- `provider.py`: 6 providers (gemini/openai/anthropic/mistral/cohere/groq), PROVIDERS registry, `ask_ai()` auto-fallback, test/mask/encrypt, `extract_json_from_ai_response()`.
- `chat.py` (grounded prompt), `news_summarizer.py` (sentiment/risks/impact).

## `backend/services/` + `tasks/` + `providers/`
- `market_data.py`: MarketDataService singleton — async, TTL (quote 15s, OHLCV 60s, funda 4h, options 2m), threadpool offload.
- `ai_consensus.py`: 3-engine consensus — Technical (RSI/EMA/MACD/ADX) + ML (XGBoost-bundle `predict_future`, confidence = validation MAPE se) + Fundamental (PE/ROE) → single score. ML me certified confidence na ho to engine UNAVAILABLE mark karke 2-engine reweight hota hai.
- `alert_scheduler.py`: loop + evaluate_all_alerts + status. `telegram_bot.py`: push + test.
- `tasks/`: celery_app + ml_tasks (train_stock_model_task).
- `providers/openbb/`: wrapper (dual-dispatch) + terminal_service (async quote+OHLCV).
- `scripts/`: backup_db, refresh_index, clear_price_data. `alembic/`: env + 0001_initial_schema.
