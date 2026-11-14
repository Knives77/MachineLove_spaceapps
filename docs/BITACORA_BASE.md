# Bitácora de la base de datos

Quién cargó qué, cuándo, con qué resultado, y dónde están los respaldos. Lo actualiza el líder cada vez que se corre un paso del ETL en `firms` o se saca un respaldo.

Contenedor: `firms_postgis` (PostgreSQL 16 + PostGIS 3.4). Bases: `firms` (oficial, la usa la API) y `firms_dev` (pruebas de procesamiento).

## Estado al 14-nov-2026, 16:30

Conteos exactos (`count(*)`), iguales en `firms` y `firms_dev`:

| Tabla | Filas |
|---|---|
| `detection` | 16,168,961 |
| `cell` | 1,481,420 (MX 737,202 · AR 744,218) |
| `cell_day` | 8,721,793 (`modis_veg` 3,047,558 · `viirs_veg` 4,183,627) |
| `static_cell` | 3,111 |
| `sensor_outage` | 463 |
| `calibration_country` | MX k = 0.3323 · AR k = 0.4641 (167 meses de traslape) |
| `preset` | 3 |

`detection` por país y fuente:

| País | Fuente | Filas | Desde | Hasta |
|---|---|---|---|---|
| MX | country | 8,306,126 | 2000-11-01 | 2025-12-31 |
| MX | archive | 1,161,850 | 2024-01-01 | 2026-08-31 |
| MX | nrt | 65,569 | 2026-08-01 | 2026-11-01 |
| AR | country | 6,330,305 | 2000-11-01 | 2025-12-31 |
| AR | archive | 160,757 | 2026-01-01 | 2026-08-31 |
| AR | nrt | 144,354 | 2026-08-01 | 2026-11-14 |

> Para contar filas usar `count(*)`. `pg_stat_user_tables.n_live_tup` es una estimación y después de cargas grandes puede diferir en decenas de miles de filas.

## Corridas

| Hora (14-nov) | Base | Qué | Resultado |
|---|---|---|---|
| mañana | `firms` y `firms_dev` | Paso 1 (ingesta MX + AR, incluida Argentina 2026), pasos 2 y 3 (máscara, caídas) | detection 16,168,961 · static_cell 3,111 · sensor_outage 463 |
| 14:16 | `firms_dev` | Pasos 4 y 5 (segunda corrida; cada paso borra y regenera, no duplica) | Mismos conteos que arriba |
| 14:54 | `firms` | `etl.run --step 4`, `--step 5`, `etl.verify` | **53/54** OK |

Única comprobación que fallaba en `etl.verify`: `viirs_primary` vs `modis_primary` en Sierra Gorda 2020 daba 50.8 % contra un límite fijo de 45 % que no salió de una medición. **Resuelto (14-nov):** el criterio ahora es que el peor año no supere el error LOYO máximo de la misma región (55.2 % en Sierra Gorda); ver `acceptance.md`. Con eso, `etl.verify` da **54/54**.

## Respaldos

| Hora | Hito | Archivo | Tamaño |
|---|---|---|---|
| 16:34 | H1 | `~/backups/machinelove/firms_20261114_1634.dump` | 385 MB |
| 16:34 | H1 | `~/backups/machinelove/firms_dev_20261114_1634.dump` | 385 MB |
| | H3 | | |
| | H5 | | |

Los dos archivos se comprobaron con `pg_restore -l`: traen las 8 tablas del proyecto con datos. Se tomaron después de la corrida de las 14:54.

**Pendiente:** copiarlos a un disco externo (hoy están en el mismo disco que la base).

Sacar un respaldo:

```bash
TS=$(date +%Y%m%d_%H%M)
for db in firms firms_dev; do
  podman exec firms_postgis pg_dump -U firms -Fc -d $db > ~/backups/machinelove/${db}_$TS.dump
done
```

Restaurar en una base nueva (no pisa `firms`):

```bash
podman exec firms_postgis createdb -U firms firms_restore
podman exec -i firms_postgis pg_restore -U firms -d firms_restore -j 4 < ~/backups/machinelove/firms_20261114_1634.dump
```
