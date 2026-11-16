# NASA FIRMS data profiling (MODIS C6.1 + VIIRS C2): /data
Analysis date: 2026-11-13 · Tool: Python 3 stdlib (csv), full read of the 15 CSVs.

> Operational note: the 6 missing zips were extracted into new per-sensor subfolders (`unzip -n`, no overwrite). `cmp` confirmed that the CSVs already extracted are byte-for-byte identical to the contents of their zips. No original CSV was modified or deleted.

## 1. File inventory and volume

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
│   ├── J2-VIIRS-C2/    fire_archive_J2V-C2_844354.csv, fire_nrt_J2V-C2_844354.csv, Readme.txt   (extracted 2026-11-13)
│   └── SNPP-VIIRS-C2/  fire_archive_SV-C2_844355.csv,  fire_nrt_SV-C2_844355.csv,  Readme.txt   (extracted 2026-11-13)
└── Argentina/
    ├── DL_FIRE_M-C61_844360.zip (0.05 MB) · DL_FIRE_J1V-C2_844361.zip (0.23 MB)
    ├── DL_FIRE_J2V-C2_844362.zip (0.22 MB) · DL_FIRE_SV-C2_844363.zip (0.17 MB)
    ├── satellites.png
    ├── MODIS/          fire_archive_M-C61_844360.csv   (NO NRT file in the zip!)
    ├── J1-VIIRS-C2/    fire_archive_J1V-C2_844361.csv, fire_nrt_J1V-C2_844361.csv
    ├── J2-VIIRS-C2/    fire_archive_J2V-C2_844362.csv, fire_nrt_J2V-C2_844362.csv
    └── SNPP-VIIRS-C2/  fire_archive_SV-C2_844363.csv,  fire_nrt_SV-C2_844363.csv
