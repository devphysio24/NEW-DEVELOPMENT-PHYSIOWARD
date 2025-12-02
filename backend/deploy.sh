#!/bin/bash

# WorkReadines Backend Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production --legacy-peer-deps

# Build TypeScript
echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
npm run build

# Check if build was successful
if [ ! -f dist/index.js ]; then
    echo -e "${RED}❌ Error: Build failed! dist/index.js not found${NC}"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 process if running
echo -e "${YELLOW}🛑 Stopping existing PM2 process...${NC}"
pm2 stop workreadines-backend 2>/dev/null || true
pm2 delete workreadines-backend 2>/dev/null || true

# Start with PM2
echo -e "${YELLOW}▶️  Starting with PM2...${NC}"
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Show status
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📝 Useful commands:"
echo "  pm2 logs workreadines-backend    # View logs"
echo "  pm2 monit                        # Monitor resources"
echo "  pm2 restart workreadines-backend # Restart app"
echo "  pm2 stop workreadines-backend    # Stop app"

