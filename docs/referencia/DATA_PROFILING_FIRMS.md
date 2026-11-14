# Data Profiling NASA FIRMS (MODIS C6.1 + VIIRS C2): /data
Fecha del análisis: 2026-11-13 · Herramienta: Python 3 stdlib (csv), lectura completa de los 15 CSV.

> Nota operativa: se descomprimieron los 6 zips que faltaban en subcarpetas nuevas por sensor (`unzip -n`, sin sobrescribir). Con `cmp` se comprobó que los CSV que ya estaban extraídos son idénticos byte a byte al contenido de sus zips. No se modificó ni borró ningún CSV original.

## 1. Inventario de Archivos y Volumen

```
data/
├── México-Querétaro/
│   ├── DL_FIRE_M-C61_844352.zip    (3.40 MB)
│   ├── DL_FIRE_J1V-C2_844353.zip   (14.59 MB)
│   ├── DL_FIRE_J2V-C2_844354.zip   (14.01 MB)
│   ├── DL_FIRE_SV-C2_844355.zip    (14.10 MB)
│   ├── satellites.png
│   ├── MODIS/          fire_archive_M-C61_844352.csv, fire_nrt_M-C61_844352.csv, Readme.txt
│   ├── J1-VIRS-C2/     fire_archive_J1V-C2_844353.csv, fire_nrt_J1V-C2_844353.csv, Readme.txt   (sic: "VIRS")
│   ├── J2-VIIRS-C2/    fire_archive_J2V-C2_844354.csv, fire_nrt_J2V-C2_844354.csv, Readme.txt   (extraído 2026-11-13)
│   └── SNPP-VIIRS-C2/  fire_archive_SV-C2_844355.csv,  fire_nrt_SV-C2_844355.csv,  Readme.txt   (extraído 2026-11-13)
└── Argentina/
    ├── DL_FIRE_M-C61_844360.zip (0.05 MB) · DL_FIRE_J1V-C2_844361.zip (0.23 MB)
    ├── DL_FIRE_J2V-C2_844362.zip (0.22 MB) · DL_FIRE_SV-C2_844363.zip (0.17 MB)
    ├── satellites.png
    ├── MODIS/          fire_archive_M-C61_844360.csv   (¡SIN archivo NRT en el zip!)
    ├── J1-VIIRS-C2/    fire_archive_J1V-C2_844361.csv, fire_nrt_J1V-C2_844361.csv
    ├── J2-VIIRS-C2/    fire_archive_J2V-C2_844362.csv, fire_nrt_J2V-C2_844362.csv
    └── SNPP-VIIRS-C2/  fire_archive_SV-C2_844363.csv,  fire_nrt_SV-C2_844363.csv
```
Readme.txt (89 bytes) solo dice: "To view Readme.txt please visit https://firms.modaps.eosdis.nasa.gov/download/Readme.txt"

| Región | Archivo | MB | wc -l | Filas de datos |
|---|---|---:|---:|---:|
| MX | fire_archive_M-C61_844352.csv  | 14.63 | 190,446 | 190,445 |
| MX | fire_nrt_M-C61_844352.csv      |  0.22 |   2,670 |   2,669 |
| MX | fire_archive_SV-C2_844355.csv  | 60.57 | 777,501 | 777,500 |
| MX | fire_nrt_SV-C2_844355.csv      |  1.70 |  21,047 |  21,046 |
| MX | fire_archive_J1V-C2_844353.csv | 62.39 | 800,672 | 800,671 |
| MX | fire_nrt_J1V-C2_844353.csv     |  1.71 |  21,190 |  21,189 |
| MX | fire_archive_J2V-C2_844354.csv | 59.74 | 766,415 | 766,414 |
| MX | fire_nrt_J2V-C2_844354.csv     |  1.67 |  20,666 |  20,665 |
| AR | fire_archive_M-C61_844360.csv  |  0.22 |   2,894 |   2,893 |
| AR | fire_archive_SV-C2_844363.csv  |  0.55 |   7,000 |   6,999 |
| AR | fire_nrt_SV-C2_844363.csv      |  0.20 |   2,516 |   2,515 |
| AR | fire_archive_J1V-C2_844361.csv |  0.82 |  10,412 |  10,411 |
| AR | fire_nrt_J1V-C2_844361.csv     |  0.22 |   2,662 |   2,661 |
| AR | fire_archive_J2V-C2_844362.csv |  0.73 |   9,333 |   9,332 |
| AR | fire_nrt_J2V-C2_844362.csv     |  0.22 |   2,692 |   2,691 |
| **Total MX** | | **203.03** | | **2,600,599** |
| **Total AR** | | **2.96** | | **37,502** |

