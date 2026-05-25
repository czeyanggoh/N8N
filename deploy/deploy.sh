#!/usr/bin/env bash
set -euo pipefail

cd /opt/dbs-automation

echo "[deploy] pulling latest"
git fetch --quiet origin main
git reset --hard origin/main

echo "[deploy] rebuilding playwright container"
docker compose \
  -f /docker/n8n/docker-compose.yml \
  -f /opt/dbs-automation/docker-compose.override.yml \
  up -d --build playwright

echo "[deploy] done"
