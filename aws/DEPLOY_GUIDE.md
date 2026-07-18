# ☁️ StockOracle Pro — AWS Deployment Guide

This guide details the step-by-step process of deploying the **StockOracle Pro** full-stack application using AWS.

---

## 🏗️ Deployment Architecture Recap

- **React Frontend**: Hosted on **AWS Amplify** (Fully managed CDN, SSL, static hosting).
- **FastAPI Backend & ML Model**: Runs on **EC2 (Ubuntu 24.04 LTS on c7i.large)** (2 vCPUs, 4 GiB RAM).
- **Process Manager**: Managed via `systemd` to run daemonized.
- **Reverse Proxy**: **Nginx** handles TLS termination (HTTPS) and proxies to Gunicorn on port 8000.
- **SSL Certificate**: Issued for free via **Let's Encrypt (Certbot)**.

---

## 🛠️ Step-by-Step Instructions

### Step 1: Launch your EC2 Instance
1. Log into your **AWS Management Console**.
2. Navigate to **EC2 Dashboard** and click **Launch Instance**.
3. Configure the following options:
   - **Name**: `stockoracle-backend`
   - **OS (AMI)**: `Ubuntu Server 24.04 LTS` (64-bit x86)
   - **Instance Type**: `c7i.large` (2 vCPUs, 4 GiB RAM, compute optimized)
   - **Key Pair**: Select or create a new key pair (`.pem`) and save it securely.
   - **Network Settings**:
     - Check **Allow SSH traffic from** and set it to **My IP** (highly secure).
     - Check **Allow HTTPS traffic from the internet**.
     - Check **Allow HTTP traffic from the internet**.
4. Click **Launch Instance**.

---

### Step 2: Configure Network & Security Group
1. In the EC2 console, go to **Network & Security** $\rightarrow$ **Elastic IPs**.
2. Click **Allocate Elastic IP address**, then click **Allocate**.
3. Select the allocated IP, click **Actions** $\rightarrow$ **Associate Elastic IP address**.
4. Choose your running `stockoracle-backend` instance and click **Associate**.
5. Note this IP down. (This will be your static API IP address).

---

### Step 3: Connect to EC2 & Run Setup Script
1. Open your local terminal or PowerShell and navigate to the directory containing your saved `.pem` key pair:
   ```bash
   chmod 400 your-key.pem
   ssh -i "your-key.pem" ubuntu@YOUR_ELASTIC_IP
   ```
2. Once connected, create the setup file and paste the contents of `aws/setup_ec2.sh` into it:
   ```bash
   nano setup_ec2.sh
   ```
   *(Paste content, press `Ctrl + O` then `Enter` to save, `Ctrl + X` to exit)*
3. Make the script executable and run it:
   ```bash
   chmod +x setup_ec2.sh
   ./setup_ec2.sh
   ```
   *This script installs Python 3.12 (the default system Python on Ubuntu 24.04), sets up a virtual environment, installs Node.js, Nginx, and Certbot.*

---

### Step 4: Clone & Configure Backend
1. Clone your project code inside the allocated directory:
   ```bash
   cd /var/www/stockoracle
   git clone YOUR_GITHUB_REPOSITORY_URL .
   ```
2. Activate the python virtual environment and install backend requirements:
   ```bash
   source venv/bin/activate
   pip install -r backend/requirements.txt
   ```
3. Set up your environment file:
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```
   Modify backend variables (like setting `ENV=production` and creating a secure random secret key).

---

### Step 5: Configure Nginx Reverse Proxy
1. Create a new Nginx block:
   ```bash
   sudo nano /etc/nginx/sites-available/stockoracle
   ```
2. Copy the contents of your project's `aws/nginx.conf` and paste them here.
   - Update `api.stockoracle.yourdomain.com` with your real domain/subdomain, or use your EC2 instance's public DNS string if you don't own a domain yet.
3. Link the site block and verify configurations:
   ```bash
   sudo ln -s /etc/nginx/sites-available/stockoracle /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default   # Remove default landing site
   sudo nginx -t                              # Check config syntax
   sudo systemctl restart nginx
   ```

---

### Step 6: Configure systemd Service
1. Create the systemd service file:
   ```bash
   sudo nano /etc/systemd/system/stockoracle.service
   ```
2. Copy the contents of `aws/stockoracle.service` into it.
3. Reload daemon, enable and start service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable stockoracle.service
   sudo systemctl start stockoracle.service
   ```
4. Verify service is running correctly:
   ```bash
   sudo systemctl status stockoracle.service
   ```

---

### Step 7: Enable SSL/HTTPS (Certbot)
If you have mapped a real domain name to your Elastic IP in your domain host (like Cloudflare or GoDaddy):
1. Run the Certbot Nginx automation utility:
   ```bash
   sudo certbot --nginx -d api.stockoracle.yourdomain.com
   ```
2. Follow the prompts. Certbot will configure the SSL certificates and update your Nginx file automatically.

---

### Step 8: Deploy Frontend to AWS Amplify
1. Log into your **AWS Console** and search for **AWS Amplify**.
2. Click **New App** $\rightarrow$ **Host web app**.
3. Choose **GitHub** and connect your account. Select your repository and the branch (e.g. `main`).
4. In build settings, Amplify will auto-detect the Vite React workspace configuration. Make sure target build command points to:
   - Base Directory: `frontend/dist`
   - Build Command: `npm run build`
5. In **Environment Variables** configuration, add:
   - `VITE_API_URL` = `https://api.stockoracle.yourdomain.com` (or your backend's HTTP path)
6. Click **Save and Deploy**.
7. Once the build completes, Amplify will provide you with a secure web URL (e.g. `https://main.xxxxxx.amplifyapp.com`) to access your app!
