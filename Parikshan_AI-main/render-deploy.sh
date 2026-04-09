#!/bin/bash

# Render Deployment Fix Script
# This script addresses common deployment issues on Render

echo "🔧 Prashnakosh Render Deployment Fix"
echo "======================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it in your Render dashboard under Environment Variables"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Check Node version
echo "📦 Node version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Push database schema (creates tables if they don't exist)
echo "🗄️ Pushing database schema..."
npm run db:push

# Build the application
echo "🏗️ Building application..."
npm run build

echo "✅ Build complete!"
echo ""
echo "To start the server, run: npm run start"
echo "The app will be available on port $PORT (or 5000 if PORT is not set)"
