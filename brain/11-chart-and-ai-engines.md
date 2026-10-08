# 11 — Chart Engine + AI Indicator Layer (frontend)

> Ye file frontend ke **indicator/AI engine layer** ka map hai. `03-frontend-map.md`
> folder structure batata hai; ye file batati hai ki ek indicator **define** hone se
> **screen pe draw** hone tak ka safar kya hai — aur kahan silently fail hota hai.

## 3 layers (yaad rakho)

```
1. CATALOG      src/components/chart/indicatorDefinitions.js   ← definition (kya hai)
2. ENGINE       src/utils/{indicatorEngine,chartIndicators,aiIndicatorEngine,aiSignalEngine}.js
                                                               ← math (value kya hai)
3. CONSUMERS    LiveChartView.jsx + chart/ChartCanvas.jsx + chart/OscillatorPane.jsx
                                                               ← render (kahan dikhega)
```

**Rule #1:** teeno layers ko ek saath update karo. Sirf catalog me entry add karne se
kuch draw nahi hota — consumer list me bhi uska rasta hona chahiye.

## Chart runtime / bundle performance
- `App.jsx` ka Dashboard route lazy-loaded hai; Chart.js/react-chartjs-2 default Live Chart entry ke static graph me nahi aane chahiye, aur `vite.config.js` Lightweight Charts ko alag vendor chunk me rakhta hai.
- `VolumePane.jsx` skips candle/MA preparation while hidden, refreshes when shown, and computes MA with a rolling sum (O(n)); keep the hidden pane's chart-series state current only on visibility restore.

## 1. Catalog — `indicatorDefinitions.js`

`INDICATOR_DEFINITIONS` (array) single source hai. Saath me `INDICATOR_CATEGORIES`,
`INDICATOR_SEARCH_ALIASES` (search ke liye: "bb" → Bollinger) aur `DEFAULT_ACTIVE_INDICATORS`.

| Field | Matlab |
|-------|--------|
| `id` / `name` / `shortName` | identity (id hi state key hai — active/toggle/hidden) |
| `category` | tab: trend / momentum / volatility / volume / market_structure / levels / ai / custom |
| `type` | render family — neeche table dekho |
| `field` / `signalField` / `subLines` / `levels` | **server-computed** columns jo candle pe already aate hain (legacy path) |
| `engineId` + `params` | **client engine** path — `calculateById(engineId, candles, params)` |
| `oscType` | sub-pane ka config selector (OscillatorPane me `OSC_CONFIG[oscType]`) |
| `aiOverlay` | AI advanced overlay: `'zones'` \| `'markers'` \| `'bands'` |
| `chartOverlay` | price pane pe real overlay draw karna hai (AI signal jaise) |
| `inputs` / `method` / `outputs` / `signals` / `confidence` / `backtest` | AI entries ka documentation block (modal me dikhta hai — **marketing nahi, contract**) |

`type` ki values: `overlay`, `overlay_multi`, `overlay_supertrend`, `overlay_psar`,
`overlay_ichimoku`, `oscillator`, `smc`, `levels`, `profile`, `ai`, `custom`.

### SMC Pro overlay pattern (current standard)

SMC ka professional mode usually ek single combined overlay ke roop me aata hai, not multiple noisy toggles. Current app me `smc_pro` indicator ko `market_structure` category se define kiya jaata hai aur ek compact summary card ke saath chart ke top-left me render hota hai, while keeping the normal individual SMC detectors available for advanced users.

