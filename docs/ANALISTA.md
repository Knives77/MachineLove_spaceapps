# Guía del analista · diseñador de la presentación

Tu trabajo es **diseñar la presentación en vivo** (no hay video): la historia que contamos, la **dinámica con el jurado** para dejarlo impresionado, lo que se ve en cada segundo, los materiales y la página del proyecto. **No programas, no corres consultas ni scripts.** Los números te los entrega procesamiento y quedan en [`HALLAZGOS.md`](HALLAZGOS.md); tú decides cuáles se usan y cómo se cuentan.

- Base del guion, afirmaciones y preguntas de jueces: [`PITCH.md`](PITCH.md). Es tuyo: cámbialo como quieras.
- Regla única: si una cifra o un hecho no está en `HALLAZGOS.md` con su fuente, no se dice.
- Para ver la app: pídele a front que te la abra, o úsala en la máquina del líder.

## Quién te da qué

| Necesitas | Te lo da | Dónde queda |
|---|---|---|
| Cifras de la app (k, errores, salto falso, meses récord, temporada, "sin MODIS") | Procesamiento B | `HALLAZGOS.md` → Cifras |
| Noticias que coincidan con los meses récord | Procesamiento A | `HALLAZGOS.md` → Caso |
| Qué instalación es el ruido industrial del sur (Tula o no) | Procesamiento A | `HALLAZGOS.md` → Caso |
| Lugares de México ya probados para que el jurado elija uno | Procesamiento B | `HALLAZGOS.md` → Lugares probados |
| Capturas de pantalla de la app con datos reales (plan B) | Front | Carpeta compartida del equipo |
| Cambios en lo que muestra la app | Front, por medio del líder | Chat |

Si te falta un dato, pídelo en el chat con el formato: *"Necesito X para el minuto Y de la presentación, antes de las HH:MM"*.

---

## D1 · Las reglas del juego · **ya, antes de las 18:30**

Lee la página oficial de Space Apps 2026 o pregunta a los organizadores locales:

- [ ] Qué campos tiene la página del proyecto (resumen, enlaces, uso de IA, equipo…).
- [ ] Presentación en vivo: cuándo, cuánto dura, si hay preguntas después, en qué sala y con qué pantalla o proyector.
- [ ] Confirmar que **no piden video** en la entrega. Si lo piden, avisar al líder en ese momento.
- [ ] ¿El repo debe ser público? ¿Hay que declarar el uso de IA?
- [ ] Hora exacta de cierre y zona horaria.
- [ ] Criterios de evaluación de los jueces: el pitch se diseña para ellos.

Anótalo en `HALLAZGOS.md` → **Entrega**. Si algo choca con el plan (por ejemplo, piden una URL pública), avisa al líder **en ese momento**.

## D2 · La historia · hasta las 21:00

Decide el arco en una página antes de pensar en pantallas:

- [ ] **El problema en una frase**, para alguien que nunca oyó de MODIS.
- [ ] **El momento "ajá"**: el salto falso de 2012 que desaparece. En el Bajío, los puntos crudos se multiplican ×14.7 entre 2011 y 2019; armonizado, ×1.07.
- [ ] **El caso**: febrero de 2026 fue el mes con más fuego en el Bajío en 26 años, cinco veces lo normal. Cuenta más si procesamiento A encuentra la noticia.
- [ ] **El futuro**: con "Simular fin de MODIS", las barras anuales casi no cambian (9 % en mediana en el Bajío).
- [ ] **Quién lo usaría** y qué decidiría con esto (Protección Civil, brigadas, CONAFOR, Sierra Gorda).
- [ ] **Cierre** en ES y EN.

Entregable: el arco en 6–8 frases, al principio de `PITCH.md`.

## D3 · La dinámica con el jurado · hasta las 22:30

Es lo que los deja impresionados: **el jurado no mira, participa**. En `PITCH.md` §2 hay una propuesta v3 en 4 actos, armada con lo que la app ya hace:

1. **"¿Cuánto creció el fuego?"**: el jurado levanta la mano si cree que el fuego se multiplicó por 15. Interruptor: no era fuego, era el satélite.
2. **"Este año"**: votan con tarjetas si febrero de 2026 fue normal, alto o récord. Fue récord en 26 años.
3. **"Elijan un lugar"**: un juez dice un lugar de México y se dibuja en vivo; la app responde en 0.2 s con su temporada y su peor mes. Hay 6 lugares ya probados como respaldo.
4. **"Apaguen MODIS"**: un juez presiona "Simular fin de MODIS" y ve que la historia aguanta.

