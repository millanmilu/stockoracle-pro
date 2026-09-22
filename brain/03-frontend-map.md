# 03 — Frontend Map

## Stack
React 18 + Vite + lightweight-charts v4 + Zustand + Axios + Recharts/Chart.js + lucide-react + react-hot-toast.

## Sabse important file: `src/components/LiveChartView.jsx`
Ye live candle chart ka dil hai. 3 invariants yahi lagu hote hain:
1. `activeCandleRef` — chalti session ki wick (open/high/low/close) track karta hai, purani finalized bars ko touch nahi karta.
2. Time bucketing:
   - Daily `1d`: aaj ki candle `YYYY-MM-DD` IST me create/update.
   - Intraday `1m/5m/15m/1h`: interval seconds se bucket nikal ke active candle update ya rollover pe nayi candle append.
3. Spike protection: verified reference se >20% door tick ignore.

## Data flow (frontend)
```
WS /ws/prices → subscribe tickers → tick aaya → spike check → activeCandle update → chart repaint
REST /api/stock/{t}/history?period=&interval= → purani candles + indicators → chart seed
```

## Chart payload trim
Backend `enrich_stock_dataframe()` ~45 columns deta hai, par `market.py` ka `_CHART_COLUMNS` sirf chart-waale columns bhejta hai (~8MB → ~2MB). `?full=true` se sab le sakte ho. Price cols 2-decimal, indicator cols 4-decimal, NaN/Inf → null (JSON-safe).

## Folders (typical)
- `src/components/` — LiveChartView, dashboards, panels (screener, backtest, paper, portfolio, alerts, options, sentiment).
- `src/stores/` — zustand stores (ticker, timeframe, theme, WS state).
- `src/utils/` — formatters (₹, %, date IST), API client, WS hook.
- `src/App.jsx` + `src/main.jsx` — routing + entry.

## Dhyan rakhne wali baatein
- Date display hamesha IST me karo; backend daily `YYYY-MM-DD` bhejta hai.
- WS reconnect logic zaroori (EC2 + Amplify me drop hota hai).
- `lightweight-charts` me missing slot = whitespace gap (ye backend gap-fill ke baad bhi bade outage me dikhega — ye feature hai, bug nahi).
