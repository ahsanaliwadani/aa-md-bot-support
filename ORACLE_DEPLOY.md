# Oracle SSH Deploy Guide — AA MD Support Dashboard

Run these commands inside your Oracle Ubuntu VM SSH session.

## Recommended one-command deploy

```bash
sudo bash -lc 'set -e; apt-get update -qq; apt-get install -y -qq git ca-certificates; APP=/opt/aamd-support; REPO=https://github.com/ahsanaliwadani/aa-md-bot-support.git; if [ ! -d "$APP/.git" ]; then rm -rf "$APP"; git clone "$REPO" "$APP"; else git -C "$APP" pull --ff-only; fi; cd "$APP"; bash deploy.sh'
```

## Deploy with an existing domain

If your DNS A record already points to the Oracle public IP, replace the domain and run:

```bash
sudo DOMAIN_NAME=support.yourdomain.com bash -lc 'set -e; apt-get update -qq; apt-get install -y -qq git ca-certificates; APP=/opt/aamd-support; REPO=https://github.com/ahsanaliwadani/aa-md-bot-support.git; if [ ! -d "$APP/.git" ]; then rm -rf "$APP"; git clone "$REPO" "$APP"; else git -C "$APP" pull --ff-only; fi; cd "$APP"; bash deploy.sh'
```

Then enable HTTPS:

```bash
sudo certbot --nginx -d support.yourdomain.com
```

## If code is already cloned/uploaded

```bash
cd /opt/aamd-support
sudo bash deploy.sh
```

With domain:

```bash
cd /opt/aamd-support
sudo DOMAIN_NAME=support.yourdomain.com bash deploy.sh
```

## What is different from the existing AA-MD-Bot VM deploy?

This support-dashboard deploy uses isolated configuration so it can live on the same VM:

| Resource | Support dashboard value |
|---|---|
| App directory | `/opt/aamd-support` |
| Linux user | `aamd_support` |
| PM2 process | `aamd-support-dashboard` |
| Port | `7000` |
| MongoDB database | `aamd_support` |
| MongoDB user | `aamd_support_user` |
| Nginx site | `aamd-support` |
| Access-key secret | `Ahsan&ali12:@` |

The deploy script creates `/opt/aamd-support/.env` automatically. You do **not** need to manually edit `.env` for first run.

## After deploy: get dashboard login and API examples

```bash
sudo cat /opt/aamd-support/admin-credentials.txt
sudo cat /opt/aamd-support/access-key-api-examples.txt
```

The dashboard URL is printed at the end of `deploy.sh`. Open it in your browser and manage WhatsApp pairing from **WhatsApp Connect**.

## Generate access key from SSH/API

Header secret method:

```bash
curl -X POST "http://YOUR_SERVER_OR_DOMAIN/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "X-Access-Key-Secret: Ahsan&ali12:@" \
  -d '{"phone":"923001234567","connectionId":"default"}'
```

Bearer secret method:

```bash
curl -X POST "http://YOUR_SERVER_OR_DOMAIN/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer Ahsan&ali12:@" \
  -d '{"phone":"923001234567","connectionId":"default"}'
```

## Useful SSH management commands

```bash
sudo -H -u aamd_support pm2 status
sudo -H -u aamd_support pm2 logs aamd-support-dashboard --lines 100
curl http://127.0.0.1:7000/health
sudo nginx -t
sudo systemctl status mongod --no-pager
sudo /opt/aamd-support/redeploy.sh
```
