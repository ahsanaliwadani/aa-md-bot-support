#!/bin/bash
set -e

# AA MD Bot Support — MongoDB Backup Script

APP_DIR="/opt/aamd-support"
MONGO_CONTAINER="aamd-mongo"
MONGO_USER="aamduser"
MONGO_DB="aamd_support"
BACKUP_DIR="$APP_DIR/backups"
KEEP=7

# Load MongoDB password from .env
if [ -f "$APP_DIR/.env" ]; then
  MONGO_PASS=$(grep MONGODB_URI "$APP_DIR/.env" | sed 's/.*:\([^@]*\)@.*/\1/')
else
  echo "ERROR: .env not found at $APP_DIR/.env"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mongo_backup_$TIMESTAMP.gz"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Creating MongoDB backup..."

# Dump and compress
docker exec "$MONGO_CONTAINER" mongodump \
  --username "$MONGO_USER" \
  --password "$MONGO_PASS" \
  --authenticationDatabase "$MONGO_DB" \
  --db "$MONGO_DB" \
  --archive --gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[INFO] Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Also backup WhatsApp sessions
if [ -d "$APP_DIR/sessions" ]; then
  SESSIONS_TAR="$BACKUP_DIR/sessions_$TIMESTAMP.tar.gz"
  tar -czf "$SESSIONS_TAR" -C "$APP_DIR" sessions/
  echo "[INFO] Sessions backup: $SESSIONS_TAR"
fi

# Clean old backups
BACKUP_KEEP=$(grep BACKUP_KEEP "$APP_DIR/.env" | cut -d= -f2 || echo "$KEEP")
OLD_BACKUPS=$(ls -1t "$BACKUP_DIR"/mongo_backup_*.gz 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)))
if [ -n "$OLD_BACKUPS" ]; then
  echo "[INFO] Cleaning old backups (keeping last $BACKUP_KEEP)..."
  echo "$OLD_BACKUPS" | xargs rm -f
fi

OLD_SESSIONS=$(ls -1t "$BACKUP_DIR"/sessions_*.tar.gz 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)))
if [ -n "$OLD_SESSIONS" ]; then
  echo "$OLD_SESSIONS" | xargs rm -f
fi

echo "[INFO] Backup complete!"
ls -lh "$BACKUP_DIR" | tail -10
