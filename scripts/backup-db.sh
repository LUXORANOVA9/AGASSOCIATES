#!/bin/bash
set -e
BACKUP_DIR="/srv/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker exec ag_postgres pg_dump -U agadmin agdb | gzip > "$BACKUP_DIR/agdb_$TIMESTAMP.sql.gz"
find "$BACKUP_DIR" -name "agdb_*.sql.gz" -mtime +7 -delete
echo "Backup saved: $BACKUP_DIR/agdb_$TIMESTAMP.sql.gz"