- `src/components/chart/indicatorDefinitions.js` → single `SMC Pro` entry in market structure catalog
- `src/utils/marketStructure.js` → `smc_pro` detector aggregates BOS / CHoCH / liquidity / FVG / OB / S&R into one signal stream
- BOS/CHoCH only emit on a close crossing a confirmed swing; unbroken swings are not structure events, and each swing emits at most one break
- SMC bias is derived from 4× and 16× candle aggregations; disagreement or insufficient aggregated history reports neutral rather than inventing HTF data
- Premium/discount follows range convention: above equilibrium = premium, below = discount; setup direction requires configured confluence
- SMC score counts only observed, direction-aligned evidence; OB/FVG contributions must be untouched and near current price, while absent sweep, structure, displacement, zone, session, or volume evidence contributes zero
- `src/components/live-chart/ChartFloaters.jsx` → compact, draggable/collapsible summary card; bias, structure, session, score come from `analyzeSMC()` rather than candle-to-candle guesses
- `src/components/live-chart/SmcProLayer.jsx` → viewport-aware SVG rendering; only short confirmed-structure markers, short active-liquidity rails, short setup rails, and active OB/FVG rectangles
- SMC Pro ke indicator Inputs (`windowSize`, `lookback`) `ChartShell` se `SmcProLayer` ke detector settings tak thread hote hain; expandable `SmcProDetailPanel` component score contributions, MTF confluence, filtered OB/FVG zones, baseline backtest, event feed aur level/zone exports dikhata hai.
- `src/utils/smc/selection/smcSelect.js` → lifecycle + relevance + current-price/zoom filtering; SMART mode favors setup context, hides filled/invalidated zones, and reduces density when zoomed out
- `src/utils/smc/selection/smcLabels.js` → priority-ranked pixel bounding-box collision placement against other labels and reserved chart areas
- `src/components/chart/canvas/useIndicatorGroups.js` keeps `smc_pro` out of the legacy price-line renderer; `indicatorOverlayEffects.js` removes any stale legacy series when it is toggled to the single SVG overlay
- Rule: no FVG/OB/swing full-width rails, no filled FVG or invalidated/mitigated OB, no EQ/PD helper rails in the default overlay; lower-priority labels yield to setup levels and MSS/CHoCH

SMC correctness fixes (Oct 2026):
- OB/FVG lifecycle starts after confirmation (OB: two departure bars, FVG: third formation bar). Formation candles never count as retests; scoring excludes zones touched after confirmation, and mitigation uses a trailing lookback.
- Setup rails honor the Setup display toggle. Liquidity caps include sweeps; structure caps apply to the combined break/swing list and remain effective when zoomed in, including zero.
- Setup displacement must match the setup direction; an opposite-direction impulse cannot satisfy confluence.
- Premium/discount defaults to the **last 120** candles, including shorter histories; missing valid prices return an unknown range, never Infinity/NaN.
- `src/utils/smc/engine/liquidityDetector.js` supplies BSL/SSL from confirmed swings. Only a subsequent wick beyond the level with a close back counts as a sweep; a close through consumes the level. Volume pockets are not sweep evidence. Score/setup only count bias-aligned sweeps from the last 40 bars, and the selector preserves the detector's lifecycle/direction.
- `src/utils/smc/engine/sessionDetector.js` accepts Unix seconds (also milliseconds), uses each configured IANA timezone with DST, and reports daily date strings as unknown. London/New York take priority over overlapping Asian windows; an explicit fixed offset remains supported, including zero.
- Bearish engine signals use range high for SL and range low for TP. Drawable TP fallbacks extend beyond existing targets in order; null entry falls back to a real price and invalid/nonpositive levels are suppressed.
- Entry/SL/TP rails and the summary card show a provisional `PLAN` when 4×/16× aggregated HTF bias agrees but full setup confluence is missing; these levels are explicitly not presented as a confirmed signal. Full confluence upgrades the same levels to confirmed.
- OB/FVG engine controls are enforced at detection time: bullish/bearish OB toggles, minimum OB displacement in ATR units, FVG visibility/cap, and a minimum FVG-size-to-ATR threshold. The top-bar SMC menu lets users tune minimum OB displacement and FVG width; a zero object cap means none, and unavailable ATR cannot pass a positive quality threshold.
- Drawable setup levels now prefer a live same-direction OB/FVG edge for entry, place the stop beyond the nearest structural invalidation with an ATR buffer and minimum risk, then use opposing swings/liquidity with >=1.25R measured fallbacks for ordered TP1/TP2/TP3. The SMC Pro card and SVG layer expose the same Entry, SL and three targets.
- `src/utils/smc/engine/smcSnapshot.js` snapshots the active candle's OHLCV. `SmcProLayer.jsx` samples the matching active ref once per second locally and shares one analysis with the summary card; unchanged samples skip analysis. History replacements and symbol/timeframe changes refresh normally, hidden SMC stops polling, and replay ignores the live ref. Do not restore a price-relative cache key (price / (price × 0.0005) is constant).
- Backtest Studio’s `smc_pro` strategy is separate from the chart detail panel’s baseline demo: it uses verified intraday OHLCV, causal 4×/16× bias, confirmed structure, sweep/OB/FVG and session evidence, and structural long/short exits in `backend/analysis/backtest_smc.py`.
- `src/utils/smc/engine/setupLifecycle.js` freezes the first surfaced SMC setup (including PLAN levels) and keeps it on the chart until TP1 or SL is touched; same-bar re-entry is suppressed until the next candle. Stop wins when one candle touches both stop and target.
- Backend `smc_pro` backtests follow the same position lifecycle: an open trade is not replaced by an opposite later signal; it closes only at structural SL/target, the configured max holding **bars**, or period end. This avoids candle-to-candle signal churn being counted as extra losses.
- SMC backtest sizing defaults to `risk_per_trade_pct=1.0`, budgeting structural stop distance plus conservative round-trip friction bounds before the position-size cap; gaps can exceed the budget. Backtest Studio exposes a 0.1–5% risk slider.
- Backend confirmation requires aligned HTF, sweep, structure, recent directional displacement (>1.2 ATR in 10 bars), OB/FVG and premium/discount. Targets require >=1.25R. Entry is a next-bar limit at the planned price (better open permitted); unfilled orders expire after that bar and still record equity. Python and chart detectors remain separate implementations, so this is not exact live-chart replay; the chart panel baseline is also separate.
- Locked PLAN status can upgrade to confirmed in the same direction without moving levels. Exit tracking scans loaded bars from creation and checks sampled close for same-bar SL/TP revisits. Pre-creation wicks alone do not trigger an exit; a touch/reversal entirely between samples within an existing wick remains unknowable from OHLC. Missing unloaded bars cannot be reconstructed by this helper.
- `src/utils/smc/selection/smcSelect.js` ranks zones before overlap merging, and `src/utils/smc/selection/smcRelevance.js` prevents dead (`invalidated`/`filled`) zones from merging with or swallowing live zones. `src/utils/smcDisplayPrefs.js` syncs `SMC_MODE_PRESETS` when switching between `smart`/`minimal`/`full`/`debug` modes, and `SmcProLayer.jsx` computes `Killzones` directly from loaded intraday candles via `detectSession()` so non-24/7 sessions, 4H/1D charts, and historical replay never stretch session boxes across the viewport.
- `calculateSMCScore()` returns normalized per-component values alongside the aggregate so the detail panel cannot mistake `{raw,total,score}` for component scores; zone tables/exports filter out liquidity points and include only OB/FVG bands.
- Live ticks update an already-present candle imperatively; new bars/fill slots go through React candle state and one `setData` replacement only. Do not append with `series.update()` and then immediately replace that same appended dataset, which can leave Lightweight Charts hit-testing stale rows.
- Regression coverage stays in `src/utils/smcSelection.test.js`, `src/utils/smcSetupLevels.test.js`, `src/utils/smcBacktest.test.js` and `src/utils/smcMtfConfluence.test.js`: default range, session units/DST, confirmed sweeps, aligned/recent scoring, mirrored SL/TP, ordered targets, dead-vs-live overlap survival, mode preset transitions, immutable live/replay snapshots, baseline R accounting and aggregated HTF confluence.

