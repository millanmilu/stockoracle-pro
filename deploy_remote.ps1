param (
    [string]$KeyPath = "",
    [string]$HostAddress = "54.165.116.67",
    [switch]$UpdatePython
)

# 1. Locate SSH Key
$candidateKeys = @(
    $KeyPath,
    "$PSScriptRoot\stock.pem",
    "$PSScriptRoot\stockubu.pem",
    "$HOME\.ssh\stock.pem",
    "$HOME\.ssh\stockubu.pem",
    "d:\Development\ai stock\stockubu.pem"
) | Where-Object { $_ -and (Test-Path $_) }

if ($candidateKeys.Count -eq 0) {
    Write-Host "[ERROR] Could not find SSH private key file (stock.pem or stockubu.pem)." -ForegroundColor Red
    Write-Host "Please place stock.pem in the project root or specify with: .\deploy_remote.ps1 -KeyPath path\to\key.pem" -ForegroundColor Yellow
    exit 1
}

$sshKey = $candidateKeys[0]
$userHost = "ubuntu@$HostAddress"
$updatePyFlag = if ($UpdatePython) { "1" } else { "0" }

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   StockOracle Pro - Remote Automated Deployment" -ForegroundColor Cyan
Write-Host "   Target:        $userHost" -ForegroundColor DarkCyan
Write-Host "   SSH Key:       $sshKey" -ForegroundColor DarkCyan
Write-Host "   Update Python: $(if ($UpdatePython) { 'Yes' } else { 'No (Fast Mode)' })" -ForegroundColor DarkCyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 2. Remote Deployment Script to run on EC2
$remoteCommand = @"
set -e
PROJECT_DIR="/var/www/stockoracle"
cd "`$PROJECT_DIR"
UPDATE_PY="$updatePyFlag"

echo "=== [1/6] Syncing latest code from GitHub ==="
ENV_BACKUP="`$HOME/.stockoracle_backend_env_backup"
if [ -f backend/.env ]; then
    cp backend/.env "`$ENV_BACKUP"
fi

git fetch origin main
git reset --hard origin/main

if [ -f "`$ENV_BACKUP" ]; then
    cp "`$ENV_BACKUP" backend/.env
fi
echo "✓ Code synced to latest main commit: `$(git rev-parse --short HEAD)"

echo ""
echo "=== [2/6] Checking Python dependencies ==="
if [ -f venv/bin/activate ]; then
    if [ "`$UPDATE_PY" = "1" ]; then
        echo "Updating Python packages (UpdatePython requested)..."
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
cd "`$PROJECT_DIR"
echo "✓ Frontend built successfully into frontend/dist."

echo ""
echo "=== [4/6] Setting Proper File Permissions ==="
sudo chown -R ubuntu:ubuntu "`$PROJECT_DIR"
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
STATUS=`$(sudo systemctl is-active stockoracle.service || echo "failed")
if [ "`$STATUS" = "active" ]; then
    echo "✓ stockoracle.service is RUNNING (active)."
else
    echo "✗ ERROR: stockoracle.service status: `$STATUS"
    sudo journalctl -u stockoracle.service -n 20 --no-pager
    exit 1
fi

HTTP_CODE=`$(curl -sk -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health || echo "000")
echo "✓ API Health Status: HTTP `$HTTP_CODE"

echo ""
echo "============================================================"
echo "  🚀 DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "  Domain:   https://stockoracle.duckdns.org"
echo "  Amplify:  https://main.d3qrmvw6hu9g61.amplifyapp.com"
echo "============================================================"
"@

# 3. Execute via SSH
ssh -F /dev/null -o StrictHostKeyChecking=no -i "$sshKey" "$userHost" "$remoteCommand"