(wc -l incluye el encabezado; todos los archivos terminan en `\n`)

## 2. Auditoría de Esquemas (Columnas y Tipos)

Solo hay **2 esquemas**, idénticos en orden y nombre para los 4 sensores (M-C61, SV-C2, J1V-C2, J2V-C2) y las 2 regiones:

**fire_archive_\* (15 columnas):**
`latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`

**fire_nrt_\* (14 columnas):** el mismo, **sin `type`**:
`latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight`

- Los VIIRS NO usan `bright_ti4` / `bright_ti5`. En estas descargas vienen como `brightness` / `bright_t31`, igual que MODIS. Semánticamente en VIIRS son las bandas I4 / I5 (375 m) y en MODIS los canales 21/22 y 31 (1 km). El nombre es el mismo pero la física es distinta.
- El orden de las columnas es idéntico en los 15 archivos. Ningún archivo tiene filas con un número de campos distinto al del encabezado (0 filas malformadas).

Tipos inferidos (sugerencia PostgreSQL):

| Columna | Tipo | Nota |
|---|---|---|
| latitude, longitude | NUMERIC(8,5) / DOUBLE | 0 a 5 decimales (ceros finales recortados) |
| brightness, bright_t31, frp, scan, track | REAL/NUMERIC | |
| acq_date | DATE | ISO `YYYY-MM-DD` en todos |
| acq_time | **TEXT/CHAR(4)** `HHMM` UTC | siempre 4 caracteres, con cero a la izquierda |
| satellite, instrument, daynight | TEXT | |
| confidence | **TEXT** | entero 0-100 en MODIS, letra l/n/h en VIIRS |
| version | **TEXT** | `61.03`, `6.1NRT`, `2`, `2.0NRT` |
| type | SMALLINT NULL | solo en archive |

Filas de ejemplo reales (México):
```
-- fire_archive_M-C61
30.4957,-109.6295,304.4,1,1,2024-01-01,0450,Terra,MODIS,60,61.03,275.1,11.5,N,2
31.6034,-106.5318,328.7,1.1,1,2024-01-01,0450,Terra,MODIS,100,61.03,273.9,37.2,N,0
-- fire_nrt_M-C61
18.14518,-92.33479,310.13,2.38,1.49,2026-09-01,0211,Terra,MODIS,79,6.1NRT,291.43,27.66,N
17.89925,-93.16592,304.45,2.79,1.6,2026-09-01,0211,Terra,MODIS,33,6.1NRT,269.25,25.32,N
-- fire_archive_SV-C2
28.69653,-100.51449,304.95,0.45,0.63,2024-01-01,0739,SNPP,SNPP,n,2,280.84,1.37,N,0
25.70044,-100.30077,305.33,0.41,0.6,2024-01-01,0740,SNPP,SNPP,n,2,284.54,1.74,N,2
-- fire_nrt_SV-C2
23.9546,-100.96375,299.24,0.43,0.46,2026-08-01,0809,SNPP,SNPP,n,2.0NRT,285.97,1.13,N
24.42661,-98.41745,311.25,0.47,0.4,2026-08-01,0809,SNPP,SNPP,n,2.0NRT,293.7,1.58,N
-- fire_archive_J1V-C2
18.6499,-92.1795,336.93,0.68,0.74,2024-01-01,0651,N20,VIIRS,n,2,289.2,13.52,N,2
18.64853,-92.1777,352.18,0.68,0.74,2024-01-01,0651,N20,VIIRS,n,2,289.27,9.68,N,2
-- fire_nrt_J1V-C2
19.31296,-89.17342,312.37,0.55,0.68,2026-08-01,0650,N20,VIIRS,n,2.0NRT,290.16,1.9,N
18.78185,-88.59986,303.99,0.49,0.65,2026-08-01,0650,N20,VIIRS,n,2.0NRT,289.25,1.31,N
-- fire_archive_J2V-C2
20.94327,-89.66634,300.45,0.38,0.43,2024-01-01,0715,N21,VIIRS,n,2,289.74,1.46,N,2
20.94282,-89.66267,318.78,0.38,0.43,2024-01-01,0715,N21,VIIRS,n,2,290.1,1.77,N,2
-- fire_nrt_J2V-C2
24.42733,-98.41725,310.01,0.38,0.59,2026-08-01,0733,N21,VIIRS,n,2.0NRT,293.13,1.15,N
25.57426,-99.93937,337.08,0.49,0.65,2026-08-01,0733,N21,VIIRS,n,2.0NRT,293.53,4.4,N
```

