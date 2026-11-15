# Hallazgos

Lo usa el **analista** para diseñar el pitch; lo llenan **procesamiento A** (noticias, Tula), **procesamiento B** (cifras) y el analista (entrega). Todo lo que se diga en la presentación o en la página tiene que estar aquí con su fuente y su hora. Si no está, no se dice.

Formato de cada entrada: **qué** · **valor** · **fuente** (enlace, consulta o `pitch_numbers.py` + hora).

## Entrega · la llena el analista (D1)

| Pregunta | Respuesta | Fuente |
|---|---|---|
| Campos de la página del proyecto | | |
| Presentación en vivo: cuándo, cuánto dura, si hay preguntas | | |
| ¿Piden video o algo más para la entrega? | | |
| Criterios de evaluación de los jueces | | |
| ¿Repo público? ¿Declarar uso de IA? | | |
| Hora de cierre y zona horaria | | |

## Caso · noticias y Tula · lo llena procesamiento A

| Candidato | Lo que muestra la app | Noticia o reporte | Enlace |
|---|---|---|---|
| Febrero de 2026, Bajío | 150 celdas-día, 5× la mediana, `critical` (14-nov 17:30) | | |
| 2025, Bajío / Querétaro | Año más alto de la serie | | |
| Mayo de 2024, Sierra Gorda | 64 celdas-día, 3.4× la mediana, `critical` | | |

**Caso elegido (lo decide el analista):**
**Frase para el pitch:**

### Tula y ruido industrial del sur de Querétaro

| Celda (lat, lon) | Días como fuente fija | Qué hay en el mapa |
|---|---|---|
| | | |

## Lugares probados para "Elijan un lugar" · los prueba procesamiento B

Rectángulos dibujados en la API real (14-nov 18:00). Las pistas marcadas con 🔎 hay que confirmarlas con noticias antes de decirlas.

| Lugar | Recuadro (O, S, E, N) | Respuesta | `k` | Peor mes en 26 años | Pico de temporada | 2026 |
|---|---|---|---|---|---|---|
| Ajusco / sur de CDMX | -99.40, 19.10, -99.05, 19.30 | 0.21 s | 0.24 | mar-2011 (10.8×) | marzo | sin críticos |
| La Primavera, Jalisco | -103.70, 20.55, -103.45, 20.75 | 0.19 s | 0.69 | 🔎 abr-2012 (11.8×) | abril | 2 críticos |
| Selva Lacandona, Chiapas | -91.60, 16.20, -90.60, 17.00 | 0.22 s | 0.34 | may-2003 (3.5×) | abril | 1 crítico |
| Sierra Tarahumara | -108.20, 27.00, -107.00, 28.20 | 0.24 s | 0.28 | may-2011 (11.7×) | mayo | sin críticos |
| Península de Yucatán (centro) | -89.50, 19.50, -88.00, 20.80 | 0.28 s | 0.40 | abr-2011 (2.9×) | abril | 1 crítico |
| Chimalapas, Oaxaca | -94.60, 16.60, -94.00, 17.20 | 0.22 s | 0.34 | 🔎 abr-2024 (5.1×) | abril | 2 críticos |

## Cifras · las actualiza procesamiento B

Salida de `python3 scripts/pitch_numbers.py` contra la API real (base `firms`), **15-nov 07:35** (H4). Respecto a las 17:43 solo cambian dos `k` por redondeo: el script ahora redondea como la pantalla (Bajío 0.3035 → **0.304**, Querétaro 0.2895 → **0.290**); las demás cifras son idénticas. Procesamiento B la vuelve a correr en H3 y H4 y reemplaza este bloque.

