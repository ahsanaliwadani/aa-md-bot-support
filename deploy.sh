#!/bin/bash
set -e

# AA MD Bot Support — Deployment Script
# Safe to run multiple times — preserves existing data, sessions, and .env

APP_DIR="/opt/aamd-support"
APP_USER="aamd"
DEFAULT_PORT="7000"
MONGO_USER="aamduser"
MONGO_DB="aamd_support"
MONGO_CONTAINER="aamd-mongo"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root or sudo
if [ "$EUID" -ne 0 ]; then
  warn "Not running as root. Some steps may fail. Try: sudo ./deploy.sh"
fi

# Detect Ubuntu
if ! grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
  warn "This script is designed for Ubuntu. Proceeding anyway..."
fi

info "=== AA MD Bot Support Deployment ==="

# ─── 1. Install system dependencies ───
info "Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl git ufw nginx software-properties-common rsync openssl ca-certificates

# ─── 2. Install Node.js LTS ───
if ! command -v node &> /dev/null; then
  info "Installing Node.js LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
info "Node.js version: $(node -v)"

# ─── 3. Install PM2 ───
if ! command -v pm2 &> /dev/null; then
  info "Installing PM2..."
  npm install -g pm2
fi

# ─── 4. Install Docker ───
if ! command -v docker &> /dev/null; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi
info "Docker version: $(docker --version)"

# ─── 5. Create application user ───
if ! id "$APP_USER" &> /dev/null; then
  info "Creating application user: $APP_USER"
  useradd --system --create-home --home-dir /home/$APP_USER --shell /bin/bash $APP_USER
fi

# ─── 6. Create application directory ───
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/sessions" "$APP_DIR/backups" "$APP_DIR/logs" "$APP_DIR/mongodb/data"

# Copy project files if we're in the source directory and not already inside APP_DIR
if [ -f "./package.json" ] && [ -d "./src" ]; then
  SRC_DIR=$(pwd -P)
  DEST_DIR=$(mkdir -p "$APP_DIR" && cd "$APP_DIR" && pwd -P)
  if [ "$SRC_DIR" != "$DEST_DIR" ]; then
    info "Copying project files to $APP_DIR..."
    rsync -a --exclude node_modules --exclude .git --exclude dashboard/node_modules --exclude dashboard/dist --exclude dist ./ "$APP_DIR/"
  else
    info "Already running from $APP_DIR — skipping self-copy."
  fi
fi

# ─── 7. Generate .env if not exists ───
if [ ! -f "$APP_DIR/.env" ]; then
  info "Generating .env with secure secrets..."

  JWT_SECRET=$(openssl rand -hex 32)
  SESSION_SECRET=$(openssl rand -hex 32)
  MONGO_PASS=$(openssl rand -hex 24)
  PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  APP_PUBLIC_URL="http://${PUBLIC_IP}"

  cat > "$APP_DIR/.env" << EOF
NODE_ENV=production
PORT=$DEFAULT_PORT
DASHBOARD_URL=$APP_PUBLIC_URL
APP_URL=$APP_PUBLIC_URL
LOG_LEVEL=info

MONGODB_URI=mongodb://$MONGO_USER:$MONGO_PASS@127.0.0.1:27017/$MONGO_DB?authSource=admin
MONGODB_DB_NAME=$MONGO_DB

JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
ACCESS_KEY_SECRET=Ahsan&ali12:@
COOKIE_SECURE=false

ADMIN_EMAIL=owner@aamdbot.com
ADMIN_PASSWORD=ChangeMe2026!

SUPPORT_NUMBER=+923316041183
BOT_NAME=AA MD BOT

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
SESSION_TIMEOUT_MINUTES=10
BACKUP_KEEP=7
EOF

  chmod 600 "$APP_DIR/.env"
  info ".env generated. EDIT $APP_DIR/.env to set your domain/admin password and set COOKIE_SECURE=true after HTTPS!"
else
  info ".env already exists — preserving."
fi

# Read runtime port without sourcing .env, because secrets may contain shell metacharacters.
APP_PORT=$(grep '^PORT=' "$APP_DIR/.env" | cut -d= -f2- || true)
APP_PORT=${APP_PORT:-$DEFAULT_PORT}

# ─── 8. Start MongoDB via Docker ───
MONGO_PASS=$(grep '^MONGODB_URI=' "$APP_DIR/.env" | sed 's/.*:\([^@]*\)@.*/\1/')

