# Guía del analista · dueño del pitch

Tu trabajo hasta el domingo 11:30 es que **el pitch, el video y la entrega salgan bien y digan solo cosas ciertas**. El código ya funciona con datos reales (H1 y H2 cumplidos el sábado a las 17:00): ya no hace falta que persigas contratos ni hitos técnicos. El líder resuelve los contratos; tú decides qué se dice y cómo se muestra.

- Guion, afirmaciones y pruebas de la demo: [`PITCH.md`](PITCH.md).
- Dónde anotar todo: [`HALLAZGOS.md`](HALLAZGOS.md). Si una cifra o un hecho no está ahí con su fuente, no se dice.
- Las casillas están en [`CHECKLIST.md`](CHECKLIST.md), sección Analista.

## Tus herramientas

**Las cifras salen de la app, no de la base.** Con el túnel al 8000 abierto ([`TOPOLOGIA.md`](TOPOLOGIA.md)):

```bash
python3 scripts/pitch_numbers.py            # k, errores, salto falso, temporada, meses récord, 2026, "sin MODIS"
python3 scripts/pitch_numbers.py qro-bajio  # un solo preset
```

Imprime exactamente lo que el jurado verá en pantalla. Copia a `HALLAZGOS.md` lo que vayas a usar, con la hora en que lo corriste.

Para casos fuera de los presets, usa la propia app (dibuja el polígono) o la base en solo lectura (`postgresql://firms:firms_local@localhost:15432/firms`, túnel al 5432).

---

## P1 · Requisitos de la entrega · **ya, antes de las 18:30**

Bloquea todo lo demás: si piden algo que no tenemos (URL pública, otro formato de video), hay que saberlo hoy.

- [ ] Campos de la página del proyecto (resumen, enlaces, uso de IA, equipo…).
- [ ] Video: duración máxima, formato, dónde se sube. ¿Presentación en vivo ante jueces locales? ¿A qué hora?
- [ ] ¿El repo debe ser público? ¿Hay que declarar uso de herramientas de IA?
- [ ] Hora exacta de cierre y zona horaria.

Resultado: sección **Entrega** de `HALLAZGOS.md`. Si algo choca con el PRD, avisa al líder **en ese momento**.

## P2 · El caso del pitch · hasta las 21:00

Es el minuto 2:20 del guion: un mes que la app marca como crítico **y** que salió en las noticias. Pistas que ya da la app (14-nov):

| Pista | Qué dice la app |
|---|---|
| **Febrero de 2026, Bajío** | Mes más alto en 26 años: 150 celdas-día, 5× la mediana. Lo mismo en Querétaro completo (166, 5×) |
| **2025, Bajío / Querétaro** | Año completo más alto de la serie (447 y 561). Abril de 2025 a 7.3× la mediana en Bajío |
| **Mayo de 2024, Sierra Gorda** | Mes más alto de la sierra en 26 años (64 celdas-día, 3.4×) |
| **Abril de 2011 y mayo de 2019, Sierra Gorda** | Años más altos de la sierra (167 y 154) |

- [ ] Buscar en noticias y reportes (CONAFOR, Protección Civil de Querétaro, SEDESU, prensa local) si esos meses tuvieron incendios o quemas reportados. Anotar nombre, municipio, fechas, hectáreas y enlace.
- [ ] Elegir **uno** como caso principal y uno de respaldo. Para el pitch, febrero de 2026 es el mejor candidato: es este año, y muestra que la herramienta sirve hoy.
- [ ] Escribir la frase en `HALLAZGOS.md` → **Caso**: "Febrero de 2026 fue el mes con más actividad de fuego en el Bajío queretano en 26 años: cinco veces lo normal. Coincide con…". Si no aparece ninguna noticia, la frase se queda sin el "coincide con".
- [ ] Si el caso pide otra región (por ejemplo, un incendio grande en otro estado), dibujar el polígono en la app, correr la consulta y pasarle el recuadro al líder si conviene un preset nuevo.

## P3 · Guion con cifras reales · hasta las 22:00

- [ ] Llenar cada fila de `PITCH.md` §2 con las cifras de `pitch_numbers.py` (no del mock, no de `CONTEXT.md`).
- [ ] Revisar §3: cada afirmación que vayas a decir debe estar en ✅. A9 (caso) se cierra con P2. A10 (Tula) **se quita del guion** salvo que sobre tiempo para verificarla.
- [ ] Revisar §4 (lo que no se dice) con quien va a hablar.
- [ ] Frase de cierre en ES y EN (para el video).