### Server-side SMC agent

`backend/smc/engine.py` is an independent, deterministic live-agent contract: 4H closed-candle EMA bias → 1H confirmed BOS/CHoCH, liquidity and departed order block → 15M closed sweep, 1.2×ATR displacement and FVG. It rejects synthetic sources and forming candles, requires a 1:2 target, and creates a durable fingerprint. `backend/services/smc_agent.py` evaluates Binance Top-20 USDT symbols (quote-volume ranking cached hourly) plus explicit XAUUSD, persists `SmcAgentSetup` rows, and retries Telegram delivery until a notification is recorded. It is disabled by default via `SMC_AGENT_ENABLED`; its own 24/7 loop must never be gated by the NSE alert scheduler. `backend/data/xauusd.py` fetches the `XAUUSD=X` FX instrument separately; XAUUSD no longer silently maps to PAXGUSDT (PAXG remains explicit). This engine is not yet the chart overlay or the legacy Backtest Studio strategy; do not present their results as agent performance.

## 2. Engines — `src/utils/`

| File | Kaam |
|------|------|
| `indicatorEngine.js` | Engine registry + contract: `INDICATOR_ENGINE`, `Indicator`, `createParameter()`, `validateParameters()`, `calculateById(id, candles, params)` → `{ valid, points }`. Yahan WMA/HMA/KAMA/AnchoredVWAP/Donchian/Stoch/CCI/Williams %R/ROC/Momentum/TRIX/ATR/Keltner/StdDev/HistVol/BBWidth... bhi hain. |
| `chartIndicators.js` | Shared primitives (16 exports) jo AI engines bhi import karte hain: `calculateSMA/EMA/RSI/MACD/BollingerBands/ATR/ADX/Supertrend/StochRSI`. Ek hi jagah math rakho — copy-paste na karo. |
| `aiIndicatorEngine.js` | AI studies (neeche). Ye file import hote hi apne engines registry me register karti hai (`AI_REGISTRY.forEach`), isliye `calculateById('ai_trend', …)` kaam karta hai. |
| `aiSignalEngine.js` | `analyzeSignal(candles)` → rule-based confluence report with a heuristic `confidence` score (not a calibrated probability), `direction`, Entry/SL/TP, confluence votes, reasons, and missing inputs. The legacy `probability` field remains for compatibility only (neutral is 50); do not interpret it as a probability. |

