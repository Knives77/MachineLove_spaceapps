# Guía de uso

Cómo usar la aplicación: qué hay en pantalla, cómo leer el calendario y cómo hacer las tareas comunes. Para saber cómo está construida, ver [`ARQUITECTURA.md`](ARQUITECTURA.md).

## 1. Para qué sirve

Responde una pregunta: **¿el fuego de este mes en mi zona es normal o anómalo frente a su propia historia?**

Los satélites registran focos de calor desde el año 2000, pero con dos familias de sensores que no se pueden comparar directamente: MODIS (desde 2000, píxel de 1 km) y VIIRS (desde 2012, píxel de 375 m, ve muchos más puntos). La aplicación los pone en una sola escala y compara cada mes contra los mismos meses de los otros años.

Está pensada para Protección Civil, CONAFOR, brigadas, áreas naturales protegidas y científicos. Cubre México, de 2000 a 2026.

**No predice incendios** ni mide área quemada: compara la actividad de quema de cada mes con su historia.

## 2. Abrir la aplicación

Con los servicios corriendo (ver [`ARQUITECTURA.md`](ARQUITECTURA.md), sección 9), abrir **http://localhost:5173** en Chromium o Chrome. Necesita una ventana de al menos 1024 px de ancho; está probada a 1024, 1280 y 1366.

Al abrir aparece la vista **Experto** con la región Sierra Gorda, Querétaro, y el último mes completo con datos.

Si la barra inferior dice **"DEMO (mocks)"** en lugar de un tiempo en milisegundos, la aplicación no está conectada a la API y muestra datos de ejemplo.

## 3. La pantalla

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ Lectura del mes ──┐   [ Buscar lat, lon ] [Calendario][Idioma][Accesib.][Vista]│
│ │ SIERRA GORDA       │                                   ┌─ Calendario ─────────┐ │
│ │ ● NORMAL           │                                   │ Total por año ▂▃▅▂▇  │ │
│ │ DIC 2008 · 1×      │            M A P A                │ 00 02 04 ... 24 26   │ │
│ │ Factor k · Error   │        (fuego del mes)            │ E ▪▪▪▪▪▪▪▪▪▪▪▪▪▪     │ │
│ │ [Descargas][Insp.k]│                                   │ F ▪▪▪▪▪▪▪▪▪▪▪▪▪▪     │ │
│ └────────────────────┘                                   │ ...   [Valor][Nivel] │ │
│                                                          └──────────────────────┘ │
│ ┌─ Consola de tiempo ───────────────────────────────────────────────────────────┐ │
│ │ [Regiones]   [Armonizado|Crudo]   [Rect][Polí][Coord][3D][Fuego][N][⤢][−][+]  │ │
│ │ ▶  actividad mes a mes 2000 ─────────────────────│───────────────────── 2026  │ │
│ │    MODIS ████████████████████████████████████████████████████  [Apagar MODIS] │ │
│ │    VIIRS                        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│ Fuente: NASA FIRMS · Cursor · Área · Hotspots · MODIS · S-NPP · NOAA · API 14 ms  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

| Zona | Qué muestra |
|---|---|
| **Mapa** | El área elegida y el fuego del mes elegido: una mancha térmica y un punto por cada detección |
| **Lectura del mes** (arriba a la izquierda) | Región, nivel del mes, cuántas veces la mediana, factor k y su error. Flechas para ir al mes anterior o siguiente. Botones de Descargas e Inspector del factor k |
| **Franja superior** | Buscador por coordenadas, botón Calendario, idioma, accesibilidad y menú Vista |
| **Calendario** (panel derecho, se oculta) | Total por año y un cuadro por cada mes de 2000 a 2026 |
| **Consola de tiempo** (abajo) | Regiones, modo, herramientas del mapa y la línea de tiempo con una pista por sensor |
| **Barra inferior** | Créditos, coordenada del cursor, área en km², hotspots del mes, estado de los sensores y tiempo de respuesta de la API |

## 4. Conceptos en un minuto