## 3. Cobertura Temporal y Punto de Corte (Archive vs. NRT)

| Región | Sensor | Archive MIN–MAX | días c/datos | NRT MIN–MAX | días c/datos | Traslape | Hueco entre ambos |
|---|---|---|---:|---|---:|---|---|
| MX | M-C61  | 2024-01-01 – **2026-08-31** | 974 | **2026-09-01** – 2026-11-01 | 62 | 0 días, 0 registros | 0 días |
| MX | SV-C2  | 2024-01-01 – 2026-07-31 | 908 | 2026-08-01 – 2026-11-01 | 92 | 0 / 0 | 0 días |
| MX | J1V-C2 | 2024-01-01 – 2026-07-31 | 942 | 2026-08-01 – 2026-11-01 | 93 | 0 / 0 | 0 días |
| MX | J2V-C2 | 2024-01-01 – 2026-07-31 | 941 | 2026-08-01 – 2026-11-01 | 93 | 0 / 0 | 0 días |
| AR | M-C61  | 2026-07-01 – 2026-08-15 | 45 | — (no existe) | — | — | — |
| AR | SV-C2  | 2026-07-01 – 2026-07-31 | 25 | 2026-08-01 – 2026-08-15 | 14 | 0 / 0 | 0 días |
| AR | J1V-C2 | 2026-07-01 – 2026-07-31 | 31 | 2026-08-01 – 2026-08-15 | 15 | 0 / 0 | 0 días |
| AR | J2V-C2 | 2026-07-01 – 2026-07-31 | 31 | 2026-08-01 – 2026-08-15 | 15 | 0 / 0 | 0 días |

- El empalme archive→NRT es limpio: no hay fechas compartidas ni registros exactos repetidos (lat, lon, fecha, hora, satélite).
- **El punto de corte depende del sensor.** MODIS corta el 2026-08-31; los tres VIIRS cortan el 2026-07-31.
- Días sin ninguna detección dentro de cada archivo (los más probables son caídas del satélite, sobre todo en SNPP):
  - MX SV archive: 2024-05-30..06-03, 2024-07-10..07-15, 2024-07-24..07-28, 2024-09-26, 2024-11-03..11-05, 2025-07-07, 2026-03-10..03-12, 2026-04-28..04-30, 2026-06-01..06-02, 2026-07-11..07-16
  - MX SV NRT: 2026-08-03 · MX J1V archive: 2024-02-04 · MX J2V archive: 2024-02-27..02-28
  - AR SV archive: 2026-07-11..07-16 · AR SV NRT: 2026-08-03 · AR M-C61: 2026-08-11
  - MX M-C61 (archive y NRT), MX J1V NRT y MX J2V NRT no tienen huecos.

## 4. Distribución de Dominios y Valores Categóricos

### satellite / instrument

