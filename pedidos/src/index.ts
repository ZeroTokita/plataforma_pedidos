import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { contarPrimosEnPool, estadoPool } from "./pool";
import { medirLatencia, resumenMetricas } from "./metricas";

const PORT = Number(process.env.PORT ?? 3000);

const INVENTARIO_URL =
  process.env.INVENTARIO_URL ?? "http://localhost:3001";

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 2000);

interface Pedido {
  id: string;
  sku: string;
  cantidad: number;
  creadoEn: string;
}

const pedidos: Pedido[] = [];
const app = express();

app.use(express.json());
app.use(medirLatencia);
// Liveness: Pedidos está funcionando
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    servicio: "pedidos"
  });
});

// NUEVO: Readiness
app.get("/health/ready", async (_req: Request, res: Response) => {
  const inicio = performance.now();

  try {
    const respuesta = await fetch(
      `${INVENTARIO_URL}/health`,
      {
        signal: AbortSignal.timeout(1000)
      }
    );

    if (!respuesta.ok) {
      throw new Error(
        `Inventario respondió HTTP ${respuesta.status}`
      );
    }

    const ms = Math.round(performance.now() - inicio);

    res.status(200).json({
      status: "listo",
      inventario: "ok",
      ms
    });

  } catch (error) {
    const ms = Math.round(performance.now() - inicio);

    const e = error as Error & {
      cause?: { code?: string }
    };

    const motivo =
      e.name === "TimeoutError"
        ? "Timeout de 1000 ms"
        : e.cause?.code ?? e.message;

    res.status(503).json({
      status: "no-listo",
      inventario: motivo,
      ms
    });
  }
});

// Consultar todos los pedidos
app.get("/pedidos", (_req: Request, res: Response) => {
  res.json(pedidos);
});

// Crear pedido mediante reserva de stock
app.post("/pedidos", async (req: Request, res: Response) => {
  const { sku, cantidad } = req.body ?? {};

  if (
    typeof sku !== "string" ||
    sku.trim() === "" ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0
  ) {
    res.status(400).json({
      error: "SKU inválido o cantidad incorrecta"
    });
    return;
  }

  const inicio = performance.now();

  try {
    // Reservar unidades en Inventario mediante POST
    const respuesta = await fetch(
      `${INVENTARIO_URL}/stock/${encodeURIComponent(sku)}/reservar`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ cantidad }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      }
    );

    const detalle = await respuesta.json();

    // Reenviar errores de Inventario
    if (respuesta.status === 404 || respuesta.status === 409) {
      res.status(respuesta.status).json(detalle);
      return;
    }

    if (!respuesta.ok) {
      res.status(502).json({
        error: "Error al reservar stock",
        detalle
      });
      return;
    }

    // La reserva fue exitosa
    const pedido: Pedido = {
      id: randomUUID(),
      sku,
      cantidad,
      creadoEn: new Date().toISOString()
    };

    pedidos.push(pedido);

    res.status(201).json(pedido);

  } catch (error) {
    const duracionMs = Math.round(
      performance.now() - inicio
    );

    const e = error as Error & {
      cause?: { code?: string }
    };

    const motivo =
      e.name === "TimeoutError"
        ? `Inventario no respondió en ${TIMEOUT_MS} ms`
        : e.cause?.code ?? e.message;

    console.error("Error de Inventario:", motivo);

    res.status(503).json({
      error: "Inventario no disponible",
      motivo,
      duracionMs
    });
  }
});
// Consultar estadísticas de las peticiones HTTP
app.get("/metricas", (_req: Request, res: Response) => {
  res.json({ ...resumenMetricas(), pool: estadoPool() });
});
// Simulación de reporte que bloquea el event loop
app.get("/reporte/bloqueante", (_req: Request, res: Response) => {
  const inicio = Date.now();

  // Bloquea el event loop durante 5 segundos
  while (Date.now() - inicio < 5000) {
    // Trabajo síncrono simulado
  }

  res.json({
    status: "ok",
    reporte: "bloqueante",
    duracionMs: Date.now() - inicio
  });
});

// Validación compartida por ambos reportes.
function leerN(req: Request, res: Response): number | null {
  const dato = req.query.n ?? "2000000";
  const n = typeof dato === "string" ? Number(dato) : NaN;
  if (!Number.isSafeInteger(n) || n < 0) {
    res.status(400).json({ error: "n debe ser un entero no negativo" });
    return null;
  }
  return n;
}

// Modelo sin límite: cada petición crea su propio hilo.
function contarPrimosSinLimite(n: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, "worker-reporte.js"), { workerData: n });
    let resultado: number | undefined;
    let fallo: Error | undefined;
    worker.on("message", (mensaje: unknown) => {
      if (typeof mensaje === "number" && Number.isSafeInteger(mensaje)) resultado = mensaje;
      else fallo = new Error("Respuesta inválida del worker");
    });
    worker.once("error", (error: Error) => { fallo = error; });
    worker.once("exit", (codigo: number) => {
      if (fallo) reject(fallo);
      else if (codigo !== 0) reject(new Error("Worker finalizó con código " + codigo));
      else if (resultado === undefined) reject(new Error("Worker terminó sin resultado"));
      else resolve(resultado);
    });
  });
}

app.get("/reporte/worker", async (req: Request, res: Response) => {
  const n = leerN(req, res);
  if (n === null) return;
  const inicio = performance.now();
  try {
    const primos = await contarPrimosSinLimite(n);
    res.json({ status: "ok", modo: "worker", n, primos,
      duracionMs: Math.round(performance.now() - inicio) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/reporte/pool", async (req: Request, res: Response) => {
  const n = leerN(req, res);
  if (n === null) return;
  const inicio = performance.now();
  try {
    const primos = await contarPrimosEnPool(n);
    res.json({ status: "ok", modo: "pool", n, primos,
      duracionMs: Math.round(performance.now() - inicio) });
  } catch (error) {
    const e = error as Error;
    if (e.name === "PoolLleno") {
      res.setHeader("Retry-After", "1");
      res.status(503).json({ error: e.message, pool: estadoPool() });
      return;
    }
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `Pedidos escuchando en puerto ${PORT}`
  );
});
