#!/usr/bin/env bash
# Encrypted PostgreSQL backup:  pg_dump | gzip | AES-256 (openssl, PBKDF2).
#   BACKUP_PASSPHRASE='long secret' ./scripts/backup.sh [output-dir]
# Store the passphrase somewhere other than the server (password manager). Without it, backups cannot be restored.
# Restore:  BACKUP_PASSPHRASE=... ./scripts/restore.sh backups/epam-2026-11-10.sql.gz.enc
set -euo pipefail
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
OUT_DIR="${1:-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
# DUMP_CMD can be overridden (used by tests); default dumps the compose database.
DUMP_CMD="${DUMP_CMD:-docker compose exec -T db pg_dump -U epam --no-owner epam}"

mkdir -p "$OUT_DIR"
umask 077
FILE="$OUT_DIR/epam-$(date +%F-%H%M%S).sql.gz.enc"
TMP="$FILE.partial"
trap 'rm -f "$TMP"' EXIT

# shellcheck disable=SC2086
$DUMP_CMD | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE -out "$TMP"
# Verify before keeping it: the file must decrypt, decompress and contain data.
BYTES=$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$TMP" | gunzip | wc -c)
[ "$BYTES" -gt 0 ] || { echo "backup is empty or unreadable, aborting" >&2; exit 1; }
mv "$TMP" "$FILE"
trap - EXIT
find "$OUT_DIR" -name 'epam-*.sql.gz.enc' -mtime +"$KEEP_DAYS" -delete
echo "wrote $FILE ($(du -h "$FILE" | cut -f1)). Copy it off this server."