| Archivo | satellite | instrument |
|---|---|---|
| MX M-C61 archive | Aqua 106,924 · Terra 83,521 | MODIS 190,445 |
| MX M-C61 NRT | Aqua 1,340 · Terra 1,329 | MODIS 2,669 |
| MX SV archive / NRT | SNPP 777,500 / 21,046 | **SNPP** 777,500 / 21,046 (no "VIIRS") |
| MX J1V archive / NRT | N20 800,671 / 21,189 | VIIRS |
| MX J2V archive / NRT | N21 766,414 / 20,665 | VIIRS |
| AR M-C61 archive | Aqua 2,330 · Terra 563 | MODIS |
| AR SV / J1V / J2V | SNPP / N20 / N21 | SNPP / VIIRS / VIIRS |

### version (un solo valor por archivo)
MODIS archive `61.03` · MODIS NRT `6.1NRT` · VIIRS archive `2` · VIIRS NRT `2.0NRT`

### confidence MODIS (numérico 0-100)

| Archivo | min | p25 | p50 | p75 | p90 | max | media | <30 | ≥80 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| MX archive | 0 | 56 | 70 | 83 | 95 | 100 | 68.24 | 8,924 | 58,843 |
| MX NRT     | 0 | 52 | 66 | 79 | 94 | 100 | 64.30 | 209 | 652 |
| AR archive | 0 | 55 | 66 | 78 | 90 | 100 | 65.66 | 102 | 658 |

### confidence VIIRS (l / n / h)

| Archivo | l | n | h |
|---|---:|---:|---:|
| MX SV archive  | 95,065 | 636,699 | 45,736 |
| MX SV NRT      | 1,347 | 18,952 | 747 |
| MX J1V archive | 102,186 | 655,993 | 42,492 |
| MX J1V NRT     | 1,472 | 18,956 | 761 |
| MX J2V archive | 97,973 | 619,509 | 48,932 |
| MX J2V NRT     | 1,447 | 18,408 | 810 |
| AR SV archive / NRT  | 176 / 59 | 6,403 / 2,346 | 420 / 110 |
| AR J1V archive / NRT | 290 / 87 | 9,596 / 2,475 | 525 / 99 |
| AR J2V archive / NRT | 223 / 100 | 8,601 / 2,422 | 508 / 169 |

### type (solo archive)

| Archivo | 0 vegetación | 1 volcán | 2 estática/industrial | 3 offshore |
|---|---:|---:|---:|---:|
| MX M-C61 | 162,781 | 242 | 26,961 | 461 |
| MX SV    | 673,770 | 633 | 100,635 | 2,462 |
| MX J1V   | 696,006 | 603 | 101,718 | 2,344 |
| MX J2V   | 664,080 | 680 | 99,397 | 2,257 |
| AR M-C61 | 2,845 | 0 | 48 | 0 |
| AR SV    | 6,687 | 0 | 306 | 6 |
| AR J1V   | 10,051 | 0 | 351 | 9 |
| AR J2V   | 8,953 | 0 | 360 | 19 |

### daynight

| Archivo | D | N |
|---|---:|---:|
| MX M-C61 archive / NRT | 139,522 / 1,556 | 50,923 / 1,113 |
| MX SV archive / NRT    | 507,532 / 11,506 | 269,968 / 9,540 |
| MX J1V archive / NRT   | 521,453 / 11,248 | 279,218 / 9,941 |
| MX J2V archive / NRT   | 497,122 / 11,067 | 269,292 / 9,598 |
| AR M-C61 archive       | 2,594 | 299 |
| AR SV archive / NRT    | 5,516 / 1,685 | 1,483 / 830 |
| AR J1V archive / NRT   | 8,457 / 1,642 | 1,954 / 1,019 |
| AR J2V archive / NRT   | 7,459 / 1,664 | 1,873 / 1,027 |

## 5. Estadísticas Físicas y Geográficas (Calidad de Datos)

**Nulos / vacíos / NaN / "null": 0 en todas las columnas de los 15 archivos.** Tampoco hay espacios sobrantes al inicio o al final de ningún campo.

