#!/bin/bash
# ==============================================================================
# StockOracle Pro — AWS EC2 Ubuntu Setup Script
# Run this script on your EC2 instance (Ubuntu 24.04 LTS recommended)
# Usage: chmod +x setup_ec2.sh && ./setup_ec2.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== [1/7] Updating system packages ==="
sudo apt-get update -y
sudo apt-get upgrade -y

echo "=== [2/7] Installing system dependencies ==="
sudo apt-get install -y python3-pip python3-dev python3-venv git nginx curl certbot python3-certbot-nginx build-essential libpq-dev

echo "=== [3/7] Setting up project directory ==="
sudo mkdir -p /var/www/stockoracle
sudo chown -R ubuntu:ubuntu /var/www/stockoracle
cd /var/www/stockoracle

echo "=== [4/7] Setting up Python Virtual Environment ==="
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
echo "Virtual environment ready at /var/www/stockoracle/venv"

echo "=== [5/7] Installing Node.js LTS (for building frontend optionally on EC2) ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== [6/7] Verifying installations ==="
python3 --version
node -v
npm -v
nginx -v

echo "=============================================================================="
echo " Setup Completed Successfully!"
echo " Next steps:"
echo " 1. Clone your repository into /var/www/stockoracle"
echo " 2. Activate virtualenv: source venv/bin/activate"
echo " 3. Install packages: pip install -r backend/requirements.txt"
echo " 4. Configure Nginx (/etc/nginx/sites-available/stockoracle)"
echo " 5. Run Certbot for SSL: sudo certbot --nginx"
echo "=============================================================================="
