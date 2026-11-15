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
3. **Sirve hoy y en cualquier lugar de México** (febrero de 2026 fue récord en el Bajío; el jurado lo prueba en su propio lugar) y sigue funcionando cuando MODIS se apague.

### 1.1 Rúbrica del jurado (Space Apps Querétaro 2026)

Cuatro criterios, cada uno de 1 a 5. La tabla dice qué pide el 5, en qué momento del guion se gana y con qué evidencia. **El jurado no tiene que deducir nada: cada criterio se dice en voz alta una vez** (frases en el cierre, §2).

| Criterio | Qué pide el 5 | Dónde se gana | Qué se dice | Evidencia |
|---|---|---|---|---|
| **Impacto** | "Alto impacto global o transformador: resuelve un gran problema y ayuda a muchísimos" | Apertura (0:00), acto 2 (febrero de 2026), acto 3 (lugar del jurado), cierre | El problema es de todos los que usan FIRMS: cualquier serie larga de focos de calor tiene el salto de 2012 y pierde su referencia cuando MODIS se apague. Aquí cualquier persona, sin saber de satélites, sabe si el fuego de su zona este mes es normal o extremo. Usuarios: Protección Civil, brigadas, CONAFOR, áreas protegidas. Hoy México; el método se calcula solo en cualquier área y Argentina ya está cargada | A1, A8, A12; "Lugares probados" en `HALLAZGOS.md` |
| **Creatividad e innovación** | "Altamente creativo, disruptivo, novedoso o inesperado" | Acto 1 (el salto que desaparece), acto 3 (`k` del lugar que eligen), acto 4 (un juez apaga MODIS) | No usamos un factor global: el factor se mide **dentro del área que dibuja el usuario**, al momento. No contamos puntos sino **lugares con fuego por día** (celda-día), que es lo que los dos sensores sí ven igual. Y el fin de MODIS no se explica: **se simula con un interruptor** y se ve cuánto cambia la historia | A3, A11 |
| **Viabilidad científica y técnica** | "Altamente viable, fundamentos sólidos, prototipo funcional y aplicable en la práctica" | Toda la demo (es la app real, no láminas), acto 4 (validación) | Funciona hoy, en esta laptop, con 26 años de datos reales de la NASA guardados en la propia máquina (solo el mapa de fondo usa internet). El factor se valida con 14 años en que los dos sensores midieron juntos, dejando un año fuera cada vez, y **decimos el error**: 6–17 % anual, ~35 % mensual. Repo público, con cifras de control y pruebas automáticas | A2, A4, A5, A6, A7, A12 |
| **Receptivo al desafío** | "Responde completamente, solución robusta, completa y bien alineada" | Acto 2 (calendario), acto 3 (región), cierre | El reto pide dos cosas y están las dos: (1) una serie armonizada MODIS + VIIRS y (2) una app web con calendario año × mes. Lista de abajo | Lista de abajo |

**Lo que pide el reto, punto por punto** (el operador lo muestra; quien habla lo nombra en el cierre):

| Pide el reto | Dónde se ve en la app |
|---|---|
| Armonizar MODIS y VIIRS en una serie consistente | Armonizado / Crudo; factor `k` y su error en la lectura del mes (arriba a la izquierda) |
| Calendario de actividad de quema, año × mes | Panel "Calendario" (derecha) |
| El usuario elige la región | 3 regiones listas, dibujar en el mapa, o buscador por coordenadas |
| Patrones estacionales | Filas del calendario (enero–marzo en el Bajío, abril–junio en la sierra) |
| Años extremos | "Total por año" y cuadros de nivel Extremo |
| El mes actual contra la mediana histórica | Lectura del mes: nivel y "N× la mediana" |
| Descarga en CSV | Botón de descarga en la lectura del mes |
| Que siga sirviendo sin MODIS | Interruptor de MODIS en la línea de tiempo |

**Huecos que bajan la nota y cómo se tapan:**

