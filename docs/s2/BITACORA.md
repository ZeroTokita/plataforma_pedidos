# Bitácora · Arquitecturas y procesos · Yakov S.

> Borrador: completar todos los campos PENDIENTE con resultados de las pruebas locales antes de entregar.
> Repositorio: https://github.com/ZeroTokita/plataforma_pedidos

## Entorno

| Dato | Valor |
| --- | --- |
| Laptop (CPU, RAM) | PENDIENTE: modelo CPU y RAM desde Windows |
| nucleos según /metricas | PENDIENTE: leer respuesta real |
| MAX_TRABAJADORES y MAX_COLA | PENDIENTE: leer /metricas.pool; por defecto núcleos disponibles y su doble |
| Duración de un reporte con n=2000000 | PENDIENTE: duracionMs de /reporte/worker?n=2000000 |

## 1. Resultados

| Escenario | Latencia 50 % | Latencia máx. | Respuestas 2xx | Respuestas 503 | Timeouts | bucle.maxMs |
| --- | --- | --- | --- | --- | --- | --- |
| 1 · bloqueo (/health) | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| 2 · worker sin límite | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| 3 · pool con límite | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

Reiniciar Pedidos con "docker compose restart pedidos" ANTES DE CADA ESCENARIO. Ejecutar la carga, capturar la salida y consultar /metricas al terminar. --renderStatusCodes permite ver cuántos códigos son específicamente 503.

### Escenario 1: bloqueo (/health)

Comando:
npx.cmd -y autocannon@8 -c 20 -d 15 --renderStatusCodes http://localhost:3000/health

Durante la prueba solicitar dos veces GET /reporte/bloqueante desde Postman o navegador.

Salida autocannon:

~~~text
PENDIENTE: pegar salida real de autocannon (escenario 1)
~~~

Respuesta /metricas:

~~~json
"PENDIENTE: pegar JSON real de /metricas (escenario 1)"
~~~

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

El valor máximo de bucle.maxMs en el escenario 1 fue **PENDIENTE ms**.
El máximo de GET /health dentro de rutas fue **PENDIENTE ms**.
El reporte bloqueante ejecuta trabajo síncrono unos cinco segundos y ocupa el hilo principal.
El monitor mide el retraso acumulado por un temporizador que no puede ejecutarse durante ese intervalo.
El interceptor mide /health solo cuando Express finalmente empieza a procesarla, sin contabilizar la espera anterior.

### 2. ¿Por qué 50 workers simultáneos pueden producir timeouts?

En el escenario 2 se completaron **PENDIENTE peticiones 2xx** y ocurrieron **PENDIENTE timeouts**.
El reporte individual n=2000000 tardó **PENDIENTE ms** sin saturación.
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
