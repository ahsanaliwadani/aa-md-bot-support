#!/bin/bash

# AA MD Bot Support — MongoDB Restore Script
# Usage: ./restore.sh mongo_backup_20260820_120000.gz

APP_DIR="/opt/aamd-support"
MONGO_CONTAINER="aamd-mongo"
MONGO_USER="aamduser"
MONGO_DB="aamd_support"
BACKUP_DIR="$APP_DIR/backups"

if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <backup_filename>"
  echo ""
  echo "Available backups:"
  ls -1 "$BACKUP_DIR"/mongo_backup_*.gz 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load MongoDB password
MONGO_PASS=$(grep MONGODB_URI "$APP_DIR/.env" | sed 's/.*:\([^@]*\)@.*/\1/')

echo "WARNING: This will OVERWRITE the current database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "[INFO] Restoring MongoDB from backup..."

cat "$BACKUP_FILE" | docker exec -i "$MONGO_CONTAINER" mongorestore \
  --username "$MONGO_USER" \
  --password "$MONGO_PASS" \
  --authenticationDatabase "$MONGO_DB" \
  --db "$MONGO_DB" \
  --drop \
  --archive --gzip

echo "[INFO] Database restored successfully!"

# Restore sessions if provided
SESSIONS_FILE="$BACKUP_DIR/$(echo $1 | sed 's/mongo_backup_/sessions_/' | sed 's/.gz/.tar.gz/')"
if [ -f "$SESSIONS_FILE" ]; then
  echo "[INFO] Restoring WhatsApp sessions..."
  tar -xzf "$SESSIONS_FILE" -C "$APP_DIR/"
  echo "[INFO] Sessions restored. Restart the bot: pm2 restart aamd-support"
fi

echo "[INFO] Restore complete!"
