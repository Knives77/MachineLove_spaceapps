# Backend · Calendario Armonizado de Actividad de Quema (FastAPI)

Este módulo implementa el servidor REST del proyecto **MachineLove (NASA Space Apps 2026)** siguiendo los contratos congelados en [`docs/contracts/`](../docs/contracts/).

---

## 1. Arquitectura y Archivos

| Archivo | Responsabilidad |
|---|---|
| `main.py` | Instancia FastAPI, configuración CORS (`localhost` / `127.0.0.1`) y manejadores globales de errores con el formato `{"error": {"code": "...", "detail": "..."}}`. |
| `models.py` | Esquemas Pydantic v2 estrictos (`extra="forbid"`) para peticiones y respuestas según [`docs/contracts/api.md`](../docs/contracts/api.md). |
| `aoi.py` | Validación geométrica de polígonos GeoJSON en WGS84, cálculo de área ($\le 200,000\text{ km}^2$), presets de México (`qro-sierra-gorda`, `qro-bajio`, `qro-recuadro`) y restricción de cobertura del MVP a México (`MX`). |
| `queries.py` | Consultas SQL parametrizadas sobre PostgreSQL 16 + PostGIS (`preset`, `cell`, `cell_day`, `detection`, `sensor_outage`, `calibration_country`) y cursor de servidor en streaming para `/hotspots.csv`. |
| `harmonize.py` | Funciones puras (sin base de datos): calibración de $k = \frac{\sum M}{\sum V}$ en el traslape `2012-02` a `2025-12` (con respaldo a $k$ nacional si $\sum M < 100$), validación LOYO anual y MAPE mensual, series `modis_primary` y `viirs_primary`, banderas de calidad, línea base histórica ($\ge 10$ años excluyendo meses con caídas/incompletos), percentiles (`p25`, `median`, `p75`, `p90`), `status`, agregados anuales, estacionalidad y `latest`. |
| `routes.py` | Endpoints REST (`/health`, `/presets`, `/calendar`, `/calendar.csv`, `/hotspots.csv`, `/hotspots`), modo `API_MOCK=1` y caché en memoria (TTL 60 s) para presets. |
| `tests/` | Suite de pruebas unitarias (`test_harmonize.py`), de endpoints (`test_api.py`) y de simulación de sistema extremo a extremo (`test_system_e2e.py`). |

---

## 2. Flujo del Proceso de Armonización en cada petición `POST /calendar`

1. **Resolución y validación del AOI (`aoi.py` / `queries.py`):**
   - Si recibe `preset_id`, verifica que sea uno de los 3 presets oficiales de México (`qro-sierra-gorda`, `qro-bajio`, `qro-recuadro`); si no existe → `404 unknown_preset`.
   - Si recibe `geometry` (GeoJSON `Polygon`), valida anillo cerrado, coordenadas WGS84 y geometría válida → si falla, `400 invalid_geometry`.
   - Calcula el área en $\text{km}^2$ con `ST_Area(g::geography) / 1e6` → si supera $200,000\text{ km}^2$, devuelve `400 aoi_too_large`.
   - Verifica intersección con celdas de México (`cell.country = 'MX'`) o el rectángulo de México → si cae en el océano o en Argentina (fuera del MVP), devuelve `422 aoi_outside_coverage`.

2. **Consulta mensual (`queries.py`):**
   - Cruza `cell` con `cell_day` para obtener $M(m)$ (`modis_cell_days`), $V(m)$ (`viirs_cell_days`) y $R(m)$ (`raw_points`) para todos los meses de `2000–2026`.
   - Recupera `sensor_outage`, `calibration_country` y meses con datos provisionales (`source = 'nrt'`).

3. **Calibración y Serie Armonizada (`harmonize.py`):**
   - Identifica los meses válidos del traslape (`2012-02` a `2025-12` sin `modis_outage`, `viirs_outage` ni `no_coverage`).
   - Calcula $k = \frac{\sum M}{\sum V}$ (`scope = "aoi"`, o `scope = "country"` si $\sum M < 100$).
   - Calcula el error dejando un año fuera (`loyo_annual_mape`, `loyo_annual_max`) y el error mensual mediano (`monthly_mape`).
   - Construye la serie mensual en **celdas-día equivalentes MODIS**:
     - `modis_primary`: $M(m)$ cuando MODIS tiene cobertura; $k \cdot V(m)$ cuando no.
     - `viirs_primary` (simulación de retiro de MODIS): $k \cdot V(m)$ desde `2012-02`; $M(m)$ antes.
   - Calcula para cada mes su línea base contra los demás años del mismo mes calendario (excluyendo meses con banderas de caída o incompletos) y clasifica `status` (`no_data`, `insufficient_baseline`, `below`, `normal`, `above`, `critical`).

---

## 3. Cómo ejecutar y probar

### Levantar el servidor
```bash
# 1. Modo Mock (sin base de datos ni túnel SSH):
API_MOCK=1 uv run uvicorn api.main:app --reload --port 8001

# 2. Modo Real (con túnel SSH en 5432 o en el anfitrión):
export DATABASE_URL=postgresql://firms:firms_local@127.0.0.1:5432/firms
uv run uvicorn api.main:app --reload --port 8001
```

### Correr todas las pruebas (unitarias + aceptación + simulación de sistema)
```bash
uv run pytest Backend api -v
```

