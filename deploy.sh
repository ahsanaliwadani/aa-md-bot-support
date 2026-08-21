#!/usr/bin/env bash
set -Eeuo pipefail

# AA MD Bot Support — Oracle Cloud Ubuntu Auto-Deploy Script
# Same style as AA-MD-Bot setup.sh, but isolated config so it can run on the
# same VM without reusing the main bot app name, database, user, port, or paths.

APP_NAME="aamd-support-dashboard"
APP_DIR="/opt/aamd-support"
APP_USER="aamd_support"
NODE_VERSION="20"
APP_PORT="7000"
MONGO_DB="aamd_support"
MONGO_USER="aamd_support_user"
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"
NGINX_SITE="aamd-support"
DEPLOY_LOG="/tmp/aamd-support-deploy.log"
SCRIPT_START=$(date +%s)
DOMAIN_NAME="${DOMAIN_NAME:-${1:-}}"
ACCESS_KEY_SECRET_VALUE="Ahsan&ali12:@"
ADMIN_PASSWORD_VALUE=""

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; B='\033[1m'; R='\033[0m'; RE='\033[0;31m'
_ts() { date '+%H:%M:%S'; }
ok() { echo -e "${G}✔  $*${R}"; echo "[OK] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
inf() { echo -e "${C}▶  $*${R}"; echo "[INF] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
warn() { echo -e "${Y}⚠  $*${R}"; echo "[WRN] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
fail() { echo -e "${RE}❌  $*${R}"; exit 1; }
hdr() { echo -e "\n${B}${C}━━━  $*  ━━━${R} ($(_ts))"; echo "--- $* ---" >> "$DEPLOY_LOG" 2>/dev/null || true; }
trap 'code=$?; echo -e "\n${RE}❌ Error at line ${BASH_LINENO[0]}: ${BASH_COMMAND}${R}"; exit $code' ERR

echo "=== AA MD Support Deploy $(date) ===" >> "$DEPLOY_LOG"
ARCH=$(uname -m)
[[ "$ARCH" == "aarch64" || "$ARCH" == "x86_64" ]] || fail "Unsupported architecture: $ARCH"

if [ "$EUID" -ne 0 ]; then
  fail "Run with sudo/root: sudo ./deploy.sh"
fi

clear || true
echo -e "${B}${C}╔══════════════════════════════════════════════════════════╗"
echo "║        AA MD Support — Oracle Cloud Auto Deploy          ║"
echo "║ MongoDB + Dashboard + WhatsApp Support — isolated config ║"
echo -e "╚══════════════════════════════════════════════════════════╝${R}"
echo "Architecture: $ARCH | Log: $DEPLOY_LOG"

hdr "1. System packages"
apt-get update -qq
# Ubuntu 24.04 can refuse installing/upgrading ufw while old persistent
# firewall packages are present or held. They are not required for this app;
# remove/unhold them before installing the supported firewall stack.
apt-mark unhold iptables-persistent netfilter-persistent >/dev/null 2>&1 || true
DEBIAN_FRONTEND=noninteractive apt-get purge -yq iptables-persistent netfilter-persistent >/dev/null 2>&1 || true
DEBIAN_FRONTEND=noninteractive apt-get autoremove -yq >/dev/null 2>&1 || true
DEBIAN_FRONTEND=noninteractive apt-get install -yq \
  curl wget git unzip gnupg build-essential ca-certificates openssl \
  nginx certbot python3-certbot-nginx ufw iptables \
  software-properties-common apt-transport-https rsync
ok "System tools installed"

hdr "2. Node.js ${NODE_VERSION} + PM2"
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "^v${NODE_VERSION}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -yq nodejs
fi
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
ok "Node $(node -v), npm $(npm -v), PM2 ready"

hdr "3. MongoDB local service"
. /etc/os-release
UBUNTU_CODENAME="${VERSION_CODENAME:-}"
case "$UBUNTU_CODENAME" in
  noble) MONGO_MAJOR="8.0" ;;
  jammy|focal) MONGO_MAJOR="7.0" ;;
  *) MONGO_MAJOR="7.0"; warn "Unknown Ubuntu codename '$UBUNTU_CODENAME'; trying MongoDB ${MONGO_MAJOR}" ;;
