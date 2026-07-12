#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

docker compose up -d postgres

echo "Waiting for postgres to become healthy..."
for _ in $(seq 1 30); do
  cid="$(docker compose ps -q postgres)"
  status="$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "starting")"
  if [ "$status" = "healthy" ]; then
    echo "postgres is healthy"
    exit 0
  fi
  sleep 2
done

echo "postgres did not become healthy in time" >&2
docker compose logs postgres
exit 1
