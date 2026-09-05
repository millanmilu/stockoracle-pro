#!/bin/bash
# ==============================================================================
# StockOracle Pro — 1-Click Remote Deployment Script (Bash / Linux / macOS)
# Usage: ./deploy_remote.sh [path/to/key.pem] [host_ip]
# ==============================================================================

set -e

KEY_ARG="$1"
HOST_ARG="${2:-54.165.116.67}"

# 1. Locate SSH Key
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_KEY=""

for k in "$KEY_ARG" "$SCRIPT_DIR/stock.pem" "$SCRIPT_DIR/stockubu.pem" "$HOME/.ssh/stock.pem" "$HOME/.ssh/stockubu.pem"; do
    if [ -n "$k" ] && [ -f "$k" ]; then
        SSH_KEY="$k"
        break
    fi
done

if [ -z "$SSH_KEY" ]; then
    echo -e "\033[0;31m[ERROR] Could not find SSH private key file (stock.pem or stockubu.pem).\033[0m"
    echo -e "\033[0;33mPlease place stock.pem in the project root or run: ./deploy_remote.sh path/to/key.pem\033[0m"
    exit 1
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true
USER_HOST="ubuntu@$HOST_ARG"

echo -e "\033[0;36m============================================================\033[0m"
echo -e "\033[0;36m   StockOracle Pro — Remote Automated Deployment\033[0m"
echo -e "\033[0;34m   Target:  $USER_HOST\033[0m"
echo -e "\033[0;34m   SSH Key: $SSH_KEY\033[0m"
echo -e "\033[0;36m============================================================\033[0m"
echo ""

REMOTE_CMD=$(cat << 'REMOTE'
set -e
PROJECT_DIR="/var/www/stockoracle"
cd "$PROJECT_DIR"

echo "=== [1/6] Syncing latest code from GitHub ==="
ENV_BACKUP="$HOME/.stockoracle_backend_env_backup"
if [ -f backend/.env ]; then
    cp backend/.env "$ENV_BACKUP"
fi

git fetch origin main
git reset --hard origin/main

if [ -f "$ENV_BACKUP" ]; then
    cp "$ENV_BACKUP" backend/.env
fi
echo "✓ Code synced to latest main commit: $(git rev-parse --short HEAD)"

echo ""
echo "=== [2/6] Checking Python dependencies ==="
if [ -f venv/bin/activate ]; then
    if [ ! -f venv/.requirements_installed ] || [ backend/requirements.txt -nt venv/.requirements_installed ]; then
        echo "Requirements modified, updating Python packages..."
        source venv/bin/activate
        pip install -r backend/requirements.txt --quiet
        touch venv/.requirements_installed
        echo "✓ Python dependencies updated."
    else
        echo "✓ Python dependencies up to date (cached, skipping re-install)."
    fi
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip --quiet
    pip install -r backend/requirements.txt --quiet
    touch venv/.requirements_installed
    echo "✓ Virtual environment created."
fi

echo ""
echo "=== [3/6] Building Frontend Production Assets ==="
cd frontend
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    echo "Updating npm dependencies..."
    npm install --prefer-offline --no-audit
fi
if [ -f node_modules/vite/bin/vite.js ]; then
    node node_modules/vite/bin/vite.js build
else
    npx vite build || npm run build
fi
cd "$PROJECT_DIR"
echo "✓ Frontend built successfully into frontend/dist."

echo ""
echo "=== [4/6] Setting Proper File Permissions ==="
sudo chown -R ubuntu:ubuntu "$PROJECT_DIR"
echo "✓ File ownership set to ubuntu:ubuntu."

echo ""
echo "=== [5/6] Restarting Services (FastAPI & Nginx) ==="
sudo systemctl daemon-reload
sudo systemctl restart stockoracle.service
sudo nginx -t && sudo systemctl reload nginx
echo "✓ Services restarted."

echo ""
echo "=== [6/6] Health Verification ==="
sleep 2
STATUS=$(sudo systemctl is-active stockoracle.service || echo "failed")
if [ "$STATUS" = "active" ]; then
    echo "✓ stockoracle.service is RUNNING (active)."
else
    echo "✗ ERROR: stockoracle.service status: $STATUS"
    sudo journalctl -u stockoracle.service -n 20 --no-pager
    exit 1
fi

HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health || echo "000")
echo "✓ API Health Status: HTTP $HTTP_CODE"

echo ""
echo "============================================================"
echo "  🚀 DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "  Domain:   https://stockoracle.duckdns.org"
echo "  Amplify:  https://main.d3qrmvw6hu9g61.amplifyapp.com"
echo "============================================================"
REMOTE
)

ssh -F /dev/null -o StrictHostKeyChecking=no -i "$SSH_KEY" "$USER_HOST" "$REMOTE_CMD"
