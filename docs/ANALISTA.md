# Guía del analista · diseñador del pitch

Tu trabajo es **diseñar el pitch**: la historia que contamos, lo que se ve en cada segundo, el video, las diapositivas y la página del proyecto. **No programas, no corres consultas ni scripts.** Los números te los entrega procesamiento y quedan en [`HALLAZGOS.md`](HALLAZGOS.md); tú decides cuáles se usan y cómo se cuentan.

- Base del guion, afirmaciones y preguntas de jueces: [`PITCH.md`](PITCH.md). Es tuyo: cámbialo como quieras.
- Regla única: si una cifra o un hecho no está en `HALLAZGOS.md` con su fuente, no se dice.
- Para ver la app: pídele a front que te la abra, o úsala en la máquina del líder.

## Quién te da qué

| Necesitas | Te lo da | Dónde queda |
|---|---|---|
| Cifras de la app (k, errores, salto falso, meses récord, temporada, "sin MODIS") | Procesamiento B | `HALLAZGOS.md` → Cifras |
| Noticias que coincidan con los meses récord | Procesamiento A | `HALLAZGOS.md` → Caso |
| Qué instalación es el ruido industrial del sur (Tula o no) | Procesamiento A | `HALLAZGOS.md` → Caso |
| Capturas de pantalla de la app con datos reales | Front | Carpeta compartida del equipo |
| Cambios en lo que muestra la app | Front, por medio del líder | Chat |

Si te falta un dato, pídelo en el chat con el formato: *"Necesito X para el segundo Y del guion, antes de las HH:MM"*.

---

## D1 · Las reglas del juego · **ya, antes de las 18:30**

Lee la página oficial de Space Apps 2026 o pregunta a los organizadores locales:

- [ ] Qué campos tiene la página del proyecto (resumen, enlaces, uso de IA, equipo…).
- [ ] Video: duración máxima, formato, dónde se sube. ¿Hay presentación en vivo ante jueces? ¿Cuándo y cuánto dura?
- [ ] ¿El repo debe ser público? ¿Hay que declarar el uso de IA?
- [ ] Hora exacta de cierre y zona horaria.
- [ ] Criterios de evaluación de los jueces: el pitch se diseña para ellos.

Anótalo en `HALLAZGOS.md` → **Entrega**. Si algo choca con el plan (por ejemplo, piden una URL pública), avisa al líder **en ese momento**.

## D2 · La historia · hasta las 21:00

Decide el arco en una página antes de pensar en pantallas:

- [ ] **El problema en una frase**, para alguien que nunca oyó de MODIS.
- [ ] **El momento "ajá"**: el salto falso de 2012 que desaparece. Lo que la app ya muestra: en el Bajío los puntos crudos se multiplican ×14.7 entre 2011 y 2019; armonizado, ×1.07.
- [ ] **El caso humano**: elegir uno de los candidatos de `HALLAZGOS.md` → Caso. El más fuerte hoy: **febrero de 2026 fue el mes con más fuego en el Bajío en 26 años, cinco veces lo normal**. Cuenta más si procesamiento A encuentra la noticia.
- [ ] **La prueba de que sirve en el futuro**: "Simular fin de MODIS". Las barras anuales casi no cambian (9 % en mediana en el Bajío).
- [ ] **Quién lo usaría** y qué decidiría con esto (Protección Civil, brigadas, CONAFOR, Sierra Gorda).
- [ ] **Cierre** en ES y EN.

Entregable: el arco en 6–8 frases, al principio de `PITCH.md`.

## D3 · El guion de 3 minutos · hasta las 22:30

- [ ] Rehacer `PITCH.md` §2 con tu historia: segundo, pantalla, clic, frase. Ya hay una propuesta v2 armada con los datos reales: úsala o cámbiala.
- [ ] Marcar en §3 qué afirmaciones usas. Las que no tengan ✅ no entran.
- [ ] Revisar §4 (lo que no se dice) con quien va a hablar.
- [ ] Pasarle a front la **ruta de la demo** (preset, mes, botones, en qué orden), para que la app quede lista para ese recorrido.

## D4 · Video, diapositivas y página · hasta H4 (07:00)

- [ ] Guion del video en tomas: pantalla, acción, voz y segundos.
- [ ] 3–5 diapositivas o tarjetas, si el formato las permite: problema, método en una imagen, validación con su error, caso, quién lo usaría.
- [ ] Texto de la página en ES y EN: resumen (≤ 150 palabras), método en 6 pasos (sale de `PRD.md`), datos usados, uso de IA y enlace al repo.
- [ ] Lista de capturas que necesitas de front.

## D5 · Ensayos · H3 (00:00) y H4 (07:00)

- [ ] Recorrer la demo con la app real siguiendo la ruta de D3. Lo que no se vea como esperas va al chat, con dueño.
- [ ] Repasar los 13 escenarios de `PITCH.md` §6 junto con front (ellos operan, tú marcas ✅/❌).
- [ ] Ensayar las preguntas de jueces (§5): cada quien responde 2 sin leer.
- [ ] Dos ensayos completos con cronómetro: una persona habla, otra opera.

## D6 · Entrega · H5–H6 (09:00–11:30)

- [ ] Capturas de cada paso y video de respaldo (plan B de §6).
- [ ] Grabar el video con la app real en la máquina del líder (09:00–10:30).
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
