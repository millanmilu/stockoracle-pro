# 12 — Research / Screener Layer + Model Artifacts

> Ye file do cheezein cover karti hai jo pehle brain me kahin nahi thi:
> (a) `backend/research/` ka screener DSL + engines + pipeline stack,
> (b) `backend/models/*.json` model bundles — aur `backend/ml/saved_models/` se unka farq.

## `backend/research/` — screener stack (dependency order)

| File | Kaam |
|------|------|
| `screener_dsl.py` (~321 lines) | Screener.in-style **formula DSL**: lexer → AST → parameterized SQL. `FIELD_MAP` whitelist + `parse_screener_query()`. **Zero `eval`/`exec`, zero string interpolation** — security isi file ki zimmedari hai. |
| `ai_screener.py` (~221 lines) | Natural-language trader query → DSL formula. `ask_ai()` + `extract_json_from_ai_response()` se JSON nikalta hai, phir `screener_dsl` se strictly validate karta hai. LLM ka output bina validate kiye DB tak nahi jaata. |
| `screener_engines.py` (~66 lines facade) + `screener_shared.py` (73), `screener_ta_engines.py` (325), `screener_flow_engines.py` (279), `screener_scoring.py` (408), `screener_aggregates.py` (304), `screener_status.py` (98) | Layered analytics engines: Market Data → Fundamental → Technical → Market Structure → Volume/Liquidity → News/Sentiment → AI/ML → Scoring → Screener → UI. Sab **deterministic**, sirf real calculated data pe. |
| `screener_pipeline.py` (~517 lines) | Daily metrics refresh pipeline: NSE universe ka fresh data → live indicators (RSI-14, Volume Ratio 20D, 52W high/low distance, SMA crossovers, returns 1D/1W/1M/1Y) + AI consensus → DB update. |
| `screener_backtest.py` (~181 lines) | Point-in-time screen-basket backtest: real closings, rebalance intervals, STT friction, NIFTY 50 benchmark. Zero random/synthetic returns. |

**Invariant:** jab koi input available na ho to engine `None` / `"N/A"` + `data_status` flag deta hai —
**kabhi fake value nahi**. UI isi flag pe "data nahi hai" dikhata hai. Isko todna = AGENTS.md ke
"no fake data" spirit ka violation.

### No-op sentinel — "sab dikhao" ka matlab sach me sab

`ALL` (ya `ANY` / `*` / `1=1` / empty) **`1=1`** pe compile hota hai
(`screener_dsl.is_no_op_query()`). Pehle "All NSE Equities" ka fake no-op `MarketCap > 0` tha —
jo no-op nahi hai: jinka market cap unknown ho wo rows chup-chaap drop ho jaati thi
(633 me se 382, yaani 60%), aur TOTAL card 633 dikha kar click pe 251 de raha tha.
**Naya "no filter" likhna ho to sentinel use karo, `MarketCap > 0` jaisa proxy nahi.**
Frontend me `NO_OP_QUERY` / `isNoOpQuery()` (`screenerColumns.js`) yahi literal share karte hain.

### Coverage contract — `data_status`

Ek hi source of truth: **`screener_engines.derive_screener_data_status()`**. Har writer (seed,
backfill, daily refresh) `upsert_screener_daily_metric()` se guzarta hai, jo flag khud derive karta
hai — caller ki value copy nahi karta. Teen states:

| Status | Matlab |
|--------|--------|
| `OK` | price + core technicals + core fundamentals — sab present |
| `PARTIAL` | price + technicals, fundamentals missing |
| `NO_DATA` | price hi nahi, ya core technicals missing (tracked naamo ki placeholder row) |

`/screener/overview` isi se `coverage` (`total/ok/partial/no_data/priced/with_fundamentals`) deta
hai, taaki UI "filter ne kuch nahi diya" aur "iske paas data hi nahi" me farq bata sake.

### Aggregators NULL ko neutral kabhi na maane

`compute_overview_cards` ka documented rule: NULL ko neutral default dena count ko badha deta hai.
Wahi rule **sab** aggregators pe lagta hai (`compute_sector_rotation`, `compute_market_breadth`):

- averages sirf un rows pe jinme field present hai — `or 0.0` / `or 50.0` / `or 1.0` **nahi**.
  (Pehle 40 me se 24 sectors ka composite bilkul identical `-11.8` aa raha tha.);
- sector chhota (`< MIN_SECTOR_STOCKS = 3`) ya bina data ho to chart me plot hi nahi hota —
  `compute_sector_exclusions()` me count hota hai, aur JSON me `sectors_excluded` ke roop me
  UI tak jaata hai;
- **`min_stocks` measured rows ginta hai, sirf rows nahi.** `"Finance"` ke paas 15 tracked rows the
  par sirf 2 me data — aur wahi 2 poore sector ko rank kar dete the, yaani "15 stocks" wala bar
  jiska composite 2 se bana. `measured_sector_stocks()` ek hi predicate hai jo rotation aur
  exclusions dono use karte hain, isliye chart se gira koi sector `below_measured_*` me hisaab me
  aata hai — chup-chaap gayab nahi hota. Har bar `stocks` (tracked) + `stocks_measured` dono deta hai.
- `"Diversified"` / `"General"` jaise placeholder labels **sector nahi** hain
  (`UNCLASSIFIED_SECTOR_LABELS`) — wo rows unclassified me jaate hain;
- breadth me missing change `no_data` bucket me jaata hai, `unchanged` me **nahi**; percentages
  ka denominator = measured rows, tracked universe nahi.

