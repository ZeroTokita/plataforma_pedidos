# Bitácora · Arquitecturas y procesos · Yakov S.

> Borrador: completar todos los campos PENDIENTE con resultados de las pruebas locales antes de entregar.
> Repositorio: https://github.com/ZeroTokita/plataforma_pedidos

## Entorno

| Dato | Valor |
| --- | --- |
| Laptop (CPU, RAM) | PENDIENTE: modelo CPU y RAM desde Windows |
| nucleos según /metricas | 16 (medido antes del escenario 1 y confirmado en el escenario 1) |
| MAX_TRABAJADORES y MAX_COLA | 16 y 32, respectivamente (/metricas.pool) |
| Duración de un reporte con n=2000000 | 341 ms con /reporte/worker y 277 ms con /reporte/pool; una ejecución individual cada uno |

## 1. Resultados

| Escenario | Latencia 50 % | Latencia máx. | Respuestas 2xx | Respuestas 503 | Timeouts | bucle.maxMs |
| --- | --- | --- | --- | --- | --- | --- |
| 1 · bloqueo (/health), prueba más reciente | PENDIENTE: salida autocannon | PENDIENTE: salida autocannon | PENDIENTE: salida autocannon | PENDIENTE: salida autocannon | PENDIENTE: salida autocannon | 5016 ms |
| 2 · worker sin límite | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| 3 · pool con límite | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

Reiniciar Pedidos con "docker compose restart pedidos" ANTES DE CADA ESCENARIO. Ejecutar la carga, capturar la salida y consultar /metricas al terminar. --renderStatusCodes permite ver cuántos códigos son específicamente 503.

### Escenario 1: bloqueo (/health)

Se conserva abajo el registro del primer intento. En una repetición con dos solicitudes bloqueantes se midió `bucle.maxMs = 5016` y `GET /health maxMs = 17.155894`; falta la salida de autocannon de esa misma repetición para completar la fila final.

Comando:
npx.cmd -y autocannon@8 -c 20 -d 15 --renderStatusCodes http://localhost:3000/health

Durante la prueba solicitar dos veces GET /reporte/bloqueante desde Postman o navegador.

Salida autocannon:

~~~text
Stat      2.5%   50%   97.5%   99%   Avg       Stdev      Max
Latency   4 ms   5 ms  14 ms   17 ms  6.27 ms   3.44 ms    112 ms

Stat       1%     2.5%   50%    97.5%   Avg     Stdev   Min
Req/Sec    1505   1505   3127   3343    2956.8  499.51  1505
Bytes/Sec  408 kB 408 kB 847 kB 906 kB 801 kB 135 kB  408 kB

Code  Count
200   44345

Req/Bytes counts sampled once per second.
# of samples: 15
44k requests in 15.03s, 12 MB read

NOTA: los timeouts no se distinguen en la captura compartida.
~~~

Respuesta /metricas:

~~~json
{
  "umbralLentaMs": 1000,
  "nucleos": 16,
  "bucle": { "p50Ms": 10, "p99Ms": 16, "maxMs": 5037 },
  "rutas": [
    {
      "ruta": "GET /health",
      "peticiones": 44377,
      "promedioMs": 0.225175026094577,
      "maxMs": 10.85235200000017,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 2,
      "promedioMs": 5018.790459,
      "maxMs": 5031.410657,
      "lentas": 2
    }
  ],
  "pool": {
    "maxTrabajadores": 16,
    "activos": 0,
    "enCola": 0,
    "maxCola": 32,
    "rechazadas": 0
  }
}
~~~

**Registro histórico del primer intento:** el bloqueo interno se midió (5037 ms), pero autocannon mostró una latencia máxima de 112 ms. Esto no confirmó la coincidencia temporal de ambos tipos de solicitudes.

#### Repetición con dos solicitudes bloqueantes (datos de /metricas)

La ejecución de autocannon correspondiente todavía no fue proporcionada; **no confundir la captura del primer intento con esta respuesta de /metricas**.

~~~json
{
  "umbralLentaMs": 1000,
  "nucleos": 16,
  "bucle": { "p50Ms": 10, "p99Ms": 15, "maxMs": 5016 },
  "rutas": [
    {
      "ruta": "GET /health",
      "peticiones": 11949,
      "promedioMs": 0.275469261026118,
      "maxMs": 17.1558939999959,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 2,
      "promedioMs": 5002.018278,
      "maxMs": 5002.12127,
      "lentas": 2
    }
  ],
  "pool": {
    "maxTrabajadores": 16,
    "activos": 0,
    "enCola": 0,
    "maxCola": 32,
    "rechazadas": 0
  }
}
~~~

