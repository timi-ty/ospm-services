#!/bin/bash
set -e

echo "=== Resetting OSPM Database ==="

# 1. Drop all tables (Prisma reset)
echo "Dropping all tables..."
npx prisma migrate reset --force --skip-seed

# 2. Apply current schema
echo "Applying schema..."
npx prisma db push

# 3. Seed database
echo "Seeding..."
npm run db:seed

echo "✓ Database reset complete"
