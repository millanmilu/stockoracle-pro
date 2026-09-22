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

## 2. Engines — `src/utils/`

| File | Kaam |
|------|------|
| `indicatorEngine.js` | Engine registry + contract: `INDICATOR_ENGINE`, `Indicator`, `createParameter()`, `validateParameters()`, `calculateById(id, candles, params)` → `{ valid, points }`. Yahan WMA/HMA/KAMA/AnchoredVWAP/Donchian/Stoch/CCI/Williams %R/ROC/Momentum/TRIX/ATR/Keltner/StdDev/HistVol/BBWidth... bhi hain. |
| `chartIndicators.js` | Shared primitives (16 exports) jo AI engines bhi import karte hain: `calculateSMA/EMA/RSI/MACD/BollingerBands/ATR/ADX/Supertrend/StochRSI`. Ek hi jagah math rakho — copy-paste na karo. |
| `aiIndicatorEngine.js` | AI studies (neeche). Ye file import hote hi apne engines registry me register karti hai (`AI_REGISTRY.forEach`), isliye `calculateById('ai_trend', …)` kaam karta hai. |
| `aiSignalEngine.js` | `analyzeSignal(candles)` → rule-based confluence report: `{ available, direction: buy/sell/neutral, probability, entry, stopLoss, takeProfit, riskReward, confluence: {buy, sell, neutral}, why: [...], missing: [...] }`. |

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
- **Viewport guard:** `scrollToRealtime()` sirf tab jab viewport already right edge pe ho
  (`range.to >= totalBars - 2`) — history pan karne pe snap-back nahi.
- **Cache budget:** `chartDataCache` me `MAX_ENTRIES=5` + 30 MB byte-budget
  (per-candle ~1.2 KB estimate) — 20×10 MB entries (~200 MB heap) wala leak band.
- **Error UX:** `useStock.fetchHistory` detail propagate karta hai (throw), generic
  "Failed" nahi. GOLD `PAXGUSDT` proxy ko `dataSource: 'binance_proxy_PAXG'` +
  `proxyWarning` banner milta hai. Error badge me Retry/Dismiss + 12s auto-clear.
- **`POPULAR_STOCKS` me `NIFTY50` nahi** (no universe token — kabhi tick nahi deta tha).
- **Replay:** timer deps me `replayIndex` nahi (speed even), end-toast once (ref guard),
  keydown listener once (stable refs) — har candle pe re-attach nahi.

## Tests + commands

```bash
cd frontend && npm test        # = node --test src/utils/*.test.js (7 files)
```

- `aiIndicatorEngine.test.js` — har AI engine ka behaviour synthetic candles pe (trend ±100,
  exhaustion sign, band widening, markers, dashboard aggregate, short-series safety).
- `indicatorEngine.test.js`, `chartHelpers.test.js`, `volumeProfile.test.js`,
  `drawingGeometry.test.js`, `aiSignalEngine.test.js`, `watchlist.test.js`.
- **CI me `npm test` nahi chalta** (CI sirf `npm run build`) — isliye ye locally chalao.
- `*.test.js` files `src/utils/` me hi rehti hain (`package.json` ka glob) — test ko
  `src/components/` me na rakho, warna chalega hi nahi.
