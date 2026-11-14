# PRD · Calendario armonizado de actividad de quema

**Estado (sáb 14-nov, 17:30):** ETL y API listos con datos reales (H1 y H2 cumplidos). Falta conectar el front (H3) y preparar el pitch. Tareas al día en `docs/CHECKLIST.md`.

## Problema

Un gestor de emergencias quiere saber si el fuego de este mes en su región es normal. El registro de 26 años está partido entre MODIS y VIIRS: sumados tal cual, parece que el fuego se multiplicó por 10 desde 2012, y MODIS está por apagarse. Sin un puente, la historia deja de servir como referencia.

## Usuarios y lo que necesitan

| Usuario | Pregunta que debe poder responder en menos de un minuto |
|---|---|
| Protección civil / brigadas | ¿Este mes está por encima de lo normal aquí? |
| Gestor territorial | ¿En qué meses se concentra el fuego en esta zona y qué años fueron extremos? |
| Científico | ¿Cómo se armonizó, con qué error, y puedo bajar los datos? |

## MVP (obligatorio, listo el domingo 00:00)

| # | Función | Criterio de aceptación |
|---|---|---|
| 1 | Elegir región | 3 presets de un clic (Sierra Gorda, Bajío, Querétaro completo) y dibujo de polígono/rectángulo dentro de México |
| 2 | Calendario año × mes | Matriz 2000–2026 con rampa de color apta para daltonismo; valor y estado al pasar el cursor |
| 3 | Crudo vs armonizado | Un interruptor cambia matriz y serie anual. En crudo se ve el salto de 2012; en armonizado desaparece |
| 4 | Diagnóstico del mes | Tarjeta: valor del mes, mediana histórica, razón, estado (`below`/`normal`/`above`/`critical`) |
| 5 | Sin dato ≠ cero | Los meses con caída de sensor o sin cobertura se pintan distinto y no entran a la mediana |
| 6 | Validación visible | Panel con `k` de la región, meses de traslape y error de validación |
| 7 | Descargas | CSV de hotspots de la búsqueda y CSV del calendario |
| 8 | Bilingüe | Selector ES/EN |

## Mejoras si sobra tiempo (en este orden)

1. **"Simular el fin de MODIS"** (`basis = viirs_primary`, ya existe en la API): recalcular la serie usando solo VIIRS escalado desde 2012. La serie anual cambia 6–16 % en mediana; el estado mensual coincide en ~55 % de los meses, así que se muestra con las barras anuales. Es la prueba de continuidad del reto.
2. Estacionalidad: barra de 12 meses con el porcentaje histórico de actividad.
3. Puntos del mes seleccionado sobre el mapa, y capa de celdas estáticas descartadas.
4. `k` por temporada (seca / lluvias) si reduce el error mensual.
5. Métrica secundaria de FRP por celda-día.
6. Exportar la gráfica como PNG.

## Después del MVP

| Fase | Qué | Esfuerzo |
|---|---|---|
| 2 | Argentina y el caso Chilecito del video de la CONAE | Bajo: los datos 2000–2026 ya están cargados y procesados; basta reactivar el preset y aceptar `AR` en la API |
| 3 | Otros países / el mundo | Alto: descargar cada país con `scripts/download_history.sh` o consultar FIRMS en vivo; revisar volumen y tiempos |

## Fuera de alcance

Login, predicción, datos en vivo, cobertura mundial, Landsat/geoestacionarios, despliegue en la nube, app móvil.

## Método de armonización (versión para explicar)

1. **Limpiar.** Solo fuego de vegetación (`type = 0`). Los datos recientes sin `type` se limpian con una máscara de celdas que históricamente fueron fuente estática.
2. **Misma regla para todos.** Malla fija de ~1 km. Una celda con fuego en un día cuenta 1, la vea quien la vea y con los píxeles que sea.
3. **Un solo observador VIIRS.** S-NPP hasta marzo de 2018, NOAA-20 después. Medimos que son equivalentes (razón 1.00–1.02).
4. **Tipo de cambio por región.** En los 14 años en que MODIS y VIIRS vieron lo mismo se calcula `k = MODIS / VIIRS` dentro del área consultada.
5. **Serie final en celdas-día equivalentes MODIS.** MODIS donde existe; `k × VIIRS` donde no.
6. **Anomalía por percentiles** de cada mes calendario contra sus otros años.