```
Readme.txt (89 bytes) only says: "To view Readme.txt please visit https://firms.modaps.eosdis.nasa.gov/download/Readme.txt"

| Region | File | MB | wc -l | Data rows |
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

(wc -l includes the header; every file ends in `\n`)

## 2. Schema audit (columns and types)

There are only **2 schemas**, identical in order and name for the 4 sensors (M-C61, SV-C2, J1V-C2, J2V-C2) and the 2 regions:

**fire_archive_\* (15 columns):**
`latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`

**fire_nrt_\* (14 columns):** the same, **without `type`**:
`latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight`

- The VIIRS files do NOT use `bright_ti4` / `bright_ti5`. In these downloads they come as `brightness` / `bright_t31`, the same as MODIS. Semantically, in VIIRS they are bands I4 / I5 (375 m) and in MODIS channels 21/22 and 31 (1 km). The name is the same but the physics is different.
- Column order is identical in the 15 files. No file has rows with a number of fields different from the header (0 malformed rows).

Inferred types (PostgreSQL suggestion):

| Column | Type | Note |
|---|---|---|
| latitude, longitude | NUMERIC(8,5) / DOUBLE | 0 to 5 decimals (trailing zeros trimmed) |
| brightness, bright_t31, frp, scan, track | REAL/NUMERIC | |
| acq_date | DATE | ISO `YYYY-MM-DD` in all |
| acq_time | **TEXT/CHAR(4)** `HHMM` UTC | always 4 characters, zero-padded |
| satellite, instrument, daynight | TEXT | |
| confidence | **TEXT** | integer 0-100 in MODIS, letter l/n/h in VIIRS |
| version | **TEXT** | `61.03`, `6.1NRT`, `2`, `2.0NRT` |
| type | SMALLINT NULL | archive only |

Real sample rows (Mexico):
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

## 3. Time coverage and cutoff point (archive vs. NRT)

| Region | Sensor | Archive MIN–MAX | days w/ data | NRT MIN–MAX | days w/ data | Overlap | Gap between them |
|---|---|---|---:|---|---:|---|---|
| MX | M-C61  | 2024-01-01 – **2026-08-31** | 974 | **2026-09-01** – 2026-11-01 | 62 | 0 days, 0 records | 0 days |
| MX | SV-C2  | 2024-01-01 – 2026-07-31 | 908 | 2026-08-01 – 2026-11-01 | 92 | 0 / 0 | 0 days |
| MX | J1V-C2 | 2024-01-01 – 2026-07-31 | 942 | 2026-08-01 – 2026-11-01 | 93 | 0 / 0 | 0 days |
| MX | J2V-C2 | 2024-01-01 – 2026-07-31 | 941 | 2026-08-01 – 2026-11-01 | 93 | 0 / 0 | 0 days |
| AR | M-C61  | 2026-07-01 – 2026-08-15 | 45 | — (does not exist) | — | — | — |
| AR | SV-C2  | 2026-07-01 – 2026-07-31 | 25 | 2026-08-01 – 2026-08-15 | 14 | 0 / 0 | 0 days |
| AR | J1V-C2 | 2026-07-01 – 2026-07-31 | 31 | 2026-08-01 – 2026-08-15 | 15 | 0 / 0 | 0 days |
| AR | J2V-C2 | 2026-07-01 – 2026-07-31 | 31 | 2026-08-01 – 2026-08-15 | 15 | 0 / 0 | 0 days |

- The archive→NRT splice is clean: there are no shared dates and no exact repeated records (lat, lon, date, time, satellite).
- **The cutoff point depends on the sensor.** MODIS cuts off on 2026-08-31; the three VIIRS cut off on 2026-07-31.
- Days without any detection inside each file (most likely satellite outages, especially on SNPP):
  - MX SV archive: 2024-05-30..06-03, 2024-07-10..07-15, 2024-07-24..07-28, 2024-09-26, 2024-11-03..11-05, 2025-07-07, 2026-03-10..03-12, 2026-04-28..04-30, 2026-06-01..06-02, 2026-07-11..07-16
  - MX SV NRT: 2026-08-03 · MX J1V archive: 2024-02-04 · MX J2V archive: 2024-02-27..02-28
  - AR SV archive: 2026-07-11..07-16 · AR SV NRT: 2026-08-03 · AR M-C61: 2026-08-11
  - MX M-C61 (archive and NRT), MX J1V NRT and MX J2V NRT have no gaps.

## 4. Distribution of domains and categorical values

### satellite / instrument

| File | satellite | instrument |
|---|---|---|
| MX M-C61 archive | Aqua 106,924 · Terra 83,521 | MODIS 190,445 |
| MX M-C61 NRT | Aqua 1,340 · Terra 1,329 | MODIS 2,669 |
| MX SV archive / NRT | SNPP 777,500 / 21,046 | **SNPP** 777,500 / 21,046 (not "VIIRS") |
| MX J1V archive / NRT | N20 800,671 / 21,189 | VIIRS |
| MX J2V archive / NRT | N21 766,414 / 20,665 | VIIRS |
| AR M-C61 archive | Aqua 2,330 · Terra 563 | MODIS |
| AR SV / J1V / J2V | SNPP / N20 / N21 | SNPP / VIIRS / VIIRS |

### version (a single value per file)
MODIS archive `61.03` · MODIS NRT `6.1NRT` · VIIRS archive `2` · VIIRS NRT `2.0NRT`

### confidence MODIS (numeric 0-100)

| File | min | p25 | p50 | p75 | p90 | max | mean | <30 | ≥80 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| MX archive | 0 | 56 | 70 | 83 | 95 | 100 | 68.24 | 8,924 | 58,843 |
| MX NRT     | 0 | 52 | 66 | 79 | 94 | 100 | 64.30 | 209 | 652 |
| AR archive | 0 | 55 | 66 | 78 | 90 | 100 | 65.66 | 102 | 658 |

### confidence VIIRS (l / n / h)

| File | l | n | h |
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

### type (archive only)

| File | 0 vegetation | 1 volcano | 2 static/industrial | 3 offshore |
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

| File | D | N |
|---|---:|---:|
| MX M-C61 archive / NRT | 139,522 / 1,556 | 50,923 / 1,113 |
| MX SV archive / NRT    | 507,532 / 11,506 | 269,968 / 9,540 |
| MX J1V archive / NRT   | 521,453 / 11,248 | 279,218 / 9,941 |
| MX J2V archive / NRT   | 497,122 / 11,067 | 269,292 / 9,598 |
| AR M-C61 archive       | 2,594 | 299 |
| AR SV archive / NRT    | 5,516 / 1,685 | 1,483 / 830 |
| AR J1V archive / NRT   | 8,457 / 1,642 | 1,954 / 1,019 |
| AR J2V archive / NRT   | 7,459 / 1,664 | 1,873 / 1,027 |

## 5. Physical and geographic statistics (data quality)

**Nulls / empties / NaN / "null": 0 in every column of the 15 files.** There is also no leading or trailing whitespace in any field.

### Geographic range

| File | lat min | lat max | lon min | lon max |
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

The boxes cover all of Mexico and all of Argentina. This is **NOT** a Querétaro clip.

### FRP (MW)
All values ≤0 are exactly 0.0. There are no negatives or nulls.

| File | min | max | median | mean | frp ≤ 0 |
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

### Pixel size (km): scan / track (min · mean · max)

| File | scan | track |
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
| AR VIIRS (all) | 0.32 · ~0.46–0.47 · 0.79–0.8 | 0.36 · ~0.485–0.505 · 0.78 |

### Brightness (K)
- MODIS `brightness`: 300.0–508.4 (MX archive), 300.0–409.66 (MX NRT), 300.0–441.0 (AR).
- VIIRS `brightness` (I4): **max = 367.0 exactly on the 3 sensors** (I4 saturation); min ≈ 207–208.
- VIIRS `bright_t31` (I5): 228.22–387.05 (MX).

## 6. Specific sample of the local case (Querétaro)
BBox: latitude ∈ [20.0, 21.7], longitude ∈ [-100.6, -99.0]. There is data only in the México-Querétaro folder; Argentina gives 0.

### Records inside the BBox

| Sensor | Archive | NRT | Total |
|---|---:|---:|---:|
| MODIS (Aqua+Terra) | 2,154 (Aqua 1,142 · Terra 1,012) | 38 (Terra 25 · Aqua 13) | **2,192** |
| S-NPP   | 11,409 | 385 | **11,794** |
| NOAA-20 | 11,565 | 371 | **11,936** |
| NOAA-21 | 11,048 | 400 | **11,448** |

### type in Querétaro (archive only; NRT has no `type`)

| Sensor | type=0 fire | type=2 static/industrial | type=1 | type=3 |
|---|---:|---:|---:|---:|
| MODIS   | 1,386 | 768 | 0 | 0 |
| S-NPP   | 5,854 | 5,554 | 0 | 1 |
| NOAA-20 | 5,729 | 5,835 | 0 | 1 |
| NOAA-21 | 5,590 | 5,457 | 0 | 1 |

In VIIRS, around 49–50% of the detections in the BBox are `type=2`.

### Sierra Gorda (lat > 20.9) vs South/agricultural (lat ≤ 20.9)

| Sensor | Archive SG (t0 / t2) | Archive South (t0 / t2 / t3) | NRT SG | NRT South |
|---|---|---|---:|---:|
| MODIS   | 337 (335 / 2) | 1,817 (1,051 / 766 / 0) | 5 | 33 |
| S-NPP   | 1,632 (1,632 / 0) | 9,777 (4,222 / 5,554 / 1) | 16 | 369 |
| NOAA-20 | 1,473 (1,473 / 0) | 10,092 (4,256 / 5,835 / 1) | 15 | 356 |
| NOAA-21 | 1,584 (1,584 / 0) | 9,464 (4,006 / 5,457 / 1) | 21 | 379 |

- In VIIRS, 100% of the `type=2` noise falls in the southern zone. In Sierra Gorda everything is `type=0`, except 2 MODIS `type=2` detections.
- The BBox is rectangular and includes parts of Hidalgo, Guanajuato, the State of Mexico and San Luis Potosí. Its SE corner (≈20.0–20.1 N, -99.3 W) covers the Tula, Hidalgo area (refinery and thermal power plant). That area is a candidate to explain much of the `type=2`, but **this is not verified**. For a real clip it is better to use the INEGI state polygon.

## 7. Critical findings or anomalies (PostgreSQL/Python ingestion risks)

1. **acq_time loses leading zeros if inferred as a number.** On disk it always comes as 4 characters `HHMM` (UTC) and there are no invalid values. But between 10% and 47% of the rows start with "0" (e.g. MX J1V NRT 46.5%, AR MODIS `0013`). With `pandas.read_csv` without `dtype={'acq_time': str}`, `0055` becomes `55`. It has to be read as text and combined with `acq_date` into a UTC `TIMESTAMPTZ`.
2. **Different schema for archive vs NRT.** NRT does not have the `type` column (14 columns versus 15). A `COPY` into a single table fails unless the column subset is listed explicitly. `type` must be nullable, and for NRT it will have to be inferred (for example, with a static-source mask built from the archive's `type=2` locations).
3. **`confidence` has a mixed type:** integer 0–100 in MODIS and `l`/`n`/`h` in VIIRS. It must be TEXT or be split into `confidence_pct SMALLINT` + `confidence_cat CHAR(1)`.
4. **`version` is text, not a number:** `61.03`, `6.1NRT`, `2`, `2.0NRT`. If cast to numeric, `61.03` (archive) and `6.1NRT` (NRT) represent the same collection 6.1 and cannot be compared that way.
5. **Inconsistent `instrument`:** S-NPP reports `instrument='SNPP'` instead of `'VIIRS'`, unlike N20 and N21. It should be normalized before filtering by instrument.
6. **Misleading column names in VIIRS:** they are called `brightness`/`bright_t31` but they are I4/I5 (not MODIS ch21/ch31). There is no `bright_ti4`/`bright_ti5`. Also, I4 saturates at 367.0 K. `brightness` must not be mixed across sensors without a `sensor` column.
7. **Different archive/NRT cutoffs per sensor:** MODIS archive reaches 2026-08-31 and VIIRS 2026-07-31. No overlap or gaps within each sensor, but a unified view mixes different provenances between 2026-08-01 and 2026-08-31.
8. **Argentina MODIS has no NRT file.** The archive only covers up to 2026-08-15 (the requested period).
9. **Near-duplicate keys:** 2 cases with the same (lat, lon, acq_date, acq_time, satellite) but different other fields:
   - MX J1V archive `19.46302,-90.48511,2024-01-25,1852,N20`
   - MX SV archive `16.27473,-91.91499,2024-03-27,1840,SNPP`

   A natural PK on those 5 columns would break the `COPY`. Better to use a synthetic PK or add `frp`/`brightness` to the key. There are no 100% identical rows.
10. **Variable decimal precision:** coordinates have 0 to 5 decimals because trailing zeros are trimmed (MODIS archive uses 4, MODIS NRT 5). To deduplicate or do spatial joins, use NUMERIC or round; never compare floats for equality.
11. **FRP = exactly 0.0** in 447 records (sum over all files). They are valid records with FRP not computed. Decide whether to filter them.
12. **Days without detections** (especially SNPP, see §3). A daily time series needs to fill those days explicitly and distinguish "0 fires" from "no satellite data".
13. **Content encoding: OK.** Pure ASCII (0 bytes >127), no BOM, LF line breaks (no CRLF), comma separator, no quotes and a trailing newline. Risk only in the paths: `México-Querétaro` has non-ASCII characters (é) and the `J1-VIRS-C2` folder has a typo (it should be "VIIRS"). Watch out for scripts or containers that do not use a UTF-8 locale.
14. **Last NRT day (2026-11-01):** it has data but the download is from 2026-11-13, so the requested window ended that day. NRT is provisional and will be replaced by archive (with `type`) when FIRMS publishes it.
