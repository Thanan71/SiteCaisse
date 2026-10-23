#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${SUPABASE_DB_URL:?Configure the SUPABASE_DB_URL Actions secret.}"
: "${SUPABASE_BACKUP_PASSPHRASE:?Configure the SUPABASE_BACKUP_PASSPHRASE Actions secret.}"
output_dir="${1:?Usage: bash scripts/backup-database.sh OUTPUT_DIRECTORY}"

if [[ ${#SUPABASE_BACKUP_PASSPHRASE} -lt 32 || "$SUPABASE_BACKUP_PASSPHRASE" == *$'\n'* ]]; then
  echo 'The backup passphrase must contain at least 32 characters on a single line.' >&2
  exit 1
fi

# Reject a different Supabase project and transaction pooling before connecting.
# Local restore tests can omit EXPECTED_SUPABASE_PROJECT_REF.
python3 - <<'PY'
import os
from urllib.parse import unquote, urlsplit

try:
    uri = urlsplit(os.environ['SUPABASE_DB_URL'])
    valid = uri.scheme in ('postgres', 'postgresql') and uri.hostname and uri.username
    project = os.environ.get('EXPECTED_SUPABASE_PROJECT_REF')
    if project:
        direct = uri.hostname == f'db.{project}.supabase.co'
        pooler = (
            uri.hostname.endswith('.pooler.supabase.com')
            and unquote(uri.username or '') == f'postgres.{project}'
        )
        valid = valid and (direct or pooler) and (uri.port or 5432) == 5432
    if not valid:
        raise ValueError()
except (ValueError, AttributeError):
    raise SystemExit('Invalid database URL: use the expected Supabase project and session pooler on port 5432.')
PY

export PGSSLMODE="${PGSSLMODE:-require}"
export PGCONNECT_TIMEOUT=20
export PGAPPNAME=SiteCaisse-daily-backup

work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT
payload_dir="$work_dir/payload"
mkdir -p "$payload_dir" "$work_dir/gnupg" "$output_dir"
export GNUPGHOME="$work_dir/gnupg"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
filename="sitecaisse-database-${timestamp}-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}.tar.gz.gpg"

# No schema or table filter: include all rows, sequences, large objects,
# policies, functions, triggers, ownership and grants in one consistent dump.
pg_dump --dbname="$SUPABASE_DB_URL" --no-password --format=custom \
  --lock-wait-timeout=60s --file="$payload_dir/database.dump"
pg_dumpall --dbname="$SUPABASE_DB_URL" --no-password --roles-only \
  --no-role-passwords --file="$payload_dir/roles.sql"

test -s "$payload_dir/database.dump"
test -s "$payload_dir/roles.sql"
pg_restore --list "$payload_dir/database.dump" > "$payload_dir/archive.list"
# Read/decompress the entire archive, including data blocks, before publishing.
pg_restore --file=/dev/null "$payload_dir/database.dump"

{
  printf 'Backup started (UTC): %s\n' "$timestamp"
  printf 'Backup completed (UTC): %s\n' "$(date -u +%Y%m%dT%H%M%SZ)"
  printf 'Supabase project: %s\n' "${EXPECTED_SUPABASE_PROJECT_REF:-local-test}"
  printf 'Git commit: %s\n' "${GITHUB_SHA:-local-test}"
  pg_dump --version
} > "$payload_dir/metadata.txt"

tar -czf "$work_dir/backup.tar.gz" -C "$payload_dir" .
# Pass the key through a file descriptor so it never appears in command arguments.
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "$work_dir/$filename" \
  "$work_dir/backup.tar.gz" 3<<< "$SUPABASE_BACKUP_PASSPHRASE"

gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt --output "$work_dir/verified.tar.gz" \
  "$work_dir/$filename" 3<<< "$SUPABASE_BACKUP_PASSPHRASE"
cmp "$work_dir/backup.tar.gz" "$work_dir/verified.tar.gz"

# The upload directory receives only a verified, encrypted archive.
mv "$work_dir/$filename" "$output_dir/$filename"
printf 'Encrypted backup ready: %s\n' "$filename"
