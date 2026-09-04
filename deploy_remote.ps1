$sshKey = if (Test-Path "$PSScriptRoot\stockubu.pem") { "$PSScriptRoot\stockubu.pem" } else { "d:\Development\ai stock\stockubu.pem" }
$userHost = "ubuntu@stockoracle.duckdns.org"

$remoteCommand = @"
cd /var/www/stockoracle 2>/dev/null || cd ~/stockoracle-pro 2>/dev/null
echo "Pulling latest code from GitHub..."
if [ -f backend/.env ]; then sudo cp backend/.env /tmp/stockoracle_backend_env_backup; fi
sudo git fetch origin main
sudo git reset --hard origin/main
if [ -f /tmp/stockoracle_backend_env_backup ]; then sudo cp /tmp/stockoracle_backend_env_backup backend/.env; fi

echo "Updating frontend build..."
cd frontend
sudo npm install
sudo npm run build
cd ..

echo "Configuring Python virtual environment..."
if [ ! -f venv/bin/gunicorn ]; then
    sudo python3 -m venv venv
    sudo venv/bin/pip install --upgrade pip
    sudo venv/bin/pip install -r backend/requirements.txt
fi

echo "Setting permissions..."
sudo chown -R ubuntu:ubuntu /var/www/stockoracle 2>/dev/null || sudo chown -R ubuntu:ubuntu ~/stockoracle-pro 2>/dev/null

echo "Restarting systemd service..."
sudo systemctl restart stockoracle.service
sudo systemctl status stockoracle.service --no-pager
"@

ssh -o StrictHostKeyChecking=no -i $sshKey $userHost $remoteCommand
