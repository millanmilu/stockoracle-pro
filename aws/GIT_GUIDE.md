# 🐙 StockOracle Pro — Complete Git & GitHub Guide

This guide walks you through setting up Git, pushing your project code securely to GitHub, and linking it to AWS.

---

## 🛠️ Step 1: Install Git (If not already installed)
1. Download Git from 👉 **[git-scm.com/downloads](https://git-scm.com/downloads)**
2. Install it with default settings.
3. Open **PowerShell** and verify installation:
   ```powershell
   git --version
   ```

---

## 🔒 Step 2: Create a `.gitignore` File
We must **never** upload virtual environments, node modules, temporary files, or sensitive configuration keys (like database credentials or API secrets in `.env`) to GitHub.

Create a file named `.gitignore` in your project root (`d:\Development\ai stock\.gitignore`):

```git
# Virtual Environment
venv/
ENV/
.venv/
bin/
lib/
share/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
dist/

# Python cache & temporary files
__pycache__/
*.pyc
*.pyo
*.pyd
.pytest_cache/
.cache/

# Environment configurations and Secrets
.env
.env.local
.env.production
*.pem
*.key

# Local Databases & ML weights
*.db
*.sqlite
*.sqlite3
backend/ml/saved_models/*.pt

# OS specific files
.DS_Store
Thumbs.db
```

---

## 🚀 Step 3: Initialize Git Locally & Make First Commit
Open your terminal (PowerShell) in the project directory (`d:\Development\ai stock`) and run:

1. **Initialize Git local repository**:
   ```powershell
   git init
   ```
2. **Add all files to stage** (Git will auto-ignore files listed in `.gitignore`):
   ```powershell
   git add .
   ```
3. **Check status** to verify that virtualenv (`venv`) and `.env` are NOT added:
   ```powershell
   git status
   ```
4. **Create your first commit**:
   ```powershell
   git commit -m "First commit: Initializing StockOracle Pro full-stack app with AWS setup"
   ```

---

## 🌐 Step 4: Create Repository on GitHub & Link It
1. Go to 👉 **[github.com](https://github.com)** and log in.
2. Click the **"+"** icon in the top-right corner $\rightarrow$ **New repository**.
3. Configure the following:
   - **Repository name**: `stockoracle-pro`
   - **Public/Private**: Select **Private** (recommended to keep your predictions and logs secure).
   - Do **NOT** check "Add a README file", "Add .gitignore", or "Choose a license" (we already have our own).
4. Click **Create repository**.
5. Copy the command listed under **"…or push an existing repository from the command line"**:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/stockoracle-pro.git
   git branch -M main
   git push -u origin main
   ```
   *(Run these three commands in your local PowerShell inside `d:\Development\ai stock`)*

---

## 🔁 Step 5: Updating Code in the Future
Whenever you make changes to your local code, push them to GitHub with these three commands:

```powershell
git add .
git commit -m "Added a cool new feature / fixed a bug"
git push origin main
```

---

## ☁️ Step 6: How AWS Uses GitHub

### 1. Frontend (AWS Amplify)
- AWS Amplify connects to your GitHub account.
- It detects when you `git push` new changes to the `main` branch.
- Amplify automatically builds the React code and deploys it live in 2 minutes. **No manual server updating needed.**

### 2. Backend (AWS EC2)
- To update your backend on EC2, SSH into your server:
  ```bash
  ssh -i "key.pem" ubuntu@YOUR_ELASTIC_IP
  cd /var/www/stockoracle
  ```
- Pull the latest changes from GitHub:
  ```bash
  git pull origin main
  ```
- Restart the systemd service to apply the code changes:
  ```bash
  sudo systemctl restart stockoracle.service
  ```
