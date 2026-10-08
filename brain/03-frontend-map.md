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
- `src/components/` — root me ~40 files (`LiveChartView.jsx` sabse important — Oct 2026 se bade panels **thin entry + chhote modules** hain: entry path wahi purana hai, asli code sibling folder me) + sub-folders:
  - `live-chart/` (16 files, `LiveChartView.jsx` ka split: controller + `useHistoryData`/`useLiveTicks`/`useBarReplay` hooks + `ChartShell`/`ChartOverlays`/panes)
  - `fundamentals/` (17 files, `FundamentalsPanel.jsx` ka split: sections + `useDerivedMetrics`)
  - `backtest/` (9 files, `BacktestPanel.jsx`), `broker-settings/` (7 files, `BrokerSettingsView.jsx`), `screener/` (13 files, `AdvancedScreener.jsx` + existing filters/modals)
  - `chart/` — chart engine layer: `ChartCanvas.jsx` (render hub, split → `chart/canvas/` 13 files), `OscillatorPane.jsx`, `VolumePane.jsx`, `VolumeProfileOverlay.jsx`, `IndicatorModal.jsx` (split → `chart/indicatorModal/` 7 files), `CustomIndicatorEditor.jsx` (safe Pine-inspired script editor), `IndicatorParamsModal.jsx`, `IndicatorLegend.jsx`, `ReplayBar.jsx`, `AIDashboard.jsx` + catalog `indicatorDefinitions.js` aur `indicatorSettingsSchema.js`.
  - `chart-tools/` — drawing toolbar/shape/renderers, `smcEngine.js`; `DrawingTools.jsx` ab 1-line entry hai (asli code `DrawingToolsComponent.jsx` + `useDrawing*` hooks + mouse down/move/up modules + JSX subcomponents), renderers `shapeRendererRegistry.jsx` + `*Renderers.jsx` me hain.
  - `terminal/` — Bloomberg-style terminal views (Options Lab, Quant Risk Cockpit, RRG Rotation, Valuation, Macro, MultiTile, CommandPalette, ticker tape) + `terminal/mit/` = Market Intelligence tab (`useMitAi.js`, `useMitIntel.js`, `useMitData.js` + `MitAiHero`, `MitSignal`, `MitConsensus`, `MitDivergence`, `MitFearGreed`, `MitSummary`, ...).
  - `screener/`, `paper/`, `heatmap/`.
  - `broker-settings/` handles masked broker credentials, encrypted AI provider settings and live
    connection status. Broker/provider selectors and credential fields are keyboard-accessible;
    backend HTTP error details are surfaced, form edits survive background refreshes, and `.env`
    persistence is opt-in.
- `src/store/` — zustand (SINGULAR folder; `useStore.js` + persist) — ticker, timeframe, theme, WS state.
- `src/hooks/` — `useStock.js` (REST + history fetch) aur `useWebSocket.js`.
- `src/constants/` — `screenerConfig.js`.
- `src/utils/` — engines + helpers: `indicatorEngine.js`, `chartIndicators.js`, `aiIndicatorEngine.js`, `aiSignalEngine.js`, `volumeProfile.js`, `marketStructure.js`, `drawingGeometry.js`, `safeChart.js`, `chartHelpers.js`, `chartDataCache.js`, `api.js`, `formatters.js`, `theme.js`, `watchlist.js`, `soundChime.js`, `chartSettings.js` + 13 `*.test.js` files (commands `08-commands.md` me).
- `src/experiments/` — `pro-terminal-v2/` (mock-data design experiment; sidebar `EXPERIMENTAL` tab se `ProTerminalV2.jsx` khulta hai; production logic yahan nahi jodna). Oct 2026 upgrade: working SVG drawing engine (drag/click-click, fib/rect/ellipse/text/measure, undo-redo + localStorage save, magnet/lock/hide/clear actions), pane-sync (`utils/paneSync.js` — main chart → sub-panes one-way range sync), keyboard shortcuts hook me single-source (capture-phase Ctrl+K search, Ctrl+S/Z, Alt+I/A, Esc), paper order ticket (`V2OrderModal`), live screener filters+Scan (`applyScreenerFilters`), working bottom tabs (historical/technicals/peers/options/shareholding/corporate/market-overview), object tree synced to real indicator/AI/drawing state, AI overlays (S/R, BOS, target/SL price lines + legend chips), responsive CSS (panels hide <1360/1120px). Sab mock/replay data — koi API call nahi.
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

