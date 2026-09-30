# 07 — Invariants (AGENTS.md ke 5 locks — TODNA MANA HAI)

## 1. Database (`backend/data/database.py`)
- `historical_prices.date` sirf `YYYY-MM-DD` (len==10), IST trading day. UTC yaha kabhi nahi.
- Intraday (1m/5m/15m/1h) kabhi SQLite me insert nahi.
- Price >0 + unit normalize (paise vs rupees).
- `low <= min(open,close)` aur `high >= max(open,close)` hamesha.
- `init_db()` me `DELETE WHERE length(date) > 10` hamesha chalega.
- **Screener upsert gap-fill hai, blind overwrite nahi.** `upsert_screener_daily_metric()`
  (`merge_screener_metric()`) me: payload me jo field nahi aaya wo stored value ko **mitata nahi**;
  placeholder sector label (`Diversified` etc.) asli classification ko overwrite nahi karta;
  `name == ticker` kisi asli naam ko nahi hatata. Value hatane ka ek hi tarika hai —
  `clear_fields=[...]` se naam lena ("absent" aur "galat tha" alag baatein hain).
  Pehle har base column hamesha payload me hota tha (None ke saath), isliye koi bhi partial write
  achha data NULL kar deti thi — 382 rows jinke paas asli technicals the unka sector refresh pe
  khali ho jaata tha.

## 2. Indicators (`backend/analysis/indicators.py`)
- `enrich_stock_dataframe()` kabhi row drop nahi karega (koi `dropna(subset=[sma...])` nahi).
- Har rolling me `min_periods=1` taaki 1D/5D/1M me bhi full candles dikhe.

## 3. Fetcher (`backend/data/fetcher.py`)
- Intraday sirf memory cache `hist_{ticker}_{period}_{interval}` me, direct return.
- `get_combined_stock_data()` live tick sirf weekday + >=9AM IST pe merge karega. Weekend pe fake candle nahi.

## 4. WebSocket (`backend/main.py`)
- Koi hardcoded rate nahi (jaise RELIANCE=1420). LTP na mile to historical/company_info close fallback.
- Sirf subscribed tickers ko broadcast, max 50/client.

## 5. Frontend (`LiveChartView.jsx`)
- `activeCandleRef` rakho — purani bars mutate mat karo.
- Daily: aaj ki candle IST date pe (`getIstDateString()` — crypto me bhi, UTC kabhi nahi).
- Intraday: bucket seconds se rollover.
- >20% spike ticks ignore karo.
- Default history bounded hai (`getBoundedTimeframe()` — kabhi `'ALL'` mat bhejo).
- Per-tick `useStore(livePrices)` subscription sirf `LivePriceBadge` me — poora tree re-render mat karao.
- `scrollToRealtime()` sirf jab viewport already right edge pe ho.

## 6. Deep Fundamentals (`backend/data/fundamentals_deep.py`)
- Missing statements ki jagah **khali list** — `annual_pl` / `quarterly_results` / `balance_sheet` /
  `cash_flow` / `shareholding` kabhi banaye hue numbers se mat bharo. `_fetch_universe_fallback()`
  sirf reference row ki asli identity/ratio/price deta hai (name, sector, cmp, pe, pb, mcap, eps, bvps).
  (Pehle wahan 5-saal ka P&L, 4 quarters, balance sheet, cash flow aur ek universal shareholding
  pattern hardcoded growth defaults se banta tha — aur `about` usse "prominent constituent" keh ke
  bech raha tha. Bana hua statement gayab statement se bura hai: UI khaali ko "gap" dikhata hai,
  par bana hua number sach lagta hai.)
- `data_freshness.status` **derive** hota hai `_finalize_freshness_status()` se — "Verified" tabhi
  jab `annual_pl` + `balance_sheet` sach me parse hue ho; warna "Partial" / "No verified statements".
  `empty_profile` ka floor neutral hai (`Unverified` + `Unavailable`), pehle se `Verified` claim nahi.
- CAGR/Piotroski/Altman/DCF sirf tab compute jo actual statements ho; khaali input pe `None` / `INSUFFICIENT DATA`.

## Master Order (phase sequence)
Phase1 (Data/Security/Core) → Phase2 (DB/Modular) → Phase3 (Reliability/DevOps) → Phase6 (Strategy/Paper 2.0) → Phase4 (Research) → Phase5 (AI/Quant) → Phase7 (Broker/Mobile).
