# S2 - Interceptor de métricas de Pedidos

## 1. Experimento de latencia

Se ejecutó GET /reporte/bloqueante y, mientras el servidor procesaba esa
solicitud, se envió GET /health desde Postman. Para la prueba se utilizó
una simulación de trabajo síncrono bloqueante de aproximadamente 5 segundos.

### Resultado de /health

- Método: GET
- Ruta: /health
- Código HTTP: 200 OK
- Tiempo en Postman: 2.47 s (2470 ms)
- Waiting (TTFB): 2.47 s

Respuesta recibida:

```json
{
  "status": "ok",
  "servicio": "pedidos"
}
```

## 2. Respuesta completa de /metricas

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /health",
      "peticiones": 66,
      "promedioMs": 0.9565225606045604,
      "maxMs": 7.661582000000635,
      "lentas": 0
    },
    {
      "ruta": "GET /favicon.ico",
      "peticiones": 1,
      "promedioMs": 3.964165999990655,
      "maxMs": 3.964165999990655,
      "lentas": 0
    },
    {
      "ruta": "GET /metricas",
      "peticiones": 1,
      "promedioMs": 1.5494550000003073,
      "maxMs": 1.5494550000003073,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 1,
      "promedioMs": 5001.123863000015,
      "maxMs": 5001.123863000015,
      "lentas": 1
    }
  ]
}
```

## 3. Análisis de los resultados

Postman mide desde el envío de /health hasta recibir la respuesta, incluyendo la espera.
El interceptor mide desde que Express comienza a procesar la petición.
El reporte bloqueante ocupa el event loop e impide atender /health inmediatamente.
Por eso Postman registra 2470 ms, mientras el interceptor promedia 0.96 ms.
El cliente experimenta alta latencia y podría sufrir un timeout, aunque recibió HTTP 200.
