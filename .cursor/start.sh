#!/usr/bin/env bash
#
# Cloud Agent per-boot startup: bring PostgreSQL up every time the environment
# starts. The database's data directory is captured in the environment snapshot,
# but its running process is not, so it must be (re)started here.
#
# Idempotent: safe to run when PostgreSQL is already up.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VERSION=16

echo "[start] Starting PostgreSQL cluster..."
sudo pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done

# Safety net: recreate the databases if a snapshot ever lacks them. On a normal
# boot both already exist and these are no-ops.
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='myuno'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE myuno;"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='myuno_test'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE myuno_test;"

echo "[start] PostgreSQL is ready."