- [ ] Elegir qué actos van y en qué orden. Cambia lo que quieras: es tu diseño.
- [ ] Escribir las frases exactas de cada pregunta al jurado y qué se dice según lo que respondan.
- [ ] Preparar qué decir si el lugar que eligen tiene pocos datos o queda fuera de México: la app avisa y no se rompe, pero hay que tener la frase lista.
- [ ] Decidir los materiales: tarjetas de votación (Normal · Alto · Récord), algo impreso para el jurado, quién les pasa el mouse.
- [ ] Opcional: "Escuchen 26 años" (la línea de tiempo con sonido). Si lo quieres, pídeselo a front **antes de las 23:00**.

## D4 · Guion y ruta de la demo · hasta las 23:30

- [ ] Guion minuto a minuto (`PITCH.md` §2): pantalla, clic, frase y quién habla.
- [ ] Marcar en §3 qué afirmaciones usas. Las que no tengan ✅ no entran.
- [ ] Revisar §4 (lo que no se dice) con quien va a hablar.
- [ ] Pasarle a front la **ruta de la demo** impresa (preset, mes, botones y orden), para que la app quede lista para ese recorrido.
- [ ] 2–3 diapositivas o tarjetas de apoyo, solo si ayudan: portada, método en una imagen, quién lo usaría.
- [ ] Texto de la página del proyecto en ES y EN: resumen (≤ 150 palabras), método en 6 pasos (sale de `PRD.md`), datos usados, uso de IA y enlace al repo.

## D5 · Ensayos · H3 (00:00) y H4 (07:00)

- [ ] Ensayo completo con la app real y con alguien que haga de jurado y responda cosas inesperadas.
- [ ] Probar el acto 3 con 3 lugares que nadie haya ensayado.
- [ ] Repasar los escenarios de `PITCH.md` §6 junto con front (ellos operan, tú marcas ✅/❌).
- [ ] Ensayar las preguntas de jueces (§5): cada quien responde 2 sin leer.
- [ ] Dos ensayos con cronómetro: una persona habla y otra opera.

## D6 · Presentación y entrega · H5–H6 (09:00–11:30)

- [ ] Plan B listo: capturas de cada paso y una grabación de pantalla de la demo, solo para usarla si la app falla en vivo.
- [ ] Último ensayo en la sala o con el proyector: zoom del navegador, sonido si se usa, notificaciones apagadas.
- [ ] Llenar la página y enviar **antes de las 11:30**.

---

## Lo que ya muestra la app (14-nov, 17:45)

Para diseñar sin esperar a nadie. Fuente: `HALLAZGOS.md`, salida de `pitch_numbers.py`.

| Dato | Sierra Gorda | Bajío | Querétaro completo |
|---|---|---|---|
| Salto falso (crudo 2011 → 2019) | ×12.4 | ×14.7 | ×13.9 |
| Armonizado 2011 → 2019 | ×0.92 | ×1.07 | ×1.01 |
| Temporada | abril–junio (pico en mayo) | enero–marzo (quemas agrícolas) | marzo |
| Mes récord en 26 años | mayo de 2024 (3.4× lo normal) | **febrero de 2026 (5×)** | **febrero de 2026 (5×)** |
| Año récord | 2011 | 2025 | 2025 |
| `k` (factor MODIS/VIIRS) | 0.26 | 0.30 | 0.29 |
| Error anual / mensual | 17 % / 37 % | 10 % / 37 % | 6 % / 33 % |
| Sin MODIS: barras anuales cambian | 16 % | 9 % | 6 % |

Cosas que hay que saber al diseñar:
- En modo armonizado normal, la serie es MODIS medido en celdas-día; el factor `k` solo cambia los datos con **"Simular fin de MODIS"** (el panel de validación lo reporta, pero no cambia nada). Si quieres que se vea el factor trabajando, la demo tiene que pasar por ese botón.
- El nivel mensual (normal, alto, crítico) tiene ~35 % de error: se habla de niveles, no de cifras exactas por mes.
- Los meses de 2000 antes de noviembre, y noviembre y diciembre de 2026, se ven en gris: "sin dato" no es cero. Es un punto a favor, no un error.
