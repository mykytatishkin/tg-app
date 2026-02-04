#!/usr/bin/env bash
# Переносит данные из backup_all_additional_Data.sql в прод. БЕЗ удаления: только добавляет
# строки из бекапа; дубликаты по id/unique пропускаются (ON_ERROR_STOP=0).
#
# Из backend/: DB_PASSWORD=xxx ./scripts/load-sql-to-prod.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_HOST="${DB_HOST:-46.21.250.43}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-tgapp}"
export PGPASSWORD="${DB_PASSWORD:-}"

echo "Target: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
read -p "Add backup data to this DB (no truncate)? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[yY]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "Building data-only SQL in FK order..."
node "$SCRIPT_DIR/reorder-dump-data-only.mjs" "$SCRIPT_DIR/backup_all_additional_Data.sql" "$SCRIPT_DIR/backup_data_only_ordered.sql"

echo "Loading data (duplicates will be skipped)..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/backup_data_only_ordered.sql" -v ON_ERROR_STOP=0

echo "Done."