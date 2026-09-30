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
Backend `enrich_stock_dataframe()` ~45 columns deta hai, par `market.py` ka `_CHART_COLUMNS` sirf chart-waale columns bhejta hai (~8MB → ~2MB). `?full=true` se sab le sakte ho. `?slim=true` se enrich skip karke sirf OHLCV 6 cols aate hain (instant first paint; `loadHistory` phir full frame se replace karta hai). Price cols 2-decimal, indicator cols 4-decimal, NaN/Inf → null (JSON-safe).

## Folders (asli structure — `ls frontend/src` se verified)
- `src/components/` — root me ~40 files (`LiveChartView.jsx` sabse important) + 6 sub-folders:
  - `chart/` — chart engine layer: `ChartCanvas.jsx` (render hub), `OscillatorPane.jsx`, `VolumePane.jsx`, `VolumeProfileOverlay.jsx`, `IndicatorModal.jsx`, `IndicatorParamsModal.jsx`, `IndicatorLegend.jsx`, `ReplayBar.jsx`, `AIDashboard.jsx` + catalog `indicatorDefinitions.js` aur `indicatorSettingsSchema.js`.
  - `chart-tools/` — drawing toolbar/shape/renderers, `smcEngine.js`, `AIPatternRecognition.jsx`, `MultiTimeframeCorrelation.jsx`, `OrderFlow.jsx`.
  - `terminal/` — Bloomberg-style terminal views (Options Lab, Quant Risk Cockpit, RRG Rotation, Valuation, Macro, MultiTile, CommandPalette, ticker tape) + `terminal/mit/` = Market Intelligence tab (`useMitAi.js`, `useMitIntel.js`, `useMitData.js` + `MitAiHero`, `MitSignal`, `MitConsensus`, `MitDivergence`, `MitFearGreed`, `MitSummary`, ...).
  - `screener/`, `paper/`, `heatmap/`.
- `src/store/` — zustand (SINGULAR folder; `useStore.js` + persist) — ticker, timeframe, theme, WS state.
- `src/hooks/` — `useStock.js` (REST + history fetch) aur `useWebSocket.js`.
- `src/constants/` — `screenerConfig.js`.
- `src/utils/` — engines + helpers: `indicatorEngine.js`, `chartIndicators.js`, `aiIndicatorEngine.js`, `aiSignalEngine.js`, `volumeProfile.js`, `marketStructure.js`, `drawingGeometry.js`, `safeChart.js`, `chartHelpers.js`, `chartDataCache.js`, `api.js`, `formatters.js`, `theme.js`, `watchlist.js`, `soundChime.js` + 8 `*.test.js` files (commands `08-commands.md` me).
- `src/App.jsx` + `src/main.jsx` — routing + entry.

> Chart engine + AI indicator layer ka full map `11-chart-and-ai-engines.md` me hai (catalog → engine → render consumers). Kuch bhi add karne se pehle wo file padho.

## Live-chart theme (TradingView parity — Sep 2026)
`src/utils/theme.js` single source hai: dark `#131722` bg / `#1E222D` menu / `#2A2E39` border /
`#D1D4DC` text / `#787B86` muted / accent `#2962FF`, candles up `#26A69A` / down `#EF5350`.
Font Trebuchet/Roboto (JetBrains Mono nahi). `ChartToolbar.jsx` TV top-bar (40px, text timeframe
tabs me active = blue pill, live price + change% header me), `ChartCanvas.jsx` me TV OHLC legend
(symbol + O/H/L/C + chg + Vol, zero-latency DOM refs se), left drawing rail 40px TV blue-active,
sub-pane headers transparent TV legend. Data/tick logic untouched — sirf visuals.

## Timeframe dropdown + number-key switch (TradingView parity — Sep 2026)
`ChartToolbar.jsx`: single dropdown button (current interval + chevron) me pura timeframe —
Minutes/Hours/Daily groups, full names, tip footer. Number keys se direct switch:
`1→1m, 5→5m, 15→15m, 30→30m, 1H/4H/1D, 60→1H, 240→4H` — 800ms buffer, blue chip feedback, Enter =
apply now, Esc = cancel. Resolver `resolveTimeframeBuffer()` `chartHelpers.js` me hai (pure,
`timeframeQuickSwitch.test.js` me 5 tests). Inputs/modals focused ho ya Alt/Ctrl dabaa ho to keys
ignore hote hain taaki drawing shortcuts na tootein.

## Drawing tools UX (TradingView parity — Sep 2026)
Selection toolbar drawing ke first anchor ke paas float karti hai (pan/zoom pe saath chalti hai,
pane me clamped; anchor na mile to top-center fallback) — hide/lock/settings/colors/width/style/
duplicate/delete same functions. Naye drawings ka default color TV blue `#2962FF`, aur last-used
style (color/width/style) `so_active_draw_style` me persist hota hai. Context menu, object tree,
sticker picker, text popup, settings modal sab TV tokens/radius-4/TV font me.

## Dhyan rakhne wali baatein
- Date display hamesha IST me karo; backend daily `YYYY-MM-DD` bhejta hai.
- WS reconnect logic zaroori (EC2 + Amplify me drop hota hai).
- `lightweight-charts` me missing slot = whitespace gap (ye backend gap-fill ke baad bhi bade outage me dikhega — ye feature hai, bug nahi).
- JS unit tests CI me nahi chalte (CI sirf `npm run build` karta hai) — locally `cd frontend && npm test` chalao, warna red test chhup jayega.