### AI engines (`aiIndicatorEngine.js` — `AI_REGISTRY`, series return karte hain)

| engineId | Range | Kya karta hai |
|----------|-------|----------------|
| `ai_trend` | −100…+100 | EMA stack (9/21/50) magnitude-weighted votes + Supertrend + MACD-hist sign, ADX se scale |
| `ai_momentum` | −100…+100 | RSI + StochRSI-%K + MACD-hist/realized-vol + ROC(10) ka average (≥2 components chahiye) |
| `ai_exhaustion` | −100…+100 | Divergence(40) + OB/OS(25) + rejection wicks(20) + EMA20 se ATR overextension(15); bull − bear |
| `ai_regime` | 0…100 | ADX + choppiness ka meter (0 = range, 100 = trend) |
| `ai_breakout` | −100…+100 | Donchian-20 channel + BB squeeze percentile + ATR expansion + rel-vol, channel edge ke proximity se scaled |
| `ai_forecast` | `{median, upper, lower, anchor}` | 20-bar drift regression + momentum tilt; band half-width = σ√k (horizon ke saath widen) |

Analytics functions (registry me nahi, directly call hote hain):
`getAISupportResistance()`, `detectAIPatterns()` (max 6), `getAIPatternMarkers()`,
`getAIBreakoutMarkers()`, `getAIReversalMarkers()`, `labelRegime()`,
`computeAIDashboardScores()` (dashboard strip ka ek snapshot).

## 2b. Custom script indicators (safe Pine-inspired subset)

- `src/components/chart/CustomIndicatorEditor.jsx` creates/edits scripts from the indicator modal; scripts and custom definitions persist in browser `localStorage` (`stockoracle_custom_indicators_v1`), not the backend.
- `src/utils/customIndicatorEngine.js` parses a bounded DSL and never evaluates JavaScript. Supported forms: assignments, `indicator()` / `study()` metadata, fixed-default numeric `input()` / `input.int()` / `input.float()`, OHLCV sources (`open`, `high`, `low`, `close`, `volume`, `hl2`, `hlc3`, `ohlc4`), arithmetic/comparisons, and up to six `plot()` lines.
- Series functions: `ta.sma`, `ta.ema`, `ta.rsi`, and the listed `math.*` scalar/series functions. Plot colors are six-digit hex. Scripts have length, line, token, nesting, period, and plot limits.
- Custom studies render as price-pane line overlays through `overlaySeriesRenderers.js`; this is a supported subset, **not** full Pine Script compatibility. Functions, control flow, strategies, alerts, drawings, imports, and oscillator panes are not supported.
- `customIndicatorEngine.test.js` covers interpreter results, validation, and unsupported syntax. Avoid adding `eval`/`Function` or broadening the grammar without matching tests and explicit resource bounds.

## 3. Consumers — ek definition ko draw karne ke 6 raaste

| # | Consumer | Filter | Screen pe kya |
|---|----------|--------|----------------|
| 1 | `LiveChartView.activeOscillators` → `OscillatorPane` | `type === 'oscillator'` | sub-pane (oscType se config) |
| 2 | `ChartCanvas.overlayIndicators` | `type` NOT in `[oscillator, smc, ai, custom, profile]` **ya** (`type==='ai'` && `aiOverlay==='bands'`) | price pane lines |
| 3 | `ChartCanvas.smcIndicators` | `type === 'smc'` | structure overlays |
| 4 | `ChartCanvas.aiZoneIndicators` | `type==='ai'` && `aiOverlay==='zones'` | S/R zone lines |
| 5 | `ChartCanvas.aiMarkerIndicators` | (`type==='ai'` && `aiOverlay==='markers'`) **ya** `id === 'ai_reversal'` | chart markers (BRK/EXH/patterns) |
| 6 | `ChartCanvas.aiOverlays` | `type==='ai'` && `chartOverlay` && **!**`aiOverlay` | Entry/SL/TP lines + direction marker (`analyzeSignal`) |

Plus: `type === 'profile'` → `VolumeProfileOverlay` (LiveChartView), aur `type === 'levels'` → pivot/fib lines.

