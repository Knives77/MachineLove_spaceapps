# Guía del analista

Eres el cerebro y la dirección del equipo: que nada de lo que digamos ante los jueces sea falso, que el front y el back no se desalineen, y que la entrega salga a tiempo. Qué decides tú está en `docs/PITCH.md` §7; el guion, la evidencia y las pruebas de la demo, en el resto de ese archivo. Las tareas con casilla están en `docs/CHECKLIST.md`; aquí está **cómo** hacer cada investigación y dónde dejar el resultado.

Conexión a la base (con túnel al 5432): `postgresql://firms:firms_local@localhost:5432/firms`. Solo lectura: tú no escribes en la base.

Regla: cada hallazgo se escribe en `docs/HALLAZGOS.md` (créalo) con fecha, la consulta o fuente usada, y el resultado. Si no está ahí, no se dice en el pitch.

---

## I1 · Requisitos de la entrega (urgente)

Pregunta a los organizadores locales o lee la página oficial de Space Apps 2026:

- [ ] ¿Qué campos tiene la página del proyecto? (resumen, enlaces, uso de IA, etc.)
- [ ] ¿Video o presentación? ¿Duración máxima? ¿Dónde se sube?
- [ ] ¿El repo debe ser público? ¿Hay que declarar uso de herramientas de IA?
- [ ] ¿Hora exacta de cierre y zona horaria?
- [ ] ¿Cómo y cuándo es la presentación ante jueces locales?

Resultado: sección "Entrega" en `HALLAZGOS.md`. Si algo choca con el PRD (por ejemplo, piden URL pública), avisar al líder **de inmediato**.

## I2 · ¿Cuál es el caso local destacado de México?

Sustituye a Chilecito (fase 2). Buscamos el mes o el año que mejor demuestre el calendario en Querétaro. Consulta (celdas-día MODIS de vegetación por mes; cambiar el recuadro para Sierra Gorda o Bajío):

```sql
SELECT extract(year FROM acq_date)::int AS anio, extract(month FROM acq_date)::int AS mes,
       count(DISTINCT (cy, cx, acq_date)) AS celdas_dia
FROM detection
WHERE family = 'MODIS' AND is_veg AND country = 'MX'
  AND latitude BETWEEN 20.9 AND 21.7 AND longitude BETWEEN -100.6 AND -99.0   -- Sierra Gorda
GROUP BY 1, 2 ORDER BY celdas_dia DESC LIMIT 15;
```

- [ ] Los 5 meses más extremos de Sierra Gorda y del Bajío en 26 años, y el mes pico de cada temporada.
- [ ] ¿Cómo está 2026 frente a su historia? (último mes completo con MODIS: agosto).
- [ ] Buscar en noticias si esos meses coinciden con incendios reportados (CONAFOR, Protección Civil de Querétaro). Si coinciden, es el mejor momento del pitch.
- [ ] Conclusión en una frase: "el mes X del año Y fue el más alto en 26 años en Sierra Gorda, y coincide con…".

## I3 · ¿El ruido industrial del sur de Querétaro es Tula?

```sql
SELECT cy, cx, n_dates,
       round((cy + 0.5) / 100.0, 3) AS lat, round((cx + 0.5) / 100.0, 3) AS lon
FROM static_cell
WHERE cy BETWEEN 2000 AND 2090 AND cx BETWEEN -10060 AND -9900
ORDER BY n_dates DESC LIMIT 15;
```

- [ ] Pegar cada `lat, lon` en Google Maps (vista satélite) y anotar qué hay: refinería, cementera, termoeléctrica, ladrillera, relleno sanitario…
- [ ] Conclusión: qué instalaciones explican el ruido. Si Tula no aparece, **no se menciona**.

## I4 · Límites conocidos (decisiones ya tomadas, escribirlas)

Agregar a la sección "Límites conocidos" de `docs/contracts/harmonization.md`:

- [ ] La máscara solo usa `type = 2`. Plataformas marinas (`type = 3`) y volcanes (`type = 1`) no se filtran en los datos NRT: probamos filtrarlos y las celdas costeras tenían más fuego real (2,938) que de plataformas (2,180) desde 2024.
- [ ] La máscara, validada en 2024–2026 con `type` conocido, atrapa 94 % (MODIS) y 99.9 % (VIIRS) de las fuentes fijas y quita por error ~2 % del fuego real. En Querétaro sobre-enmascara un poco en temporada de lluvias.
- [ ] Algunos días tranquilos se registran como "caída" de Terra/Aqua; en México solo marcan 2001-06/07 y 2002-03, que coinciden con fallas reales de Terra y además ya son `terra_only`.

## I5 · Fuentes y citas para el README y el pitch

