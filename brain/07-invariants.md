# 07 — Invariants (AGENTS.md ke 5 locks — TODNA MANA HAI)

## 1. Database (`backend/data/database.py`)
- `historical_prices.date` sirf `YYYY-MM-DD` (len==10), IST trading day. UTC yaha kabhi nahi.
- Intraday (1m/5m/15m/1h) kabhi SQLite me insert nahi.
- Price >0 + unit normalize (paise vs rupees).
- `low <= min(open,close)` aur `high >= max(open,close)` hamesha.
- `init_db()` me `DELETE WHERE length(date) > 10` hamesha chalega.

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
- Daily: aaj ki candle IST date pe. Intraday: bucket seconds se rollover.
- >20% spike ticks ignore karo.

## Master Order (phase sequence)
Phase1 (Data/Security/Core) → Phase2 (DB/Modular) → Phase3 (Reliability/DevOps) → Phase6 (Strategy/Paper 2.0) → Phase4 (Research) → Phase5 (AI/Quant) → Phase7 (Broker/Mobile).
