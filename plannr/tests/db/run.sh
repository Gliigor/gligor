#!/usr/bin/env bash
# Runs the migration + RLS tests against a throwaway supabase/postgres container.
# Usage: npm run test:db   (requires Docker)
set -euo pipefail
cd "$(dirname "$0")/../.."

NAME=plannr-db-test
PORT=${PLANNR_TEST_DB_PORT:-54398}
IMAGE=${PLANNR_TEST_DB_IMAGE:-supabase/postgres:17.11.0.004}

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

export PGPASSWORD=postgres
# Migrations run as "postgres" (like the Supabase SQL editor); the storage stub
# and the test fixtures need the superuser "supabase_admin".
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
PSQL_ADMIN=(psql -h 127.0.0.1 -p "$PORT" -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q)

for _ in $(seq 1 60); do
  # The image restarts once after running its init scripts; wait for auth.users.
  if "${PSQL[@]}" -c "select 1 from auth.users limit 1" >/dev/null 2>&1; then break; fi
  sleep 1
done
sleep 2

"${PSQL_ADMIN[@]}" -f tests/db/storage-stub.sql
for f in supabase/migrations/*.sql; do
  echo "Migratie: $f"
  "${PSQL[@]}" -f "$f"
done
"${PSQL_ADMIN[@]}" -f tests/db/rls.test.sql
