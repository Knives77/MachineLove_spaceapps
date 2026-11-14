# Topología de desarrollo

Dónde corre cada pieza, cómo llega cada persona, qué puerto usa y por dónde viaja el código. La configuración paso a paso de SSH está en [`acceso/GUIA_TUNELES_SSH.md`](acceso/GUIA_TUNELES_SSH.md).

## Mapa

```
          Laptop de cada compañero                         Máquina anfitriona (líder)
   ┌──────────────────────────────────┐            ┌────────────────────────────────────────────┐
   │ git clone del repo               │            │ /home/equimanthorn/.../MachineLove_spaceapps│
   │                                  │  túnel SSH │                                            │
   │ localhost:8000 ─────────────────────────────────▶ 127.0.0.1:8000  API estable (main)       │
   │ localhost:8001 ─────────────────────────────────▶ 127.0.0.1:8001  API de desarrollo        │
   │ localhost:15432 ────────────────────────────────▶ 127.0.0.1:5432  PostgreSQL 16 + PostGIS  │
   │                                  │            │                   (podman: firms_postgis)  │
   │ pnpm dev → localhost:5173 (front)│            │                   bases: firms, firms_dev  │
   └──────────────┬───────────────────┘            │ data/ (1.4 GB de CSV, no sale de aquí)     │
                  │                                └──────────────┬─────────────────────────────┘
                  │ git push / PR                                 │ git pull
                  ▼                                               ▼
                        GitHub: Knives77/MachineLove_spaceapps (main + ramas por rol)
```

- La anfitriona escucha **solo en `127.0.0.1`**: la API y Postgres no se exponen a la red. Desde fuera se llega únicamente por túnel SSH.
- Para la demo y el video todo corre en la anfitriona, sin túneles ni red: API en 8000 y front con `pnpm dev`.

## Redes

| Red | IP de la anfitriona | Quién |
|---|---|---|
| Wi-Fi del evento | `10.61.5.140` | La mayoría |
| Cable directo | `10.0.0.1/24` (el compañero se pone `10.0.0.2/24`) | Quien esté conectado por Ethernet |

Si por Wi-Fi no se ven entre sí (`ping` falla), la red del evento aísla clientes. Plan B: Tailscale en la anfitriona y en cada laptop.

## Acceso: solo túneles

Las llaves de los compañeros están en el `~/.ssh/authorized_keys` de `equimanthorn`, **restringidas a túneles**: `restrict,port-forwarding,permitopen=...,command="/usr/bin/false"`. No hay terminal ni Remote-SSH en la anfitriona. Cada quien programa en su laptop y abre los túneles que necesita:

```bash
ssh -N machinelove-wifi        # con docs/acceso/ssh_config.example en su ~/.ssh/config
# o, sin config:
ssh -N -L 8000:localhost:8000 -L 8001:localhost:8001 -L 15432:localhost:5432 equimanthorn@10.61.5.140
```

Postgres se reenvía a **15432** para no chocar con un Postgres local de la laptop.

| Llave | Puertos permitidos |
|---|---|
| Todas las del equipo | 8000, 8001, 5432 |

Plantillas: [`acceso/ssh_config.example`](acceso/ssh_config.example) (laptop) y [`acceso/authorized_keys.example`](acceso/authorized_keys.example) (anfitriona).

## Puertos

| Puerto (anfitriona) | Servicio | Quién lo levanta | Quién lo usa |
|---|---|---|---|
| 8000 | API estable, código de `main`, base `firms` | Líder | Front, analista |
| 8001 | API de desarrollo | Backend (si la corre en la anfitriona) | Backend |
| 5432 | PostgreSQL + PostGIS | Líder (`scripts/db_up.sh`) | Procesamiento, backend, analista |
| 5173 (en cada laptop) | Front con Vite (`pnpm dev`) | Cada persona de front | — |

## Bases de datos

| Base | Cadena desde una laptop (túnel en 15432) | Uso |
|---|---|---|
| `firms` | `postgresql://firms:firms_local@localhost:15432/firms` | **Oficial.** La usa la API en 8000. Solo el líder corre el ETL aquí |
| `firms_dev` | `postgresql://firms:firms_local@localhost:15432/firms_dev` | Pruebas de procesamiento y backend |

En la anfitriona misma el puerto es 5432. Estado, corridas y respaldos: [`BITACORA_BASE.md`](BITACORA_BASE.md).

## Cómo trabaja cada rol

| Rol | Programa en | Necesita túnel a | Corre |
|---|---|---|---|
| Procesamiento | Su laptop | 5432 | `DATABASE_URL=...:15432/firms_dev uv run python -m etl.run --step N` |
| Backend | Su laptop | 5432 (y 8000 para comparar) | `DATABASE_URL=...:15432/firms uv run uvicorn backend.main:app --port 8001` |
| Front | Su laptop | 8000 | `pnpm install --frozen-lockfile && pnpm dev` con `VITE_API_URL=http://localhost:8000/api/v1` en `web/.env` |
| Analista | Su laptop | 8000 y 5432 (solo lectura) | Consultas de `ANALISTA.md`, la app en el navegador |
| Líder | La anfitriona | — | `git pull`, ETL completo en `firms`, API estable en 8000, respaldos |

Los CSV completos (1.4 GB) solo están en la anfitriona: el paso 1 del ETL solo se corre ahí. Los pasos 2–5 leen de la base y se pueden correr desde cualquier laptop contra `firms_dev`.

## Flujo del código

1. Cada rol trabaja en su rama (`etl-a`, `etl-b`, `Backend`, `front`).
2. PR pequeño a `main`, con sus pruebas pasando y su línea en `CHANGELOG.md`.
3. El líder fusiona, hace `git pull` en la anfitriona y reinicia la API en 8000 si cambió `backend/`.
4. Si cambió `etl/`, el líder corre el paso en `firms`, luego `uv run python -m etl.verify`, y lo anota en `BITACORA_BASE.md`.

## Cuidados

- No correr dos ETL completos a la vez: la anfitriona tiene 16 GB de RAM compartidos.
- La anfitriona no se suspende ni cambia de red durante el hackatón.
- Respaldo de la base en H1, H3 y H5 (comando en `BITACORA_BASE.md`) y copia a un disco externo.