### Rango geográfico

| Archivo | lat min | lat max | lon min | lon max |
|---|---:|---:|---:|---:|
| MX M-C61 archive | 14.5872 | 32.7097 | -117.0763 | -86.8749 |
| MX M-C61 NRT     | 14.88378 | 32.70948 | -117.05504 | -87.97412 |
| MX SV archive    | 14.55428 | 32.70606 | -117.10682 | -86.82667 |
| MX SV NRT        | 14.64968 | 32.71013 | -117.09799 | -86.82835 |
| MX J1V archive   | 14.56294 | 32.70839 | -117.11522 | -86.82623 |
| MX J1V NRT       | 14.64936 | 32.71162 | -117.09445 | -86.82777 |
| MX J2V archive   | 14.57971 | 32.70947 | -117.09669 | -86.82739 |
| MX J2V NRT       | 14.62397 | 32.69139 | -117.08253 | -86.82962 |
| AR M-C61 archive | -42.4388 | -22.543 | -69.4515 | -53.8109 |
| AR SV archive / NRT  | -54.45886 / -50.78653 | -22.3538 / -22.2597 | -70.97124 / -70.83608 | -53.72038 / -53.67529 |
| AR J1V archive / NRT | -54.45925 / -54.45819 | -22.2208 / -22.14718 | -71.70706 / -70.7807 | -53.72648 / -53.75729 |
| AR J2V archive / NRT | -54.7949 / -50.78766 | -22.24476 / -22.14371 | -71.4641 / -71.19649 | -53.78099 / -53.77474 |

Las cajas cubren todo México y toda Argentina. Esto **NO** es un recorte de Querétaro.

### FRP (MW)
Todos los valores ≤0 son exactamente 0.0. No hay negativos ni nulos.

| Archivo | min | max | mediana | media | frp ≤ 0 |
|---|---:|---:|---:|---:|---:|
| MX M-C61 archive | 0.0 | 5006.7 | 18.0 | 35.38 | 8 |
| MX M-C61 NRT     | 0.0 | 399.4 | 12.21 | 21.98 | 1 |
| MX SV archive    | 0.0 | 1282.13 | 4.94 | 8.98 | 78 |
| MX SV NRT        | 0.0 | 509.89 | 4.18 | 7.57 | 4 |
| MX J1V archive   | 0.0 | 1796.68 | 4.98 | 9.10 | 123 |
| MX J1V NRT       | 0.0 | 756.08 | 4.21 | 8.02 | 12 |
| MX J2V archive   | 0.0 | 1489.36 | 5.88 | 10.68 | 201 |
| MX J2V NRT       | 0.0 | 1235.53 | 5.06 | 9.22 | 19 |
| AR M-C61 archive | 0.0 | 2542.7 | 14.9 | 31.85 | 1 |
| AR SV archive / NRT  | 0.05 / 0.09 | 307.03 / 332.48 | 4.82 / 3.93 | 9.22 / 8.43 | 0 / 0 |
| AR J1V archive / NRT | 0.07 / 0.04 | 324.03 / 199.14 | 4.94 / 3.98 | 9.58 / 9.01 | 0 / 0 |
| AR J2V archive / NRT | 0.03 / 0.08 | 432.3 / 231.05 | 5.855 / 4.55 | 11.34 / 11.02 | 0 / 0 |

### Tamaño de píxel (km): scan / track (min · media · max)

