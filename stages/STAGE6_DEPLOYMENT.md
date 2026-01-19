# Stage 6: Deployment Workflow

> **Target:** AWS Lightsail VPS  
> **CI:** GitHub Actions  
> **Process Manager:** PM2

---

## Purpose

Deploy Data Service + Oracle to VPS. Single shell script handles everything.

---

## What We're Deploying (Phase 1 Only)

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Database |
| Data Service | 8000 | Python crawler + AI |
| Oracle | 3001 | API + orchestrator |

**NOT deploying:** Contracts, nginx SSL (local/staging only), frontend (separate repo).

---

## GitHub Action

```yaml
# .github/workflows/deploy-staging.yml

name: Deploy Staging

on:
  push:
    branches: [main]
  workflow_dispatch:  # Manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /home/ospm/ospm-services
            git pull origin main
            ./scripts/deploy.sh
```

**Required secrets:**
- `VPS_HOST` - Lightsail IP
- `VPS_USER` - SSH user (e.g., `ospm`)
- `VPS_SSH_KEY` - Private key

---

## Deploy Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "=== OSPM Phase 1 Deployment ==="

# 1. PostgreSQL (skip if already running)
if ! systemctl is-active --quiet postgresql; then
    echo "Starting PostgreSQL..."
    sudo systemctl start postgresql
fi

# 2. Data Service
echo "Deploying Data Service..."
cd /home/ospm/ospm-services/data-service

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate

# 3. Oracle Service
echo "Deploying Oracle..."
cd /home/ospm/ospm-services/oracle
npm ci --production --silent
npx prisma migrate deploy
npx prisma generate

# 4. Restart services with PM2
echo "Restarting services..."
cd /home/ospm/ospm-services
pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js

# 5. Health check
sleep 3
curl -sf http://localhost:8000/health > /dev/null && echo "✓ Data Service healthy" || echo "✗ Data Service failed"
curl -sf http://localhost:3001/health > /dev/null && echo "✓ Oracle healthy" || echo "✗ Oracle failed"

echo "=== Deployment complete ==="
```

---

## PM2 Ecosystem

```javascript
// ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'data-service',
      cwd: './data-service',
      script: './venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000',
      interpreter: 'none',
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      },
    },
    {
      name: 'oracle',
      cwd: './oracle',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: process.env.DATABASE_URL,
        DATA_SERVICE_URL: 'http://localhost:8000',
      },
    },
  ],
};
```

---

## VPS Initial Setup (One-time)

```bash
# Run once on fresh Lightsail instance

# 1. System packages
sudo apt update && sudo apt install -y nodejs npm postgresql python3-venv

# 2. Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. PM2
sudo npm install -g pm2

# 4. Create ospm user + clone repo
sudo useradd -m ospm
sudo -u ospm git clone https://github.com/yourorg/ospm-services.git /home/ospm/ospm-services

# 5. PostgreSQL database
sudo -u postgres createdb ospm
sudo -u postgres psql -c "CREATE USER ospm WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ospm TO ospm;"

# 6. Environment file
cp /home/ospm/ospm-services/.env.example /home/ospm/ospm-services/.env
# Edit .env with actual values
```

---

## Environment Variables (VPS)

```env
# /home/ospm/ospm-services/.env

# Database
DATABASE_URL=postgresql://ospm:password@localhost:5432/ospm

# Data Service
OPENAI_API_KEY=sk-...

# Oracle
PORT=3001
DATA_SERVICE_URL=http://localhost:8000
NODE_ENV=production
```

---

## Monitoring Commands

```bash
# View all services
pm2 status

# View logs
pm2 logs data-service
pm2 logs oracle

# Restart single service
pm2 restart oracle

# View detailed metrics
pm2 monit
```

---

## Rollback

```bash
# If deployment fails
cd /home/ospm/ospm-services
git checkout HEAD~1
./scripts/deploy.sh
```

---

## Success Criteria

```
✓ Push to main triggers GitHub Action
✓ VPS pulls latest code
✓ Data Service running on :8000
✓ Oracle running on :3001
✓ Both services pass health checks
✓ pm2 status shows both "online"
```
