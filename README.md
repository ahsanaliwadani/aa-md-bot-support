# AA MD Bot — Official Support Bot

A complete production-ready WhatsApp support bot for AA MD Bot. Handles customer support, Access Key management, payment requests, support tickets, FAQ, and a full admin dashboard.

## What This System Does

- **WhatsApp Support Bot**: Connects to a dedicated WhatsApp number and provides an automated support menu for customers
- **Access Key Management**: Generate, assign, activate, suspend, and revoke access keys
- **Payment Workflow**: Customers request keys, admin approves payments from dashboard, keys auto-generated on approval
- **Support Tickets**: Customers report issues via WhatsApp, tickets appear in dashboard with real-time updates
- **Admin Dashboard**: Secure web dashboard to manage everything — customers, keys, payments, tickets, messages, FAQ, settings, audit logs
- **Messages**: View and reply to WhatsApp conversations directly from the dashboard
- **Audit Logging**: Every admin action is logged with timestamp, IP, and result

## Architecture

```
aa-md-support-bot/
├── src/                    # Backend (Node.js + TypeScript)
│   ├── bot/                # WhatsApp bot (Baileys)
│   ├── handlers/           # Message processing & intent parsing
│   ├── middleware/         # Auth, rate limiting, validation, audit
│   ├── models/             # MongoDB schemas (10 collections)
│   ├── routes/             # REST API endpoints
│   ├── services/           # Business logic (auth, keys, tickets, etc.)
│   ├── config/             # Environment configuration
│   └── index.ts            # Application entry point
├── dashboard/              # React + Vite + Tailwind dashboard
│   └── src/
│       ├── components/     # Layout, UI components
│       ├── lib/            # API client, types, auth
│       └── pages/          # All dashboard pages
├── deploy.sh               # One-command deployment
├── update.sh               # Safe update script
├── backup.sh               # MongoDB + sessions backup
├── restore.sh              # Restore from backup
├── docker-compose.yml      # MongoDB container
├── ecosystem.config.js     # PM2 configuration
└── nginx/                  # Nginx reverse proxy config
```

## Requirements

- Ubuntu 20.04+ (Oracle Cloud VM recommended)
- Root or sudo access
- 1GB+ RAM (2GB recommended)
- 10GB+ disk space

## Quick Deploy on Oracle Cloud Ubuntu VM

### SSH command to run on the server

After SSH into your Oracle Ubuntu VM, run this exact command:

```bash
sudo bash -lc 'set -e; apt-get update -qq; apt-get install -y -qq git ca-certificates; APP=/opt/aamd-support; REPO=https://github.com/ahsanaliwadani/aa-md-bot-support.git; if [ ! -d "$APP/.git" ]; then rm -rf "$APP"; git clone "$REPO" "$APP"; else git -C "$APP" fetch --all --prune; git -C "$APP" reset --hard origin/main; fi; cd "$APP"; bash deploy.sh'
```

If you already have a domain pointed to this VM, run the same deploy with `DOMAIN_NAME`:

```bash
sudo DOMAIN_NAME=support.yourdomain.com bash -lc 'set -e; apt-get update -qq; apt-get install -y -qq git ca-certificates; APP=/opt/aamd-support; REPO=https://github.com/ahsanaliwadani/aa-md-bot-support.git; if [ ! -d "$APP/.git" ]; then rm -rf "$APP"; git clone "$REPO" "$APP"; else git -C "$APP" pull --ff-only; fi; cd "$APP"; bash deploy.sh'
```

If the project is already cloned/uploaded and you are inside the repo, use:

```bash
sudo bash deploy.sh
```

### What deploy creates automatically

The script automatically installs system packages, Node.js 20, PM2, local MongoDB, Nginx, Certbot/UFW helpers, builds the backend/dashboard, starts PM2, configures Nginx, opens firewall rules, runs health checks, and prints the final dashboard URL.

It uses isolated names so it can run beside an existing AA-MD-Bot deployment on the same Oracle VM:

| Item | Value |
|------|-------|
| App directory | `/opt/aamd-support` |
| Linux user | `aamd_support` |
| PM2 app | `aamd-support-dashboard` |
| App port | `7000` |
| MongoDB database | `aamd_support` |
| MongoDB user | `aamd_support_user` |
| Nginx site | `aamd-support` |
| Access key API secret | `Ahsan&ali12:@` |

### After deploy

Read the generated dashboard login and API examples:

```bash
sudo cat /opt/aamd-support/admin-credentials.txt
sudo cat /opt/aamd-support/access-key-api-examples.txt
```

Open the printed dashboard URL in your browser. Manage WhatsApp connection from **WhatsApp Connect** in the dashboard, then manage customers, messages, tickets, payments, access keys, and settings there.