Detalle exacto: `docs/contracts/harmonization.md`.

## Roles

| Rol | Dueño de | Entregable |
|---|---|---|
| Procesamiento A | `etl/ingest`, `etl/mask` | `detection` y `static_cell` cargadas |
| Procesamiento B | `etl/cells`, `etl/calibrate`, `etl/outages` | `cell_day`, `sensor_outage`, cifras de control reproducidas |
| Backend | `backend/` | 4 endpoints según contrato, < 2 s en presets |
| Analista | Pitch, video y entrega (`docs/ANALISTA.md`, `docs/PITCH.md`, `docs/HALLAZGOS.md`) | Caso del pitch, guion con cifras reales, fuentes, video y página enviados |
| Líder | Máquina anfitriona, `main`, base `firms`, decisiones de contrato | API estable en 8000, ETL en `firms`, respaldos, PRs fusionados |
| Frontend A | Mapa, presets, dibujo, selector de idioma | Front conectado a la API real |
| Frontend B | Calendario, interruptor, tarjeta, panel de validación, descargas | Interruptor y validación funcionando con datos reales |

## Hitos

| Hito | Cuándo | Qué debe existir | Quién verifica | Estado |
|---|---|---|---|---|
| H0 Cimientos | Sáb 14:30 | Repo en GitHub, acceso SSH probado por los 5, Postgres arriba, contratos congelados, mocks entregados a frontend | Líder | ✅ |
| H1 Datos | Sáb 18:30 | `detection` y `cell_day` con México 2000–2026; cifras de control de `acceptance.md` reproducidas | Procesamiento B | ✅ 14:54 |
| H2 API | Sáb 21:30 | `/presets`, `/calendar` y los CSV respondiendo con datos reales para los 3 presets | Backend + líder | ✅ 17:00 |
| H3 Integración | Dom 00:00 | Frontend contra API real, interruptor crudo/armonizado funcionando: **MVP completo** | Todos | ⏳ |
| H4 Pulido | Dom 07:00 | Polígono libre, banderas de caída, bilingüe revisado, mejora 1 si hay tiempo, pitch ensayado | Analista |  |
| H5 Congelamiento | Dom 09:00 | Rama `main` congelada. Solo correcciones de fallos | Líder |  |
| H6 Entrega | Dom 11:30 | Video grabado (09:00–10:30), página del proyecto llena, enlace al repo | Analista |  |

Integración obligatoria en cada hito: todos hacen `git pull`, se corre la app completa y se pasa la lista de `acceptance.md`.

Descanso: nadie programa de 02:00 a 06:00 sin relevo; al menos 2 personas duermen en cada turno.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La máquina anfitriona falla o se queda sin red | `pg_dump` a un disco externo en H1, H3 y H5; el repo siempre al día en GitHub |
| La ingesta de ~20 M de filas tarda o no cabe | Filtrar al leer (solo columnas del contrato), `COPY`, índices al final. Si aun así no da: limitar a los estados del centro de México |
| El frontend de Figma Make no encaja con la API | Construyen desde el minuto cero contra los JSON de `docs/contracts/examples/`; la API no cambia de forma sin pasar por el analista |
| El polígono libre es lento | Límite de 200,000 km²; consulta sobre `cell_day`, no sobre puntos |
| El error de calibración es alto en zonas con poco fuego | Si el traslape tiene < 100 celdas-día MODIS se usa el `k` del país y la respuesta lo declara |
| Se acaba el tiempo | Orden de recorte: mejoras → polígono libre → CSV del calendario. Nunca se recorta el interruptor crudo/armonizado ni la validación |

## Guion de la demo

El guion de 3 minutos, las afirmaciones con su evidencia y las pruebas de la demo están en `docs/PITCH.md`.