## Chart Settings dialog (TradingView parity — Oct 2026)
`ChartSettingsModal.jsx` ke 5 tabs — Symbol / Candles, Appearance & Grid,
Scales & Precision, Status Line, Trading — me TradingView ke saare knobs (6 chart
styles, body/border/wick + line colors, grid, crosshair mode/style/labels,
axis text color + size, watermark, scale side, log/percentage, invert,
precision, timezone, status-line toggles, paper trade bar/panel/position lines).
Trade bar + docket LiveChartView me settings se derive hote hain (toolbar ke
toggle bhi store me likhte hain — last writer wins). Dialog sirf
`src/utils/chartSettings.js` ke store me likhta hai; ChartCanvas + panes
subscribe karte hain, isliye settings chart rebuild/theme flip pe survive
karten hain. Persist key `stockoracle_chart_settings_tv_v1` (localStorage).
Toolbar chart-style aur price-scale changes bhi isi store me likhte hain.
Chart style series rebuild ke baad overlays ko re-sync karta hai, aur
`useDrawingRefSync.js` active chart type ke primary series ref ko refresh karta
hai—warna indicator time-index mismatch chart paint crash aur drawings ke
coordinate conversion ko null kar sakta hai.
Contract + traps `11-chart-and-ai-engines.md` me, tests `chartSettings.test.js`.

## Drawing tools UX (TradingView parity — Sep 2026, settings upgrade Oct 2026)
Two-anchor tools support both click-click placement and click-drag; longer multi-anchor tools stay click-to-place.
Selection toolbar single-row compact panel hai (~40px: drag grip, name, eye, lock, color dot,
width, style, ⚙, ⋮, × — text tools ko size, shapes ko fill quick-toggle milta hai;
width/style/size/mini-panels anchor pe khulte hain, ek waqt pe ek hi; ⋮ me fill,
extend, font, duplicate, layer, delete). ⚙ detailed settings popover ko drawing
anchor se independent chart ke fixed corner me portal karta hai, taaki selected
object ke upar chipak/overlap na ho; viewport/chart bounds ke andar scroll hota hai.
Toolbar by default chart pane ke upper-right corner me rehta hai. Grip se panel
ko pane ke andar move kar sakte hain; moved position selection badalne tak stable
rehti hai, phir toolbar upper-right corner me reset hota hai.
Popover (`DrawingSettingsPopover.jsx`) Appearance (line/border color + width,
line-style previews via shared `StyleButtons`, opacity, fill + fill color/opacity,
border color; fib tools ko per-level ON/OFF + editable value inputs —
`fibLevelValues` override map, default par wapas likhne se override delete;
`savedLineDrawings.jsx` fib renderer custom values par label/position update
karta hai)/Coordinates/Visibility/
Interaction/Text sections, Reset/Save-default/Apply-to-all/Apply; live preview,
Cancel = snapshot restore). Context menu / object tree se wahi content
(`DrawingSettingsModal.jsx` + Host) usi stable chart corner me khulta hai —
single implementation.
Fixed Range Volume Profile renderer selected candle slice ka volume/POC/VAH/VAL
calculate karta hai; settings me rows, value area, histogram width/colors, level
visibility/prices aur summary metrics independently configurable hain.
SMC Pro (`SmcProLayer.jsx` + `utils/smc/` engine: swings/BOS-CHoCH, liquidity,
OB, FVG, premium-discount, sessions, MTF, scoring): Killzones session strip
viewport-clamped hai — session ka ek bhi edge loaded window me ho to block
paint hota hai (null edge 0/`w` par clamp; dono null = fully outside → skip),
taaki fresh intraday chart par bhi live session strip dikhe; summary card ka
session label capitalized hai (`Overnight`).
Shared triggers/panels (`drawingStyleControls.jsx` — ToolButton, MiniPanel,
WidthSegmented, StyleRow, ToggleSwitch) toolbar aur popover dono use karte hain.
Color hamesha single dot (`DrawingColorPicker` dot mode: Recent/Preset/HEX-RGB-HSL/
alpha/custom on demand).
bar (`SelectedDrawingsToolbar.jsx`) bulk color/width/style/eye/lock/delete + Group/Ungroup
(`groupId`) deta hai. Naye drawings ka default color TV blue `#2962FF`, aur last-used
style (color/width/style) `so_active_draw_style` me persist hota hai. Settings edits
live preview karte hain (har change turant drawing pe, chart reload nahi); modal
Cancel snapshot restore karta hai (no history), Apply single history entry commit
karta hai (`DrawingSettingsHost.jsx`). Shared controls
(`drawingStyleControls.jsx` — Width/Style-with-SVG-preview/Opacity/Fill/Extend) toolbar aur
popover dono use karte hain, isliye style kahin diverge nahi hota. Per-tool factory templates +
saved-default manager `drawingToolDefaults.js` me hai (tests `drawingToolDefaults.test.js`);
`frontend/src/components/chart-tools/drawingSettingsSchema.js`
caps/theme/tokens + recent/saved colors ko `stockoracle_drawing_settings_tv_v1` me rakhta hai.
Chart Settings → Appearance & Grid → Drawings me global appearance
defaults; SVG drawings/toolbar theme tokens dark/light app theme ke saath follow karte hain.
Visibility list supported chart intervals ke saath weekly/monthly options bhi expose karti hai.
Object tree (📁 Drawings header, group chips) se drawings rename, lock, hide aur reorder kar sakte hain. Context menu, object tree,
sticker picker, text popup, settings modal sab TV tokens/radius-4/TV font me. Shift/Ctrl/Cmd-click
aur Shift+drag marquee (`useDrawingMarquee.js` — capture-phase, chart-lock, pan untouched) chart
drawings multi-select karte hain; Ctrl+A saare drawings select karta hai; Esc deselect, Del delete,
Ctrl+Z / Ctrl+Shift+Z undo/redo.
Drawing hotkeys me Alt+R sirf Bar Replay ke liye hai; Remove All drawings
Alt+Shift+R par hai. Cross cursor Alt+Shift+F use karta hai (Alt+V VPVR ke liye),
aur Rotated Rectangle Alt+Shift+W use karta hai taaki chords clash na hon.

