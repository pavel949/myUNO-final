#!/bin/bash

# Fix script for stuck Prisma migration
# Usage: ./scripts/fix-migration.sh

set -e

echo "🔧 Fixing Prisma migration issue..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env with DATABASE_URL pointing to your Supabase database"
    exit 1
fi

echo "📋 Checking database connection..."
npx prisma db execute --stdin < /dev/null 2>/dev/null && echo "✅ Database connected" || {
    echo "⚠️  Warning: Cannot connect to database"
    echo "Make sure your DATABASE_URL in .env is correct and the database is running"
    exit 1
}

echo ""
echo "🔄 Resolving migration 1_add_analytics_tables..."
npx prisma migrate resolve --rolled-back 1_add_analytics_tables

echo ""
echo "✅ Migration resolved!"
echo "Running: npm run build to verify..."
npm run build

echo ""
echo "🎉 Done! Everything is fixed!"