### AI catalog ka current wiring (audit snapshot)

| Entry | Wiring | Kahan draw hota hai |
|-------|--------|---------------------|
| `ai_signal` | `chartOverlay: true` | Entry/SL/TP lines + direction marker (consumer 6) |
| `ai_trend` | `type:'oscillator'` + `oscType:'ai_trend'` + `engineId:'ai_trend'` | sub-pane (consumer 1) |
| `ai_momentum` | same pattern (`ai_momentum`) | sub-pane |
| `ai_reversal` | `oscType:'ai_exhaustion'` + id consumer 5 me | sub-pane **+** EXH markers |
| `ai_sr` | `aiOverlay:'zones'` | zone lines (consumer 4) |
| `ai_breakout` | `aiOverlay:'markers'` | sirf BRK markers — impulse series kisi render list me nahi |
| `ai_pattern` | `aiOverlay:'markers'` | pattern markers |
| `ai_forecast` | `aiOverlay:'bands'` + `engineId:'ai_forecast'` | price pane bands (consumer 2) |
| `ai_regime` | **koi render field nahi** | kuch nahi — toggle karne pe sirf AIDashboard chip badalta hai |
| `ai_dashboard` | **koi render field nahi** | kuch nahi — MTF alignment already AIDashboard strip me hai |
| `ai_consensus` | koi render field nahi | by design panel-only (trained ML model ho tabhi surface hota hai) |

`ai_breakout` ke 3 outputs catalog me likhe hain (BRK markers, impulse −100…+100, SQUEEZE/impulse
state) — par impulse series ka koi pane nahi hai; wo sirf `AIDashboard` ke BRK chip ke tooltip me
dikhta hai.

**Marker-only series invariant:** Lightweight Charts crosshair marker renderer calls
`firstValue()` for any series with a marker at the active time. `ai_signal` ka invisible marker
anchor series isliye latest valid close ka ek hidden data point rakhta hai; `setMarkers()` ke
saath empty `setData([])` crash kara sakta hai (`Value is null`).

**Primary candle paint guard:** `chartHelpers.isValidChartTime()` + `sanitizeCandles()` invalid
calendar/timestamp rows ko primary series se drop karte hain. `candlesDataSync` OHLC/time ko
dobara validate karta hai, live imperative updates empty/stale series par skip hote hain, aur
`safeChart` ka chart-scoped paint guard transient lightweight-charts `Value is null` frames ko
fatal app overlay banne se rokta hai.

## Traps (inhi se bugs aate hain)

1. **Silent no-op:** aisa definition jo kisi bhi consumer filter me fit nahi hota, na draw hota hai
   na error deta hai — modal me active dikhta hai, chart pe kuch nahi. Naya entry add karte waqt
   upar ki table me apna rasta likho, warna kuch nahi hoga.
2. **Pane ke liye teen cheezein chahiye:** `type:'oscillator'` (pane banega) + `oscType` (config
   milega) + `engineId` (values aayenge). `oscType` missing/galt ho to
   `OSC_CONFIG[oscType] || OSC_CONFIG.rsi` fallback lagta hai — 0…100 meter pe RSI ke 70/30 bands
   draw ho jayenge, jo galat read hai. AI ke liye `OSC_CONFIG` me `ai_trend`, `ai_momentum`,
   `ai_exhaustion` already hain; naya oscillator add karo to wahan entry bhi daalo.
3. **Ek score, do number:** pane `definition.params` use karta hai, par
   `computeAIDashboardScores(candles)` har engine ko **khaali `{}`** se call karta hai. Isliye
   modal me params badalne ke baad pane aur dashboard chip alag value dikha sakte hain. Koi naya
   param dashboard me honour karana ho to usse explicitly thread karo.
4. **Sign convention ko ek jagah rakho.** Trend/momentum/impulse me positive = bullish.
   Exhaustion me positive = **sellers exhausted** → bullish bounce (yani marker green/below bar,
   signal BUY). Ek hi number ke 3 consumers hain — `getAIReversalMarkers` (marker),
   `aiSignalOf` (buy/sell), `computeAIDashboardScores` (label/colour). Polarity badloge to teeno
   ek saath badlo, warna chart aur label ulta bol denge.
5. **Ek bar pe ek marker.** `getAIPatternMarkers` same timestamp ke markers dedupe karta hai
   (highest completion jeetta hai). Jo detectors sab `last.time` pe anchor karte hain
   (triangle/flag), unke markers ek dusre ko chhupa dete hain — chart pe 1 marker dikhega jabki
   dashboard saare patterns list kar dega. Naya pattern add karte waqt apni real pivot bar pe
   anchor karo, last bar pe nahi.
