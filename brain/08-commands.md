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

## Tests (19 files in tests/)
```bash
venv/bin/pytest tests/ -q
venv/bin/pytest tests/test_data_invariants.py tests/test_database_invariants.py -v  # invariants
venv/bin/pytest tests/test_ws_broadcast_fallback.py tests/test_indicators.py -v
```

## Frontend tests (JS — CI me NAHI chalte)
<!-- check: frontend_tests=7 -->
```bash
cd frontend && npm test        # = node --test src/utils/*.test.js
```
- **7 `*.test.js` files**, sab `src/utils/` me — glob `package.json` me `src/utils/*.test.js` hai,
isliye test wahi rakho, warna chala hi nahi.
- Indicator/AI engine tests: `aiIndicatorEngine.test.js`, `indicatorEngine.test.js`, `aiSignalEngine.test.js` (+ `chartHelpers`, `volumeProfile`, `drawingGeometry`, `watchlist`).
- CI ka `frontend-ci` job sirf `npm run build` chalata hai — **`npm test` nahi**. Isliye JS unit tests
  locally chalana zaroori hai, warna red test chup-chaap commit ho jayega.

## Brain checker
```bash
python3 scripts/check_brain.py            # paths + counts verify (CI invariants job me bhi chalta hai)
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
