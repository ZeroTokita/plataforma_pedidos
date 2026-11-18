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
| 1 · bloqueo (/health) | 6 ms | 5064 ms | 11921 | 0 | No reportados en la captura | 5016 ms |
| 2 · worker sin límite | 2052 ms | 3191 ms | 486 | 0 (no se muestran otros códigos) | PENDIENTE: no visible al final de captura | 261 ms |
| 3 · pool con límite | 1 ms (incluye 503) | 2412 ms | 493 | 16273 | No reportados en la salida visible | 58 ms |

Reiniciar Pedidos con "docker compose restart pedidos" ANTES DE CADA ESCENARIO. Ejecutar la carga, capturar la salida y consultar /metricas al terminar. --renderStatusCodes permite ver cuántos códigos son específicamente 503.

### Escenario 1: bloqueo (/health)

El intento de medición válido contiene dos solicitudes bloqueantes durante la carga. Se registraron `bucle.maxMs = 5016 ms`, `GET /health maxMs = 17.155894 ms` y un máximo observado por autocannon de `5064 ms`. Se deja el primer intento como registro histórico por separado.

Comando:
npx.cmd -y autocannon@8 -c 20 -d 15 --renderStatusCodes http://localhost:3000/health

Durante la prueba solicitar dos veces GET /reporte/bloqueante desde Postman o navegador.

Salida autocannon (intento anterior, conservado solo como historial):

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

Respuesta /metricas (intento anterior):

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

#### Repetición válida con dos solicitudes bloqueantes

Salida de autocannon (captura aportada para esta misma repetición):

~~~text
Running 15s test @ http://localhost:3000/health
20 connections

Stat      2.5%   50%   97.5%   99%   Avg      Stdev    Max
Latency   4 ms   6 ms  21 ms   33 ms  24.79 ms 290.7 ms 5064 ms

Stat        1%  2.5%  50%  97.5%  Avg     Stdev     Min
Req/Sec     0    0     0    2995  794.87  1049.93  391
Bytes/Sec   0 B  0 B   0 B  812 kB 215 kB  284 kB   106 kB

Code  Count
200   11921

Req/Bytes counts sampled once per second.
# of samples: 15
12k requests in 15.11s, 3.23 MB read

No aparece un recuento específico de timeouts en la captura compartida.
~~~

Respuesta de /metricas de la misma repetición:

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

**Conclusión:** ahora sí aparece una latencia máxima de autocannon de 5064 ms, consistente con el bloqueo de ~5 segundos y la medición interna de 5016 ms. El interceptor de /health conserva un máximo de 17.16 ms. Solo queda confirmar si hubo timeouts mediante la salida completa, si se necesita una cifra exacta.

### Escenario 2: un hilo por petición

Comando:
npx.cmd -y autocannon@8 -c 50 -d 20 --renderStatusCodes "http://localhost:3000/reporte/worker?n=2000000"

Salida autocannon:

~~~text
Running 20s test @ http://localhost:3000/reporte/worker?n=2000000
50 connections

Stat      2.5%     50%      97.5%    99%      Avg        Stdev      Max
Latency   1092 ms  2052 ms  2948 ms  3050 ms  1969.22 ms 524.65 ms  3191 ms

Stat       1%   2.5%   50%   97.5%  Avg     Stdev   Min
Req/Sec    0    0      19    49     24.3    13.74   7
Bytes/Sec  0 B  0 B    5.93 kB 15.3 kB 7.58 kB 4.29 kB 2.18 kB

Code Count
200  486

Req/Bytes counts sampled once per second.
# of samples: 20
536 requests in 20.16s, 152 kB read

NOTA: la captura se corta después de esta línea; los 50 intentos de diferencia entre 536 solicitudes y 486 respuestas 200 no se pueden etiquetar como timeouts sin leer el resumen final.
~~~

Respuesta /metricas:

