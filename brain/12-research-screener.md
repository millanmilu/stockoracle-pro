# 12 — Research / Screener Layer + Model Artifacts

> Ye file do cheezein cover karti hai jo pehle brain me kahin nahi thi:
> (a) `backend/research/` ka screener DSL + engines + pipeline stack,
> (b) `backend/models/*.json` model bundles — aur `backend/ml/saved_models/` se unka farq.

## `backend/research/` — screener stack (dependency order)

| File | Kaam |
|------|------|
| `screener_dsl.py` (~321 lines) | Screener.in-style **formula DSL**: lexer → AST → parameterized SQL. `FIELD_MAP` whitelist + `parse_screener_query()`. **Zero `eval`/`exec`, zero string interpolation** — security isi file ki zimmedari hai. |
| `ai_screener.py` (~221 lines) | Natural-language trader query → DSL formula. `ask_ai()` + `extract_json_from_ai_response()` se JSON nikalta hai, phir `screener_dsl` se strictly validate karta hai. LLM ka output bina validate kiye DB tak nahi jaata. |
| `screener_engines.py` (~1205 lines) | Layered analytics engines: Market Data → Fundamental → Technical → Market Structure → Volume/Liquidity → News/Sentiment → AI/ML → Scoring → Screener → UI. Sab **deterministic**, sirf real calculated data pe. |
| `screener_pipeline.py` (~517 lines) | Daily metrics refresh pipeline: NSE universe ka fresh data → live indicators (RSI-14, Volume Ratio 20D, 52W high/low distance, SMA crossovers, returns 1D/1W/1M/1Y) + AI consensus → DB update. |
| `screener_backtest.py` (~181 lines) | Point-in-time screen-basket backtest: real closings, rebalance intervals, STT friction, NIFTY 50 benchmark. Zero random/synthetic returns. |

**Invariant:** jab koi input available na ho to engine `None` / `"N/A"` + `data_status` flag deta hai —
**kabhi fake value nahi**. UI isi flag pe "data nahi hai" dikhata hai. Isko todna = AGENTS.md ke
"no fake data" spirit ka violation.

### Supporting data files (screener ke around)
- `backend/data/index_constituents.py` — index membership (NIFTY 50 etc.).
- `backend/data/expand_screener_universe.py` — universe expand karne ka script.
- `backend/data/seed_screener_metrics.py` — `screener_daily_metrics` table seed.
- `backend/scripts/refresh_index_constituents.py` — constituents refresh.
- Table: `screener_daily_metrics` (ticker, date) — heatmap/screener ka data source (schema `04-database-schema.md`).
- Endpoints (scan/results/saved-scans) `05-api-endpoints.md` me hain — yahan duplicate nahi.

## Model artifacts — **do alag stores hain, mix mat karo**

| Store | Kya hai | Kaun padhta hai |
|-------|---------|------------------|
| `backend/models/<SYMBOL>.json` | Per-symbol bundle: `{trained_at, symbol, validation_mape, xgboost, elasticnet}` | `analysis/trainer.py`, `analysis/backtester.py`, `analysis/explainer.py` (`MODEL_DIR`) |
| `backend/ml/saved_models/<ticker>.pt` | PyTorch checkpoints (BiLSTM+Attention / Transformer ensemble) | `ml/predictor.py` |

- `backend/models/` me fila-hal **20 symbols** ke bundles hain (RELIANCE, TCS, INFY, HDFCBANK, ...).
- `validation_mape` hi **certified confidence** ka source hai: ye ho to hi model ki confidence
  report hoti hai, warna fallback heuristics "Uncalibrated" label + `confidence: None` deta hai.
  (`services/ai_consensus.py` bhi isi rule pe ML engine ko `UNAVAILABLE` mark karke 2-engine reweight karta hai.)
- Yaad rakho: JSON bundle = gradient-boosting/linear ensemble; `.pt` = neural ensemble. Ek jagah
  train karke doosri jagah load karne ki koshish mat karo.

## Traps

1. **DSL me bypass kabhi nahi.** Naya operator/metric add karna ho to usse `FIELD_MAP` whitelist +
   parameterized SQL se hi karo — f-string se query banana is layer ka P0 security bug hai.
2. **AI screener ka LLM output untrusted hai** — JSON parse + DSL validate ke baad hi use karo.
3. **Refresh pipeline ka order:** indicators → metrics → AI consensus → DB. Beech me skip karne se
   metrics partial update hote hain aur screener stale numbers dikhata hai.
4. **Backtest ka benchmark + friction hataana nahi** — NIFTY 50 aur STT ke bina returns jhoothe lagte hain.
5. **Naya screener metric** add karo to 4 jagah update: `FIELD_MAP` (DSL), engine layer
   (`screener_engines.py`), pipeline (`screener_pipeline.py`), aur UI (`src/constants/screenerConfig.js`).
