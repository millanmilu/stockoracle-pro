# 06 — Data Flow (tick se UI tak)

## 1. Live tick ka safar
```
Angel SmartAPI WS / Binance (BTC/XAU)
  → fetcher session keepalive
  → backend/main.py broadcaster (15s loop)
  → ConnectionManager.broadcast (sirf subscribed clients)
  → WS /ws/prices → frontend LiveChartView
  → spike check (>20% ignore) → activeCandleRef update → repaint
  → buffered writer → live_ticks table (UTC ts)
```

## 2. History (daily) ka safar
```
fetch_stock_data(ticker, period)
  1. memory cache hit? → return
  2. SQLite historical_prices (YYYY-MM-DD) → return
  3. Angel One API → save_historical_prices (validate: >0, OHLC, date len 10) → return
  4. stale SQLite fallback → return
  (synthetic path HATA DIYA — ab 404/503 aayega, fake candle kabhi nahi)
  → get_combined_stock_data(): aaj ka live tick merge (sirf weekday + >=9AM IST)
  → enrich_stock_dataframe() → 45 indicators
  → market.py trim → JSON → chart seed
```

## 3. Intraday ka safar
```
fetch_stock_data(ticker, period, interval=1m/5m/15m/1h)
  → memory cache `hist_{t}_{p}_{i}` → direct return (SQLite me SAVE NAHI)
  → fill_intraday_time_gaps(): chhote gap flat-fill (prev close, vol 0), bada gap khaali
  → frontend bucketing: activeCandle ya rollover pe nayi candle
```

## 4. ML predict ka safar
```
GET /api/stock/{s}/predict
  → prediction cache (10m)? → return
  → fetch 2Y → require_real_data → StockPredictor.predict
  → trained ensemble? → 7-day return + bounds + confidence + signal
  → nahi mila? → heuristic fallback ("Uncalibrated", confidence None)
  → save_prediction → JSON
```

## 5. Backtest ka safar
```
GET /api/stock/{t}/backtest
  → fetch ALL (min 60 rows) → require_real_data
  → causal features (row-by-row, no look-ahead) → 70/30 split
  → strategy signals → slippage+commission ke saath equity curve
  → Sharpe/Sortino/Calmar/DD/trades/monthly/MC-500 → JSON
```

## 6. Alert ka safar
```
POST /api/smart-alerts (ticker, type, params)
  → smart_alerts table
  → scheduler loop evaluate_all_alerts → live LTP se check
  → trigger → Telegram push
```

## Timezone rule (yaad rakho)
- Daily candle date = IST trading day `YYYY-MM-DD`.
- Intraday labels = IST wall-clock `YYYY-MM-DD HH:MM:SS`.
- Ticks/logs/audit = UTC ISO.
