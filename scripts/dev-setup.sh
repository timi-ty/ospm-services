#!/bin/bash
set -e

echo "=== OSPM Phase 1 Local Setup ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v python3.11 >/dev/null 2>&1 || { echo "❌ Python 3.11 required (brew install python@3.11)"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL required (brew install postgresql)"; exit 1; }

PYTHON_CMD="python3.11"

# 1. PostgreSQL
echo ""
echo "=== PostgreSQL ==="
if pg_isready -q 2>/dev/null; then
    echo "✓ PostgreSQL is running"
else
    echo "Starting PostgreSQL..."
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
        echo "❌ Could not start PostgreSQL. Start it manually: brew services start postgresql"
        exit 1
    }
    sleep 2
fi

# Create database if not exists
if psql -lqt | cut -d \| -f 1 | grep -qw ospm; then
    echo "✓ Database 'ospm' exists"
else
    echo "Creating database 'ospm'..."
    createdb ospm
    echo "✓ Database 'ospm' created"
fi

# 2. Data Service
echo ""
echo "=== Data Service ==="
cd data-service

if [ ! -d "venv" ]; then
    echo "Creating Python 3.11 venv..."
    $PYTHON_CMD -m venv venv
fi

echo "Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt -q
echo "Installing Playwright Firefox..."
playwright install firefox
deactivate

cd ..

# 3. Environment file (must exist before Oracle migrations)
echo ""
echo "=== Environment ==="
if [ ! -f ".env" ]; then
    echo "Creating .env from env.example..."
    cp env.example .env
    echo "⚠️  Edit .env with your OPENAI_API_KEY"
else
    echo "✓ .env exists"
fi

# 4. Oracle
echo ""
echo "=== Oracle ==="
cd oracle

# Symlink root .env so Prisma can find DATABASE_URL
if [ ! -f ".env" ]; then
    ln -s ../.env .env
    echo "✓ Linked .env to oracle/"
fi

echo "Installing npm dependencies..."
npm install --silent

echo "Running Prisma migrations..."
npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate dev

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database with OSPM market..."
npm run db:seed

cd ..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Start services:"
echo ""
echo "  Terminal 1 (Data Service):"
echo "    cd data-service && source venv/bin/activate && python main.py"
echo ""
echo "  Terminal 2 (Oracle):"
echo "    cd oracle && npm run dev"
echo ""
echo "  Test:"
echo "    curl http://localhost:8000/health"
echo "    curl http://localhost:3001/health"