if ! docker ps --format '{{.Names}}' | grep -q "$MONGO_CONTAINER"; then
  info "Starting MongoDB container..."
  if docker ps -a --format '{{.Names}}' | grep -q "$MONGO_CONTAINER"; then
    docker start "$MONGO_CONTAINER"
  else
    docker run -d \
      --name "$MONGO_CONTAINER" \
      --restart always \
      -p 127.0.0.1:27017:27017 \
      -v "$APP_DIR/mongodb/data":/data/db \
      -e MONGO_INITDB_ROOT_USERNAME="$MONGO_USER" \
      -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_PASS" \
      -e MONGO_INITDB_DATABASE="$MONGO_DB" \
      mongo:7 --auth --bind_ip_all
  fi
  info "MongoDB started (bound to 127.0.0.1 only — NOT public)"
else
  info "MongoDB already running."
fi

# ─── 9. Install backend dependencies ───
info "Installing backend dependencies..."
cd "$APP_DIR"
npm install --production=false

# ─── 10. Build backend ───
info "Building backend..."
npm run build

# ─── 11. Build dashboard ───
info "Building dashboard..."
cd "$APP_DIR/dashboard"
npm install
npm run build
cd "$APP_DIR"

# ─── 12. Set ownership ───
chown -R $APP_USER:$APP_USER "$APP_DIR"

# ─── 13. Configure PM2 ───
info "Configuring PM2..."
mkdir -p /etc/pm2
cat > /etc/pm2/ecosystem.config.js << 'PMEOF'
module.exports = {
  apps: [{
    name: 'aamd-support',
    script: '/opt/aamd-support/dist/index.js',
    cwd: '/opt/aamd-support',
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
    error_file: '/opt/aamd-support/logs/pm-error.log',
    out_file: '/opt/aamd-support/logs/pm-out.log',
    time: true,
  }]
};
PMEOF

sudo -H -u $APP_USER pm2 start /etc/pm2/ecosystem.config.js || sudo -H -u $APP_USER pm2 reload /etc/pm2/ecosystem.config.js
sudo -H -u $APP_USER pm2 save
pm2 startup systemd -u $APP_USER --hp /home/$APP_USER || true

# ─── 14. Configure Nginx ───
info "Configuring Nginx..."
cat > /etc/nginx/sites-available/aamd-support << NGINXEOF
server {
    listen 80;
    server_name _;

    client_max_body_size 2M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/aamd-support /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx

# ─── 15. Configure firewall ───
info "Configuring firewall..."
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow ${APP_PORT}/tcp || true
ufw --force enable || true

# ─── 16. Health check ───
info "Running health check..."
sleep 3
HEALTH=$(curl -fsS http://127.0.0.1:${APP_PORT}/health || echo '{"status":"error"}')
info "Health: $HEALTH"
if echo "$HEALTH" | grep -q '"status":"error"'; then
  warn "Health check did not return OK yet. Check: sudo -H -u $APP_USER pm2 logs aamd-support --lines 100"
fi

# ─── 17. Summary ───
echo ""
echo "========================================"
echo "  AA MD BOT SUPPORT — DEPLOYMENT COMPLETE"
echo "========================================"
echo ""
PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
echo "Dashboard:  http://${PUBLIC_IP}  (Nginx)"
echo "Dashboard:  http://${PUBLIC_IP}:${APP_PORT}  (direct app port)"
echo "API:        http://${PUBLIC_IP}/api"
echo "Health:     http://${PUBLIC_IP}/health"
echo "App port:   ${APP_PORT}"
echo ""
echo "MongoDB:    $(docker ps --format '{{.Names}} {{.Status}}' | grep $MONGO_CONTAINER || echo 'CHECK NEEDED')"
echo "PM2:        $(sudo -H -u $APP_USER pm2 list --no-color 2>/dev/null | grep aamd || echo 'CHECK NEEDED')"
echo "Nginx:      $(systemctl is-active nginx)"
echo ""
echo "WhatsApp:   WAITING FOR PAIRING — check PM2 logs for QR code"
echo "            Run: sudo -H -u $APP_USER pm2 logs aamd-support --lines 50"
echo ""
echo "IMPORTANT:"
echo "  1. Edit $APP_DIR/.env — set your domain and admin password"
echo "     Access key API secret is already set to: Ahsan&ali12:@"
echo "  2. For HTTPS: sudo certbot --nginx -d support.yourdomain.com"
echo "  3. Scan the WhatsApp QR code from PM2 logs"
echo "  4. Login at http://${PUBLIC_IP} or http://${PUBLIC_IP}:${APP_PORT} with your admin email/password"
echo ""
echo "Default admin: owner@aamdbot.com"
echo "========================================"
