
import express, { Request, Response } from "express";

const PORT = Number(process.env.PORT ?? 3001);
const RETARDO_MS = Number(process.env.RETARDO_MS ?? 1000);

const stock = new Map<string, number>([
  ["Laptop-14", 5],
  ["MOUSE-USB", 40],
  ["TECLADO-ES", 12],
  ["MONITOR-24", 0]
]);

const esperar = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const app = express();

// Permitir recibir JSON en solicitudes POST
app.use(express.json());

// Salud del servicio
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", servicio: "inventario" });
});

// Consultar stock
app.get(
  "/stock/:sku",
  async (req: Request<{ sku: string }>, res: Response) => {
    if (RETARDO_MS > 0) {
      await esperar(RETARDO_MS);
    }

    const disponible = stock.get(req.params.sku);

    if (disponible === undefined) {
      res.status(404).json({
        error: "sku no encontrado " + req.params.sku
      });
      return;
    }

    res.json({ sku: req.params.sku, disponible });
  }
);

// NUEVO: Reservar stock
app.post(
  "/stock/:sku/reservar",
  async (req: Request<{ sku: string }>, res: Response) => {
    const sku = req.params.sku;
    const cantidad = req.body?.cantidad;

    // Validar cantidad
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      res.status(400).json({
        error: "La cantidad debe ser un entero mayor que 0"
      });
      return;
    }

    // Retardo antes de descontar
    if (RETARDO_MS > 0) {
      await esperar(RETARDO_MS);
    }

    // Consultar stock actualizado después del retardo
    const disponible = stock.get(sku);

    if (disponible === undefined) {
      res.status(404).json({
        error: "SKU no encontrado",
        sku
      });
      return;
    }

    if (disponible < cantidad) {
      res.status(409).json({
        error: "Stock insuficiente",
        sku,
        solicitado: cantidad,
        disponible
      });
      return;
    }

    // Descontar unidades
    const restante = disponible - cantidad;
    stock.set(sku, restante);

    res.status(200).json({
      sku,
      reservado: cantidad,
      restante
    });
  }
);

app.listen(PORT, () => {
  console.log(
    "Inventario escuchando en puerto " +
    PORT +
    " - Retardo: " +
    RETARDO_MS +
    "ms"
  );
});
