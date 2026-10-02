#!/usr/bin/env node
/**
 * Presupuesto del primer sector (REQ-ARQ-014, T47): bytes de arte que /juego
 * descarga antes de poder jugar, por mundo, con el barco en el puerto. Usa
 * los atlas de `public/atlas/` si están (`pnpm atlas`) y si no los PNG de
 * `art/`, como el motor. Sale con 1 si algún mundo pasa de 5 MB.
 * El cálculo está en `tools/atlas/budget.ts`.
 *
 * Uso: node scripts/world-budget.mjs [--json] [--png]   (--png: sin atlas)
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..');
// Deja a Node cargar el TypeScript de los paquetes (importaciones sin extensión).
await import(pathToFileURL(join(repo, 'packages/world/scripts/ts-resolve.mjs')).href);
const { FIRST_SECTOR_BUDGET, readAtlasIndex, worldBudgets } = await import(
  pathToFileURL(join(repo, 'tools/atlas/budget.ts')).href
);

const png = process.argv.includes('--png');
const rows = worldBudgets(png ? null : readAtlasIndex());
const over = rows.filter((r) => r.total > FIRST_SECTOR_BUDGET);
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ budget: FIRST_SECTOR_BUDGET, worlds: rows }, null, 2));
} else {
  console.log('\nArte antes de jugar en /juego, por mundo (barco en el puerto):');
  for (const r of rows) {
    console.log(
      `  ${r.world.padEnd(10)} ${kb(r.total).padStart(10)}  [${r.mode}] arte ${kb(r.art)} · manifiestos ${kb(
        r.manifests,
      )} · barco ${kb(r.ship)} · ${r.objects} objetos · sectores ${r.sectors.join(', ')}`,
    );
  }
  console.log(
    `  presupuesto ${kb(FIRST_SECTOR_BUDGET)} por mundo · ${over.length === 0 ? 'OK' : `EXCEDIDO: ${over.map((r) => r.world).join(', ')}`}\n`,
  );
}
process.exit(over.length === 0 ? 0 : 1);