```text
=== qro-sierra-gorda  (14,706 km², respuesta en 0.03 s)
k = 0.260 (aoi), 167 meses de traslape
error anual (mediana dejando un año fuera) 17.2%, peor año 55.2%; error mensual 36.9%
salto falso: crudo 2011 → 2019 = 175 → 2,167 puntos (×12.4); armonizado 167.0 → 154.0 (×0.92)
temporada: pico en may; abr, may, jun concentran 62% del fuego
5 meses más altos en 26 años:
    may-2024    64.0 celdas-día  critical, 3.37× la mediana  fuente modis
    abr-2011    61.0 celdas-día  critical, 5.55× la mediana  fuente modis
    may-2019    61.0 celdas-día  critical, 3.21× la mediana  fuente modis
    mar-2013    57.0 celdas-día  critical, 6.71× la mediana  fuente modis
    may-2009    50.0 celdas-día  critical, 2.63× la mediana  fuente modis
3 años completos más altos: 2011 (167.0), 2019 (154.0), 2013 (123.0)
último mes completo (tarjeta): oct-2026 = 0.0, normal, mediana 1.0
2026 por mes: ene critical, feb critical, mar normal, abr normal, may below, jun below, jul below, ago normal, sep critical, oct normal
sin MODIS (viirs_primary): serie anual cambia 16% en mediana (peor año 51%); estado mensual igual en 56%, a un nivel o menos en 90%

=== qro-bajio  (16,636 km², respuesta en 0.02 s)
k = 0.304 (aoi), 167 meses de traslape
error anual (mediana dejando un año fuera) 10.1%, peor año 43.6%; error mensual 37.3%
salto falso: crudo 2011 → 2019 = 349 → 5,137 puntos (×14.7); armonizado 243.0 → 260.0 (×1.07)
temporada: pico en mar; ene, feb, mar concentran 46% del fuego
5 meses más altos en 26 años:
    feb-2026   150.0 celdas-día  critical, 5.0× la mediana  fuente modis
    abr-2025   113.0 celdas-día  critical, 7.29× la mediana  fuente modis
    mar-2025    91.0 celdas-día  critical, 2.53× la mediana  fuente modis
    feb-2016    80.0 celdas-día  critical, 2.67× la mediana  fuente modis
    ene-2026    79.0 celdas-día  critical, 3.59× la mediana  fuente modis
3 años completos más altos: 2025 (447.0), 2017 (317.0), 2016 (295.0)
último mes completo (tarjeta): oct-2026 = 7.0, normal, mediana 8.0
2026 por mes: ene critical, feb critical, mar critical, abr normal, may critical, jun normal, jul normal, ago critical, sep below, oct normal
sin MODIS (viirs_primary): serie anual cambia 9% en mediana (peor año 37%); estado mensual igual en 55%, a un nivel o menos en 89%

=== qro-recuadro  (31,342 km², respuesta en 0.02 s)
k = 0.290 (aoi), 167 meses de traslape
error anual (mediana dejando un año fuera) 5.9%, peor año 15.4%; error mensual 33.2%
salto falso: crudo 2011 → 2019 = 524 → 7,304 puntos (×13.9); armonizado 410.0 → 414.0 (×1.01)
temporada: pico en mar; mar, abr, may concentran 43% del fuego
5 meses más altos en 26 años:
    feb-2026   166.0 celdas-día  critical, 5.03× la mediana  fuente modis
    abr-2025   149.0 celdas-día  critical, 5.05× la mediana  fuente modis
    mar-2025   107.0 celdas-día  critical, 2.3× la mediana  fuente modis
    mar-2022    93.0 celdas-día  critical, 2.0× la mediana  fuente modis
    mar-2021    91.0 celdas-día  critical, 1.96× la mediana  fuente modis
3 años completos más altos: 2025 (561.0), 2017 (416.0), 2019 (414.0)
último mes completo (tarjeta): oct-2026 = 7.0, normal, mediana 9.0
2026 por mes: ene critical, feb critical, mar above, abr normal, may normal, jun below, jul normal, ago critical, sep normal, oct normal
sin MODIS (viirs_primary): serie anual cambia 6% en mediana (peor año 14%); estado mensual igual en 55%, a un nivel o menos en 93%
```

## Fuentes · las llena procesamiento A

| Para qué | Referencia | Enlace |
|---|---|---|
| Datos FIRMS (cita oficial) | | |
| MODIS C6.1 | | |
| VIIRS 375 m C2 | | |
| Cese de S-NPP (2-nov-2026) | | |

## Pruebas de la demo · las llena el analista (D5)

| Hora | Escenarios OK | Fallos y dueño |
|---|---|---|
| | | |