- [ ] Texto oficial de cita y aviso de FIRMS (página de FIRMS → "Citation" / Readme de las descargas).
- [ ] Referencia del producto MODIS C6.1 y del VIIRS 375 m C2 (artículos de los algoritmos; candidatos a verificar: Giglio et al. 2016, *Remote Sensing of Environment*, MODIS C6; Schroeder et al. 2014, *RSE*, VIIRS 375 m).
- [ ] Fuente del cese de Suomi-NPP el 2-nov-2026 (blog de FIRMS/LANCE, noviembre 2026).
- [ ] 1–2 trabajos que comparen MODIS y VIIRS en conteos de fuego, si existen, para decir "nuestro factor es del mismo orden que lo publicado" (solo si se encuentra; no inventar).

Resultado: sección "Fuentes" en `HALLAZGOS.md` con enlaces; luego al README.

## I7 · Casos reales para el pitch (y sus datos)

Buscamos 2–3 eventos de fuego en México que los jueces reconozcan y que el calendario muestre con claridad. El mejor caso combina: está en noticias o en reportes oficiales, destaca en el calendario, y ocurrió en el traslape MODIS + VIIRS (2012–2026), para que se vea el interruptor.

**Cómo investigar**
- [ ] Fuentes: reportes de temporada de CONAFOR, Protección Civil estatal, noticias, y el Sistema Nacional de Información Forestal. Buscar temporadas récord a nivel nacional y eventos grandes en Querétaro y estados vecinos.
- [ ] Para cada candidato anotar: nombre, estado/municipio, fechas, hectáreas reportadas, fuente con enlace.
- [ ] Verificar en la base que el evento se ve (cambiar recuadro y fechas):

```sql
SELECT acq_date, family, count(*) AS detecciones, count(DISTINCT (cy, cx)) AS celdas
FROM detection
WHERE is_veg AND country = 'MX'
  AND latitude BETWEEN 21.0 AND 21.5 AND longitude BETWEEN -99.8 AND -99.2   -- recuadro del evento
  AND acq_date BETWEEN '2025-03-01' AND '2025-05-31'                          -- fechas del evento
GROUP BY 1, 2 ORDER BY 1, 2;
```

- [ ] Si el evento no aparece en la base, **no se usa**.

**Datos**
- México 2000 → 2026-11-01 ya está completo en la base: para cualquier caso mexicano **no hay que descargar nada**. Para entregar los puntos de un caso, usar la propia app (`/hotspots.csv`) o la consulta de arriba.
- Si el caso necesita días posteriores al 2026-11-01 (por ejemplo, un incendio de esta semana): pedir en FIRMS *Archive Download* México, 4 sensores, 2026-11-01 → hoy, CSV, y avisar al líder para cargarlo (mismo procedimiento que se usó con Argentina).
- Casos fuera de México son fase 2: anotarlos, no prepararlos.

**Entregable** (en `HALLAZGOS.md`, sección "Casos")
- [ ] Una tabla con los candidatos, su fuente y la verificación en la base.
- [ ] El caso elegido para el minuto 2:20 del guion, con su recuadro (`lat` mín/máx, `lon` mín/máx).
- [ ] Si conviene un **preset nuevo** para ese caso: pasar el recuadro al líder; se agrega en `docs/contracts/db_schema.sql` (tabla `preset`) y en `examples/presets.response.json`, y se avisa al front.

## I6 · Polígonos reales para los presets (después de H3, solo si sobra tiempo)

- [ ] Reserva de la Biosfera Sierra Gorda (CONANP o Protected Planet / WDPA) y límite estatal de Querétaro (INEGI), en GeoJSON simplificado (< 500 vértices).
- [ ] Entregarlos al backend; se cambian en `db_schema.sql` (tabla `preset`) y en `examples/presets.response.json`.

---

## Cifras ya verificadas que puedes usar

| Dato | Valor | Origen |
|---|---|---|
| Detecciones de México | 9.5 M (nov-2000 → nov-2026); Argentina 6.6 M cargadas para la fase 2 | ETL paso 1 |
| Salto falso en Querétaro | 423 puntos crudos (2011) → 4,554 (2019); MODIS: 410 → 414 celdas-día | `docs/CONTEXT.md` §3 |
| VIIRS entre sí | NOAA-20 / S-NPP = 1.00–1.02 | `CONTEXT.md` §3 |
| `k` y error anual | Qro 0.293 / 6.8 %; Sierra Gorda 0.262 / 14.7 %; Bajío 0.307 / sin medir | `CONTEXT.md` §3 (se recalcula con el paso 5) |
| Fuentes fijas | 3,111 celdas; 19 % de los datos NRT se apagan | ETL paso 2 |
| Caída real detectada sola | Terra 15-jun → 3-jul-2001 (coincide con el Readme de FIRMS) | ETL paso 3 |
