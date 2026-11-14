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
| `docs/ACCESS.md` y `GUIA_TUNELES_SSH.md` | Túneles SSH, puertos y base de datos |
| `.claude/skills/` | Guía por rol: `etl`, `api`, `frontend` |

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

## Estructura

```
etl/        ingesta, máscara estática, celdas-día, calibración   (2 personas)
api/        FastAPI: /presets, /calendar, /hotspots.csv          (1 persona)
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
uv run uvicorn api.main:app --port 8000
```
