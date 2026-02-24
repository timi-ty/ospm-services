#!/bin/bash
set -e

BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="ospm_backup_${DATE}.sql.gz"

if [ -z "$DATABASE_URL" ]; then
  if [ -f "oracle/.env" ]; then
    export $(grep -E '^DATABASE_URL=' oracle/.env | xargs)
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[Backup] ERROR: DATABASE_URL not set"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[Backup] Starting: $FILENAME"
pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"

find "$BACKUP_DIR" -name "ospm_backup_*.sql.gz" -type f -mtime +7 -delete

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[Backup] Complete: ${FILENAME} (${SIZE})"
