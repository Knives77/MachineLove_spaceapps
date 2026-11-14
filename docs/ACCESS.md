# Acceso a la máquina anfitriona

Todo corre en una sola máquina (Linux, 16 GB de RAM, 12 núcleos). **La configuración de SSH está en `GUIA_TUNELES_SSH.md`** (llaves restringidas a túneles, sin terminal). Este documento solo añade qué puertos usa el proyecto y cómo trabaja cada rol con ese esquema.

## Puertos del proyecto

| Puerto | Servicio | Quién lo necesita |
|---|---|---|
| 8000 | API estable (`main`). La que consume frontend | Frontend, analista |
| 8001 | API en desarrollo | Backend |
| 5432 | PostgreSQL + PostGIS | Procesamiento, backend |

En `authorized_keys`, cada llave necesita un `permitopen="localhost:PUERTO"` por cada puerto que vaya a usar. La guía solo trae 8000 y 5432: añadir 8001 a la llave de backend.

En los comandos `ssh -L` usar siempre `localhost` (no `127.0.0.1`): `permitopen` compara el texto tal cual.

```bash
ssh -N -L 8000:localhost:8000 equimanthorn@<IP>                              # frontend, analista
ssh -N -L 8000:localhost:8000 -L 5432:localhost:5432 equimanthorn@<IP>       # procesamiento
ssh -N -L 8001:localhost:8001 -L 5432:localhost:5432 equimanthorn@<IP>       # backend
```

Frontend: `VITE_API_URL=http://localhost:8000/api/v1`.

Plantillas listas:
- [`ssh_config.example`](ssh_config.example): para el `~/.ssh/config` de cada amigo. Se conectan con `ssh machinelove-cable` o `ssh machinelove-wifi`.
- [`authorized_keys.example`](authorized_keys.example): para el `~/.ssh/authorized_keys` del anfitrión, con una línea por rol.
- IP del anfitrión: `10.61.5.140` (Wi-Fi) o `10.0.0.1` (cable directo; el amigo usa `10.0.0.2/24`).

## Base de datos

```bash
scripts/db_up.sh        # en el anfitrión: crea o arranca el contenedor firms_postgis
```

Escucha solo en `127.0.0.1:5432`; desde fuera se llega únicamente por túnel.

| Base | Cadena | Uso |
|---|---|---|
| `firms` | `postgresql://firms:firms_local@localhost:5432/firms` | La oficial. Solo la carga la ingesta completa que corre quien lidera |
| `firms_dev` | `postgresql://firms:firms_local@localhost:5432/firms_dev` | Pruebas del equipo de procesamiento con la muestra |

Crear la de pruebas una vez: `podman exec firms_postgis createdb -U firms firms_dev`.

## Cómo trabaja cada rol solo con túneles

| Rol | Dónde programa | Datos |
|---|---|---|
| Procesamiento | En su laptop | Una **muestra** de CSV que quien lidera les pasa por USB o Drive (México MODIS y S-NPP de 2011, 2012 y 2019: ~70 MB). Cargan a `firms_dev` por el túnel y comparan con `docs/contracts/acceptance.md` |
| Backend | En su laptop, API en su propio `localhost:8001` | Lee `firms` por el túnel |
| Frontend, analista | En su laptop | Mocks primero; luego la API por el túnel 8000 |
| Quien lidera | En el anfitrión | `git pull`, corre la ingesta completa sobre `firms` con los 1.4 GB, y mantiene la API estable en 8000 |

La ingesta completa solo se corre en el anfitrión: los CSV completos no salen de esa máquina.

## Antigravity / VS Code Remote-SSH (esquema activo)

Remote-SSH necesita terminal, así que cada persona tiene **su propia cuenta Linux** (`kalozano`, `lar`) con acceso solo al proyecto:

- El proyecto está montado en `/srv/machinelove` (bind mount de la carpeta real; `/home/equimanthorn` sigue cerrado).
- El grupo `machinelove` tiene `rwX` sobre el proyecto (ACL).
- Sin `sudo`. Se crea con `setup_amigos.sh` (fuera del repo).
- En Antigravity: `Remote-SSH: Connect to Host...` → `machinelove-wifi` / `machinelove-cable` → abrir `/srv/machinelove`. Los puertos se reenvían desde la pestaña **Ports**.

## Cuidados

- Si Wi-Fi y Ethernet no se ven entre sí (`ping <IP>` falla), la red del evento aísla clientes: plan B, Tailscale en el anfitrión y en cada laptop.
- No correr dos ingestas completas a la vez (16 GB compartidos).
- Respaldo en H1, H3 y H5: `podman exec firms_postgis pg_dump -U firms -Fc firms > /ruta/externa/firms_$(date +%H%M).dump`.
- La máquina anfitriona no se suspende ni cambia de red durante el hackathon.
