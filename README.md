# MachineLove · NASA Space Apps 2026

**Harmonization of MODIS and VIIRS Hot Spots.** Un calendario de actividad de quema donde no importa qué satélite tomó el dato: cada mes se compara contra su propia historia (2000–2026) para saber si es normal o anómalo. MVP: México.

## El problema

Los satélites cuentan focos de calor desde el año 2000, pero el registro está partido en dos familias de sensores que no se pueden comparar directamente. MODIS (Terra y Aqua, píxel de 1 km) tiene la historia larga y está cerca del final de su vida operativa; VIIRS (S-NPP, NOAA-20 y NOAA-21, píxel de 375 m) existe desde 2012 y ve el mismo fuego con muchos más puntos. Si se suman los puntos tal cual, el fuego del Bajío queretano parece multiplicarse ×14.7 entre 2011 y 2019, cuando en realidad cambió el sensor. Así, quien gestiona el fuego no puede saber si el mes actual es normal o anómalo frente a la historia de su zona.

## Objetivos

**General.** Una aplicación web que armonice los focos de calor de MODIS y VIIRS (NASA FIRMS) en un calendario de actividad de quema consistente de 2000 a hoy, para que cualquiera pueda ver si el fuego de este mes en su área es normal o anómalo frente a su propia historia, sin importar qué satélite tomó el dato.

**Específicos.**

1. Poner MODIS y VIIRS en una sola escala y medir cuánto se equivoca esa conversión.
2. Mostrar, para un área de interés, un calendario año × mes de 2000 a 2026: qué meses del año queman más y qué años tuvieron más actividad.
3. Comparar cada mes contra la mediana histórica del mismo mes y clasificarlo como Bajo, Normal, Alto o Extremo, sin confundir "sin dato" con cero.
4. Permitir elegir el área con regiones de ejemplo, dibujando en el mapa o con latitud y longitud.
5. Descargar los resultados: CSV de los hotspots y CSV del calendario.
6. Seguir funcionando cuando MODIS deje de operar.
7. Ser accesible: paletas para daltonismo, nivel escrito además del color, español e inglés.

**Para quién:** Protección Civil, CONAFOR, brigadas, áreas naturales protegidas y científicos. MVP: México; Argentina ya está cargada para la fase 2.

## Propuesta de solución

1. **Datos.** FIRMS MODIS C6.1 y VIIRS C2 (S-NPP, NOAA-20, NOAA-21) de México, 2000–2026: 9.5 millones de detecciones en PostgreSQL + PostGIS.
2. **Limpieza.** Se marcan las fuentes fijas (celdas clasificadas como fuente estática en 3 o más fechas: industria, no vegetación) y se detectan las caídas de cada satélite. Un mes con caída lleva bandera y no entra a la historia.
3. **Contar lugares, no puntos.** La unidad es la celda-día: una celda de 0.01° (~1 km) con al menos un foco de vegetación ese día. Así un sensor más fino no infla la cuenta. Cada día se usa un solo VIIRS de referencia (S-NPP antes de abril de 2018, NOAA-20 después, con respaldo si uno falla).
4. **Factor k medido.** k = celdas-día MODIS / celdas-día VIIRS en los 167 meses en que ambos operaron (feb-2012 a dic-2025), calculado para el área que elige el usuario (o el del país si hay pocos datos). Validado dejando un año fuera: 6–17 % de error anual según la región y ~35 % mensual. En 15 lugares de México, k va de 0.21 a 0.38: por eso no se usa un factor fijo.
5. **Cada mes contra su historia.** Mediana y percentiles del mismo mes en los demás años (al menos 10) definen el nivel y cuántas veces la mediana vale el mes.
6. **Futuro sin MODIS.** Con "Simular fin de MODIS" la serie usa VIIRS × k desde 2012: en el Bajío el total anual cambia 9 % en mediana y el nivel del mes queda igual o a un escalón en 89 % de los meses.
7. **La app.** ETL en Python → API FastAPI → React + MapLibre. Vista Experto: mapa 3D con el fuego del mes elegido y la ficha de cada punto (satélite, fecha, potencia), calendario de mosaicos, barras anuales, buscador por coordenadas, modo crudo/armonizado, inspector del factor k y descargas. Responde en 0.2 s o menos.

**Resultado.** Con el método, el salto falso del Bajío pasa de ×14.7 (puntos crudos) a ×1.07 (celdas-día armonizadas), y febrero de 2026 aparece como el mes con más fuego en 26 años: 150 celdas-día, 5 veces la mediana.

**Límites declarados.** Un mes nublado puede parecer "poco fuego"; el error mensual (~35 %) obliga a leer niveles y no cifras exactas; no predice incendios: compara cada mes con su historia.

## Estructura

```
etl/        ingesta de FIRMS, máscara estática, caídas de sensor, celdas-día, calibración
backend/    API FastAPI: /presets, /calendar, /calendar.csv, /hotspots.csv
web/        frontend React + Vite + Tailwind
docs/       contexto, PRD, checklist, topología, contratos (docs/contracts/), pitch
scripts/    base de datos (Postgres + PostGIS), descarga del histórico, cifras del pitch
data/       CSV de FIRMS (fuera de Git; se regenera con scripts/download_history.sh)
```

`etl/` y `backend/` comparten el mismo `pyproject.toml` (Python 3.12+, `uv`).

## Cómo correrlo

```bash
scripts/db_up.sh                                   # Postgres + PostGIS en 127.0.0.1:5432
scripts/download_history.sh                        # histórico 2000–2025 de FIRMS a data/
scripts/download_requests.sh                       # solicitudes 2024–2026 (release de GitHub)
uv run python -m etl.run --all                     # ETL completo
uv run uvicorn backend.main:app --port 8000        # API
pnpm install --frozen-lockfile && pnpm dev         # frontend (workspace pnpm en la raíz)
```

Pruebas: `uv run pytest etl backend`.

## Documentación

| Para | Leer |
|---|---|
| Usar la aplicación | [`docs/GUIA_DE_USO.md`](docs/GUIA_DE_USO.md) |
| Cómo está construida | [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) |
| Entender el reto y los datos | [`docs/CONTEXT.md`](docs/CONTEXT.md) |
| Qué construimos y cuándo | [`docs/PRD.md`](docs/PRD.md), [`docs/CHECKLIST.md`](docs/CHECKLIST.md) |
| Dónde corre cada cosa y cómo conectarse | [`docs/TOPOLOGIA.md`](docs/TOPOLOGIA.md) |
| Poblar la base de datos | [`docs/POBLAR_BASE.md`](docs/POBLAR_BASE.md) |
| Qué entrega cada parte a la otra | [`docs/contracts/README.md`](docs/contracts/README.md) |
| La API | [`backend/README.md`](backend/README.md), [`docs/contracts/api.md`](docs/contracts/api.md) |
| El pitch | [`docs/PITCH.md`](docs/PITCH.md), [`docs/ANALISTA.md`](docs/ANALISTA.md) |
| Qué cambió | [`CHANGELOG.md`](CHANGELOG.md) |