6. **Recompute cost live ticks pe lagta hai:** `computeAIDashboardScores` + `analyzeSignal` dono
   `useMemo([candles])` me hain, aur candles har live tick pe badalte hain. Andar kaam duplicate
   hai (forecast andar momentum dobara chalata hai; S/R aur patterns dono apna ATR + pivots
   banate hain; breakout wahi Bollinger bands recompute karta hai). Bhaari symbol/timeframe pe
   lag dikhe to pehle yahi dekho.
7. **Sparse warmup normal hai** — engine series shuruat me khaali hote hain, panes nulls filter
   karte hain. Isliye "chart me line nahi aayi" ka matlab hamesha bug nahi hota; `calculateById()`
   ka `valid` flag dekho.

## Live-chart perf + correctness locks (P0/P1 — Sep 2026)

- **Bounded history:** `getBoundedTimeframe()` (`chartHelpers.js`) — `1d→2Y, 1m/5m/1s/30s→5D,
  15m/30m→1M, 1h/4h→6M`. `LiveChartView.loadHistory` kabhi `'ALL'` nahi bhejta
  (7k+ rows / ~10 MB / 71 cols). Backend default ab bhi `ALL` support karta hai,
  par chart loads bounded hain.
- **Payload truth:** `_CHART_COLUMNS` = 71 cols (comment me purana `~8MB→2MB / 22 cols`
  claim fix ho gaya). Payload win rows se aata hai, column-trim se nahi.
- **Slim two-stage load (cold chart paint):** `GET /history?...&slim=true` enrich skip
  karke sirf OHLCV 6 cols deta hai (1m/5D: 2.6 MB → 190 KB). `loadHistory` pehle slim
  paint karta hai (live-tick refs seed ho jate hain), phir full enriched frame silently
  replace karta hai — field-only overlays (SMA 20) stage 2 me pop-in hote hain, chart
  kabhi blank nahi hota. Sirf cold loads pe (cache miss); cached remount seedha full
  refresh karta hai. Cursor backfill (`?before=`) hamesha full rehta hai.
- **Render isolation:** `LivePriceBadge` (toolbar) hi ekmatra per-tick subscriber hai;
  `LiveChartView` tree per-tick re-render nahi hota. `ChartCanvas` `React.memo` +
  custom prop-compare me hai. Paper P&L lines ko 2s-throttled snapshot milta hai
  (`throttledLivePrice`), raw tick nahi — warna `createPriceLine` flicker karta.
- **Crypto WS:** `@aggTrade` unsubscribed (10-100+/sec jank); `@ticker` (1s) + `@kline`
  kaafi hain. Ticks rAF-coalesced hain (`pendingTickRef`).
- **Daily bucket IST:** `getIstDateString()` single source — crypto + equity dono.
  `toISOString()` (UTC) kabhi daily bucket me mat use karo (00:00–05:30 IST bug).
  Yehi `useStock` Binance fallback aur `useWebSocket` kline branch me bhi hai.
- **Continuation:** `INTERVAL_SLOT_SEC[interval]` use hota hai (hardcoded 300s hata diya)
  taaki 1h/4h me `prevClose` carry-over na toote.
- **Fill continuity gate (BTC flat-dash fix):** stall backfill (flat vol-0 bars) sirf tab
  jab previous bucket isi session me tick-touched ho (`lastTickBucketRef`). Seeded bars
  (cache/history restore, remount, hidden-tab return, full-frame replace) pe rollover
  honest gap chhodta hai — stale price pe fake flat line + jump nahi (yehi BTC pe
  "galat chhoti candles" lag rahe the; probe me live edge pe 5 vol-0 flats mile, fix ke
  baad zero). 60s+ hidden gap `visibilitychange` se continuity invalidate karta hai;
  har `loadHistory` start reset karta hai; full-stage merge strictly-newer live bars
  preserve karke continuity re-arm karta hai (16s-load wick loss band).
- **Holiday/fallback gate (`canUpdateLiveCandle`, chartHelpers.js):** equity candle
  mutate/spawn sirf tab jab tick genuinely live ho. Sirf clock window (09:15–15:30 IST)
  NSE holidays nahi dekh sakta — Gandhi Jayanti jaise weekday-holidays clock window ke
  ANDAR aate hain, aur broadcaster holiday/ broker-outage pe verified EOD fallback
  `is_live:false` bhejta rehta hai. Explicit `is_live:false` clock gate ko VETO karta
  hai (fake 1m candle kabhi nahi); flag missing ho to legacy clock behavior; crypto
  24/7 bypass. Unit test: `chartHelpers.test.js` (AGENTS.md §4).
