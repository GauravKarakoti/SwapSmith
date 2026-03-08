#!/usr/bin/env sh
set -e

MAX_RETRIES="${MAX_RETRIES:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set; cannot wait for database"
else
  echo "Waiting for database..."
  
  # Parse PostgreSQL connection string
  # Format: postgres://user:password@host:port/dbname
  DB_URL="$DATABASE_URL"
  
  # Remove postgres:// prefix
  DB_URL="${DB_URL#postgres://}"
  DB_URL="${DB_URL#postgresql://}"
  
  # Extract user and password
  if echo "$DB_URL" | grep -q "@"; then
    USERPASS="${DB_URL%@*}"
    DB_URL="${DB_URL#*@}"
    DB_USER="${USERPASS%:*}"
    DB_PASS="${USERPASS#*:}"
  else
    DB_USER="postgres"
    DB_PASS=""
  fi
  
  # Extract host and port
  if echo "$DB_URL" | grep -q ":"; then
    DB_HOST="${DB_URL%:*}"
    REST="${DB_URL#*:}"
    DB_PORT="${REST%/*}"
    DB_NAME="${REST#*/}"
  else
    DB_HOST="${DB_URL%/*}"
    DB_PORT="5432"
    DB_NAME="${DB_URL#*/}"
  fi
  
  # Provide defaults
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-postgres}"
  
  COUNTER=0
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
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

