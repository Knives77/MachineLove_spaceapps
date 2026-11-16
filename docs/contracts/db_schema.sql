-- Database contract. PostgreSQL 16 + PostGIS.
-- Apply: psql "$DATABASE_URL" -f docs/contracts/db_schema.sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Normalized detections (one row per hot spot). Feeds raw mode and the CSV.
CREATE TABLE IF NOT EXISTS detection (
    id             BIGSERIAL PRIMARY KEY,
    country        CHAR(2)  NOT NULL,              -- MX | AR (AR outside the MVP)
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
    type           SMALLINT,                       -- NULL in NRT
    source         TEXT     NOT NULL,              -- country | archive | nrt
    is_veg         BOOLEAN  NOT NULL,
    cy             INTEGER  NOT NULL,              -- floor(lat*100)
    cx             INTEGER  NOT NULL               -- floor(lon*100)
);
-- Indexes: create them AFTER the COPY.
CREATE INDEX IF NOT EXISTS detection_cell_date ON detection (cy, cx, acq_date);
CREATE INDEX IF NOT EXISTS detection_date      ON detection (acq_date);

-- 2. Cells with a recurring static source (type = 2 on >= 3 dates).
CREATE TABLE IF NOT EXISTS static_cell (
    cy INTEGER NOT NULL,
    cx INTEGER NOT NULL,
    n_dates INTEGER NOT NULL,
    PRIMARY KEY (cy, cx)
);

-- 3. Catalog of cells with at least one detection. This is what is intersected with the polygon.
CREATE TABLE IF NOT EXISTS cell (
    cy INTEGER NOT NULL,
    cx INTEGER NOT NULL,
    country CHAR(2) NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,           -- center: ((cx+0.5)/100, (cy+0.5)/100)
    PRIMARY KEY (cy, cx)
);
CREATE INDEX IF NOT EXISTS cell_geom ON cell USING GIST (geom);

-- 4. Cell-day: the unit of activity. One row per cell and date with any detection.
CREATE TABLE IF NOT EXISTS cell_day (
    cy        INTEGER  NOT NULL,
    cx        INTEGER  NOT NULL,
    acq_date  DATE     NOT NULL,
    modis_veg BOOLEAN  NOT NULL,                   -- any MODIS detection with is_veg
    viirs_veg BOOLEAN  NOT NULL,                   -- any is_veg detection from that day's reference VIIRS
    raw_points SMALLINT NOT NULL,                  -- all detections, all satellites, all types
    raw_modis  SMALLINT NOT NULL,
    raw_viirs  SMALLINT NOT NULL,
    frp_modis  REAL,                               -- sum of MODIS is_veg FRP (optional enhancement)
    frp_viirs  REAL,                               -- sum of the reference VIIRS is_veg FRP
    PRIMARY KEY (cy, cx, acq_date)
);
CREATE INDEX IF NOT EXISTS cell_day_date ON cell_day (acq_date);

-- 5. Days without data per satellite and country.
CREATE TABLE IF NOT EXISTS sensor_outage (
    satellite  TEXT NOT NULL,
    country    CHAR(2) NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    origin     TEXT NOT NULL,                      -- detected | firms_readme | coverage
    PRIMARY KEY (satellite, country, start_date)
);

-- 6. Fallback factor per country (when the queried area has little overlap).
CREATE TABLE IF NOT EXISTS calibration_country (
    country CHAR(2) PRIMARY KEY,
    k DOUBLE PRECISION NOT NULL,
    overlap_months INTEGER NOT NULL,
    modis_cell_days BIGINT NOT NULL,
    viirs_cell_days BIGINT NOT NULL,
    loyo_annual_mape DOUBLE PRECISION NOT NULL
);

-- 7. Predefined regions.
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
-- The presets are provisional rectangles. Enhancement: replace them with the official polygons.