esac
MONGO_KEYRING="/usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg"
MONGO_LIST="/etc/apt/sources.list.d/mongodb-org-${MONGO_MAJOR}.list"
if ! command -v mongod >/dev/null 2>&1; then
  curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_MAJOR}.asc" | gpg --batch --yes -o "$MONGO_KEYRING" --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=${MONGO_KEYRING} ] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/${MONGO_MAJOR} multiverse" > "$MONGO_LIST"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -yq mongodb-org mongosh
else
  ok "MongoDB already installed — preserving existing service"
fi
install -d -m 755 -o mongodb -g mongodb /var/log/mongodb /var/lib/mongodb
systemctl enable mongod >/dev/null 2>&1 || true
systemctl start mongod || systemctl restart mongod
for i in $(seq 1 30); do
  if (echo > "/dev/tcp/${MONGO_HOST}/${MONGO_PORT}") >/dev/null 2>&1; then
    ok "MongoDB TCP port responding on ${MONGO_HOST}:${MONGO_PORT}"
    break
  fi
  [ "$i" -eq 30 ] && fail "MongoDB did not become ready on ${MONGO_HOST}:${MONGO_PORT}"
  sleep 2
done

hdr "4. MongoDB database/user (${MONGO_DB})"
mkdir -p "$APP_DIR"
EXISTING_ENV="$APP_DIR/.env"
DB_PASS=""
if [ -f "$EXISTING_ENV" ]; then
  uri=$(sed -n 's/^MONGODB_URI=//p' "$EXISTING_ENV" | head -1 || true)
  if [[ "$uri" =~ ^mongodb://${MONGO_USER}:([^@]+)@${MONGO_HOST}:${MONGO_PORT}/ ]]; then
    DB_PASS="${BASH_REMATCH[1]}"
    inf "Preserving existing ${MONGO_USER} password from .env"
  fi
fi
[ -n "$DB_PASS" ] || DB_PASS=$(openssl rand -hex 32)

mongo_noauth_eval() {
  mongosh --quiet "mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}" --eval "$1"
}

if ! mongo_noauth_eval "db.getUser('${MONGO_USER}')" >/dev/null 2>&1; then
  warn "MongoDB auth may be enabled; temporarily disabling auth to create/update isolated support user"
  cp /etc/mongod.conf /etc/mongod.conf.aamd-support.bak.$(date +%s) || true
  if grep -q 'authorization:[[:space:]]*enabled' /etc/mongod.conf; then
    sed -i -E 's/^([[:space:]]*)authorization:[[:space:]]*enabled/\1authorization: disabled/' /etc/mongod.conf
    systemctl restart mongod
    sleep 3
  fi
fi
mongo_noauth_eval "if (db.getUser('${MONGO_USER}')) { db.updateUser('${MONGO_USER}', {pwd:'${DB_PASS}', roles:[{role:'readWrite', db:'${MONGO_DB}'}]}); } else { db.createUser({user:'${MONGO_USER}', pwd:'${DB_PASS}', roles:[{role:'readWrite', db:'${MONGO_DB}'}]}); }"
ok "MongoDB user ${MONGO_USER} ready for database ${MONGO_DB}"
if grep -q 'authorization:[[:space:]]*disabled' /etc/mongod.conf; then
  sed -i -E 's/^([[:space:]]*)authorization:[[:space:]]*disabled/\1authorization: enabled/' /etc/mongod.conf
  systemctl restart mongod
  sleep 3
fi
AUTH_URI="mongodb://${MONGO_USER}:${DB_PASS}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=${MONGO_DB}"
mongosh --quiet "$AUTH_URI" --eval 'db.adminCommand({ping:1})' >/dev/null || fail "MongoDB support user auth failed"
ok "MongoDB auth verified for support dashboard"

hdr "5. Application files"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /bin/bash "$APP_USER"
fi
mkdir -p "$APP_DIR" "$APP_DIR/sessions" "$APP_DIR/backups" "$APP_DIR/logs"
if [ -f ./package.json ] && [ -d ./src ]; then
  SRC_DIR=$(pwd -P)
  DEST_DIR=$(cd "$APP_DIR" && pwd -P)
  if [ "$SRC_DIR" != "$DEST_DIR" ]; then
    rsync -a --delete \
      --exclude node_modules --exclude .git --exclude dashboard/node_modules --exclude dist --exclude dashboard/dist \
      ./ "$APP_DIR/"
  fi
fi
ok "Application files ready at $APP_DIR"

hdr "6. Environment"
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD_VALUE=$(openssl rand -base64 18 | tr -d '=+/' | cut -c1-18)
PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
if [ -n "$DOMAIN_NAME" ]; then
  APP_PUBLIC_URL="https://${DOMAIN_NAME}"
else
  APP_PUBLIC_URL="http://${PUBLIC_IP}"
fi
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<ENV
NODE_ENV=production
PORT=${APP_PORT}
APP_URL=${APP_PUBLIC_URL}
DASHBOARD_URL=${APP_PUBLIC_URL}
LOG_LEVEL=info

MONGODB_URI=${AUTH_URI}
MONGODB_DB_NAME=${MONGO_DB}

JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
ACCESS_KEY_SECRET=${ACCESS_KEY_SECRET_VALUE}
COOKIE_SECURE=false

ADMIN_EMAIL=owner@aamdbot.com
ADMIN_PASSWORD=${ADMIN_PASSWORD_VALUE}

SUPPORT_NUMBER=+923316041183
BOT_NAME=AA MD BOT SUPPORT

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
SESSION_TIMEOUT_MINUTES=10
BACKUP_KEEP=7
ENV
  chmod 600 "$APP_DIR/.env"
  ok ".env generated with automatic admin password and fixed access-key API secret"
else
  sed -i "s#^MONGODB_URI=.*#MONGODB_URI=${AUTH_URI}#" "$APP_DIR/.env"
  sed -i "s#^MONGODB_DB_NAME=.*#MONGODB_DB_NAME=${MONGO_DB}#" "$APP_DIR/.env"
  grep -q '^PORT=' "$APP_DIR/.env" || echo "PORT=${APP_PORT}" >> "$APP_DIR/.env"
  if grep -q '^ACCESS_KEY_SECRET=' "$APP_DIR/.env"; then
    sed -i "s#^ACCESS_KEY_SECRET=.*#ACCESS_KEY_SECRET=${ACCESS_KEY_SECRET_VALUE}#" "$APP_DIR/.env"
  else
    echo "ACCESS_KEY_SECRET=${ACCESS_KEY_SECRET_VALUE}" >> "$APP_DIR/.env"
  fi
  ok ".env preserved; MongoDB credentials and fixed access-key API secret refreshed"
fi
APP_PORT=$(sed -n 's/^PORT=//p' "$APP_DIR/.env" | head -1)
APP_PORT=${APP_PORT:-7000}

ADMIN_EMAIL_VALUE=$(sed -n 's/^ADMIN_EMAIL=//p' "$APP_DIR/.env" | head -1)
ADMIN_PASSWORD_FILE_VALUE=$(sed -n 's/^ADMIN_PASSWORD=//p' "$APP_DIR/.env" | head -1)
cat > "$APP_DIR/admin-credentials.txt" <<CREDS
Dashboard URL: ${APP_PUBLIC_URL}
Admin email: ${ADMIN_EMAIL_VALUE:-owner@aamdbot.com}
Admin password: ${ADMIN_PASSWORD_FILE_VALUE:-check-existing-env}
Access key API secret: ${ACCESS_KEY_SECRET_VALUE}
CREDS
cat > "$APP_DIR/access-key-api-examples.txt" <<EXAMPLES
# Header secret method
curl -X POST "${APP_PUBLIC_URL}/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "X-Access-Key-Secret: ${ACCESS_KEY_SECRET_VALUE}" \
  -d '{"phone":"923001234567","expiresInDays":30,"connectionId":"default"}'

# Bearer secret method
curl -X POST "${APP_PUBLIC_URL}/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_KEY_SECRET_VALUE}" \
  -d '{"phone":"923001234567","expiresInDays":30,"connectionId":"default"}'
EXAMPLES
chmod 600 "$APP_DIR/admin-credentials.txt" "$APP_DIR/access-key-api-examples.txt"

hdr "7. Install and build"
cd "$APP_DIR"
npm install --production=false
npm run build
cd "$APP_DIR/dashboard"
npm install
npm run build
cd "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "Backend and dashboard built"

hdr "8. PM2"
cat > /etc/pm2-${APP_NAME}.config.js <<PMEOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: '${APP_DIR}/dist/index.js',
    cwd: '${APP_DIR}',
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    max_memory_restart: '600M',
    env: { NODE_ENV: 'production' },
    error_file: '${APP_DIR}/logs/pm-error.log',
    out_file: '${APP_DIR}/logs/pm-out.log',
    time: true,
  }]
};
PMEOF
sudo -H -u "$APP_USER" pm2 start /etc/pm2-${APP_NAME}.config.js || sudo -H -u "$APP_USER" pm2 reload "$APP_NAME" --update-env
sudo -H -u "$APP_USER" pm2 save
pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" >/dev/null 2>&1 || true
ok "PM2 app ${APP_NAME} running"

