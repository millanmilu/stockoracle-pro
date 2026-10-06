# 08 — Commands (run / test / deploy)

## Local run
```bash
./run_local.sh     # backend :8000 + frontend :5173
./stop_local.sh    # dono stop
curl -s http://127.0.0.1:8000/api/health
```

## Manual modes
```bash
venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000   # backend only
cd frontend && ../.bin/bin/node node_modules/vite/bin/vite.js --port 5173  # frontend only
python main.py --mode terminal --symbol RELIANCE   # CLI terminal
python main.py --mode worker                       # celery worker
python verify_terminal.py                          # EC2 integration check
```

## Tests (21 files in tests/)
```bash
venv/bin/pytest tests/ -q
venv/bin/pytest tests/test_data_invariants.py tests/test_database_invariants.py -v  # invariants
venv/bin/pytest tests/test_ws_broadcast_fallback.py tests/test_indicators.py -v
```

## Frontend tests (JS — CI me bhi chalte hain)
<!-- check: frontend_tests=16 -->
```bash
cd frontend && npm test        # = node --test src/utils/*.test.js
```
- **16 `*.test.js` files**, sab `src/utils/` me — glob `package.json` me `src/utils/*.test.js` hai,
isliye test wahi rakho, warna chala hi nahi.
- Indicator/AI engine tests: `aiIndicatorEngine.test.js`, `indicatorEngine.test.js`, `aiSignalEngine.test.js` (+ `chartHelpers`, `volumeProfile`, `drawingGeometry`, `drawingRepair`, `drawingSettings`, `drawingToolDefaults`, `smcSetupLevels`, `smcSelection`, `brokerHelpers`, `watchlist`, `timeframeQuickSwitch`, `chartSettings`, `theme` — pinned chart ICU locale).
- CI ka `frontend-ci` job `npm test` + `npm run lint` (0-errors gate) + `npm run build` chalata hai — red test ya lint error commit hi nahi hoga.

## UI check (headless browser)
```bash
cd frontend && npm run ui:check              # = node scripts/ui-check.mjs (servers :5173/:8000 up hone chahiye)
node scripts/ui-check.mjs /screener          # specific route check
npm run ui:livechart                         # Live Chart tab check (mock market data — backend ki zaroorat nahi)
npm run ui:livechart -- real                 # wahi checks asli backend/window pe (candles load hone chahiye)
LIVECHART_LOCALE=en-US@posix npm run ui:livechart   # LANG=C/POSIX locale regression (LWC locale trap)
UI_CHECK_CHROMIUM=/path/to/chrome npm run ui:livechart   # explicit browser binary
npm run ui:smc-ai                            # SMC Pro overlay + AI layer check (live backend chahiye)
SMC_AI_SYMBOL=RELIANCE npm run ui:smc-ai     # symbol choose karo (default RELIANCE)
UI_CHECK_CHROMIUM=/path/to/chrome npm run ui:smc-ai   # explicit browser binary
```
- `frontend/scripts/ui-check.mjs` real headless Chrome (Playwright devDependency, system Chrome use karta hai) me app
  load karta hai, React hydration wait karta hai, aur console errors / uncaught exceptions / failed requests /
  HTTP >= 400 report karta hai + full-page screenshot `logs/ui-check/home.png` me save hota hai.
- Exit code 0 = healthy, 1 = problems (CI-friendly). External-origin warnings fail nahi karte.
- Ye sirf dev-time script hai — CI me nahi chalta, `playwright` browsers download karne ki zaroorat nahi
  (system Chrome se chalta hai; fallback bundled Chromium).
- `frontend/scripts/livechart-check.mjs` Live Chart tab ka dedicated check hai: **mock pass** default
  (deterministic synthetic /history + /ws ticks — staged slim→full load, OHLC status line, live tick
  candle, bucket rollover, left-pan cursor backfill, interval switch, crosshair, modals, oscillator pane)
  aur **real pass** (`real` arg — asli backend pe hydrate + candles). Screenshots + JSON report
  `logs/livechart-check/` me. Real backend data ke bina bhi frontend chart path verify ho jata hai.
- `frontend/scripts/smc-ai-check.mjs` **SMC Pro + AI layer** ka check hai (live backend chahiye —
  ismein /api mock nahi hota, kyunki SMC overlay aur AI panel asli candles pe hi bante hain):
  toolbar toggle → `SmcProLayer` SVG (shapes + CHoCH/HH/HL labels) + score card
  (Bias/Structure/Phase/Session/Score), phir AI Trend sub-pane, AI Signal price-pane overlay,
  AIDashboard strip, AI Chat panel (key na ho to graceful guidance), aur Dashboard ka
  3-Engine AI Consensus gauge (visible + live score). Report `logs/smc-ai-check/` me.
  **Zaroori:** active interval pe candles hone chahiye — app default 1m/5D kholta hai, isliye
  seed DB me intraday rows chahiye; sirf daily (1d) rows ho to overlay khaali rehta hai
  (detection ke liye ≥20 candles chahiye, `SmcProLayer` chup-chaap empty div deta hai).

## Brain checker
```bash
python3 scripts/check_brain.py            # paths + counts + screener honesty probes (CI invariants job me chalta hai)
python3 scripts/check_brain.py --strict   # line-count drift pe bhi fail (default 10% tolerance)
```
`brain/*.md` ke saare backtick paths + tree paths exist karte hain ya nahi, ye check hota hai.
Runtime artifacts (`.log`, `.db`, `.pt`, `.pem`) skip hote hain, aur kuch bhi repo ke bahar
(`/api/...` endpoints, `{placeholder}` strings, commands) ignore hota hai.

## DB / Alembic
```bash
venv/bin/alembic upgrade head
venv/bin/python -c "from backend.shared.database import init_database; init_database()"
```

## Deploy (EC2 + Amplify)
```bash
./deploy_remote.sh stock.pem 54.165.116.67            # fast deploy
./deploy_remote.sh stock.pem 54.165.116.67 --update-python  # deps bhi update
# deploy: git reset --hard origin/main → venv → vite build → systemd restart → /api/health check
```
- Domain: https://stockoracle.duckdns.org, Amplify: https://main.d3qrmvw6hu9g61.amplifyapp.com
- EC2 service: `stockoracle.service` + Nginx. Logs: `logs/backend.log`, `logs/frontend.log`.

## Env
`backend/.env` me: ENV, PORT, Angel One keys, GEMINI_API_KEY, DATABASE_URL. Prod me JWT_SECRET + API_KEY set karo.
