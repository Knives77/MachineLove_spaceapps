# MachineLove · NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots

Entrega: **domingo 15-nov-2026, 12:00 PM**. Presentación en vivo con demo local y dinámica con el jurado (sin video) + repo público. Congelamiento de código: domingo 09:00.

**Alcance del MVP: solo México.** Argentina queda cargada en la base para la fase 2; después, el mundo.

Frase brújula: *que no importe qué satélite tomó el dato, sino saber si el fuego de este mes es normal o anómalo frente a su historia.*

## Lee antes de escribir código

| Documento | Para qué |
|---|---|
| `docs/CONTEXT.md` | El reto, lo que sabemos de los datos y las decisiones cerradas |
| `docs/PRD.md` | Alcance del MVP, hitos con hora y estado, roles, mejoras |
| `docs/CHECKLIST.md` | Tareas por rol, al día |
| `docs/TOPOLOGIA.md` | Dónde corre cada pieza, puertos, bases, túneles y flujo de código (`docs/acceso/` para la configuración SSH) |
| `docs/contracts/` | Contratos congelados: ingesta, tablas, armonización, API, ejemplos, aceptación. Índice y cómo se cambian: `docs/contracts/README.md` |
| `docs/PITCH.md` | Guion, afirmaciones con evidencia, preguntas de jueces, pruebas de la demo |
| `docs/ANALISTA.md` | Tareas del analista (dueño del pitch) y sus herramientas |
| `docs/HALLAZGOS.md` | Cifras y hechos con fuente que se pueden decir en el pitch |
| `docs/POBLAR_BASE.md` | Cómo poblar la base: desde cero con el ETL o restaurando un respaldo |
| `docs/BITACORA_BASE.md` | Estado de la base, corridas del ETL en `firms` y respaldos |
| `CHANGELOG.md` | Qué cambió y qué tiene que hacer cada rol. Todo PR agrega su línea |
| `.claude/skills/` | Guía por rol: `etl`, `backend`, `frontend` |

## Reglas que no se negocian

1. **Los contratos mandan.** Si el código necesita algo distinto a `docs/contracts/`, primero se cambia el contrato (lo aprueba el líder; ver `docs/contracts/README.md`) y después el código. Nunca al revés.
2. **Nada de nombres de columnas inventados.** Los esquemas reales están en `docs/contracts/ingest.md`.
3. **La unidad de actividad es la celda-día**, no el punto: una celda de 0.01° × 0.01° con al menos una detección de vegetación ese día. Los puntos crudos solo existen para el modo "crudo" y el CSV.
4. **"Sin dato" no es "cero".** Un mes con caída de sensor lleva bandera y no entra a la mediana histórica.
5. **Fuera del MVP:** Argentina y otros países (fase 2), login, predicción con ML, datos en vivo de la API de FIRMS, Landsat, geoestacionarios, mapas 3D, despliegue en la nube.
6. **`data/` no se sube a Git** (1.4 GB), salvo los `.zip` de las solicitudes de FIRMS. El histórico se regenera con `scripts/download_history.sh`.
7. **Todo cálculo de armonización vive en el ETL o en SQL/Python del backend.** El frontend solo pinta lo que devuelve la API.
8. **La API devuelve códigos, no textos** (`status: "critical"`, `flags: ["modis_outage"]`). La traducción ES/EN es del frontend.
9. Python 3.12 con `uv`. No instalar nada global en la máquina anfitriona.
10. Cada cambio se prueba contra las **cifras de control** de `docs/contracts/acceptance.md` antes de decir que funciona.

## Frontend: reglas de UI/UX (detalle en `.claude/skills/frontend/`)

- **Mapa:** solo `maplibre-gl` (WebGL). Cámara con `fitBounds`/`easeTo` nativos y `padding` sincronizado con el panel del calendario. Nada de bucles manuales de animación.
- **Colores:** todos salen de `web/src/theme/tokens.ts` (espejo en `web/src/index.css`): superficies `#090D14` / `#111827`, interacción `#38BDF8` / `#F8FAFC`, niveles Sin incendios `#64748B`, Bajo `#A855F7`, Normal `#E06D53`, Alto `#F97316`, Extremo `#FDE047`, más la paleta para daltonismo. Sin colores escritos a mano en componentes.
- **Progressive disclosure:** `Vista: General` limpia (una barra de tiempo 2000–2026, sin trazas de sensores, sin interruptor crudo ni descargas). Lo técnico va en Aprendizaje, Educacional y Experto.
- **Antes de cada commit del frontend:** `pnpm run build` y verificación visual en navegador (abrir/cerrar el calendario, cambiar de región).

## Estructura

```
etl/        ingesta, máscara estática, celdas-día, calibración   (2 personas)
backend/    FastAPI: /presets, /calendar, /hotspots.csv          (1 persona)
web/        React + Vite + Tailwind exportado de Figma Make      (2 personas; workspace pnpm en la raíz)
docs/       contexto, PRD, checklist, topología, contratos, pitch
scripts/    base de datos, descarga de histórico, cifras del pitch
data/       CSV de FIRMS, fuera de Git
```

## Comandos

```bash
scripts/db_up.sh                 # Postgres + PostGIS en podman, puerto 127.0.0.1:5432
scripts/download_history.sh      # CSV por país y año de FIRMS a data/historico_pais/ (2000–2025)
scripts/download_requests.sh     # solicitudes MX 2024–2026 y AR 2026 desde la release de GitHub
uv run python -m etl.run --all   # ETL completo (paso 1 solo en la anfitriona)
uv run python -m etl.verify      # cifras de control del ETL
uv run pytest etl backend        # pruebas
uv run uvicorn backend.main:app --port 8000
pnpm install --frozen-lockfile   # desde la raíz: instala web/
pnpm dev                         # front en http://localhost:5173
python3 scripts/pitch_numbers.py # cifras del pitch desde la API
```