| Archivo | scan | track |
|---|---|---|
| MX M-C61 archive | 1.0 · 1.550 · 4.8 | 1.0 · 1.192 · 2.0 |
| MX M-C61 NRT     | 1.0 · 1.588 · 4.82 | 1.0 · 1.206 · 2.0 |
| MX SV archive    | 0.32 · 0.465 · 0.8 | 0.36 · 0.492 · 0.78 |
| MX SV NRT        | 0.32 · 0.465 · 0.8 | 0.36 · 0.490 · 0.78 |
| MX J1V archive   | 0.32 · 0.467 · 0.8 | 0.36 · 0.494 · 0.78 |
| MX J1V NRT       | 0.32 · 0.470 · 0.8 | 0.36 · 0.498 · 0.78 |
| MX J2V archive   | 0.32 · 0.466 · 0.8 | 0.36 · 0.492 · 0.78 |
| MX J2V NRT       | 0.32 · 0.467 · 0.8 | 0.36 · 0.494 · 0.78 |
| AR M-C61 archive | 1.0 · 1.558 · 4.8 | 1.0 · 1.197 · 2.0 |
| AR VIIRS (todos) | 0.32 · ~0.46–0.47 · 0.79–0.8 | 0.36 · ~0.485–0.505 · 0.78 |

### Brillo (K)
- MODIS `brightness`: 300.0–508.4 (MX archive), 300.0–409.66 (MX NRT), 300.0–441.0 (AR).
- VIIRS `brightness` (I4): **max = 367.0 exacto en los 3 sensores** (saturación de I4); min ≈ 207–208.
- VIIRS `bright_t31` (I5): 228.22–387.05 (MX).

## 6. Muestra Específica del Caso Local (Querétaro)
BBox: latitude ∈ [20.0, 21.7], longitude ∈ [-100.6, -99.0]. Solo hay datos en la carpeta México-Querétaro; Argentina da 0.

### Registros dentro del BBox

| Sensor | Archive | NRT | Total |
|---|---:|---:|---:|
| MODIS (Aqua+Terra) | 2,154 (Aqua 1,142 · Terra 1,012) | 38 (Terra 25 · Aqua 13) | **2,192** |
| S-NPP   | 11,409 | 385 | **11,794** |
| NOAA-20 | 11,565 | 371 | **11,936** |
| NOAA-21 | 11,048 | 400 | **11,448** |

### type en Querétaro (solo archive; NRT no tiene `type`)

| Sensor | type=0 incendio | type=2 estático/industrial | type=1 | type=3 |
|---|---:|---:|---:|---:|
| MODIS   | 1,386 | 768 | 0 | 0 |
| S-NPP   | 5,854 | 5,554 | 0 | 1 |
| NOAA-20 | 5,729 | 5,835 | 0 | 1 |
| NOAA-21 | 5,590 | 5,457 | 0 | 1 |

En VIIRS, alrededor del 49–50% de las detecciones en el BBox son `type=2`.

### Sierra Gorda (lat > 20.9) vs Sur/agrícola (lat ≤ 20.9)

| Sensor | Archive SG (t0 / t2) | Archive Sur (t0 / t2 / t3) | NRT SG | NRT Sur |
|---|---|---|---:|---:|
| MODIS   | 337 (335 / 2) | 1,817 (1,051 / 766 / 0) | 5 | 33 |
| S-NPP   | 1,632 (1,632 / 0) | 9,777 (4,222 / 5,554 / 1) | 16 | 369 |
| NOAA-20 | 1,473 (1,473 / 0) | 10,092 (4,256 / 5,835 / 1) | 15 | 356 |
| NOAA-21 | 1,584 (1,584 / 0) | 9,464 (4,006 / 5,457 / 1) | 21 | 379 |

- En VIIRS, el 100% del ruido `type=2` cae en la zona sur. En la Sierra Gorda todo es `type=0`, salvo 2 detecciones MODIS `type=2`.
- El BBox es rectangular e incluye partes de Hidalgo, Guanajuato, Edomex y SLP. Su esquina SE (≈20.0–20.1 N, -99.3 W) abarca la zona de Tula, Hidalgo (refinería y termoeléctrica). Esa zona es candidata a explicar buena parte del `type=2`, pero **no está verificado**. Para un recorte real conviene usar el polígono estatal del INEGI.

## 7. Hallazgos Críticos o Anomalías (riesgos de ingesta PostgreSQL/Python)

