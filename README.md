# MachineLove · NASA Space Apps 2026

**Harmonization of MODIS and VIIRS Hot Spots.** Un calendario de actividad de quema donde no importa qué satélite tomó el dato: cada mes se compara contra su propia historia (2000–2026) para saber si es normal o anómalo. MVP: México.

## Estructura

```
etl/        ingesta de FIRMS, máscara estática, caídas de sensor, celdas-día, calibración
backend/    API FastAPI: /presets, /calendar, /calendar.csv, /hotspots.csv
web/        frontend React + Vite + Tailwind
docs/       contexto, PRD, contratos (docs/contracts/), accesos y túneles SSH
scripts/    base de datos (Postgres + PostGIS) y descarga del histórico
data/       CSV de FIRMS (fuera de Git; se regenera con scripts/download_history.sh)
```

`etl/` y `backend/` comparten el mismo `pyproject.toml` (Python 3.12+, `uv`).

## Cómo correrlo

```bash
scripts/db_up.sh                                   # Postgres + PostGIS en 127.0.0.1:5432
scripts/download_history.sh                        # histórico de FIRMS a data/
uv run python -m etl.run --all                     # ETL completo
uv run uvicorn backend.main:app --port 8000        # API
cd web && pnpm install && pnpm dev                 # frontend
```

Pruebas: `uv run pytest etl backend`.

Más detalle en [`docs/CONTEXT.md`](docs/CONTEXT.md), [`docs/PRD.md`](docs/PRD.md) y [`backend/README.md`](backend/README.md).
