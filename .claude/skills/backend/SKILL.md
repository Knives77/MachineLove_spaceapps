---
name: backend
description: Guía para construir o modificar el backend FastAPI (carpeta backend/) - endpoints /presets, /calendar, /calendar.csv y /hotspots.csv sobre Postgres + PostGIS. Úsala antes de tocar cualquier archivo de backend/.
---

# Backend FastAPI

La especificación es `docs/contracts/api.md` (forma de peticiones y respuestas) y `docs/contracts/harmonization.md` (fórmulas). Las tablas están en `docs/contracts/db_schema.sql`. No inventes campos.

## Entorno

```bash
uv add fastapi "uvicorn[standard]" "psycopg[binary,pool]" pydantic shapely pytest httpx
export DATABASE_URL=postgresql://firms:firms_local@localhost:5432/firms
uv run uvicorn backend.main:app --reload --port 8001     # desarrollo
uv run uvicorn backend.main:app --port 8000              # estable, la que usa frontend
```

## Archivos

| Archivo | Contenido |
|---|---|
| `backend/main.py` | App, CORS (`http://localhost:*`), manejador de errores con la forma `{"error": {code, detail}}` |
| `backend/models.py` | Modelos Pydantic idénticos al contrato |
| `backend/aoi.py` | Resolver `preset_id` o `geometry`, validar, área, país |
| `backend/queries.py` | SQL |
| `backend/harmonize.py` | `k`, serie, línea base, estados. Funciones puras, sin base de datos |
| `backend/routes.py` | Los endpoints |
| `backend/tests/` | Pruebas |

## Trabajar antes de que exista la base

Hasta el hito H1 no hay datos. Empieza por `backend/harmonize.py` y sus pruebas con listas escritas a mano, y haz que los endpoints devuelvan los JSON de `docs/contracts/examples/` detrás de la variable `API_MOCK=1`. Así frontend puede apuntar a la API desde el primer momento.

## Consulta central de `/calendar`

Una sola consulta devuelve los conteos mensuales; todo lo demás se calcula en Python.

```sql
WITH aoi AS (SELECT ST_GeomFromGeoJSON(%(geojson)s)::geometry(Polygon, 4326) AS g),
     c AS (SELECT cy, cx FROM cell, aoi WHERE ST_Intersects(cell.geom, aoi.g))
SELECT date_trunc('month', d.acq_date)::date AS month,
       count(*) FILTER (WHERE d.modis_veg) AS modis_cell_days,
       count(*) FILTER (WHERE d.viirs_veg) AS viirs_cell_days,
       sum(d.raw_points)                   AS raw_points
FROM cell_day d JOIN c USING (cy, cx)
WHERE d.acq_date >= %(start)s AND d.acq_date < %(end)s
GROUP BY 1 ORDER BY 1;
```

- Siempre parámetros; nunca concatenar texto en el SQL.
- Para `k` se necesita el traslape 2012-02 → 2025-12 completo aunque el usuario pida otro rango: consultar siempre 2000–2026 y recortar al final.
- Los meses sin filas no aparecen en el resultado: generar la lista completa de meses en Python y rellenar. Un mes sin filas pero con cobertura vale **0**, no `null`. Es `null` solo si hay `no_coverage` o caída total.
- **MVP solo México.** Filtrar siempre `cell.country = 'MX'`. Si el área no tiene celdas de México y no toca el rectángulo de México (lat 14.5–32.8, lon −118.5 a −86.5) → 422 `aoi_outside_coverage`. Argentina está en la base pero se rechaza hasta la fase 2.
- Área en km²: `ST_Area(g::geography) / 1e6`. Rechazar más de 200,000.
- Banderas de caída: contar por mes los días de `sensor_outage` del país.

## `/hotspots.csv`

Mismo CTE de celdas, `JOIN detection USING (cy, cx)`, filtro por fechas, y además `ST_Intersects` del punto exacto con el polígono para no incluir puntos de celdas de borde. Devolver con `StreamingResponse` y un cursor del lado del servidor; no armar el CSV en memoria.

## Pruebas

- `backend/harmonize.py`: una prueba por cada fila de las tablas de `harmonization.md` (estados, banderas, `basis`, respaldo a `k` de país con menos de 100 celdas-día).
- Endpoints: las casillas de la sección API de `docs/contracts/acceptance.md`, con `httpx` y `TestClient`.
- Antes de avisar que algo está listo: `uv run pytest backend` y una llamada real con `curl` al preset `qro-sierra-gorda`.

## No hacer

- No devolver textos para humanos; solo códigos.
- No calcular nada que el contrato asigne al ETL (`is_veg`, VIIRS de referencia).
- No cambiar la forma de una respuesta sin que el analista cambie antes `api.md` y los ejemplos.
- No añadir autenticación, caché distribuida ni tareas en segundo plano.
