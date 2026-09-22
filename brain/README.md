# 🧠 StockOracle Pro — Project Brain

> Ye folder pure project ka **brain / long-term memory** hai.
> Har naya agent / developer / AI session pehle ye files padhega taaki
> architecture, invariants, data-flow aur commands samajh aaye bina codebase
> me bhatke.
> Bhasha: Hinglish (Hindi + English) taaki sabko samajh aaye.

**Verified against:** commit `c0f5a5c` (22 Sep 2026) — facts is commit pe check kiye gaye the.
Har run pe `python3 scripts/check_brain.py` current tree ke against paths/counts verify karta hai
(CI ke invariants job me bhi chalta hai). Isliye agar tumne code move kiya aur brain update
nahi kiya, to checker FAIL karega — bas wahi is folder ka safety net hai.

## 📂 Is folder me kya hai?

| File | Kaam |
|------|------|
| `00-project-overview.md` | Project kya hai, tech stack, entry points, kaise chalaye |
| `01-architecture.md` | Backend / Frontend / DB / Terminal ka full map |
| `02-backend-modules.md` | Backend part 1: main, core, shared, guards |
| `02b-backend-modules.md` | Backend part 2: data, analysis, ml, ai, services |
| `03-frontend-map.md` | Frontend components, chart logic, state |
| `04-database-schema.md` | Saari tables + invariants |
| `05-api-endpoints.md` | Saare REST + WebSocket endpoints |
| `06-data-flow.md` | Tick → Candle → Indicator → ML → UI ka full flow |
| `07-invariants.md` | AGENTS.md ke 5 critical rules (copy + explanation) |
| `08-commands.md` | Run / test / deploy commands |
| `09-gotchas.md` | Common mistakes + debugging tips |
| `10-glossary.md` | Terms (OHLCV, LTP, PCR, VaR, DCF...) Hinglish me |
| `11-chart-and-ai-engines.md` | Client-side indicator + AI engine layer: catalog → engine → render consumers, aur traps |
| `12-research-screener.md` | Screener DSL/engines/pipeline + `backend/models/*.json` artifacts |

## 🚀 Quick Start (naye agent ke liye)

1. `00-project-overview.md` padho — 2 min me project samajh aayega.
2. `07-invariants.md` padho — ye rules TODNA MANA hai.
3. `08-commands.md` se project chalao.
4. Kaam shuru karne se pehle `06-data-flow.md` dekho.
5. Frontend chart/indicator/AI pe kaam? → `11-chart-and-ai-engines.md`. Screener/research? → `12-research-screener.md`.

## ✍️ Brain update kaise karein (naya feature = brain update)

1. Apne change se jo files/folders move ya rename hue, unhe relevant brain file me theek karo.
2. Naya module/folder bana? → us file me add karo, aur `01-architecture.md` ke tree me bhi.
3. Counts (routers, test files, line counts) badle? → text update karo; checker mismatch pakad lega.
4. `python3 scripts/check_brain.py` chalao — green hona chahiye.
5. Commit me brain ka diff saath rakho (code + docs ek hi commit me).

> Checker kaise kaam karta hai: `brain/*.md` ke saare backtick paths aur tree paths exist karte hain
> ya nahi, aur router/test/line counts match karte hain. Sirf runtime artifacts (`.log`, `.db`, `.pt`, `.pem`) skip hote hain.

## ⚠️ Golden Rules

- `historical_prices` me sirf `YYYY-MM-DD` daily candles. Intraday kabhi nahi.
- `enrich_stock_dataframe()` kabhi rows drop nahi karega, `min_periods=1` hamesha.
- Fake/hardcoded price kabhi nahi — sirf verified close fallback.
- Weekend pe fake candle nahi banegi.
- Har naya feature yahi brain update karega.