| Término | Significado |
|---|---|
| **Hotspot** o punto de calor | Un píxel caliente visto por el satélite. No es un incendio: un incendio puede dar muchos puntos |
| **Celda-día** | Un cuadro de ~1 km con al menos un foco de vegetación ese día. Es la unidad de la aplicación. Diez puntos en el mismo cuadro el mismo día cuentan una vez |
| **Factor k** | El "tipo de cambio" entre sensores: celdas-día de MODIS entre celdas-día de VIIRS, medido cuando ambos operaron a la vez. Se calcula para el área elegida |
| **eq. MODIS** | Equivalente MODIS: VIIRS multiplicado por k, para que toda la serie esté en la misma escala |
| **Mediana** | El valor del medio de ese mes en los demás años: la mitad quedó por debajo |
| **Razón** | El valor del mes entre la mediana. 1× es lo típico; 5× es cinco veces lo típico |
| **Fuente fija** | Industria o quemadores que brillan siempre en el mismo sitio. No es fuego de vegetación y no cuenta |

## 5. Leer el calendario

Las columnas son años (00 a 26) y las filas son meses (E, F, M…). Arriba, una barra por año con su total; una barra punteada es un año incompleto.

### Niveles

Cada mes se compara con el mismo mes de los demás años (se necesitan al menos 10):

| Nivel | Regla |
|---|---|
| **Sin incendios** | Se midió y no hubo fuego (valor 0) |
| **Bajo** | Menor que el 25 % de los años |
| **Normal** | Entre el 25 % y el 75 % de los años |
| **Alto** | Entre el 75 % y el 90 % de los años |
| **Extremo** | Más alto que el 90 % de los años |
| **Sin dato** | El satélite no midió. **No es cero** |
| **Historia insuficiente** | Menos de 10 años para comparar |

### Color: Valor o Nivel

El interruptor **Valor / Nivel** cambia qué pregunta contesta el color; los datos son los mismos.

| Opción | El color dice | Úsalo para |
|---|---|---|
| **Valor** | Cuánto fuego hubo | Ver la temporada: marzo a mayo siempre se ve intenso |
| **Nivel** | Qué tan raro fue para ese mes | Encontrar anomalías: un octubre con poco fuego puede ser Extremo si en octubre casi nunca hay |

Nivel solo existe en modo armonizado; en modo crudo siempre se pinta por valor.

### Marcas

- **Trama rayada:** sin dato (caída de sensor o sin archivos). No es cero.
- **Esquina marcada:** aviso técnico; al pasar el cursor dice cuál.
- **Punto dentro del cuadro:** mes Alto. **Anillo:** mes Extremo. Sirven para leer el nivel sin depender del color.

### El detalle de un mes

Al pasar el cursor sobre un cuadro:

| Campo | Significado |
|---|---|
| Valor | Celdas-día equivalentes MODIS del mes |
| Puntos crudos | Todas las detecciones de todos los satélites, sin filtrar |
| Mediana (n) | Lo típico de ese mes y con cuántos años se calculó |
| Normal (p25–p75) | El rango en que cae la mitad central de los años |
| Razón | Valor entre mediana |
| Fuente | `MODIS` o `VIIRS × k` |
| Avisos | Banderas del mes, si las hay |

### Avisos

| Aviso | Qué significa |
|---|---|
| Solo Terra | Antes de julio de 2002 había un solo satélite MODIS; el mes puede subestimar |
| Caída MODIS | 3 o más días sin Terra ni Aqua; no entra a la mediana |
| Caída VIIRS | 3 o más días sin el VIIRS de referencia ni su respaldo |
| Provisional | Datos en tiempo casi real (NRT); pueden cambiar |
| Mes parcial | Mes incompleto; no entra a la mediana y no recibe nivel |
| Sin cobertura | No hay archivos para ese mes |

## 6. Tareas

### Elegir una zona

Hay cuatro formas:

1. **Regiones de ejemplo.** En la consola de tiempo: Sierra Gorda, Bajío queretano o Querétaro completo. También se puede hacer clic en una región sobre el mapa.
2. **Rectángulo.** Herramienta Rectángulo, luego clic y arrastrar sobre el mapa.
3. **Polígono.** Herramienta Polígono, un clic por vértice y clic en el primero para cerrar. `Enter` cierra, `Retroceso` quita el último vértice, `Esc` cancela.
4. **Coordenadas.** Con la herramienta Coordenadas: latitud, longitud y un radio de 25, 50 o 100 km. O con el buscador de la franja superior (atajo `/`): acepta coordenadas pegadas de Google Maps, en decimal o en grados, minutos y segundos.

