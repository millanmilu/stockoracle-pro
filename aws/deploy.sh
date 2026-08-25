#!/bin/bash
# ==============================================================================
# StockOracle Pro — One-Command Deploy Script
# Run on EC2: chmod +x aws/deploy.sh && bash aws/deploy.sh
# ==============================================================================

set -e

PROJECT_DIR="/var/www/stockoracle"
VENV_BIN="$PROJECT_DIR/venv/bin"
SERVICE="stockoracle"
ENV_FILE="$PROJECT_DIR/backend/.env"

cd "$PROJECT_DIR"

echo ""
echo "============================================================"
echo "   StockOracle Pro — Deploying Latest Build"
echo "============================================================"
echo ""

# Step 1: Pull latest code
echo "[1/5] Pulling latest code from GitHub..."
git pull origin main
echo "OK: Code updated."

# Step 2: Install/update Python packages
echo ""
echo "[2/5] Installing/updating Python dependencies..."
source "$VENV_BIN/activate"
pip install -r backend/requirements.txt --quiet
echo "OK: Python packages up to date."

# Step 3: Check GEMINI_API_KEY
echo ""
echo "[3/5] Checking environment variables..."
if [ -f "$ENV_FILE" ]; then
    if grep -qE "^GEMINI_API_KEY=.+" "$ENV_FILE"; then
        echo "OK: GEMINI_API_KEY is set."
    else
        echo "WARNING: GEMINI_API_KEY is missing in $ENV_FILE"
        echo "  Get free key at: https://aistudio.google.com/app/apikey"
        echo "  Add line:  GEMINI_API_KEY=your_key_here"
        echo "  AI Chat will show config message until this is added."
    fi
else
    echo "WARNING: $ENV_FILE not found."
    echo "  Run: cp $PROJECT_DIR/backend/.env.example $ENV_FILE"
    echo "  Then fill in your credentials."
fi

# Step 4: Restart backend service
echo ""
echo "[4/5] Restarting stockoracle service..."
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"
sleep 2
STATUS=$(sudo systemctl is-active "$SERVICE")
if [ "$STATUS" = "active" ]; then
    echo "OK: Backend service is RUNNING."
else
    echo "ERROR: Service status: $STATUS"
    echo "  Logs: sudo journalctl -u $SERVICE -n 30 --no-pager"
    exit 1
fi

# Step 5: Health check
echo ""
echo "[5/5] Running health check..."
sleep 1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "OK: API health check passed (HTTP 200)."
else
    echo "NOTE: Health check returned HTTP $HTTP_CODE (may still be starting)"
fi

echo ""
echo "============================================================"
echo "  DEPLOY COMPLETE — StockOracle is LIVE"
echo "============================================================"
echo ""
echo "  Backend:  https://stockoracle.duckdns.org"
echo "  Frontend: https://main.d3qrmvw6hu9g61.amplifyapp.com"
echo ""
echo "  New features:"
echo "  - AI Chat: right rail (chat icon) + Sidebar > AI Chat"
echo "  - Fundamentals: Sidebar > Fundamentals and Options"
echo "  - Options Chain: Sidebar > Fundamentals and Options"
echo "  - Portfolio: Sidebar > Portfolio"
echo ""
echo "  IMPORTANT: Add GEMINI_API_KEY to backend/.env for AI features!"
echo ""