### Freshness — `stale`

Data 5 din purana ho sakta hai kyunki refresh daemon sirf 16:15 IST (weekday) pe chalta hai jab
server chal raha ho, aur bootstrap branch tabhi trigger hota hai jab `n_rows < 50`.
`get_screener_overview_stats().metrics_as_of` = **median** covered row ka date (naya row nahi —
single freshly-rewritten row poori table ko "current" nahi bana sakti), aur `/screener/overview`
`stale: true/false` deta hai. Rows with `NO_DATA` is ginti me nahi aate: unme recompute karne layak
values hi nahi hain, par seeder unhe har run pe re-stamp kar deta hai.

## Coverage backfill — `backend/scripts/backfill_screener_coverage.py`

Table me do **alag** populations hain, do alag holes ke saath — isiliye ek naive "refresh" kabhi
kisi ko theek nahi karta tha:

| Population | Kya asli hai | Kya missing hai | Stage |
|-----------|--------------|-----------------|-------|
| **PARTIAL** (382) | asli OHLCV + asli technicals | identity + fundamentals (`name == ticker`, sector unclassified, mcap/pe/roe/roce NULL) | `--fundamentals`, `--names`, `--sectors` |
| **NO_DATA** (200) | curated naam/sector/mcap | OHLCV hi nahi — na price, na koi technical | `--technicals` |

```
python backend/scripts/backfill_screener_coverage.py --all --limit 50
python backend/scripts/backfill_screener_coverage.py --fundamentals --limit 200
python backend/scripts/backfill_screener_coverage.py --technicals --tickers TCS,INFY
python backend/scripts/backfill_screener_coverage.py --sectors --dry-run
```

Stages:

- **`--fundamentals`** — Screener.in se `market_cap_cr`/`pe`/`pb`/`roe`/`roce`/`debt_to_equity`
  (`data/fundamentals.get_fundamentals()`, jo tiered Screener.in → yfinance → DB hai).
- **`--names`** — `name == ticker` un rows ke liye jo abhi apna symbol hi naam dikha rahe hain;
  naam Screener.in ke `<h1>` se aata hai (`company_name`).
- **`--technicals`** — 1Y daily OHLCV → wahi indicator engine jo daily refresh use karta hai
  (`compute_metrics_from_ohlcv(..., use_live_price=False)`); synthesized frames reject hote hain.
- **`--sectors`** — sirf **asli index membership** se classify (`NIFTY IT/AUTO/PHARMA/FMCG/METAL/
  REALTY/INFRA/ENERGY/BANK/PSU BANK`), aur labels curated vocabulary me hi likhe jaate hain, warna
  ek hi sector do rotation bars me bat jaata hai (`"Energy"` vs `"Energy / Oil & Gas"`).

Rules jo ise honest rakhte hain:

- **Ek >1 sector index me ho to woh unclassified rehta hai** (index providers primary business se
  rank karte hain — woh judgement ye script reconstruct nahi kar sakti). Ambiguous aur no-index
  counts report hote hain, guess nahi.
- **Purana apna likha galat label clear hota hai** (`clear_fields=["sector"]`) — warna chart ek stale
  guess se bana bar dikhata rehta. Curated-meta sector (jaise `"Capital Goods / Defence"`) kabhi
  relabel nahi hota.
- Script **kuch invent nahi karta**: jo ticker resolve na ho, wo "still missing" me report hota hai.
- `--dry-run` **sach me network fetch karta hai**, sirf write skip karta hai — `--limit` saath do.

Abhi bhi jo genuinely baaki hai: `rs_vs_nifty_pct`, `rs_vs_sector_pct`, `sentiment_score`
**100% NULL** hain (ya populate karo ya UI se column hatao — dono aaj ad me hain), aur poore 633-row
backfill ke liye ek long network run chahiye (Angel One rate-limit ke saath).

### Supporting data files (screener ke around)
- `backend/data/index_constituents.py` — index membership (NIFTY 50 etc.).
- `backend/data/expand_screener_universe.py` — universe expand karne ka script.
- `backend/data/seed_screener_metrics.py` — `screener_daily_metrics` table seed.
- `backend/scripts/refresh_index_constituents.py` — constituents refresh.
- `backend/scripts/backfill_screener_coverage.py` — coverage backfill (upar dekho).
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
6. **`close_price` pe placeholder kabhi mat likho.** Wo column nullable hai jaan-boojh kar. Purana
   upsert `close_price or 100.0` karta tha (NOT NULL column pe), jisse 200 seeded rows screener ke
   Price column me nakli **₹100.00** dikha rahi thi. Migration `init_db()` me hai:
   `_ensure_screener_close_price_nullable()` (SQLite me table rebuild, indexes replay ke saath) +
   `repair_screener_placeholder_rows()` + `reconcile_screener_data_status()`.
7. **`MarketCap > 0` ko "sab dikhao" mat samjho** (upar sentinel section).
8. **`compute_sector_rotation` / `compute_market_breadth` me `or <neutral>` mat likho** — wahi bug
   hai jisse khali sector measured dikhte the.
9. **Seeder existing rows ko re-stamp kar sakta hai.** `seed_screener_metrics_table()` sirf wahi rows
   chhodta hai jinke paas `ema_50` **ya** `close_price` hai; isliye freshness sirf covered rows pe
   compute hoti hai. Guard hataana = `updated_at` jhootha "fresh" ban jaayega.
