# MachineLove · NASA Space Apps 2026

**Harmonization of MODIS and VIIRS Hot Spots.** Un calendario de actividad de quema donde no importa qué satélite tomó el dato: cada mes se compara contra su propia historia (2000–2026) para saber si es normal o anómalo. MVP: México.

## Estructura

```
etl/        ingesta de FIRMS, máscara estática, caídas de sensor, celdas-día, calibración
backend/    API FastAPI: /presets, /calendar, /calendar.csv, /hotspots.csv
web/        frontend React + Vite + Tailwind
docs/       contexto, PRD, checklist, topología, contratos (docs/contracts/), pitch
scripts/    base de datos (Postgres + PostGIS), descarga del histórico, cifras del pitch
data/       CSV de FIRMS (fuera de Git; se regenera con scripts/download_history.sh)
```

`etl/` y `backend/` comparten el mismo `pyproject.toml` (Python 3.12+, `uv`).

## Cómo correrlo

```bash
scripts/db_up.sh                                   # Postgres + PostGIS en 127.0.0.1:5432
scripts/download_history.sh                        # histórico de FIRMS a data/
uv run python -m etl.run --all                     # ETL completo
uv run uvicorn backend.main:app --port 8000        # API
pnpm install --frozen-lockfile && pnpm dev         # frontend (workspace pnpm en la raíz)
```

Pruebas: `uv run pytest etl backend`.

## Documentación

| Para | Leer |
|---|---|
| Entender el reto y los datos | [`docs/CONTEXT.md`](docs/CONTEXT.md) |
| Qué construimos y cuándo | [`docs/PRD.md`](docs/PRD.md), [`docs/CHECKLIST.md`](docs/CHECKLIST.md) |
| Dónde corre cada cosa y cómo conectarse | [`docs/TOPOLOGIA.md`](docs/TOPOLOGIA.md) |
| Qué entrega cada parte a la otra | [`docs/contracts/README.md`](docs/contracts/README.md) |
| La API | [`backend/README.md`](backend/README.md), [`docs/contracts/api.md`](docs/contracts/api.md) |
| El pitch | [`docs/PITCH.md`](docs/PITCH.md), [`docs/ANALISTA.md`](docs/ANALISTA.md) |
| Qué cambió | [`CHANGELOG.md`](CHANGELOG.md) |