El área debe tocar México y medir como máximo 200,000 km². **Encuadrar** vuelve a centrar el mapa en el área.

### Elegir un mes

- Hacer clic en un cuadro del calendario.
- Arrastrar el cursor de la línea de tiempo, o usar las flechas de la lectura del mes.
- **Ir a**, en el calendario: año y mes, o un salto rápido a un episodio conocido.
- **Reproducir** (▶) recorre el tiempo solo.

Al cambiar de mes, el mapa muestra el fuego de ese mes y la barra inferior cuenta sus hotspots.

### Ver el fuego en el mapa

El botón **Fuego** enciende o apaga la capa. Cada punto es una detección; su tamaño y color dependen de su potencia. Al pasar el cursor sobre un punto aparece su ficha: satélite, fecha, potencia radiativa (FRP, en MW), tipo (vegetación o fuente fija) y coordenadas.

Si el área tiene más de 20,000 detecciones en el mes, la barra inferior pide reducir el área.

**Vista 3D** inclina el mapa y levanta el relieve. Clic derecho y arrastrar gira e inclina. **Norte** endereza el mapa.

### Comparar crudo y armonizado

El interruptor **Armonizado / Crudo** de la consola de tiempo:

- **Armonizado** (por defecto): celdas-día en escala MODIS. Es la serie comparable.
- **Crudo:** la suma de todos los puntos de todos los satélites, tal como llegan. Muestra el problema: en 2012 la cuenta salta porque entró VIIRS, no porque hubiera más fuego.

Las dos escalas no se comparan entre sí.

### Simular el fin de MODIS

**Apagar MODIS**, al final de la pista de MODIS en la consola de tiempo, rehace la serie usando solo VIIRS × k desde febrero de 2012. Responde qué pasa con la historia cuando MODIS deje de operar. La serie con MODIS queda como línea punteada en las barras anuales para comparar.

El total anual cambia poco; el nivel de un mes individual puede moverse un escalón. Solo está disponible en modo armonizado.

### Revisar qué tan confiable es la conversión

El botón **Inspector del factor k**, en la lectura del mes, muestra:

| Dato | Significado |
|---|---|
| ΣMODIS y ΣVIIRS en el traslape | Las dos sumas de celdas-día cuando ambos sensores midieron |
| Meses de traslape | Cuántos meses entraron al cálculo |
| Origen de k | "Esta área" o "todo el país" (si el área tiene pocos datos) |
| Error anual (LOYO) | Se quita un año, se calcula k con los demás y se mide cuánto falla al predecirlo. Es el error típico |
| Peor año (LOYO) | El año en que esa prueba salió peor |
| Error mensual | El error típico de un mes suelto |

Regla práctica: el total anual es confiable; el mes individual es aproximado. Por eso conviene leer el nivel y no la cifra exacta.

### Descargar los datos

El botón **Descargas**, en la lectura del mes:

| Archivo | Contenido |
|---|---|
| **CSV del calendario** | Una fila por mes, 2000–2026, con la base activa (con o sin MODIS) |
| **CSV de hotspots** | Una fila por detección del mes elegido dentro del área |
| **GeoJSON del área** | El polígono consultado |

Columnas del CSV del calendario:

`year, month, harmonized, source, raw_points, modis_cell_days, viirs_cell_days, baseline_median, baseline_p25, baseline_p75, baseline_p90, anomaly_ratio, status, flags`

Columnas del CSV de hotspots:

`latitude, longitude, acq_date, acq_time, satellite, family, confidence, frp, daynight, type, source, is_vegetation_fire, cell_id`

En los CSV los niveles y avisos van como códigos en inglés (`critical`, `modis_outage`), varios avisos se separan con `|`, y un mes sin dato queda vacío, no en 0.