## SMC Pro layer (screenshot-parity overlays — Oct 2026)
`src/components/live-chart/SmcProLayer.jsx` price pane ke upar click-through SVG layer hai
(`zIndex 30`, drawings ke neeche): translucent OB/FVG rectangles, BSL/SSL + EQH/EQL dashed
levels, BOS/CHoCH/MSS + HH/HL tags, calculated Entry/TP1-3/SL rails with right-side chips,
aur same levels ka compact score card, Asia/London/NewYork killzone strip. Detection ZERO naya — `analyzeSMC()` (`src/utils/smc/`) +
`detectSwingPoints`/`detectBosChoch` (`src/utils/marketStructure.js`) ka output sirf paint hota hai;
setup levels pure `deriveSetupLevels()` (`src/utils/smc/engine/setupLevels.js`, test
`src/utils/smcSetupLevels.test.js`) se. `SmcProLayer.jsx` active candle ka immutable OHLCV snapshot
once per second leta hai (`src/utils/smc/engine/smcSnapshot.js`) aur overlay + summary card ko
ek analysis deta hai; unchanged snapshot pe recompute nahi. Replay live ref ignore karta hai,
aur symbol/interval switch fresh instance banata hai. Display toggles `src/utils/smcDisplayPrefs.js` store me
(`so_smc_display_v1`) — top-bar SMC Pro switch + menu + score card sab wahi padhte hain, prop drilling nahi.
Layer + score card sirf `smc_pro` indicator active aur visible hone par render hote hain. Bottom range bar jaan-bujhkar nahi banaya.

## SMC Pro Backtest Studio
`BacktestPanel.jsx` me SMC Pro strategy select karne par interval (`1m`–`4h`) aur lookback controls
dikhenge. Backend `backtest_smc.py` causal 4×/16× bias, confirmed swings/breaks, sweeps,
untouched OB/FVG, premium/discount aur timezone-aware sessions se out-of-sample signals banata hai;
trades next candle open par long/short fill hote hain, structural stop/target levels par wick hit
resolve hote hain (same-candle ambiguity me stop pehle). SMC holding cap candles me hai aur
generic percent stop/target controls apply nahi hote. Chart detail panel ka baseline backtest alag
hai; usse Studio ke SMC Pro strategy result na samjhein.

## SMC visibility architecture (declutter rework — Oct 2026)
Detection ≠ visualization: engine hazaaron objects detect kar sakta hai, chart par sirf
`src/utils/smc/selection/` se release hue dikhte hain —
`smcObjects.js` (reload-stable uids: symbol|interval|kind|direction|time|price — purane index-ids
hataye), `smcLifecycle.js` (FVG fill%/OB mitigation/sweep/invalidation states, pure replay),
`smcRelevance.js` (0-100 score: state/distance/freshness/displacement/HTF/retests; overlap ≥60%
merge, stronger survives), `smcSelect.js` (mode caps + confluence-gated setup + PDH/PDL/PWH/PWL +
MSS-aware breaks + EQ clusters), `smcLabels.js` (pixel collision: priority wins, shift-then-drop,
edge chips 17px rhythm). Display modes: smart (default: 1 break, 1 OB/FVG per side, nearest
BSL/SSL + sweep, setup sirf 6-point confluence par) / minimal / full / debug (purana clutter
sirf yahan). BOS short segments (break+14 bars), rails anchor→live edge (kabhi bar-zero se nahi).
Prefs `src/utils/smcDisplayPrefs.js` me mode + maxOb/maxFvg/maxLiquidity/maxStructure + minScore;
top-bar SMC menu se badalte hain. Tests `src/utils/smcSelection.test.js` (12: lifecycle, merge,
relevance, caps, dedupe, confluence, collision).

## Dhyan rakhne wali baatein
- Date display hamesha IST me karo; backend daily `YYYY-MM-DD` bhejta hai.
- WS reconnect logic zaroori (EC2 + Amplify me drop hota hai).
- `lightweight-charts` me missing slot = whitespace gap (ye backend gap-fill ke baad bhi bade outage me dikhega — ye feature hai, bug nahi).
- JS unit tests CI me nahi chalte (CI sirf `npm run build` karta hai) — locally `cd frontend && npm test` chalao, warna red test chhup jayega.
