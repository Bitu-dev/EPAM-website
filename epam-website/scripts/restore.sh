#!/usr/bin/env bash
# Restore an encrypted backup into the compose database. THIS REPLACES CURRENT DATA.
#   BACKUP_PASSPHRASE=... ./scripts/restore.sh backups/epam-....sql.gz.enc
set -euo pipefail
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
FILE="${1:?usage: restore.sh <backup file>}"
RESTORE_CMD="${RESTORE_CMD:-docker compose exec -T db psql -v ON_ERROR_STOP=1 -U epam epam}"
read -r -p "This will overwrite the live database with $FILE. Type YES to continue: " ok
[ "$ok" = "YES" ] || { echo aborted; exit 1; }
# shellcheck disable=SC2086
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | gunzip | $RESTORE_CMD
echo "restored from $FILE"
