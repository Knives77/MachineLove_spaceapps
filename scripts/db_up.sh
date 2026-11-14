#!/usr/bin/env bash
# Levanta PostgreSQL 16 + PostGIS en podman, accesible solo desde 127.0.0.1:5432.
set -euo pipefail
NAME=firms_postgis
if podman container exists "$NAME"; then
  podman start "$NAME" >/dev/null
else
  podman run -d --name "$NAME" \
    -e POSTGRES_USER=firms -e POSTGRES_PASSWORD=firms_local -e POSTGRES_DB=firms \
    -p 127.0.0.1:5432:5432 \
    -v firms_pgdata:/var/lib/postgresql/data \
    --shm-size=1g \
    docker.io/postgis/postgis:16-3.4 \
    postgres -c shared_buffers=2GB -c work_mem=128MB -c maintenance_work_mem=1GB \
             -c synchronous_commit=off -c max_wal_size=8GB >/dev/null
fi
until podman exec "$NAME" pg_isready -U firms -d firms >/dev/null 2>&1; do sleep 1; done
echo "Listo: postgresql://firms:firms_local@127.0.0.1:5432/firms"
echo "Esquema: psql postgresql://firms:firms_local@127.0.0.1:5432/firms -f docs/contracts/db_schema.sql"
