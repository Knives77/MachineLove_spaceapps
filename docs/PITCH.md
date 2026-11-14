# Pitch, evidencia y pruebas de la demo

Dueño: **analista**. Este documento decide qué se dice, qué se muestra y con qué se prueba. Si una frase del pitch no tiene evidencia marcada ✅ en la tabla de la sección 3, no se dice.

---

## 1. Mensaje central

> **ES:** Durante 25 años los satélites contaron incendios con reglas distintas. Nosotros los ponemos en la misma escala para que un brigadista sepa, en un vistazo, si el fuego de este mes es normal o histórico, aunque MODIS se apague.
>
> **EN:** For 25 years satellites counted fires with different rules. We put them on one scale so a fire manager can tell at a glance whether this month is normal or historic — even after MODIS goes dark.

Tres ideas que el jurado debe repetir al salir:
1. **El salto de 2012 es falso** y lo quitamos.
2. **Lo validamos** con 14 años en que ambos sensores midieron juntos, y decimos el error.
3. **Sirve hoy** en Querétaro (febrero de 2026 fue récord en el Bajío) y sigue funcionando cuando MODIS se apague.

---

## 2. Guion de 3 minutos · v2 con datos reales (propuesta; la decide el analista)

La v1 suponía que la temporada era marzo–mayo en todo Querétaro y que el factor `k` se veía en el modo armonizado. Con los datos reales: el Bajío quema en **enero–marzo** y la sierra en **abril–junio**, y `k` solo cambia los datos en pantalla con **"Simular fin de MODIS"** (en el modo normal, el panel de validación solo lo reporta). Esta versión sigue lo que la app muestra hoy.

**Ruta de la demo:** preset **Bajío** → Crudo → Armonizado → calendario → clic en **febrero de 2026** → "Simular fin de MODIS" → panel de validación → preset **Sierra Gorda** → CSV.

| Tiempo | En pantalla | Qué se dice | Dato en la app | Campo |
|---|---|---|---|---|
| 0:00–0:20 | Portada / mapa | MODIS se apaga, S-NPP ya se apagó (2-nov-2026), y la historia no se puede comparar | — | — |
| 0:20–0:45 | Bajío, modo **Crudo**, barras anuales | "Según los datos tal cual, el fuego se multiplicó por 15 entre 2011 y 2019" | 349 → 5,137 puntos | `years[].raw_points` |
| 0:45–1:05 | Interruptor a **Armonizado** | "Misma historia, misma regla: el salto desaparece" | 243 → 260 celdas-día (×1.07) | `years[].harmonized` |
| 1:05–1:30 | **Calendario** año × mes | "Aquí se quema en enero–marzo: quemas agrícolas. Y este febrero…" | Columnas ene–mar más claras | `months[]`, `seasonality` |
| 1:30–1:50 | Clic en **febrero de 2026** → tarjeta | "…fue el mes con más fuego en 26 años: cinco veces lo normal" (+ la noticia, si la hay) | 150 celdas-día, 5.0×, crítico | `months[].status`, `anomaly_ratio` |
| 1:50–2:15 | **Simular fin de MODIS** | "¿Y cuando MODIS se apague? Usamos VIIRS con un factor medido en 14 años de traslape: las barras casi no cambian" | Barras anuales con 9 % de diferencia en mediana; `k` = 0.30 | `basis = viirs_primary`, `calibration.k` |
| 2:15–2:35 | **Panel de validación** | "Y decimos cuánto nos equivocamos: 10 % al año, ~35 % al mes. Por eso hablamos de niveles, no de cifras exactas" | Errores LOYO y mensual | `calibration.*` |
| 2:35–2:50 | Preset **Sierra Gorda** | "En la sierra, en el mismo estado, el fuego es forestal, en abril–junio, y el factor es otro: 0.26" | Calendario con otra temporada y otro `k` | `seasonality`, `calibration.k` |
| 2:50–3:00 | Botón **CSV** + cierre | "Cualquier región de México, descargable, y sigue funcionando cuando MODIS ya no esté" | Descarga | `/calendar.csv` |

## 3. Afirmaciones y su evidencia

