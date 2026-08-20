#!/bin/bash
set -e

# AA MD Bot Support — Update Script
# Safely updates the application without destroying data

APP_DIR="/opt/aamd-support"
APP_USER="aamd"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

info "=== AA MD Bot Support Update ==="

cd "$APP_DIR"

# Pull latest code if git repo
if [ -d ".git" ]; then
  info "Pulling latest code..."
  git pull origin main || git pull origin master || warn "Could not pull — check your git remote"
else
  info "Not a git repo — skipping pull. Copy files manually if needed."
fi

# Preserve .env
info "Preserving .env..."
cp .env .env.backup.$(date +%s)

# Install dependencies
info "Installing backend dependencies..."
npm install --production=false

# Build backend
info "Building backend..."
npm run build

# Build dashboard
info "Building dashboard..."
cd dashboard
npm install
npm run build
cd "$APP_DIR"

# Set ownership
chown -R $APP_USER:$APP_USER "$APP_DIR"

# Restart service
info "Restarting PM2..."
pm2 reload aamd-support

# Health check
sleep 3
HEALTH=$(curl -s http://127.0.0.1:3000/health || echo '{"status":"error"}')
info "Health: $HEALTH"

info "Update complete!"
echo ""
echo "WhatsApp session and MongoDB data preserved."
echo "Check logs: pm2 logs aamd-support --lines 30"