### External access-key API secret

`deploy.sh` generates a dedicated `ACCESS_KEY_ENDPOINT_SECRET` for website-to-bot requests and writes it to `/opt/aamd-support/admin-credentials.txt`. Keep it in the external website backend environment only; do not place it in browser code.

```bash
sudo cat /opt/aamd-support/admin-credentials.txt
sudo cat /opt/aamd-support/access-key-api-examples.txt
```

The external endpoint accepts either `X-Access-Key-Secret` or `Authorization: Bearer` with that dedicated secret. Choose the target with `serverId` from `1` through `4`; configure each server URL via `ACCESS_KEY_SERVER_1_URL` through `ACCESS_KEY_SERVER_4_URL`. See [Four-server external access-key API](#four-server-external-access-key-api) for the complete contract.

### Useful server commands

```bash
sudo -H -u aamd_support pm2 status
sudo -H -u aamd_support pm2 logs aamd-support-dashboard --lines 100
curl http://127.0.0.1:7000/health
sudo /opt/aamd-support/redeploy.sh
```

See `SSH_COMMANDS.md` and `ORACLE_DEPLOY.md` for the copy/paste SSH commands and full Oracle checklist.

## WhatsApp Bot Commands

Users send any of these to the support number:

| Command | Action |
|---------|--------|
| hi, hello, menu, help, start | Show main menu |
| 1, buy, purchase | Start Access Key purchase flow |
| 2, activate | Activate an Access Key |
| 3, key issue | Access Key issue support |
| 4, payment | Payment issue support |
| 5, bot not working | Report bot not working |
| 6, bug, report | Report a bug |
| 7, connection | Connection troubleshooting |
| 8, key info | Access Key information |
| 9, pricing | Show pricing |
| 10, contact | Contact support |
| ticket, status | View ticket status |

## Admin Dashboard Pages

| Page | Purpose |
|------|---------|
| Dashboard | Overview stats, bot/DB status |
| Customers | Search, view, manage customer profiles |
| Access Keys | Generate, activate, suspend, revoke keys |
| Payments | Approve/reject payment requests (auto-generates key on approval) |
| Tickets | View and reply to support tickets |
| Messages | View WhatsApp conversations, reply directly |
| FAQ | Create, edit, delete FAQ entries |
| Admins | Manage admin users and roles |
| Audit Logs | View all admin actions |
| WhatsApp Connect | Connect the WhatsApp support number from dashboard with pairing code and QR/log fallback |
| System Health | CPU, RAM, uptime, bot/DB status |
| Settings | Edit bot name, pricing, messages, support hours |

## Admin Roles

| Role | Access |
|------|--------|
| OWNER | Full access to everything |
| ADMIN | Most management features (no settings deletion) |
| SUPPORT | Customers, tickets, messages — no settings/keys |

## API Endpoints

```
POST   /api/auth/login          # Admin login
POST   /api/auth/logout         # Logout
GET    /api/auth/me             # Current admin info
POST   /api/auth/change-password

GET    /api/dashboard/stats     # Overview statistics
GET    /api/dashboard/health    # System health
GET    /api/dashboard/whatsapp/status
POST   /api/dashboard/whatsapp/pairing-code

GET    /api/customers           # List customers
GET    /api/customers/:id       # Customer detail
PUT    /api/customers/:id/notes
POST   /api/customers/:id/tags
POST   /api/customers/:id/block
POST   /api/customers/:id/unblock

GET    /api/access-keys         # List keys
POST   /api/access-keys/generate
POST   /api/access-keys/assign
POST   /api/access-keys/activate
POST   /api/access-keys/suspend
POST   /api/access-keys/reactivate
POST   /api/access-keys/revoke

GET    /api/payments            # List payments
POST   /api/payments/:id/approve
POST   /api/payments/:id/reject

GET    /api/tickets             # List tickets
GET    /api/tickets/:ticketId   # Ticket detail
POST   /api/tickets/:ticketId/reply
POST   /api/tickets/:ticketId/status
POST   /api/tickets/:ticketId/assign
PUT    /api/tickets/:ticketId/priority

GET    /api/messages            # List conversations
GET    /api/messages/:jid       # Get conversation
POST   /api/messages/send       # Send message via bot

GET    /api/faqs                # List FAQs
POST   /api/faqs                # Create FAQ
PUT    /api/faqs/:id            # Update FAQ
DELETE /api/faqs/:id            # Delete FAQ

GET    /api/settings            # Get settings
PUT    /api/settings            # Update settings

GET    /api/admins              # List admins
POST   /api/admins              # Create admin
PUT    /api/admins/:id/role
PUT    /api/admins/:id/status

GET    /api/audit-logs          # List audit logs
GET    /health                  # Public health check
```

## HTTPS Setup

After deploy.sh completes:

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d support.yourdomain.com

# Certbot auto-configures Nginx and sets up auto-renewal
```

Update `.env`:
```
DASHBOARD_URL=https://support.yourdomain.com
APP_URL=https://support.yourdomain.com
COOKIE_SECURE=true
```

Then restart:
```bash
pm2 restart aamd-support
```

## Oracle Cloud Firewall

In your Oracle Cloud console, configure the VCN Security List:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

**Do NOT open port 27017** — MongoDB is bound to 127.0.0.1 only.

## Backup & Restore

### Create backup
```bash
sudo ./backup.sh
```

Backs up:
- MongoDB database (compressed)
- WhatsApp session files

Backups stored in `/opt/aamd-support/backups/` with timestamps. Old backups auto-cleaned (keeps last 7 by default, configurable via `BACKUP_KEEP` in `.env`).

### Restore from backup
```bash
sudo ./restore.sh mongo_backup_20260820_120000.gz
```

### Automated daily backup (cron)
```bash
sudo crontab -e
# Add: 0 3 * * * /opt/aamd-support/backup.sh >> /opt/aamd-support/logs/backup.log 2>&1
```

## Update

```bash
sudo ./update.sh
```

Safely:
- Pulls latest code (if git repo)
- Reinstalls dependencies
- Rebuilds backend + dashboard
- Restarts PM2
- Preserves `.env`, MongoDB data, WhatsApp sessions

## Development

### Run locally
```bash
# Install backend deps
npm install

# Install dashboard deps
cd dashboard && npm install && cd ..

# Copy .env
cp .env.example .env
# Edit .env with your MongoDB URI

# Run backend in dev mode
npm run dev

# Run dashboard in another terminal
cd dashboard && npm run dev
```

Dashboard runs at `http://localhost:5173`, API at `http://localhost:3000`.

### Build
```bash
npm run build          # Backend
cd dashboard && npm run build  # Dashboard
```

## Troubleshooting

### WhatsApp bot not connecting
```bash
# Check PM2 logs for QR code
pm2 logs aamd-support --lines 100

# If session is corrupted, clear and re-pair
pm2 stop aamd-support
rm -rf /opt/aamd-support/sessions/*
pm2 start aamd-support
pm2 logs aamd-support --lines 50
# Scan new QR code
```

### MongoDB not starting
```bash
# Check Docker
docker ps -a | grep aamd-mongo
docker logs aamd-mongo

# Restart MongoDB
docker restart aamd-mongo
```

### Dashboard not loading
```bash
# Check if backend is running
pm2 status
curl http://127.0.0.1:3000/health

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
```

### Login fails
```bash
# Check .env for ADMIN_EMAIL and ADMIN_PASSWORD
# Re-seed the database
cd /opt/aamd-support
npx ts-node src/scripts/seed.ts
```

### Bot reconnects repeatedly
This is normal if WhatsApp disconnects. The bot uses exponential backoff (up to 30 seconds). If it persists:
```bash
# Check internet connectivity
ping -c 4 web.whatsapp.com

# Restart
pm2 restart aamd-support
```

## Security Checklist

- [x] Passwords hashed with bcrypt (12 rounds)
- [x] JWT tokens with 8h expiry
- [x] Secure HTTP-only cookies
- [x] Helmet security headers
- [x] CORS restricted to dashboard URL
- [x] Rate limiting on all API routes
- [x] Input validation with Zod
- [x] NoSQL injection protection (sanitize middleware)
- [x] XSS protection (HTML stripped from input)
- [x] MongoDB bound to 127.0.0.1 only (not public)
- [x] No secrets in source code
- [x] .env in .gitignore
- [x] WhatsApp sessions in .gitignore
- [x] Audit logging for all admin actions
- [x] Role-based access control (OWNER/ADMIN/SUPPORT)
- [x] Login attempt protection (5 failures = 15min lock)
- [x] Access keys stored as SHA-256 hashes
- [x] No plaintext keys in logs

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | production |
| PORT | Backend port | 3000 |
| DASHBOARD_URL | Dashboard public URL | https://support.example.com |
| APP_URL | App public URL | https://support.example.com |
| MONGODB_URI | MongoDB connection string | — |
| MONGODB_DB_NAME | Database name | aamd_support |
| JWT_SECRET | JWT signing secret | (auto-generated) |
| SESSION_SECRET | Session/cookie secret | (auto-generated) |
| COOKIE_SECURE | HTTPS-only cookies | true |
| ADMIN_EMAIL | Initial owner email | owner@aamdbot.com |
| ADMIN_PASSWORD | Initial owner password | — |
| SUPPORT_NUMBER | Official support number | +923316041183 |
| BOT_NAME | Bot display name | AA MD BOT |
| LOG_LEVEL | Logging level | info |
| RATE_LIMIT_WINDOW_MS | Rate limit window | 60000 |
| RATE_LIMIT_MAX | Max requests per window | 20 |
| SESSION_TIMEOUT_MINUTES | Conversation state timeout | 10 |
| BACKUP_KEEP | Backups to keep | 7 |

## Default Configuration

- **Pakistan Price**: Rs. 1,000
- **International Price**: $5 USD
- **One-time payment**: No subscription
- **1 Access Key = 1 WhatsApp Number**
- **Official Support Number**: +923316041183

All configurable from the dashboard Settings page.

## License

Proprietary — AA MD Bot. All rights reserved.

## Four-server external access-key API

Each server URL is configured independently in the bot `.env`. Keep the same integration secret on the server that receives website requests, and change only the four URL values when your bot servers move:

```env
# Required: use a new random value, never the old ACCESS_KEY_SECRET value.
ACCESS_KEY_ENDPOINT_SECRET=PASTE_A_LONG_RANDOM_SECRET

ACCESS_KEY_SERVER_1_URL=https://193.122.82.38.nip.io
ACCESS_KEY_SERVER_2_URL=https://141-147-132-189.nip.io
ACCESS_KEY_SERVER_3_URL=https://130-110-123-57.nip.io
ACCESS_KEY_SERVER_4_URL=https://144-24-220-107.nip.io
```

Generate the secret once with `openssl rand -hex 32`. `deploy.sh` creates and preserves this secret automatically. The external website must use `ACCESS_KEY_ENDPOINT_SECRET`; `ACCESS_KEY_SECRET` is not accepted by the external integration endpoints.

### External website environment

```env
AA_BOT_API_URL=https://YOUR_SERVER_IP.nip.io/api
ACCESS_KEY_ENDPOINT_SECRET=PASTE_THE_SAME_SECRET
```

### Protected external endpoints

Send either `X-Access-Key-Secret: $ACCESS_KEY_ENDPOINT_SECRET` or `Authorization: Bearer $ACCESS_KEY_ENDPOINT_SECRET` on every request.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api` | Health check |
| `POST` | `/api/access-keys/generate` | Create a key for server 1–4 |
| `GET` | `/api/access-keys?search=PHONE_OR_KEY` | List or search keys |
| `GET` | `/api/access-keys?id=ACCESS_KEY_ID` | Read one key |
| `GET` | `/api/access-keys/history?id=ACCESS_KEY_ID` | Read key history |
| `POST` | `/api/access-keys/action` | Secure management actions |

For generation, send `serverId` (`1`, `2`, `3`, or `4`), plus optional `phone`, `connectionId`, `expiresInDays` (1–3650), or a future ISO `expiresAt`. Omit both expiry fields for a lifetime key. Do not send both expiry fields together.

```bash
curl -X POST "https://YOUR_SERVER_IP.nip.io/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "X-Access-Key-Secret: $ACCESS_KEY_ENDPOINT_SECRET" \
  -d '{"serverId":4,"phone":"923001234567","connectionId":"website","expiresInDays":30}'
```

The `/action` endpoint supports `generate`, `search`, `view`, `history`, `assign`, `activate`, `suspend`, `revoke`, and `delete`. For example:

```bash
curl -X POST "https://YOUR_SERVER_IP.nip.io/api/access-keys/action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_KEY_ENDPOINT_SECRET" \
  -d '{"action":"activate","id":"ACCESS_KEY_ID","createdBy":"website-backend"}'
```

## Oracle Cloud deployment checklist

1. Create an Ubuntu VM in Oracle Cloud, open VCN ingress for TCP `22`, `80`, and `443` only.
2. SSH into the VM and clone/upload this repository to `/opt/aamd-support`.
3. Run `sudo ./deploy.sh` from the repository root.
4. Edit `/opt/aamd-support/.env` and set `APP_URL`, `DASHBOARD_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `SESSION_SECRET`, `ACCESS_KEY_ENDPOINT_SECRET`, and the four `ACCESS_KEY_SERVER_*_URL` values.
5. Run `npm run build && npm run build:dashboard` to verify the production build.
6. Restart with `pm2 restart aamd-support` and verify `curl http://127.0.0.1:3000/health`.
7. Add HTTPS with `sudo certbot --nginx -d YOUR-DOMAIN`, then set `COOKIE_SECURE=true` and restart PM2.