| # | Afirmación | Evidencia | Estado |
|---|---|---|---|
| A1 | Sumar puntos crudos crea un salto falso | App, Querétaro completo: 524 puntos crudos (2011) → 7,304 (2019), ×13.9; armonizado 410 → 414 celdas-día. (El 423 → 4,554 de `CONTEXT.md` cuenta solo `type = 0`; en el pitch se usa la cifra de la app) | ✅ medido con la API |
| A2 | Los tres VIIRS son equivalentes entre sí | NOAA-20 / S-NPP = 1.00–1.02 en 3 regiones | ✅ medido |
| A3 | El factor MODIS/VIIRS cambia por región | API: 0.260 Sierra Gorda, 0.304 Bajío, 0.290 Querétaro completo, dentro del mismo estado | ✅ medido con la API |
| A4 | Error anual de la conversión | API (mediana dejando un año fuera): 6 % Querétaro completo, 10 % Bajío, 17 % Sierra Gorda | ✅ medido con la API |
| A5 | Error mensual ~35 % | API: 33 % Querétaro, 37 % Bajío, 37 % Sierra Gorda | ✅ medido con la API |
| A6 | Quitamos fuentes industriales | 3,111 celdas fijas; máscara valida 94–99.9 % | ✅ medido |
| A7 | Detectamos solos las caídas de sensor | Terra 15-jun → 3-jul-2001, coincide con el Readme de FIRMS | ✅ medido |
| A8 | S-NPP dejó de operar el 2-nov-2026 | Blog de FIRMS / datos terminan ese día | ⏳ falta la cita (I5) |
| A9 | Caso destacado de México (mes récord y si coincide con incendios reportados) | Consulta I2 | ⏳ I2 |
| A10 | El ruido del sur de Querétaro es Tula | Celdas más fuertes en 20.04 N, 99.29 W | ⏳ I3 |
| A11 | Sin MODIS, la historia **anual** casi no cambia; el nivel **mensual** sí puede moverse un escalón | Serie anual: mediana de diferencia 16 % Sierra Gorda, 9 % Bajío, 6 % Querétaro. Estado mensual 2012–2025: igual en 55–56 % de los meses, a un nivel o menos en ~90 %; de los meses críticos, 60–80 % siguen saliendo alto o crítico | ✅ medido el 14-nov con la API |
| A12 | Responde en menos de 2 s | Presets 0.35–0.38 s; polígono en Jalisco 0.46 s (anfitriona, 14-nov) | ✅ medido; repetir el día de la demo |

## 4. Lo que **no** se dice

- ❌ "Detectamos incendios" → se dice **"focos de calor"** o **"actividad de fuego"**. Un hotspot es un píxel caliente, no un incendio.
- ❌ "Predecimos" → no hay predicción; comparamos contra la historia.
- ❌ "Precisión de X %" sin decir anual o mensual.
- ❌ "Funciona en todo el mundo" → el MVP funciona en México; el método es aplicable a otras regiones (Argentina ya está cargada para la siguiente fase).
- ❌ Cualquier cifra del mock. Solo cifras de la app real o de `HALLAZGOS.md`.
- ❌ A9 y A10 hasta que pasen a ✅.

---

## 5. Preguntas probables de los jueces

| Pregunta | Respuesta corta |
|---|---|
| ¿Por qué no multiplican VIIRS por un factor fijo global? | Porque medimos que cambia de 0.26 a 0.40 entre regiones; lo calculamos dentro del área que elige el usuario. |
| ¿Por qué no regresión o *quantile mapping*? | Lo probamos: la regresión log-log no superó al factor regional (8.8 % vs 6.8 % de error anual en Querétaro). Elegimos lo más simple que mejor funcionó. |
| ¿Qué error tiene? | 6–17 % anual según la región, ~35 % mensual. Por eso clasificamos por percentiles y no prometemos precisión mensual. |
| ¿Qué pasa cuando se apague MODIS? | Desde 2012 ya tenemos el factor; la serie sigue con VIIRS escalado. Lo probamos simulando el fin de MODIS: los totales anuales cambian entre 6 y 16 % en mediana, y el nivel de cada mes queda igual o a un escalón en 9 de cada 10 meses. |
| ¿Y Terra en la mañana? | Al apagarse se pierde la ventana de media mañana; el factor absorbe el promedio, no el ciclo diario. Es un límite declarado. |
| ¿Cómo distinguen "sin dato" de "cero"? | Detectamos días sin ninguna detección del satélite en todo el país y los marcamos; esos meses no entran a la mediana. |
| ¿Por qué celdas de 1 km y no puntos? | Un mismo fuego genera ~4 puntos VIIRS por cada uno de MODIS; la celda-día cuenta "lugar con fuego ese día" igual para ambos. |
| ¿Y las plataformas petroleras? | En datos recientes sin clasificar no se filtran: probamos y las celdas costeras tenían más fuego real que plataformas. |
| ¿Por qué no usaron IA? | El reto es de consistencia histórica, no de predicción. Un método simple y medible es más defendible. |
| ¿Quién lo usaría? | Protección Civil, brigadas, CONAFOR, gestores de áreas protegidas como Sierra Gorda. |
| ¿Y el caso de Chilecito de la CONAE? | Los datos de Argentina 2000–2026 ya están cargados y procesados; es la siguiente fase. Elegimos cerrar bien México primero. |

