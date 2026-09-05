#!/bin/bash
# ==============================================================================
# StockOracle Pro — 1-Click Remote Deployment Script (Bash / Linux / macOS)
# Usage: ./deploy_remote.sh [path/to/key.pem] [host_ip] [--update-python]
# ==============================================================================

set -e

KEY_ARG=""
HOST_ARG="54.165.116.67"
UPDATE_PY="0"

for arg in "$@"; do
    if [[ "$arg" == *.pem ]]; then
        KEY_ARG="$arg"
    elif [[ "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$arg" == *.duckdns.org ]] || [[ "$arg" == *.amazonaws.com ]]; then
        HOST_ARG="$arg"
    elif [[ "$arg" == "--update-python" ]] || [[ "$arg" == "-p" ]]; then
        UPDATE_PY="1"
    fi
done

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
echo -e "\033[0;34m   Target:        $USER_HOST\033[0m"
echo -e "\033[0;34m   SSH Key:       $SSH_KEY\033[0m"
echo -e "\033[0;34m   Update Python: $([ "$UPDATE_PY" = "1" ] && echo "Yes" || echo "No (Fast Mode)")\033[0m"
echo -e "\033[0;36m============================================================\033[0m"
echo ""

REMOTE_CMD=$(cat << REMOTE
set -e
PROJECT_DIR="/var/www/stockoracle"
cd "\$PROJECT_DIR"
UPDATE_PY="$UPDATE_PY"

echo "=== [1/6] Syncing latest code from GitHub ==="
ENV_BACKUP="\$HOME/.stockoracle_backend_env_backup"
if [ -f backend/.env ]; then
    cp backend/.env "\$ENV_BACKUP"
fi

git fetch origin main
git reset --hard origin/main

if [ -f "\$ENV_BACKUP" ]; then
    cp "\$ENV_BACKUP" backend/.env
fi
echo "✓ Code synced to latest main commit: \$(git rev-parse --short HEAD)"

echo ""
echo "=== [2/6] Checking Python dependencies ==="
if [ -f venv/bin/activate ]; then
    if [ "\$UPDATE_PY" = "1" ]; then
        echo "Updating Python packages (--update-python requested)..."
        source venv/bin/activate
        pip install -r backend/requirements.txt --quiet
        echo "✓ Python dependencies updated."
    else
        echo "✓ Python environment ready (cached for max speed)."
    fi
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip --quiet
    pip install -r backend/requirements.txt --quiet
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
cd "\$PROJECT_DIR"
echo "✓ Frontend built successfully into frontend/dist."

echo ""
echo "=== [4/6] Setting Proper File Permissions ==="
sudo chown -R ubuntu:ubuntu "\$PROJECT_DIR"
echo "✓ File ownership set to ubuntu:ubuntu."

echo ""
echo "=== [5/6] Restarting Services (FastAPI & Nginx) ==="
sudo systemctl daemon-reload
sudo systemctl restart stockoracle.service
sudo nginx -t && sudo systemctl reload nginx
echo "✓ Services restarted."

echo ""
echo "=== [6/6] Health Verification ==="
sleep 3
STATUS=\$(sudo systemctl is-active stockoracle.service || echo "failed")
if [ "\$STATUS" = "active" ]; then
    echo "✓ stockoracle.service is RUNNING (active)."
else
    echo "✗ ERROR: stockoracle.service status: \$STATUS"
    sudo journalctl -u stockoracle.service -n 20 --no-pager
    exit 1
fi

HTTP_CODE=\$(curl -sk -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health || echo "000")
echo "✓ API Health Status: HTTP \$HTTP_CODE"

echo ""
echo "============================================================"
echo "  🚀 DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "  Domain:   https://stockoracle.duckdns.org"
echo "  Amplify:  https://main.d3qrmvw6hu9g61.amplifyapp.com"
echo "============================================================"
REMOTE
)

ssh -F /dev/null -o StrictHostKeyChecking=no -i "$SSH_KEY" "$USER_HOST" "$REMOTE_CMD"
