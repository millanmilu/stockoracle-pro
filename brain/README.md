# 🧠 StockOracle Pro — Project Brain

> Ye folder pure project ka **brain / long-term memory** hai.
> Har naya agent / developer / AI session pehle ye files padhega taaki
> architecture, invariants, data-flow aur commands samajh aaye bina codebase
> me bhatke.
> Bhasha: Hinglish (Hindi + English) taaki sabko samajh aaye.

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

## 🚀 Quick Start (naye agent ke liye)

1. `00-project-overview.md` padho — 2 min me project samajh aayega.
2. `07-invariants.md` padho — ye rules TODNA MANA hai.
3. `08-commands.md` se project chalao.
4. Kaam shuru karne se pehle `06-data-flow.md` dekho.

## ⚠️ Golden Rules

- `historical_prices` me sirf `YYYY-MM-DD` daily candles. Intraday kabhi nahi.
- `enrich_stock_dataframe()` kabhi rows drop nahi karega, `min_periods=1` hamesha.
- Fake/hardcoded price kabhi nahi — sirf verified close fallback.
- Weekend pe fake candle nahi banegi.
- Har naya feature yahi brain update karega.