- **Impacto "global":** el MVP es México. No se dice "funciona en todo el mundo" (§4); se dice que **el problema es global y el método no depende del lugar**. Si preguntan, Argentina ya está cargada.
- **Impacto sin caso real:** A9 sigue ⏳. Si procesamiento A encuentra la noticia de febrero de 2026 en el Bajío, se dice en el acto 2; es lo que más sube este criterio. Sin noticia, se dice solo lo que muestra la app.
- **Receptivo:** el caso oficial de Chilecito (CONAE) no está en la demo. Respuesta en §5.
- **Viabilidad:** el error mensual (~35 %) se dice antes de que lo pregunten; por eso se habla de niveles y no de cifras exactas.

---

## 2. Presentación en vivo con dinámica · v4 (propuesta; la decide el analista)

**No hay video.** Se presenta en vivo ante el jurado, en la máquina del líder, y **el jurado participa**: adivina, elige un lugar y apaga MODIS. La duración exacta sale de D1; esta versión dura ~4 minutos. Si hay que recortar a 3: quitar Sierra Gorda del cierre y dejar el acto 3 en un solo lugar. El acto 4 no se quita: es donde se ve el factor `k` trabajando.

Datos reales (14-nov): el Bajío quema en **enero–marzo** y la sierra en **abril–junio**; `k` solo cambia los datos en pantalla con **"Simular fin de MODIS"**. Cualquier polígono en México responde en **0.2 s**.

**Ruta:** Bajío → Crudo → (votación) → Armonizado → febrero de 2026 → lugar del jurado → Simular fin de MODIS → validación → cierre.

**Dónde está cada cosa en la app (15-nov 08:30):** la demo usa **solo la vista Experto**; el menú de vistas está oculto, así que el guion no pasa por General ni Aprendizaje.

- **Armonizado / Crudo:** consola de abajo, al centro.
- **Regiones** (Sierra Gorda, Bajío, Querétaro completo): consola de abajo, a la izquierda; teclas 1–3.
- **Apagar MODIS:** el interruptor a la derecha de las pistas MODIS / VIIRS de la línea de tiempo. Debajo aparece el factor (`×.304` en el Bajío). En Crudo está desactivado. Con MODIS apagado, "Total por año" muestra una **línea punteada** con el valor con MODIS: es lo que el jurado tiene que mirar.
- **Validación** (factor `k`, error anual y mensual): lectura del mes, arriba a la izquierda, junto con el nivel y las descargas.
- **Calendario año × mes y "Total por año":** panel derecho (botón "Calendario").
- **Lugar del jurado:** herramientas de dibujo en la consola de abajo, o el buscador "lat, lon" arriba a la derecha (±25 / 50 / 100 km).
- **Fuego en el mapa:** aparece al elegir un mes con actividad.
- **Nombres de los niveles en pantalla:** Bajo, Normal, Alto, **Extremo**. Lo que el guion llama "crítico" o "récord" se ve como "Extremo".

### Acto 1 · "¿Cuánto creció el fuego?" (0:00–1:00)

| Tiempo | En pantalla | Qué pasa | Dato |
|---|---|---|---|
| 0:00–0:15 | App abierta en el Bajío | "Desde 2000 contamos focos de calor desde el espacio, y con eso deciden brigadas y Protección Civil. Pero el satélite que los contaba se está apagando, y el nuevo cuenta distinto." | S-NPP se apagó el 2-nov-2026 |
| 0:15–0:35 | Bajío, modo **Crudo**, "Total por año" | **Pregunta al jurado:** "Si sumamos los datos de la NASA tal cual, el fuego en el Bajío se multiplicó por 15 entre 2011 y 2019. ¿Quién cree que es cierto? Levanten la mano." | 349 → 5,137 puntos |
| 0:35–1:00 | Interruptor a **Armonizado** | "No era fuego: era un satélite nuevo que ve más. Con una sola regla, el salto desaparece." | 243 → 260 celdas-día (×1.07) |

### Acto 2 · "Este año" (1:00–1:40)