hdr "9. Nginx + firewall"
cat > "/etc/nginx/sites-available/${NGINX_SITE}" <<NGINX
server {
    listen 80;
    server_name _;
    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
ln -sf "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
nginx -t && systemctl reload nginx
systemctl enable nginx >/dev/null 2>&1 || true
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow "${APP_PORT}/tcp" || true
ufw --force enable || true
# Oracle images sometimes have iptables REJECT rules before UFW allows HTTP(S).
iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 443 -j ACCEPT
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save >/dev/null 2>&1 || true
elif command -v iptables-save >/dev/null 2>&1; then
  mkdir -p /etc/iptables
  iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
fi
ok "Nginx and firewall ready"

hdr "10. Health check"
sleep 5
HEALTH=$(curl -fsS "http://127.0.0.1:${APP_PORT}/health" || echo '{"status":"error"}')
inf "Health: $HEALTH"
if echo "$HEALTH" | grep -q '"status":"error"'; then
  warn "Health not OK yet. Check: sudo -H -u ${APP_USER} pm2 logs ${APP_NAME} --lines 100"
fi

cat > "$APP_DIR/redeploy.sh" <<REDEPLOY
#!/usr/bin/env bash
set -e
cd "$APP_DIR"
git pull --ff-only || true
npm install --production=false
npm run build
cd dashboard && npm install && npm run build
cd "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -H -u "$APP_USER" pm2 reload "$APP_NAME" --update-env
REDEPLOY
chmod +x "$APP_DIR/redeploy.sh"
chown "$APP_USER:$APP_USER" "$APP_DIR/redeploy.sh"

elapsed=$(( $(date +%s) - SCRIPT_START ))
echo ""
echo "========================================"
echo " AA MD SUPPORT DEPLOYMENT COMPLETE"
echo "========================================"
echo "Dashboard: ${APP_PUBLIC_URL}"
echo "Direct:    http://${PUBLIC_IP}:${APP_PORT}"
echo "Health:    ${APP_PUBLIC_URL}/health"
echo "PM2:       ${APP_NAME}"
echo "MongoDB:   ${MONGO_DB} / ${MONGO_USER} on ${MONGO_HOST}:${MONGO_PORT}"
echo "Logs:      sudo -H -u ${APP_USER} pm2 logs ${APP_NAME} --lines 100"
echo "Redeploy:  sudo ${APP_DIR}/redeploy.sh"
echo "Time:      ${elapsed}s"
echo ""
cat <<SUMMARY
Credentials file: sudo cat ${APP_DIR}/admin-credentials.txt
Access key examples: sudo cat ${APP_DIR}/access-key-api-examples.txt
Access key API secret: ${ACCESS_KEY_SECRET_VALUE}
Generate key with X-Access-Key-Secret:
curl -X POST "${APP_PUBLIC_URL}/api/access-keys/generate" -H "Content-Type: application/json" -H "X-Access-Key-Secret: ${ACCESS_KEY_SECRET_VALUE}" -d '{"phone":"923001234567","expiresInDays":30,"connectionId":"default"}'
Generate key with Authorization Bearer:
curl -X POST "${APP_PUBLIC_URL}/api/access-keys/generate" -H "Content-Type: application/json" -H "Authorization: Bearer ${ACCESS_KEY_SECRET_VALUE}" -d '{"phone":"923001234567","expiresInDays":30,"connectionId":"default"}'
Optional HTTPS domain deploy: sudo DOMAIN_NAME=support.yourdomain.com ./deploy.sh
WhatsApp connect: open dashboard → WhatsApp Connect → pairing code / QR.
SUMMARY