- **Viewport guard:** `scrollToRealtime()` sirf tab jab viewport already right edge pe ho
  (`range.to >= totalBars - 2`) — history pan karne pe snap-back nahi.
- **Cache budget:** `chartDataCache` me `MAX_ENTRIES=5` + 30 MB byte-budget
  (per-candle ~1.2 KB estimate) — 20×10 MB entries (~200 MB heap) wala leak band.
- **Error UX:** `useStock.fetchHistory` detail propagate karta hai (throw), generic
  "Failed" nahi. GOLD `PAXGUSDT` proxy ko `dataSource: 'binance_proxy_PAXG'` +
  `proxyWarning` banner milta hai. Error badge me Retry/Dismiss + 12s auto-clear.
- **Cursor backfill (left-pan auto-load, primary):** `GET /history?before=<epoch|IST date>&limit=<n>`
  → `fetch_history_window()` (`fetcher.py`) purani window **sirf** lautata hai (live edge
  merge nahi) — crypto Binance `endTime` walk-back, equity Angel One window + DB merge,
  daily DB slice (+refill). `LiveChartView.handleNeedOlderData` oldest loaded candle ko
  cursor banata hai, `sanitizeCandles` se prepend karta hai (timestamp dedupe, live edge
  wins ties), ChartCanvas prepend-shift se zoom/crosshair/viewport rakhta hai.
  Trigger: `range.from < BACKFILL_TRIGGER_BARS (30)`; single-flight + 1.5s debounce +
  per-key `{exhausted, oldest, lastBefore}` range-cache (same edge dobara fire nahi).
  Pill: `Loading historical data…` → `No more historical data` (4s auto-clear) →
  error pe Retry. `BACKFILL_LEVELS` ab fallback/compat ke liye hai.
- **Chunk sizes (kabhi universal count nahi):** backend `CURSOR_CHUNK_LIMITS` =
  frontend `BACKFILL_CHUNK_LIMIT` (`chartHelpers.getBackfillChunkLimit`, clamp 50…5000):
  `1s→300, 30s→500, 1m/5m→3000, 15m/30m/1h→2000, 4h→1500, 1d→1000`. Dono files
  ek saath badlo. Short window / `has_more:false` / khaali list = exhausted.
  `useStock` Binance fallback bhi cursor-aware hai (`endTime` seed + `limit` cap) taaki
  backend-down pe bhi backfill kaam kare.
- **Crypto DB fast-path period-aware hai** (`from_ts` + coverage check) — warna 5D load ke
  60s andar 1M backfill wahi shallow slice lautata tha aur turant `exhausted` lagta tha.
- **`POPULAR_STOCKS` me `NIFTY50` nahi** (no universe token — kabhi tick nahi deta tha).
- **Replay:** timer deps me `replayIndex` nahi (speed even), end-toast once (ref guard),
  keydown listener once (stable refs) — har candle pe re-attach nahi.

## Chart Settings store (TradingView dialog — Oct 2026)

`src/utils/chartSettings.js` = saare chart knobs ka single source. Dialog
(`ChartSettingsModal.jsx`) sirf yahan likhta hai; `ChartCanvas.jsx`,
`VolumePane.jsx`, `OscillatorPane.jsx` aur `LiveChartView.jsx` subscribe karte hain.

Flow: **modal → `saveChartSettings()` (cache + localStorage, notify 60ms coalesced)
→ subscribers → `buildChartOptions()` / `buildSeriesOptions()` → `chart/series.applyOptions()`**

| Store API | Kaam |
|-----------|------|
| `loadChartSettings()` | DEFAULT + saved merge (cached read; `invalidateChartSettingsCache()` se refresh) |
| `saveChartSettings(patch)` | merge + persist + notify — persist turant, broadcast 60ms trailing (color `<input>` per-pixel chalta hai) |
| `resetChartSettings()` | defaults + storage clear + **immediate** notify |
| `subscribeChartSettings(fn)` | unsubscribe fn; **turant ek baar** current value se call hota hai (mount paint isi se hota hai) |
| `buildChartOptions(s, theme)` | chart-level patch: bg / grid / crosshair / axis text+size / scale visibility. `null` color = theme token |
| `buildSeriesOptions(s, type)` | primary series patch: colors, border/wick toggle, last-value tag, price line |
| `applyScalePlacement(chart, s, series[])` | scale side flip + har series ka `priceScaleId` move |
| `applyPaneChartOptions(chart, s, theme, series[])` | sub-pane par wahi patch (grid/crosshair/axis + scale side) |