| Tiempo | En pantalla | Qué pasa | Dato |
|---|---|---|---|
| 1:00–1:20 | Calendario año × mes | "Esto es lo que pide el reto: un calendario de quema. Cada cuadro es un mes; cuanto más claro, más fuego. Aquí se quema en enero–marzo: quemas agrícolas." | `seasonality` |
| 1:20–1:40 | Clic en **febrero de 2026** | **Pregunta:** "¿Normal, alto o extremo?" (tarjetas de votación). Revelar: "El mes con más fuego en 26 años: cinco veces lo normal." El mapa muestra dónde ardió (+ la noticia, si procesamiento A la encuentra) | 150 celdas-día, 5.0×, Extremo |

### Acto 3 · "Elijan un lugar" (1:40–2:40)

| Tiempo | En pantalla | Qué pasa | Dato |
|---|---|---|---|
| 1:40–2:00 | Mapa | "Díganme un lugar de México que les importe." Se dibuja un rectángulo en vivo, o se pegan sus coordenadas en el buscador | Responde en ~0.2 s |
| 2:00–2:40 | Calendario y lectura del lugar | Leer en voz alta su temporada, su peor mes en 26 años y cómo va 2026. Señalar que el factor `k` de ese lugar se acaba de medir, y es distinto al del Bajío. Si piden un lugar fuera de México: "En esta versión cubrimos México; Argentina ya está cargada para la siguiente" (la app muestra el aviso, no se rompe) | Ver "Lugares probados" en `HALLAZGOS.md` |

**Plan B del acto 3:** si nadie propone un lugar o la app tarda, el operador usa uno de los probados (La Primavera, Ajusco, Chimalapas…).

### Acto 4 · "Apaguen MODIS" (2:40–3:30)

| Tiempo | En pantalla | Qué pasa | Dato |
|---|---|---|---|
| 2:40–3:05 | Bajío, **interruptor de MODIS** en la línea de tiempo | Darle el mouse a un juez: **"Ustedes apagan MODIS."** Las barras de "Total por año" casi no se separan de la línea punteada | 9 % de cambio en mediana; `k` = 0.30 medido en 14 años de traslape |
| 3:05–3:30 | Lectura del mes (factor `k` y errores) | "Lo validamos con los 14 años en que los dos sensores midieron juntos. Y decimos cuánto nos equivocamos: 10 % al año, ~35 % al mes. Por eso hablamos de niveles, no de cifras exactas." | `calibration.*` |

### Cierre (3:30–4:00)

| Tiempo | En pantalla | Qué pasa |
|---|---|---|
| 3:30–3:40 | Sierra Gorda (opcional) | "Mismo estado, otro fuego: la sierra quema en abril–junio, con otro factor. Por eso se calcula para cada región." |
| 3:40–4:00 | App en el Bajío, febrero de 2026 | Las cuatro frases de la rúbrica, en este orden, y la frase de cierre (§1) |

**Las cuatro frases (una por criterio; se dicen tal cual):**

1. **Responde al reto:** "El reto pedía una serie armonizada y un calendario de quema con región, estacionalidad, extremos, comparación con la mediana y CSV. Lo acaban de usar."
2. **Es viable:** "No es una idea: es un prototipo que corre hoy con 26 años de datos de la NASA, validado con 14 años de traslape y con su error a la vista."
3. **Es distinto:** "El factor no es global: se mide en el lugar que ustedes eligieron. Y el fin de MODIS lo apagaron ustedes."
4. **Importa:** "Cualquier brigada o Protección Civil puede saber en segundos si este mes es normal o extremo en su zona, y lo seguirá sabiendo cuando MODIS se apague."

Si hay que recortar el cierre a 10 s: frases 2 y 4.

### Extra si la app lo permite · "Escuchen 26 años"

Reproducir la línea de tiempo con sonido: cada mes suena según su nivel, y los críticos suenan dos veces. Febrero de 2026 "suena" distinto. Necesita que front agregue sonido y una velocidad más rápida a la reproducción (hoy son 450 ms por mes: 26 años tardan más de 2 minutos).

### Materiales

