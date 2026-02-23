# Stage 8: Production Deployment & Monitoring

> **Status:** 🔲 TODO  
> **Repos:** ospm-services, ospm-frontend  
> **Prerequisites:** All previous stages complete and tested locally  
> **Depends on:** Stages 1-7

---

## Objective

Deploy the complete platform to production infrastructure: backend services on AWS Lightsail VPS, frontend on Vercel, with SSL, monitoring, and automated deployments.

---

## What to Build

### 8.1 VPS Setup (AWS Lightsail)

Provision Ubuntu 22.04 instance (minimum 2GB RAM):

```bash
# System packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y postgresql postgresql-contrib nginx

# 2GB Swap (prevent build crashes on low-memory instances)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Python 3.11
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt install -y python3.11 python3.11-venv

# PM2
sudo npm install -g pm2

# Create ospm user
sudo useradd -m -s /bin/bash ospm
```

### 8.2 PostgreSQL Configuration

```bash
sudo -u postgres createdb ospm
sudo -u postgres psql -c "CREATE USER ospm WITH PASSWORD '<secure-password>';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ospm TO ospm;"
```

### 8.3 nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/ospm
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Oracle API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
    }
}
```

### 8.4 SSL Certificates (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 8.5 PM2 Ecosystem Configuration

Already exists as `ecosystem.config.cjs`. Verify it manages:
- `data-service` — Python FastAPI on port 8000
- `oracle` — Node.js on port 3001

### 8.6 Deployment Script Updates

Update `scripts/deploy.sh` to handle the full stack:
1. Pull latest code
2. Install/update Data Service dependencies (venv + pip)
3. Install/update Oracle dependencies (npm ci + prisma migrate deploy)
4. Build Oracle (TypeScript → JavaScript)
5. Restart both services via PM2
6. Run health checks
7. Report deployment status

### 8.7 GitHub Actions CI/CD

`.github/workflows/deploy-staging.yml`:
- Trigger: push to main, or manual dispatch
- SSH to VPS
- Run deploy.sh
- Post-deploy health check verification

Required secrets:
- `VPS_HOST` — Lightsail static IP
- `VPS_USER` — SSH user
- `VPS_SSH_KEY` — Private key

### 8.8 Frontend Deployment (Vercel)

1. Connect ospm-frontend repo to Vercel
2. Configure environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_PRIVY_APP_ID`
   - `NEXT_PUBLIC_ORACLE_URL` → `https://api.yourdomain.com`
   - `NEXT_PUBLIC_CHAIN_ID` → `84532`
   - `NEXT_PUBLIC_PLAY_TOKEN_ADDRESS`
   - `NEXT_PUBLIC_MARKET_FACTORY_ADDRESS`
   - `NEXT_PUBLIC_PAYMASTER_URL` (if using)
3. Deploy triggers on push to main

### 8.9 Database Backups

```bash
#!/bin/bash
# scripts/backup_db.sh
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="ospm_backup_${DATE}.sql.gz"

pg_dump $DATABASE_URL | gzip > "${BACKUP_DIR}/${FILENAME}"
find ${BACKUP_DIR} -type f -mtime +7 -delete
echo "Backup completed: ${FILENAME}"
```

Cron: daily at 3 AM
```
0 3 * * * ospm /home/ospm/scripts/backup_db.sh >> /var/log/ospm/backup.log 2>&1
```

### 8.10 Monitoring

**Uptime Monitoring:**
- Set up UptimeRobot or Better Stack for:
  - `https://api.yourdomain.com/health` (Oracle)
  - `https://yourdomain.com` (Frontend)
- Alert on downtime via email/Telegram

**PM2 Monitoring:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Error Tracking (optional):**
- Add Sentry to frontend and oracle for error reporting

### 8.11 Security Hardening

- UFW firewall: allow only 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Fail2ban for SSH brute force protection
- PostgreSQL listens on localhost only
- Data Service (port 8000) not exposed to internet (only Oracle accesses it)
- Oracle API protected by rate limiting and CORS
- Environment variables never in git

---

## Completion Criteria

### VPS Health

```bash
# SSH to VPS
ssh ospm@<VPS_IP>

# Services running
pm2 status
# → data-service: online
# → oracle: online

# Health checks
curl http://localhost:8000/health
# → {"status":"healthy"}

curl http://localhost:3001/health
# → {"status":"ok"}
```

### Public API Access

```bash
# From external machine (not VPS)
curl https://api.yourdomain.com/health
# → {"status":"ok"}

curl https://api.yourdomain.com/api/markets
# → Markets JSON array

# HTTP redirects to HTTPS
curl -I http://api.yourdomain.com
# → 301 → https://api.yourdomain.com
```

### Frontend Deployed

```
BROWSER TEST:
1. Navigate to https://yourdomain.com (Vercel URL)
2. Homepage loads with markets
3. Markets fetched from https://api.yourdomain.com
4. Auth works (sign in/out)
5. Trading works (if market is open)
6. No mixed content warnings (all HTTPS)
```

### SSL Verification

```bash
# Certificate valid
curl -vI https://api.yourdomain.com 2>&1 | grep "SSL certificate"
# → SSL certificate verify ok

# No SSL errors in browser console
```

### CI/CD Pipeline

```bash
# Push to main branch
git push origin main

# GitHub Action triggers and deploys
# Check Actions tab: deploy-staging workflow succeeds

# VPS has latest code
ssh ospm@<VPS_IP> "cd /home/ospm/ospm-services && git log -1 --oneline"
# → Latest commit
```

### Database

```bash
# Database accessible
ssh ospm@<VPS_IP>
psql $DATABASE_URL -c "SELECT count(*) FROM \"Market\";"
# → Number (may be 0 if freshly deployed)

# Migrations applied
cd /home/ospm/ospm-services/oracle
npx prisma migrate status
# → All migrations applied
```

### Monitoring

```bash
# Uptime monitor configured and reporting
# Check UptimeRobot/Better Stack dashboard
# → api.yourdomain.com: UP
# → yourdomain.com: UP

# PM2 logs rotating
ls -la /home/ospm/.pm2/logs/
# → Log files present, not growing unbounded
```

### Security

```bash
# Firewall active
sudo ufw status
# → 22/tcp ALLOW, 80/tcp ALLOW, 443/tcp ALLOW

# Data Service not externally accessible
curl http://<VPS_IP>:8000/health  # From external
# → Connection refused (port not exposed)

# PostgreSQL not externally accessible
psql postgresql://ospm:pass@<VPS_IP>:5432/ospm  # From external
# → Connection refused
```

---

## Key Design Notes

- Use Lightsail static IP (not dynamic) for DNS records
- Domain DNS: A record for `api.yourdomain.com` → Lightsail IP, CNAME for `yourdomain.com` → Vercel
- PM2 startup: `pm2 startup` + `pm2 save` ensures services restart on VPS reboot
- Oracle wallet (ORACLE_PRIVATE_KEY) must be funded with Base Sepolia ETH on the VPS
- OPENAI_API_KEY must be set on VPS for Data Service AI generation
- First deployment may need manual `npx prisma migrate deploy` before PM2 starts Oracle
- Vercel auto-deploys on push — no manual action needed for frontend
- Keep Lightsail instance size appropriate: 2GB RAM minimum, 4GB recommended for production