~~~json
{
  "umbralLentaMs": 1000,
  "nucleos": 16,
  "bucle": { "p50Ms": 10, "p99Ms": 43, "maxMs": 261 },
  "rutas": [
    {
      "ruta": "GET /health",
      "peticiones": 6,
      "promedioMs": 10.1775584999999,
      "maxMs": 46.1936649999989,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/worker",
      "peticiones": 486,
      "promedioMs": 1910.79222484568,
      "maxMs": 2920.280498,
      "lentas": 486
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

### Escenario 3: pool con límite

Comando:
npx.cmd -y autocannon@8 -c 50 -d 20 --renderStatusCodes "http://localhost:3000/reporte/pool?n=2000000"

Salida autocannon:

~~~text
Running 20s test @ http://localhost:3000/reporte/pool?n=2000000
50 connections

Stat       2.5%  50%   97.5%    99%      Avg       Stdev      Max
Latency    0 ms  1 ms  1799 ms  1909 ms  56.47 ms  315.67 ms  2412 ms

Stat       1%      2.5%    50%     97.5%    Avg     Stdev    Min
Req/Sec    403     403     871     1019     838.3   150.04   403
Bytes/Sec  159 kB  159 kB  344 kB  405 kB   332 kB  59.9 kB  158 kB

Code  Count
200   493
503   16273

Req/Bytes counts sampled once per second.
# of samples: 20
493 2xx responses, 16273 non 2xx responses
17k requests in 20.05s, 6.63 MB read

NOTA: la salida visible no muestra un recuento explícito de timeouts.
La latencia p50 de 1 ms corresponde principalmente a respuestas 503 rápidas y NO a reportes procesados exitosamente.
~~~

Respuesta /metricas:

~~~json
{
  "umbralLentaMs": 1000,
  "nucleos": 16,
  "bucle": { "p50Ms": 10, "p99Ms": 16, "maxMs": 58 },
  "rutas": [
    {
      "ruta": "GET /reporte/pool",
      "peticiones": 16768,
      "promedioMs": 55.0005717392057,
      "maxMs": 2207.503625,
      "lentas": 478
    },
    {
      "ruta": "GET /health",
      "peticiones": 5,
      "promedioMs": 0.928750400000354,
      "maxMs": 1.38880600000266,
      "lentas": 0
    }
  ],
  "pool": {
    "maxTrabajadores": 16,
    "activos": 0,
    "enCola": 0,
    "maxCola": 32,
    "rechazadas": 16274
  }
}
~~~

## 2. Análisis

### 1. ¿Por qué el monitor del bucle ve el bloqueo pero el interceptor no?

En la repetición con dos reportes bloqueantes, el valor máximo de `bucle.maxMs` fue **5016 ms**.
El máximo de `GET /health` en `rutas` fue **17.16 ms**, mientras autocannon observó **5064 ms** de latencia máxima de cliente.
El reporte bloqueante ejecuta trabajo síncrono unos cinco segundos y ocupa el hilo principal.
El monitor mide el retraso acumulado por un temporizador que no puede ejecutarse durante ese intervalo.
El interceptor mide /health solo cuando Express finalmente empieza a procesarla, sin contabilizar la espera anterior.

### 2. ¿Por qué 50 workers simultáneos pueden producir timeouts?

En el escenario 2 se completaron **486 peticiones HTTP 200**; el número de timeouts sigue **pendiente** porque no se ve en la captura.
El reporte individual n=2000000 tardó **341 ms** sin saturación en modo worker (277 ms en modo pool).
Cada solicitud a /reporte/worker crea un hilo nuevo y no existe un cupo global.
Con 50 peticiones simultáneas, los hilos compiten por CPU y memoria y pagan el coste de creación; la latencia p50 subió a **2052 ms**.
La duración de una operación aislada no predice la latencia bajo carga: la saturación puede generar timeouts.

### 3. ¿Qué diferencia hay entre un 503 inmediato y un timeout?

En el escenario 3 se recibieron **493 respuestas 2xx** y **16273 respuestas 503**, según autocannon.
El pool limita la ejecución a **16 trabajadores** y la cola a **32 solicitudes**.
Al agotar ambos recursos, el servidor emite un rechazo explícito, un fallo reconocido.
La cabecera Retry-After: 1 permite al cliente planificar su próximo intento.
Un timeout es un fallo por omisión: el cliente no puede saber si el trabajo se llegó a ejecutar.

### 4. ¿Qué efecto tuvieron los reintentos inmediatos?

Durante el escenario 3, `pool.rechazadas` registró **16274** rechazos, uno más que los **16273** códigos 503 observados por autocannon.
Autocannon sigue enviando peticiones aunque haya recibido 503 y no espera automáticamente el tiempo sugerido.
Al mantener la carga con nuevas solicitudes inmediatas, autocannon ocasionó 16273 respuestas 503, frente a 493 respuestas exitosas.
El límite protegió la concurrencia: bucle.maxMs fue 58 ms, frente a 261 ms del escenario 2; el servidor siguió respondiendo rechazos.
Un cliente bien diseñado respetaría Retry-After: 1, con límite de intentos, retroceso y jitter para evitar nuevas ráfagas.

### 5. ¿Qué ocurriría con tres réplicas detrás de un balanceador?

Cada réplica tendría sus métricas, cola y contador de rechazos en memoria propios.
La respuesta de /metricas solo describiría la instancia que respondió.
Si cada réplica dispone de 16 trabajadores, tres instancias podrían ejecutar **48 reportes** a la vez.
La capacidad total de espera sería **96 trabajos** (3 × 32), si la carga se reparte bien.
Para una vista global agregaría métricas; para limitar globalmente los trabajos usaría una cola compartida y consumidores coordinados.

## 3. Problemas encontrados

- En el main del repositorio faltaban worker-reporte.ts y /reporte/worker. Se incorporó un worker base de un solo uso compartido por ambos modos de reporte.
- En el segundo intento del escenario 1 se ejecutó autocannon sin las solicitudes bloqueantes, por lo que el monitor solo registró 44 ms; se corrigió repitiendo ambos tipos de carga al mismo tiempo.
- En el escenario 2 la captura terminó antes del resumen de posibles timeouts. La diferencia entre solicitudes y respuestas 200 no se consideró evidencia suficiente para clasificarlas.
- En el escenario 3 la latencia mediana de 1 ms resultó engañosa porque incluía 16273 rechazos 503; se compararon por separado los códigos de estado y las métricas del bucle.
- No se han inventado datos: las mediciones deben obtenerse de la laptop del estudiante.

## 4. Uso declarado de IA

Se utilizó ChatGPT para revisar el repositorio, proponer el código de los reportes con trabajadores y del pool, integrar las métricas y preparar el borrador de bitácora. El estudiante debe ejecutar la carga, registrar salidas reales, revisar los resultados y completar el análisis antes de entregar.