---

## 6. Pruebas de la demo

### Escenarios (correr en H3, H4 y antes de grabar)

| # | Acción | Resultado esperado | ✅ / ❌ |
|---|---|---|---|
| D1 | Abrir la app sin red externa (solo localhost) | Carga completa; el mapa base puede faltar, todo lo demás funciona | |
| D2 | Preset Sierra Gorda | Calendario 2000–2026 en < 2 s; `k` ≈ 0.26 | |
| D3 | Preset Bajío, modo Crudo | Salto visible en 2012 | |
| D4 | Interruptor a Armonizado | Salto desaparece; matriz y barras cambian juntas | |
| D5 | Pasar el cursor por un mes de 2001 | Muestra banderas (`terra_only`, `modis_outage` si aplica) | |
| D6 | Meses de nov–dic 2026 | Gris con trama ("sin dato"), no color de cero. Noviembre es mes parcial: puede mostrar su valor en el tooltip, pero su nivel es "sin dato" | |
| D7 | Presets Sierra Gorda y Bajío | Estacionalidad y `k` distintos (≈ 0.26 y ≈ 0.30) | |
| D8 | Dibujar polígono pequeño en Jalisco | Responde en < 8 s | |
| D9 | Dibujar polígono en el océano o en Argentina | Mensaje de error traducido, la app no se rompe | |
| D10 | Dibujar polígono enorme (todo México) | Mensaje "área demasiado grande" | |
| D11 | Cambiar a inglés | Todo traducido, incluidos estados y banderas | |
| D12 | Descargar los dos CSV | Abren en hoja de cálculo; columnas del contrato | |
| D13 | Recargar la página a mitad de la demo | Vuelve a un estado usable | |

### Coherencia de números (el analista cruza la app contra la base)

- [ ] Los totales anuales de MODIS en la app coinciden con la tabla de `acceptance.md` (± 1 %).
- [ ] El `k` de cada preset coincide con `calibration` de la API y con A3.
- [ ] La suma de `raw_points` de un año coincide con un `count(*)` directo en `detection`.
- [ ] Ninguna cifra del guion difiere de lo que se ve en pantalla.

### Plan B

- [ ] Capturas de pantalla de cada paso del guion (H4).
- [ ] Video de respaldo grabado de la demo (H5), por si la app falla en vivo.
- [ ] La demo corre en la máquina anfitriona sin túneles ni red; laptop cargada, notificaciones apagadas, zoom del navegador probado en el proyector.
- [ ] Una persona habla y otra opera; ensayado al menos 2 veces con cronómetro.

---

## 7. El analista como dueño del pitch

El analista tiene la última palabra en:

- **Qué se dice:** la tabla de la sección 3. Sin ✅, no se dice.
- **Cómo se muestra:** el orden del guion, qué preset y qué mes se enseñan, qué va en el video.
- **Si la demo está lista:** los escenarios de la sección 6.

Los contratos los decide el líder (`docs/contracts/README.md`) y le avisa al analista cuando un cambio toca el pitch. Lo que se recorta si vamos tarde lo deciden juntos, siguiendo el orden del PRD: mejoras → polígono libre → CSV del calendario. Nunca el interruptor ni el panel de validación.

En H3 y H4, el analista manda al chat un mensaje de 3 líneas: qué escenarios de la demo pasan, qué falla y de quién es, y qué falta del pitch.