| `status` | En pantalla |
|---|---|
| `below` | Bajo |
| `normal` | Normal |
| `above` | Alto |
| `critical` | Extremo |
| `no_data` | Sin dato |
| `insufficient_baseline` | Historia insuficiente |

## 7. Vistas

El menú **Vista** tiene dos:

| Vista | Para quién | Contenido |
|---|---|---|
| **Experto** (inicial) | Quien analiza una zona | Todo lo descrito en esta guía |
| **Aprendizaje** | Quien quiere entender el método | Cuatro pasos (crudo, quitar fuentes fijas, malla de 1 km, factor k) con sus gráficas, y un cuestionario de tres preguntas |

## 8. Accesibilidad e idioma

- **Idioma:** español o inglés; se traduce todo, incluidos niveles y avisos. Se recuerda entre sesiones.
- **Paletas:** Estándar (térmica), Daltónicos (azul–amarillo) y Alto contraste. Cambian el calendario y el fuego del mapa.
- **Nivel escrito además del color:** el nivel siempre aparece con palabra, y Alto y Extremo llevan su marca (punto y anillo) dentro del cuadro.
- **Sonificación:** un tono por nivel al recorrer el calendario.
- **Movimiento reducido:** si el sistema lo pide, se quitan las animaciones y el parpadeo del fuego.

### Teclado

| Tecla | Dónde | Acción |
|---|---|---|
| `Tab` | Toda la app | Recorrer los controles; el primero es "Saltar al contenido" |
| `/` | Toda la app | Ir al buscador por coordenadas |
| Flechas | Calendario | Moverse entre meses y años |
| `Enter` o `Espacio` | Calendario | Elegir el mes |
| `←` `→` | Línea de tiempo | Un mes atrás o adelante |
| `Re Pág` `Av Pág` | Línea de tiempo | Un año adelante o atrás |
| `Enter` | Dibujo de polígono | Cerrar el polígono |
| `Retroceso` | Dibujo de polígono | Quitar el último vértice |
| `Esc` | Dibujo, menús, paneles | Cancelar o cerrar |

## 9. Mensajes y problemas comunes

| Mensaje o síntoma | Causa | Qué hacer |
|---|---|---|
| "El área está fuera de la zona con datos (México)" | El área no toca México (mar u otro país) | Elegir una zona dentro de México |
| "El área es demasiado grande" | Más de 200,000 km² | Dibujar un área más chica |
| "El polígono no es válido" | El trazo se cruza consigo mismo | Dibujarlo de nuevo |
| "No hay conexión con la API" | La API no está corriendo o el túnel está cerrado | Levantar la API en el puerto 8000 o abrir el túnel; luego Reintentar |
| "La base de datos no responde" | Postgres apagado | `scripts/db_up.sh` |
| "más de 20,000: reduce el área" | Demasiados puntos para el mapa en ese mes | Reducir el área; el calendario no se afecta |
| El fondo del mapa no aparece | Sin internet (el mapa base viene de fuera) | El calendario y las descargas siguen funcionando |
| El último mes sale "Sin dato" con valor | Es un mes parcial: aún no está completo | Es correcto; no se compara un mes a medias contra meses completos |
| k dice "todo el país" | El área tiene poco traslape entre sensores | Usar un área más grande si se quiere un k propio |
| La barra inferior dice "DEMO (mocks)" | Falta `VITE_API_URL` en `web/.env` | Definirla y reiniciar `pnpm dev` |

## 10. Qué tener presente al interpretar

- **Lee niveles, no cifras exactas.** El error de un mes suelto es de 33–37 %; un mes cerca de un límite puede caer en el nivel vecino.
- **Sin dato no es cero.** Un mes rayado no dice nada sobre el fuego.
- **Un mes nublado puede parecer tranquilo.** El satélite no ve a través de las nubes.
- **Antes de julio de 2002 los valores subestiman:** solo había un satélite.
- **No mide intensidad ni área quemada:** cuenta dónde y cuántos días hubo detección.
- **Un punto no es un incendio:** es un píxel caliente.

Fuente de los datos: NASA FIRMS (MODIS C6.1, VIIRS C2), de LANCE de NASA.