**Pendiente:** agregar la salida de autocannon de este mismo intento (latencia p50 y máxima, códigos 2xx/503 y timeouts) y verificar si los bloqueos coincidieron con peticiones de /health en vuelo.

### Escenario 2: un hilo por petición

Comando:
npx.cmd -y autocannon@8 -c 50 -d 20 --renderStatusCodes "http://localhost:3000/reporte/worker?n=2000000"

Salida autocannon:

~~~text
PENDIENTE: pegar salida real de autocannon (escenario 2)
~~~

Respuesta /metricas:

~~~json
"PENDIENTE: pegar JSON real de /metricas (escenario 2)"
~~~

### Escenario 3: pool con límite

Comando:
npx.cmd -y autocannon@8 -c 50 -d 20 --renderStatusCodes "http://localhost:3000/reporte/pool?n=2000000"

Salida autocannon:

~~~text
PENDIENTE: pegar salida real de autocannon (escenario 3)
~~~

Respuesta /metricas:

~~~json
"PENDIENTE: pegar JSON real de /metricas (escenario 3)"
~~~

## 2. Análisis

### 1. ¿Por qué el monitor del bucle ve el bloqueo pero el interceptor no?

En la repetición con dos reportes bloqueantes, el valor máximo de `bucle.maxMs` fue **5016 ms**.
El máximo de `GET /health` en `rutas` fue **17.16 ms**; falta la salida de autocannon de la misma repetición.
El reporte bloqueante ejecuta trabajo síncrono unos cinco segundos y ocupa el hilo principal.
El monitor mide el retraso acumulado por un temporizador que no puede ejecutarse durante ese intervalo.
El interceptor mide /health solo cuando Express finalmente empieza a procesarla, sin contabilizar la espera anterior.

### 2. ¿Por qué 50 workers simultáneos pueden producir timeouts?

En el escenario 2 se completaron **PENDIENTE peticiones 2xx** y ocurrieron **PENDIENTE timeouts**.
El reporte individual n=2000000 tardó **341 ms** sin saturación en modo worker (277 ms en modo pool).
Cada solicitud a /reporte/worker crea un hilo nuevo y no existe un cupo global.
Con 50 peticiones simultáneas, los hilos compiten por CPU y memoria y pagan el coste de creación.
La duración de una operación aislada no predice la latencia bajo carga: la saturación puede generar timeouts.

### 3. ¿Qué diferencia hay entre un 503 inmediato y un timeout?

En el escenario 3 se recibieron **PENDIENTE respuestas 2xx** y **PENDIENTE respuestas 503**.
El pool limita la ejecución a **PENDIENTE trabajadores** y la cola a **PENDIENTE solicitudes**.
Al agotar ambos recursos, el servidor emite un rechazo explícito, un fallo reconocido.
La cabecera Retry-After: 1 permite al cliente planificar su próximo intento.
Un timeout es un fallo por omisión: el cliente no puede saber si el trabajo se llegó a ejecutar.

### 4. ¿Qué efecto tuvieron los reintentos inmediatos?

Durante el escenario 3, pool.rechazadas registró **PENDIENTE** rechazos.
Autocannon sigue enviando peticiones aunque haya recibido 503 y no espera automáticamente el tiempo sugerido.
Esto incrementa el número de rechazos mientras el servidor está saturado.
El límite protege el número de hilos, pero el servidor sigue gastando recursos atendiendo rechazos.
Un cliente bien diseñado respetaría Retry-After y aplicaría un límite de reintentos y retroceso con jitter.

### 5. ¿Qué ocurriría con tres réplicas detrás de un balanceador?

Cada réplica tendría sus métricas, cola y contador de rechazos en memoria propios.
La respuesta de /metricas solo describiría la instancia que respondió.
Si cada réplica permite W trabajadores activos, las tres podrían ejecutar hasta **3 × W** reportes a la vez.
La capacidad de trabajos esperando sería hasta **3 × MAX_COLA**, si la carga se reparte bien.
Para una vista global agregaría métricas; para limitar globalmente los trabajos usaría una cola compartida y consumidores coordinados.

## 3. Problemas encontrados

- En el main del repositorio faltaban worker-reporte.ts y /reporte/worker. Se incorporó un worker base de un solo uso compartido por ambos modos de reporte.
- PENDIENTE: documentar errores y soluciones reales de Docker, TypeScript, carga o capacidad.
- No se han inventado datos: las mediciones deben obtenerse de la laptop del estudiante.

## 4. Uso declarado de IA

Se utilizó ChatGPT para revisar el repositorio, proponer el código de los reportes con trabajadores y del pool, integrar las métricas y preparar el borrador de bitácora. El estudiante debe ejecutar la carga, registrar salidas reales, revisar los resultados y completar el análisis antes de entregar.