Dialog ke 5 tabs: **Symbol / Candles** (6 chart styles, body/border/wick colors,
line color, borders/wicks/last-value/price-line toggles), **Appearance & Grid**
(bg theme|custom, grid toggles+colors, crosshair mode normal/magnet/hidden +
style + labels + label bg, axis text color/size, symbol watermark),
**Scales & Precision** (scale side, normal/log/percentage, invert, precision
auto|0–8, timezone, auto-fit prices), **Status Line** (title, OHLC, change %,
volume, indicator values, countdown), **Trading** (trade button, trading
panel, position lines — teeno `showTradeButton` / `showTradeDocket` /
`showPositionLines` par store me hain).

### Traps (inhi se bugs aate hain)

1. **Live preview + Cancel-restore:** dialog khulte waqt snapshot; har change
   turant store me; Cancel / X / backdrop = snapshot wapas (aur
   `onApplySettings` bhi wapas). Sirf OK pe parent state (chartType,
   priceScaleMode, invertScale, timezone) persist rehti hai — wo LiveChartView
   ke **props** hain, store nahi.
2. **Chart rebuild settings nahi bhulta:** `createPrimarySeries()` settings
   leta hai, creation `buildChartOptions` apply karta hai, aur theme-change
   effect ke baad subscriber dobara apply karta hai — warna `applyChartTheme`
   user colors grid/crosshair par mita deta.
3. **Scale side = series ka kaam:** sirf `leftPriceScale.visible` karne se
   left axis khali rehti hai (saari series `'right'` par hain). `applyScalePlacement`
   har series ka `priceScaleId` badalta hai (lightweight-charts applyOptions se
   scale par move hota hai). Series banane waale effect ke end me
   `syncScalePlacement()` call hota hai — naya series-creating effect add karo
   to wahan bhi call karo, warna wo series active scale par nahi dikhegi.
4. **`null` color = theme fallback:** defaults me grid/crosshair/axis colors
   `null` hain aur `|| tk.*` se theme token aata hai. Light theme me koi
   hardcoded `#1E222D`/`#787B86` mat lagao — concrete value sirf user ke
   choose karne par aati hai.
5. **Precision do jagah lagti hai:** axis labels (`data load`) aur series
   `priceFormat` (chart-type switch). Dono jagah
   `resolvePrecision(settings, autoDec)` se guzaro, warna axis aur legend alag
   decimal bolenge.
6. **60ms notify:** test me `await` chahiye (`chartSettings.test.js` dekho);
   `subscribeChartSettings` ka initial call synchronous hai.
7. **Countdown** LiveChartView render karta hai (ChartCanvas nahi), isliye wahan
   bhi store subscribe hota hai (`showCountdown`).
8. **Trading tab:** `showTradeButton`/`showTradeDocket` par LiveChartView
   **derive** karta hai (useState nahi) — toolbar ke toggle bhi
   `saveChartSettings()` se likhte hain, warna state alag ho jayegi.
   `showPositionLines: false` hona `paperPosition` prop ko `null` karta hai;
   ChartCanvas ka paper-lines effect cleanup early-return se **pehle** lines
   hata hai, isliye toggle off karte hi entry/SL/TP lines gayab hoti hain.

## Tests + commands

```bash
cd frontend && npm test        # = node --test src/utils/*.test.js (16 files)
```

- `aiIndicatorEngine.test.js` — har AI engine ka behaviour synthetic candles pe (trend ±100,
  exhaustion sign, band widening, markers, dashboard aggregate, short-series safety).
- `indicatorEngine.test.js`, `chartHelpers.test.js`, `volumeProfile.test.js`,
  `drawingGeometry.test.js`, `aiSignalEngine.test.js`, `watchlist.test.js`,
  `timeframeQuickSwitch.test.js` (number-key timeframe resolver),
  `chartSettings.test.js` (settings store + option builders),
  `drawingRepair.test.js` (`repairDrawings` — catalog `spec.points` anchor count
  se repair; 2-point tools reload pe drop na hon — FRVP regression).
- **CI me `npm test` nahi chalta** (CI sirf `npm run build`) — isliye ye locally chalao.
- `*.test.js` files `src/utils/` me hi rehti hain (`package.json` ka glob) — test ko
  `src/components/` me na rakho, warna chalega hi nahi.
