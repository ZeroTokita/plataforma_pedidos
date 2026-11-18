
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";

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

app.listen(PORT, () => {
  console.log(
    `Pedidos escuchando en puerto ${PORT}`
  );
});