1. **acq_time pierde ceros a la izquierda si se infiere como número.** En disco siempre viene como 4 caracteres `HHMM` (UTC) y no hay valores inválidos. Pero entre el 10% y el 47% de las filas empiezan con "0" (ej. MX J1V NRT 46.5%, AR MODIS `0013`). Con `pandas.read_csv` sin `dtype={'acq_time': str}`, `0055` se convierte en `55`. Hay que leerlo como texto y combinarlo con `acq_date` en un `TIMESTAMPTZ` UTC.
2. **Esquema distinto archive vs NRT.** NRT no tiene la columna `type` (14 columnas contra 15). Un `COPY` a una tabla única falla si no se lista explícitamente el subconjunto de columnas. `type` debe ser NULL-able, y para el NRT habrá que inferirlo (por ejemplo, con una máscara de fuentes estáticas a partir de las ubicaciones `type=2` del archive).
3. **`confidence` tiene tipo mixto:** entero 0–100 en MODIS y `l`/`n`/`h` en VIIRS. Debe ser TEXT o separarse en `confidence_pct SMALLINT` + `confidence_cat CHAR(1)`.
4. **`version` es texto, no número:** `61.03`, `6.1NRT`, `2`, `2.0NRT`. Si se castea a numérico, `61.03` (archive) y `6.1NRT` (NRT) representan la misma colección 6.1 y no se pueden comparar así.
5. **`instrument` inconsistente:** S-NPP reporta `instrument='SNPP'` en lugar de `'VIIRS'`, a diferencia de N20 y N21. Conviene normalizar antes de filtrar por instrumento.
6. **Nombres de columna engañosos en VIIRS:** se llaman `brightness`/`bright_t31` pero son I4/I5 (no ch21/ch31 de MODIS). No hay `bright_ti4`/`bright_ti5`. Además, la I4 satura en 367.0 K. No se debe mezclar `brightness` entre sensores sin una columna `sensor`.
7. **Cortes archive/NRT distintos por sensor:** MODIS archive llega al 2026-08-31 y VIIRS al 2026-07-31. Sin traslape ni huecos dentro de cada sensor, pero una vista unificada mezcla procedencias distintas entre 2026-08-01 y 2026-08-31.
8. **Argentina MODIS no tiene archivo NRT.** El archive solo cubre hasta el 2026-08-15 (el periodo pedido).
9. **Claves casi duplicadas:** 2 casos con la misma (lat, lon, acq_date, acq_time, satellite) pero otros campos distintos:
   - MX J1V archive `19.46302,-90.48511,2024-01-25,1852,N20`
   - MX SV archive `16.27473,-91.91499,2024-03-27,1840,SNPP`

   Una PK natural sobre esas 5 columnas rompería el `COPY`. Mejor usar una PK sintética o agregar `frp`/`brightness` a la clave. No hay filas 100% idénticas.
10. **Precisión decimal variable:** las coordenadas tienen de 0 a 5 decimales porque se recortan los ceros finales (MODIS archive usa 4, MODIS NRT 5). Para deduplicar o hacer joins espaciales, usar NUMERIC o redondear, nunca comparar floats por igualdad.
11. **FRP = 0.0 exacto** en 447 registros (suma de todos los archivos). Son registros válidos con FRP no calculado. Definir si se filtran.
12. **Días sin detecciones** (sobre todo SNPP, ver §3). Una serie temporal diaria necesita rellenar esos días explícitamente y distinguir "0 fuegos" de "sin dato del satélite".
13. **Codificación del contenido: OK.** ASCII puro (0 bytes >127), sin BOM, saltos LF (sin CRLF), separador coma, sin comillas y salto de línea al final. Riesgo solo en las rutas: `México-Querétaro` tiene caracteres no-ASCII (é) y la carpeta `J1-VIRS-C2` tiene un typo (debería ser "VIIRS"). Ojo con scripts o contenedores que no usen locale UTF-8.
14. **Último día NRT (2026-11-01):** tiene datos pero la descarga es del 2026-11-13, así que la ventana pedida terminó ese día. NRT es provisional y será reemplazado por archive (con `type`) cuando FIRMS lo publique.
