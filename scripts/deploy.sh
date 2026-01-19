#!/bin/bash
# OSPM Deployment Script (Idempotent)
# Works on fresh Ubuntu VPS or existing server
set -e

echo "=== OSPM Deployment ==="

# ============================================
# PREREQUISITES (install only if missing)
# ============================================

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    IS_LINUX=true
else
    IS_LINUX=false
fi

# Node.js
if ! command -v node &>/dev/null; then
    echo "Installing Node.js 20..."
    if $IS_LINUX; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    else
        echo "Please install Node.js: https://nodejs.org"
        exit 1
    fi
else
    echo "✓ Node.js $(node -v)"
fi

# Python 3.11 (pinned version)
PYTHON_CMD="python3.11"
if ! command -v $PYTHON_CMD &>/dev/null; then
    echo "Installing Python 3.11..."
    if $IS_LINUX; then
        sudo apt install -y software-properties-common
        sudo add-apt-repository -y ppa:deadsnakes/ppa
        sudo apt update
        sudo apt install -y python3.11 python3.11-venv python3.11-dev
    else
        echo "Please install Python 3.11: brew install python@3.11"
        exit 1
    fi
else
    echo "✓ Python $($PYTHON_CMD --version)"
fi

# PostgreSQL
if ! command -v psql &>/dev/null; then
    echo "Installing PostgreSQL..."
    if $IS_LINUX; then
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl enable postgresql
    else
        echo "Please install PostgreSQL"
        exit 1
    fi
else
    echo "✓ PostgreSQL installed"
fi

# Start PostgreSQL (Linux)
if $IS_LINUX; then
    sudo systemctl start postgresql 2>/dev/null || true
fi

# Create database and user (idempotent - ignore "already exists" errors)
if $IS_LINUX; then
    echo "Ensuring database exists..."
    sudo -u postgres psql -c "CREATE USER ospm WITH PASSWORD 'ospm_secure_password';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE ospm OWNER ospm;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ospm TO ospm;" 2>/dev/null || true
fi

# PM2
if ! command -v pm2 &>/dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
else
    echo "✓ PM2 installed"
fi

# nginx (Linux only)
if $IS_LINUX; then
    if ! command -v nginx &>/dev/null; then
        echo "Installing nginx..."
        sudo apt install -y nginx
        sudo systemctl enable nginx
    else
        echo "✓ nginx installed"
    fi
fi

# Configure nginx reverse proxy
if $IS_LINUX; then
    echo "Configuring nginx reverse proxy..."
    sudo tee /etc/nginx/sites-available/ospm > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name ospm-services.waterleaf.ai;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
NGINXEOF

    # Enable site (remove default if exists, link ospm)
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf /etc/nginx/sites-available/ospm /etc/nginx/sites-enabled/ospm
    sudo nginx -t && sudo systemctl reload nginx
    echo "✓ nginx configured"
fi

# Swap (Linux only, 2GB - prevents OOM during builds)
if $IS_LINUX && [ ! -f /swapfile ]; then
    echo "Setting up swap..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✓ Swap created"
fi

# Playwright system dependencies (Linux only)
if $IS_LINUX; then
    if ! dpkg -l | grep -q libnss3; then
        echo "Installing Playwright dependencies..."
        sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
    fi
fi

# ============================================
# DEPLOYMENT
# ============================================

# Determine base directory
if [ -d "/home/ospm/ospm-services" ]; then
    BASE_DIR="/home/ospm/ospm-services"
else
    BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

echo ""
echo "=== Deploying from $BASE_DIR ==="

# Data Service
echo ""
echo "--- Data Service ---"
cd "$BASE_DIR/data-service"

if [ ! -d "venv" ]; then
    echo "Creating Python 3.11 venv..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate
echo "Installing Python dependencies..."
pip install -r requirements.txt --quiet
echo "Installing Playwright Firefox..."
playwright install firefox
deactivate

# Oracle Service
echo ""
echo "--- Oracle Service ---"
cd "$BASE_DIR/oracle"

echo "Installing npm dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

echo "Running Prisma migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
npm run db:seed

# Restart services with PM2
echo ""
echo "--- Starting Services ---"
cd "$BASE_DIR"
pm2 restart ecosystem.config.cjs --update-env 2>/dev/null || pm2 start ecosystem.config.cjs

# Health checks
echo ""
echo "--- Health Checks ---"
sleep 3
curl -sf http://localhost:8000/health >/dev/null && echo "✓ Data Service healthy" || echo "✗ Data Service not responding"
curl -sf http://localhost:3001/health >/dev/null && echo "✓ Oracle healthy" || echo "✗ Oracle not responding"

echo ""
echo "=== Deployment Complete ==="