- Tarjetas impresas o en el celular: **Normal · Alto · Extremo** (los nombres que usa la app), para que el jurado vote en el acto 2.
- Una persona habla y otra opera. El operador tiene la ruta impresa.
- La app abierta en Bajío y en modo Crudo antes de empezar, con el panel del calendario abierto.
- La rúbrica impresa junto a la ruta: quien habla marca cada criterio cuando lo dice.

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
| ¿Qué impacto tiene fuera de México? | El problema es el mismo en cualquier país que use FIRMS: el salto de 2012 y el fin de MODIS. El método no depende del lugar, porque el factor se mide en cada área. Hoy está probado en México; Argentina ya está cargada. |
| ¿Qué tiene de nuevo? FIRMS ya muestra los focos | FIRMS muestra puntos de cada sensor. Nosotros los ponemos en una sola escala de 26 años, con el factor medido en el área del usuario, el error declarado y la respuesta a "¿es normal este mes?". |
| ¿Se puede usar mañana? | Sí: corre en una laptop con Postgres y los CSV públicos de FIRMS; la base se arma desde cero en unos 2 minutos (`POBLAR_BASE.md`). Falta conectarlo a los datos en vivo, que quedó fuera del MVP. |
| ¿Y el caso de Chilecito de la CONAE? | Los datos de Argentina 2000–2026 ya están cargados y procesados; es la siguiente fase. Elegimos cerrar bien México primero. |

---

## 6. Pruebas de la demo

### Escenarios (correr en H3, H4 y antes de presentar)

| # | Acción | Resultado esperado | ✅ / ❌ |
|---|---|---|---|
| D1 | Abrir la app sin red externa (solo localhost) | Carga completa; el mapa base puede faltar, todo lo demás funciona | |
| D2 | Preset Sierra Gorda | Calendario 2000–2026 en < 2 s; `k` ≈ 0.26 | |
| D3 | Región Bajío, modo Crudo (vista Experto) | Salto visible en 2012 | |
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
| D14 | Dibujar en vivo 3 lugares de "Lugares probados" | Cada uno responde en < 1 s y la tarjeta se lee en voz alta sin buscar | |
| D15 | Un juez mueve el interruptor de MODIS en la línea de tiempo | Cambia "Total por año" y aparece la línea punteada; se puede volver a encender | |
| D16 | Pegar "20.55, -103.60" en el buscador de coordenadas | Consulta el cuadro alrededor del punto y actualiza calendario y lectura | |
| D17 | Recorrer la lista "Lo que pide el reto" (§1.1) en la app | Cada punto se encuentra en menos de 5 s sin salir de Experto | |

### Coherencia de números (el analista cruza la app contra la base)

- [ ] Los totales anuales de MODIS en la app coinciden con la tabla de `acceptance.md` (± 1 %).
- [ ] El `k` de cada preset coincide con `calibration` de la API y con A3.
- [ ] La suma de `raw_points` de un año coincide con un `count(*)` directo en `detection`.
- [ ] Ninguna cifra del guion difiere de lo que se ve en pantalla.

### Plan B

- [ ] Capturas de pantalla de cada paso del guion (H4).
- [ ] Grabación de pantalla de la demo completa (H5), solo para usarla si la app falla en vivo.
- [ ] La demo corre en la máquina anfitriona sin túneles ni red; laptop cargada, notificaciones apagadas, zoom del navegador probado en el proyector.
- [ ] Una persona habla y otra opera; ensayado al menos 2 veces con cronómetro.

---

## 7. El analista como dueño del pitch

El analista tiene la última palabra en:

- **Qué se dice:** la tabla de la sección 3. Sin ✅, no se dice.
- **Cómo se muestra:** el orden de la presentación, la dinámica con el jurado, qué preset y qué mes se enseñan.
- **Si la demo está lista:** los escenarios de la sección 6.

Los contratos los decide el líder (`docs/contracts/README.md`) y le avisa al analista cuando un cambio toca el pitch. Lo que se recorta si vamos tarde lo deciden juntos, siguiendo el orden del PRD: mejoras → polígono libre → CSV del calendario. Nunca el interruptor ni el panel de validación.

En H3 y H4, el analista manda al chat un mensaje de 3 líneas: qué escenarios de la demo pasan, qué falla y de quién es, y qué falta del pitch.