## P4 · Fuentes y citas · hasta las 23:30

- [ ] Cita oficial de FIRMS (página de FIRMS o el Readme de las descargas).
- [ ] Referencias de los productos: MODIS C6.1 (candidato a verificar: Giglio et al. 2016, *Remote Sensing of Environment*) y VIIRS 375 m (candidato: Schroeder et al. 2014, *RSE*). Solo si las encuentras y las lees; no inventar.
- [ ] Fuente del cese de S-NPP el 2-nov-2026 (blog de FIRMS/LANCE) → cierra A8.
- [ ] Sección **Fuentes** de `HALLAZGOS.md` con enlaces; el líder las pasa al README.

## P5 · Material del video · hasta H4 (07:00)

- [ ] Guion del video en tomas: qué pantalla, qué clic, qué se dice y cuántos segundos (base: `PITCH.md` §2).
- [ ] 3–5 diapositivas o tarjetas, si el formato las permite: problema (salto de 2012), método en una imagen, validación con su error, caso, quién lo usaría.
- [ ] Texto de la página del proyecto en ES y EN: resumen (≤ 150 palabras), método en 6 pasos (`PRD.md`), datos usados, uso de IA, enlace al repo.

## P6 · Ensayos y pruebas · H3 (00:00) y H4 (07:00)

- [ ] Correr los 13 escenarios de `PITCH.md` §6 con la app real y marcar ✅/❌. Lo que falle va al chat con dueño.
- [ ] Cruce de números (§6): `k` y totales en pantalla contra `pitch_numbers.py`.
- [ ] Ensayar las preguntas de jueces (§5) con el equipo: cada quien responde 2 sin leer.
- [ ] Dos ensayos completos con cronómetro: una persona habla, otra opera.

## P7 · Entrega · H5–H6 (09:00–11:30)

- [ ] Capturas de cada paso del guion y video de respaldo (plan B de §6).
- [ ] Grabar el video con la app real en la anfitriona (09:00–10:30).
- [ ] Llenar la página y enviar **antes de las 11:30**.

---

## Si sobra tiempo

- **Tula (A10).** Celdas fijas más fuertes del sur de Querétaro; pegar cada coordenada en Google Maps (vista satélite) y anotar qué instalación es:
  ```sql
  SELECT n_dates, round((cy + 0.5) / 100.0, 3) AS lat, round((cx + 0.5) / 100.0, 3) AS lon
  FROM static_cell WHERE cy BETWEEN 2000 AND 2090 AND cx BETWEEN -10060 AND -9900
  ORDER BY n_dates DESC LIMIT 15;
  ```
- **Caso fuera de Querétaro.** Un incendio grande y conocido de México (2012–2026), verificado en la app con un polígono.

## Ya no te toca

- Redactar los límites del contrato (I4): ya están en `harmonization.md`.
- Congelar contratos, generar mocks y verificar H1/H2: hecho.
- Polígonos oficiales de los presets (I6): fuera; nos quedamos con los rectángulos.
- Decisiones de contrato: las resuelve el líder y te avisa. Si una cambia algo del pitch, te toca revisar §3.

## Cifras verificadas (API, 14-nov 17:30)

| Dato | Sierra Gorda | Bajío | Querétaro completo |
|---|---|---|---|
| `k` | 0.260 | 0.303 | 0.289 |
| Error anual (mediana / peor año) | 17 % / 55 % | 10 % / 44 % | 6 % / 15 % |
| Error mensual | 37 % | 37 % | 33 % |
| Crudo 2011 → 2019 | 175 → 2,167 (×12.4) | 349 → 5,137 (×14.7) | 524 → 7,304 (×13.9) |
| Armonizado 2011 → 2019 | 167 → 154 (×0.92) | 243 → 260 (×1.07) | 410 → 414 (×1.01) |
| Pico de temporada | mayo (abr–jun = 62 %) | marzo (ene–mar = 46 %) | marzo |
| Sin MODIS: serie anual / estado mensual igual | 16 % / 56 % | 9 % / 55 % | 6 % / 55 % |

Otros: 3,111 celdas de fuentes fijas quitadas; caída de Terra 15-jun → 3-jul-2001 detectada sola (coincide con el Readme de FIRMS); NOAA-20 / S-NPP = 1.00–1.02.
