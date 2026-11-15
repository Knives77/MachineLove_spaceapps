# MachineLove · NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots

Entrega: **domingo 15-nov-2026, 12:00 PM**. Demo local + video + repo público. Congelamiento de código: domingo 09:00.

**Alcance del MVP: solo México.** Argentina queda cargada en la base para la fase 2; después, el mundo.

Frase brújula: *que no importe qué satélite tomó el dato, sino saber si el fuego de este mes es normal o anómalo frente a su historia.*

## Lee antes de escribir código

| Documento | Para qué |
|---|---|
| `docs/CONTEXT.md` | El reto, lo que sabemos de los datos y las decisiones cerradas |
| `docs/PRD.md` | Alcance del MVP, hitos con hora, roles, mejoras |
| `docs/CHECKLIST.md` | Tareas por rol y por hito |
| `docs/ANALISTA.md` | Investigaciones del analista con consultas SQL |
| `docs/PITCH.md` | Guion, afirmaciones con evidencia, preguntas de jueces, pruebas de la demo |
| `docs/contracts/` | Contratos congelados: ingesta, tablas, API, JSON de ejemplo |
| `docs/BITACORA_BASE.md` | Estado de la base, corridas del ETL en `firms` y respaldos |
| `docs/ACCESS.md` y `docs/GUIA_TUNELES_SSH.md` | Túneles SSH, puertos y base de datos |
| `.claude/skills/` | Guía por rol: `etl`, `backend`, `frontend` |

## Reglas que no se negocian

1. **Los contratos mandan.** Si el código necesita algo distinto a `docs/contracts/`, primero se cambia el contrato (lo aprueba el analista) y después el código. Nunca al revés.
2. **Nada de nombres de columnas inventados.** Los esquemas reales están en `docs/contracts/ingest.md`.
3. **La unidad de actividad es la celda-día**, no el punto: una celda de 0.01° × 0.01° con al menos una detección de vegetación ese día. Los puntos crudos solo existen para el modo "crudo" y el CSV.
4. **"Sin dato" no es "cero".** Un mes con caída de sensor lleva bandera y no entra a la mediana histórica.
5. **Fuera del MVP:** Argentina y otros países (fase 2), login, predicción con ML, datos en vivo de la API de FIRMS, Landsat, geoestacionarios, mapas 3D, despliegue en la nube.
6. **`data/` no se sube a Git** (1.4 GB). Se regenera con `scripts/download_history.sh`.
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
web/        React + Vite + Tailwind exportado de Figma Make      (2 personas)
docs/       contexto, PRD, contratos                              (analista)
scripts/    base de datos, descarga de histórico
data/       CSV de FIRMS, fuera de Git
```

## Comandos

```bash
scripts/db_up.sh                 # Postgres + PostGIS en podman, puerto 127.0.0.1:5432
scripts/download_history.sh      # CSV por país y año de FIRMS a data/historico_pais/
uv run python -m etl.run --all   # ingesta completa (cuando exista)
uv run uvicorn backend.main:app --port 8000
```
