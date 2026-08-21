# SSH commands to deploy AA MD Support Dashboard

Use these commands after you SSH into the Oracle Ubuntu VM.

## 1) One-command deploy (recommended)

```bash
sudo bash -lc 'set -e; apt-get update -qq; apt-get install -y -qq git ca-certificates; APP=/opt/aamd-support; REPO=https://github.com/ahsanaliwadani/aa-md-bot-support.git; if [ ! -d "$APP/.git" ]; then rm -rf "$APP"; git clone "$REPO" "$APP"; else git -C "$APP" pull --ff-only; fi; cd "$APP"; bash deploy.sh'
```

The script prints the final dashboard URL, health URL, PM2 name, MongoDB info, admin credential file, and access-key API curl examples.

## 2) If you already have a domain pointed to this server

Replace `support.yourdomain.com` with your real domain:

```bash
sudo DOMAIN_NAME=support.yourdomain.com bash -lc 'set -e; apt-get update -qq; apt-get install -y -qq git ca-certificates; APP=/opt/aamd-support; REPO=https://github.com/ahsanaliwadani/aa-md-bot-support.git; if [ ! -d "$APP/.git" ]; then rm -rf "$APP"; git clone "$REPO" "$APP"; else git -C "$APP" pull --ff-only; fi; cd "$APP"; bash deploy.sh'
```

Then enable HTTPS:

```bash
sudo certbot --nginx -d support.yourdomain.com
```

## 3) If the repo is already cloned/uploaded

```bash
cd /opt/aamd-support
sudo bash deploy.sh
```

Or with domain:

```bash
cd /opt/aamd-support
sudo DOMAIN_NAME=support.yourdomain.com bash deploy.sh
```

## 4) After deploy: read login and API commands

```bash
sudo cat /opt/aamd-support/admin-credentials.txt
sudo cat /opt/aamd-support/access-key-api-examples.txt
```

## 5) Generate an access key manually from SSH

Use the URL printed by deploy. These both work because the deploy script sets `ACCESS_KEY_SECRET=Ahsan&ali12:@` automatically.

```bash
curl -X POST "http://YOUR_SERVER_OR_DOMAIN/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "X-Access-Key-Secret: Ahsan&ali12:@" \
  -d '{"phone":"923001234567","expiresInDays":30,"connectionId":"default"}'
```

```bash
curl -X POST "http://YOUR_SERVER_OR_DOMAIN/api/access-keys/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer Ahsan&ali12:@" \
  -d '{"phone":"923001234567","expiresInDays":30,"connectionId":"default"}'
```

## 6) Useful management commands

```bash
sudo -H -u aamd_support pm2 status
sudo -H -u aamd_support pm2 logs aamd-support-dashboard --lines 100
curl http://127.0.0.1:7000/health
sudo /opt/aamd-support/redeploy.sh
```
