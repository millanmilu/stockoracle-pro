# StockOracle Pro — Architecture & Code Invariants

## CRITICAL RULES & INVARIANTS (DO NOT MODIFY WITHOUT EXPLICIT PERMISSION)

These rules are permanent architectural locks designed to ensure data consistency, clean charts, and prevent corrupt candles.

---

### 1. Database & Historical Storage Invariants (`backend/data/database.py`)
- **Strict Daily Date Format**: The `historical_prices` table MUST only store daily records where `date` is formatted strictly as `YYYY-MM-DD` (exactly 10 characters).
- **No Intraday in SQLite**: Intraday candles (`1m`, `5m`, `15m`, `1h`) must NEVER be inserted into the `historical_prices` table.
- **Unit & Positive Price Normalization**: All prices in database inserts must be verified positive (> 0) and normalized (rupees vs paise).
- **Auto-Cleansing on Init**: `init_db()` must always execute `DELETE FROM historical_prices WHERE length(date) > 10` to keep legacy tables clean.

---

### 2. Technical Indicators & Candle Preservation (`backend/analysis/indicators.py`)
- **Zero Candle Dropping**: `enrich_stock_dataframe()` must NEVER drop raw price rows (e.g. via `df.dropna(subset=["sma_50", ...])`). Every OHLCV candle (open, high, low, close, volume) from data fetcher must be preserved in the output.
- **`min_periods=1` Standard**: All rolling calculations (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, ADX, Fibonacci) must specify `min_periods=1` so short timeframes (1D, 5D, 1M, 3M) always render full unbroken candles.

---

### 3. Data Fetching & Caching Invariants (`backend/data/fetcher.py`)
- **Isolated Intraday Cache**: Intraday data must only be cached in-memory with key `hist_{ticker}_{period}_{interval}` and returned directly to callers.
- **Combined Live Ticks Safeguard**: `get_combined_stock_data()` must only merge live ticks on active trading days (weekdays) during/after market hours (>= 9 AM). Weekend ticks must never generate artificial weekend candles.

---

### 4. WebSocket & Real-time Broadcasting Invariants (`backend/main.py`)
- **No Fake Hardcoded Rates**: The WebSocket broadcaster loop must never use static hardcoded fallback rates (e.g., RELIANCE = 1420). If live LTP is unavailable, it must fall back strictly to verified historical/company_info close prices.
- **Subscription-Aware Feed**: Broadcast loop must target all active client-subscribed tickers.

---

### 5. Frontend Live Chart View Invariants (`frontend/src/components/LiveChartView.jsx`)
- **Active Candle State**: Must maintain `activeCandleRef` to smoothly track ongoing session wicks (`open`, `high`, `low`, `close`) without resetting or mutating historical finalized bars.
- **Time Bucketing**:
  - Daily (`1d`): Creates/updates today's candle (`YYYY-MM-DD`).
  - Intraday (`1m`, `5m`, `15m`, `1h`): Calculates current interval bucket in seconds and updates active candle or appends a new one when the bucket rolls over.
- **Spike Protection**: Live ticks deviating > 20% from recent verified reference prices must be ignored.
