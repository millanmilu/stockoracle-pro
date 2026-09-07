#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

mkdir -p "$PROJECT_DIR/logs"
export PATH="$PROJECT_DIR/.bin/bin:$PATH"

echo "============================================================"
echo "  Starting StockOracle Pro (Local Mode)"
echo "============================================================"

# Stop any lingering instances
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
sleep 1

# 1. Launch FastAPI Backend
echo "[1/2] Starting Backend on http://127.0.0.1:8000 ..."
nohup "$PROJECT_DIR/venv/bin/uvicorn" backend.main:app --host 127.0.0.1 --port 8000 </dev/null > "$PROJECT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID
echo "Backend launched (PID: $BACKEND_PID). Logs: logs/backend.log"

# 2. Launch Vite Frontend Dev Server
echo "[2/2] Starting Frontend on http://localhost:5173 ..."
cd "$PROJECT_DIR/frontend"
nohup node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 </dev/null > "$PROJECT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
disown $FRONTEND_PID
echo "Frontend launched (PID: $FRONTEND_PID). Logs: logs/frontend.log"
cd "$PROJECT_DIR"

echo ""
echo "Waiting for services to initialize..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
        echo "✓ Backend is UP and Healthy!"
        break
    fi
    sleep 1
done

echo ""
echo "============================================================"
echo "  StockOracle Pro is RUNNING LOCALLY"
echo "  Frontend URL: http://localhost:5173"
echo "  Backend API:  http://127.0.0.1:8000"
echo "  API Docs:     http://127.0.0.1:8000/docs"
echo "============================================================"
