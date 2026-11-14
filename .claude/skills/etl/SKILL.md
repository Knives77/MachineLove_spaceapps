---
name: etl
description: Guía para construir o modificar el ETL de FIRMS (carpeta etl/) - ingesta de CSV, máscara estática, celdas-día, caídas de sensor y calibración. Úsala antes de tocar cualquier archivo de etl/ o de cargar datos a Postgres.
---

# ETL de hotspots FIRMS

Lee primero `docs/contracts/ingest.md`, `docs/contracts/db_schema.sql` y `docs/contracts/harmonization.md`. Son la especificación; este archivo solo dice cómo trabajar.

## Entorno

```bash
uv init --python 3.12        # solo si no existe pyproject.toml
uv add polars "psycopg[binary]" pytest
export DATABASE_URL=postgresql://firms:firms_local@localhost:5432/firms_dev   # pruebas; la ingesta oficial usa /firms
export FIRMS_DATA_DIR=<ruta a data/>     # en tu laptop, la muestra; en el anfitrión, data/ completa
```

No instales nada con `pip` global ni `sudo`.

## Módulos y orden

| Paso | Módulo | Qué hace | Salida |
|---|---|---|---|
| 1 ✅ | `etl/ingest.py` | **Hecho.** Lee las fuentes A, B y C, normaliza, calcula `cy`/`cx`, `COPY`. Carga completa: 15.9 M filas en ~90 s. Pruebas en `etl/tests/test_ingest.py` | `detection` (sin `is_veg` final para NRT) |
| 2 ✅ | `etl/mask.py` | **Hecho.** Celdas con `type = 2` en ≥ 3 fechas; luego fija `is_veg` de NRT. Validado sobre archive 2024+: atrapa 94% (MODIS) y 99.9% (VIIRS) de los `type = 2` y quita por error ~2% del fuego real | `static_cell`, `detection.is_veg` |
| 3 ✅ | `etl/outages.py` | **Hecho.** Días sin detecciones por satélite y país (`detected`), huecos exactos del Readme (`firms_readme`) y periodos sin archivos (`coverage`). Pruebas en `etl/tests/test_outages.py` | `sensor_outage` |
| 4 | `etl/cells.py` | Agrega a celda-día con la regla del VIIRS de referencia | `cell`, `cell_day` |
| 5 | `etl/calibrate.py` | `k` por país y validación dejando un año fuera | `calibration_country` |
| 6 | `etl/run.py` | `--all` o `--step N`; `--country MX|AR`; `--limit-years 2019,2020` para pruebas | |

Cada paso debe poder repetirse sin duplicar filas (`TRUNCATE` de sus tablas al empezar, o borrar por país).

## Reglas

- Leer los CSV con polars indicando `schema_overrides={"acq_time": pl.Utf8, "confidence": pl.Utf8, "version": pl.Utf8}`. Seleccionar columnas por nombre.
- Fuente A VIIRS: renombrar `bright_ti4` → `brightness`, `bright_ti5` → `bright_t31`, y `satellite` `N` → `SNPP`.
- `family` se deriva de `satellite`, nunca de `instrument`.
- `cy = floor(latitude * 100)`, `cx = floor(longitude * 100)` como enteros de 32 bits. Con longitudes negativas `floor` y truncar dan resultados distintos.
- Fuentes B y C: conservar solo `acq_date >= 2026-01-01`, excepto N21, que se conserva completo.
- Carga con `cursor.copy("COPY detection (...) FROM STDIN")` por archivo. Los índices se crean al final del paso 1.
- Buscar archivos con comodines (`glob`), porque hay rutas con acentos y un typo en `J1-VIRS-C2`.
- Procesar un archivo a la vez: la máquina tiene 16 GB compartidos. No cargar todos los CSV en memoria.
- Los pasos 2 a 5 son SQL (`INSERT ... SELECT ... GROUP BY`) ejecutado desde Python; no traer `detection` a memoria.

## Regla del VIIRS de referencia (paso 4)

Para cada fecha y país: referencia = `SNPP` antes de 2018-04-01, `N20` después. Si la referencia tiene caída ese día en `sensor_outage`, usar el otro; si faltan ambos, `N21`. `cell_day.viirs_veg` es verdadero solo si hay una detección `is_veg` de **ese** satélite.

## Cómo probar

El MVP solo usa México; el ETL procesa ambos países porque cuesta poco y deja lista la fase 2.

1. Primero con poco: `uv run python -m etl.run --all --country MX --limit-years 2011,2012,2019`.
2. Comparar contra la tabla de `docs/contracts/acceptance.md` con esta consulta:

```sql
SELECT extract(year FROM acq_date) AS y,
       count(*) FILTER (WHERE modis_veg) AS modis,
       count(*) FILTER (WHERE viirs_veg) AS viirs
FROM cell_day
WHERE cy BETWEEN 2000 AND 2170 AND cx BETWEEN -10060 AND -9900   -- recuadro Querétaro
GROUP BY 1 ORDER BY 1;
```

   Debe dar MODIS 410 (2011), 190 (2012), 414 (2019). Las cifras de control incluyen el borde del recuadro: si difieren por 1–3 celdas-día, revisar los límites; si difieren más de 1%, hay un error.
3. Solo entonces correr todo: `uv run python -m etl.run --all`.
4. Escribir en `etl/tests/` una prueba por cada casilla de la sección ETL de `acceptance.md`.

## No hacer

- No usar H3, geopandas ni PostGIS para asignar celdas: es aritmética.
- No filtrar por `confidence` (no está en el método).
- No cambiar nombres de tablas o columnas sin cambiar antes el contrato.
- No modificar ni borrar nada dentro de `data/`.
