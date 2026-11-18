import { parentPort, workerData } from "node:worker_threads";

// Worker de un trabajo: se usa tanto sin límite como desde el pool.
function contarPrimos(n: number): number {
  let total = 0;
  for (let numero = 2; numero <= n; numero++) {
    if (numero > 2 && numero % 2 === 0) continue;
    let esPrimo = true;
    for (let divisor = 3; divisor * divisor <= numero; divisor += 2) {
      if (numero % divisor === 0) {
        esPrimo = false;
        break;
      }
    }
    if (esPrimo) total++;
  }
  return total;
}

if (!parentPort) throw new Error("Este archivo debe ejecutarse como worker");
parentPort.postMessage(contarPrimos(Number(workerData)));
