#!/bin/bash
set -e

# Allow celery worker/beat and other commands to bypass backend startup
if [ $# -gt 0 ]; then
  exec "$@"
fi

echo "Waiting for PostgreSQL..."
until python -c "import psycopg2; psycopg2.connect('${DATABASE_URL_SYNC}')" 2>/dev/null; do
  sleep 2
done

echo "Running database migrations..."
alembic upgrade head

echo "Initializing database..."
python -m app.cli init-db

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Creating admin user..."
  python -m app.cli create-admin "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "${ADMIN_NAME:-SOC Admin}"
fi

echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
