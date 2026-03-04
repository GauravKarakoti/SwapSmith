#!/usr/bin/env sh
set -e

MAX_RETRIES="${MAX_RETRIES:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set; cannot wait for database"
else
  echo "Waiting for database at $DATABASE_URL..."
  COUNTER=0
  until pg_isready -d "$DATABASE_URL"; do
    COUNTER=$((COUNTER + 1))
    if [ "$COUNTER" -ge "$MAX_RETRIES" ]; then
      echo "Database not ready after $MAX_RETRIES attempts, exiting"
      exit 1
    fi
    echo "Database not ready yet (attempt $COUNTER/$MAX_RETRIES), retrying in ${SLEEP_SECONDS}s..."
    sleep "$SLEEP_SECONDS"
  done
fi

echo "Database is ready, running migrations..."
npm run db:migrate

echo "Migrations complete, starting bot..."
npm run start:render

