# Oracle One-Command Deploy

Run this exact command inside your Oracle Ubuntu VM SSH session. It installs Git if needed, clones your repo, runs the deploy script, creates `.env`, starts MongoDB, builds the backend/dashboard, starts PM2, configures Nginx, opens firewall ports, and prints the final web links.

```bash
sudo bash -lc 'set -e; apt-get update -qq; apt-get install -y -qq git ca-certificates; APP=/opt/aamd-support; REPO=https://github.com/ahsanaliwadani/aa-md-bot-support.git; if [ ! -d "$APP/.git" ]; then rm -rf "$APP"; git clone "$REPO" "$APP"; else git -C "$APP" pull --ff-only; fi; cd "$APP"; bash deploy.sh'
```

If the code is already uploaded/cloned and you are inside the repository, run this one command instead:

```bash
sudo bash deploy.sh
```

## What this creates automatically

- App directory: `/opt/aamd-support`
- Linux service user: `aamd`
- Web app port: `7000`
- Nginx public dashboard link: `http://YOUR_ORACLE_PUBLIC_IP`
- Direct dashboard/app link: `http://YOUR_ORACLE_PUBLIC_IP:7000`
- API via Nginx: `http://YOUR_ORACLE_PUBLIC_IP/api`
- API direct: `http://YOUR_ORACLE_PUBLIC_IP:7000/api`
- MongoDB Docker container: `aamd-mongo`
- MongoDB bind: `127.0.0.1:27017` only, not public
- PM2 app name: `aamd-support`
- Firewall ports opened: `22`, `80`, `443`, and `7000`

## Auto-generated `.env`

The deploy script creates `/opt/aamd-support/.env` if it does not already exist and sets database URL/secrets automatically:

```env
NODE_ENV=production
PORT=7000
DASHBOARD_URL=http://YOUR_ORACLE_PUBLIC_IP
APP_URL=http://YOUR_ORACLE_PUBLIC_IP
MONGODB_URI=mongodb://aamduser:AUTO_GENERATED_PASSWORD@127.0.0.1:27017/aamd_support?authSource=admin
MONGODB_DB_NAME=aamd_support
ACCESS_KEY_SECRET=Ahsan&ali12:@
COOKIE_SECURE=false
ADMIN_EMAIL=owner@aamdbot.com
ADMIN_PASSWORD=ChangeMe2026!
```

## After deploy

1. Open the dashboard:

```text
http://YOUR_ORACLE_PUBLIC_IP
```

or direct port:

```text
http://YOUR_ORACLE_PUBLIC_IP:7000
```

2. Login with:
   - `ADMIN_EMAIL=owner@aamdbot.com`
   - `ADMIN_PASSWORD=ChangeMe2026!`

3. Easier option: open dashboard → **WhatsApp Connect**, enter the support phone number, and click **Get Pairing Code**.

4. If you prefer server logs, check WhatsApp QR/pairing logs:

```bash
sudo -H -u aamd pm2 logs aamd-support --lines 50
```

5. Scan the WhatsApp QR code from the support phone, or enter the dashboard pairing code in WhatsApp Linked Devices.

6. Check web health:

```bash
curl http://127.0.0.1:7000/health
curl http://YOUR_ORACLE_PUBLIC_IP/health
```

## HTTPS/domain setup later

Point your domain DNS A record to the Oracle public IP, then run:

```bash
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d YOUR_DOMAIN
```

After HTTPS, edit `/opt/aamd-support/.env`:

```env
APP_URL=https://YOUR_DOMAIN
DASHBOARD_URL=https://YOUR_DOMAIN
COOKIE_SECURE=true
```

Restart:

```bash
sudo -H -u aamd pm2 restart aamd-support
```

## Access key API command

```bash
curl -X POST "http://YOUR_ORACLE_PUBLIC_IP/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer Ahsan&ali12:@" \
  -d '{"serverId":1,"phone":"923001234567","expiresInDays":30,"connectionId":"default"}'
```
