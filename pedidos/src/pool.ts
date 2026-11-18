import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

function configurarEntero(nombre: string, predeterminado: number, minimo: number): number {
  const valor = process.env[nombre];
  if (valor === undefined) return predeterminado;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= minimo ? numero : predeterminado;
}

const maxTrabajadores = configurarEntero("MAX_TRABAJADORES", availableParallelism(), 1);
const maxCola = configurarEntero("MAX_COLA", maxTrabajadores * 2, 0);

type Trabajo = {
  n: number;
  resolve: (primos: number) => void;
  reject: (error: Error) => void;
};
const cola: Trabajo[] = [];
let activos = 0;
let rechazadas = 0;

export function estadoPool() {
  return { maxTrabajadores, activos, enCola: cola.length, maxCola, rechazadas };
}

function despachar(): void {
  while (activos < maxTrabajadores && cola.length > 0) {
    const siguiente = cola.shift();
    if (siguiente) iniciar(siguiente);
  }
}

function iniciar(trabajo: Trabajo): void {
  activos++;
  let worker: Worker;
  try {
    worker = new Worker(join(__dirname, "worker-reporte.js"), { workerData: trabajo.n });
  } catch (error) {
    activos--;
    trabajo.reject(error instanceof Error ? error : new Error(String(error)));
    despachar();
    return;
  }
  let resultado: number | undefined;
  let fallo: Error | undefined;
  worker.on("message", (mensaje: unknown) => {
    if (typeof mensaje === "number" && Number.isSafeInteger(mensaje)) {
      resultado = mensaje;
    } else {
      fallo = new Error("Respuesta inválida del worker");
    }
  });
  worker.once("error", (error: Error) => { fallo = error; });
  worker.once("exit", (codigo: number) => {
    activos--;
    if (fallo) trabajo.reject(fallo);
    else if (codigo !== 0) trabajo.reject(new Error("Worker finalizó con código " + codigo));
    else if (resultado === undefined) trabajo.reject(new Error("Worker terminó sin devolver resultado"));
    else trabajo.resolve(resultado);
    despachar();
  });
}

export function contarPrimosEnPool(n: number): Promise<number> {
  if (!Number.isSafeInteger(n) || n < 0) {
    return Promise.reject(new RangeError("n debe ser un entero no negativo"));
  }
  return new Promise<number>((resolve, reject) => {
    const trabajo: Trabajo = { n, resolve, reject };
    if (activos < maxTrabajadores && cola.length === 0) {
      iniciar(trabajo);
    } else if (cola.length < maxCola) {
      cola.push(trabajo);
      despachar();
    } else {
      rechazadas++;
      const error = new Error("El pool y su cola están llenos");
      error.name = "PoolLleno";
      reject(error);
    }
  });
}
