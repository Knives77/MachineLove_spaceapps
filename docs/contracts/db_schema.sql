-- Contrato de base de datos. PostgreSQL 16 + PostGIS.
-- Aplicar: psql "$DATABASE_URL" -f docs/contracts/db_schema.sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Detecciones normalizadas (una fila por hotspot). Alimenta el modo crudo y el CSV.
CREATE TABLE IF NOT EXISTS detection (
    id             BIGSERIAL PRIMARY KEY,
    country        CHAR(2)  NOT NULL,              -- MX | AR (AR fuera del MVP)
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    acq_date       DATE     NOT NULL,
    acq_time       CHAR(4)  NOT NULL,              -- HHMM UTC
    acq_ts         TIMESTAMPTZ NOT NULL,
    satellite      TEXT     NOT NULL,              -- Terra | Aqua | SNPP | N20 | N21
    family         TEXT     NOT NULL,              -- MODIS | VIIRS
    confidence_raw TEXT     NOT NULL,
    frp            REAL     NOT NULL,
    scan           REAL     NOT NULL,
    track          REAL     NOT NULL,
    daynight       CHAR(1)  NOT NULL,              -- D | N
    type           SMALLINT,                       -- NULL en NRT
    source         TEXT     NOT NULL,              -- country | archive | nrt
    is_veg         BOOLEAN  NOT NULL,
    cy             INTEGER  NOT NULL,              -- floor(lat*100)
    cx             INTEGER  NOT NULL               -- floor(lon*100)
);
-- Índices: crearlos DESPUÉS del COPY.
CREATE INDEX IF NOT EXISTS detection_cell_date ON detection (cy, cx, acq_date);
CREATE INDEX IF NOT EXISTS detection_date      ON detection (acq_date);

-- 2. Celdas con fuente estática recurrente (type = 2 en >= 3 fechas).
CREATE TABLE IF NOT EXISTS static_cell (
    cy INTEGER NOT NULL,
    cx INTEGER NOT NULL,
    n_dates INTEGER NOT NULL,
    PRIMARY KEY (cy, cx)
);

-- 3. Catálogo de celdas con al menos una detección. Es lo que se cruza con el polígono.
CREATE TABLE IF NOT EXISTS cell (
    cy INTEGER NOT NULL,
    cx INTEGER NOT NULL,
    country CHAR(2) NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,           -- centro: ((cx+0.5)/100, (cy+0.5)/100)
    PRIMARY KEY (cy, cx)
);
CREATE INDEX IF NOT EXISTS cell_geom ON cell USING GIST (geom);

-- 4. Celda-día: la unidad de actividad. Una fila por celda y fecha con alguna detección.
CREATE TABLE IF NOT EXISTS cell_day (
    cy        INTEGER  NOT NULL,
    cx        INTEGER  NOT NULL,
    acq_date  DATE     NOT NULL,
    modis_veg BOOLEAN  NOT NULL,                   -- alguna detección MODIS con is_veg
    viirs_veg BOOLEAN  NOT NULL,                   -- alguna detección is_veg del VIIRS de referencia de ese día
    raw_points SMALLINT NOT NULL,                  -- todas las detecciones, todos los satélites, todos los type
    raw_modis  SMALLINT NOT NULL,
    raw_viirs  SMALLINT NOT NULL,
    frp_modis  REAL,                               -- suma FRP MODIS is_veg (mejora opcional)
    frp_viirs  REAL,                               -- suma FRP del VIIRS de referencia is_veg
    PRIMARY KEY (cy, cx, acq_date)
);
CREATE INDEX IF NOT EXISTS cell_day_date ON cell_day (acq_date);

-- 5. Días sin datos por satélite y país.
CREATE TABLE IF NOT EXISTS sensor_outage (
    satellite  TEXT NOT NULL,
    country    CHAR(2) NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    origin     TEXT NOT NULL,                      -- detected | firms_readme | coverage
    PRIMARY KEY (satellite, country, start_date)
);

-- 6. Factor de respaldo por país (cuando el área consultada tiene poco traslape).
CREATE TABLE IF NOT EXISTS calibration_country (
    country CHAR(2) PRIMARY KEY,
    k DOUBLE PRECISION NOT NULL,
    overlap_months INTEGER NOT NULL,
    modis_cell_days BIGINT NOT NULL,
    viirs_cell_days BIGINT NOT NULL,
    loyo_annual_mape DOUBLE PRECISION NOT NULL
);

-- 7. Regiones predefinidas.
CREATE TABLE IF NOT EXISTS preset (
    id      TEXT PRIMARY KEY,                      -- qro-sierra-gorda | qro-bajio | qro-recuadro
    name_es TEXT NOT NULL,
    name_en TEXT NOT NULL,
    country CHAR(2) NOT NULL,
    geom    GEOMETRY(Polygon, 4326) NOT NULL
);
INSERT INTO preset VALUES
 ('qro-sierra-gorda', 'Sierra Gorda, Querétaro', 'Sierra Gorda, Querétaro', 'MX',
  ST_MakeEnvelope(-100.6, 20.9, -99.0, 21.7, 4326)),
 ('qro-bajio', 'Bajío queretano', 'Querétaro lowlands (Bajío)', 'MX',
  ST_MakeEnvelope(-100.6, 20.0, -99.0, 20.9, 4326)),
 ('qro-recuadro', 'Querétaro completo (recuadro)', 'Querétaro (full box)', 'MX',
  ST_MakeEnvelope(-100.6, 20.0, -99.0, 21.7, 4326))
ON CONFLICT (id) DO NOTHING;
-- Los presets son rectángulos provisionales. Mejora: sustituirlos por los polígonos oficiales.
