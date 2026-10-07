/**
 * `pnpm deck:capturas [NN]`: corre los specs de captura de la presentación
 * (todas las partes, o sólo `apps/web/e2e/deck/NN-*.deck.ts`) con
 * `apps/web/playwright.deck.config.ts`, contra el build local en un puerto
 * libre. Las capturas caen en docs/presentacion/capturas/NN-slug/.
 * Lo que venga detrás de NN se pasa a Playwright (p. ej. `-g hero`).
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

function puertoLibre(): Promise<number> {
  return new Promise((ok, mal) => {
    const s = createServer();
    s.once('error', mal);
    s.listen(0, '127.0.0.1', () => {
      const dir = s.address();
      s.close(() => (typeof dir === 'object' && dir ? ok(dir.port) : mal(new Error('sin puerto'))));
    });
  });
}

const args = process.argv.slice(2);
const parte = args[0] && /^\d\d$/.test(args[0]) ? args.shift() : undefined;
if (args[0] && !args[0].startsWith('-')) {
  console.error(
    `Uso: pnpm deck:capturas [NN] [opciones de Playwright]  («${args[0]}» no es un número de parte)`,
  );
  process.exit(2);
}

const puerto = process.env.DECK_PORT ?? String(await puertoLibre());
const env = { ...process.env, DECK_PORT: puerto, ...(parte ? { DECK_PARTE: parte } : {}) };
console.log(
  `Capturas ${parte ? `de la parte ${parte}` : 'de todas las partes'} (puerto ${puerto})`,
);
const r = spawnSync(
  'pnpm',
  [
    '--filter',
    '@boia/web',
    'exec',
    'playwright',
    'test',
    '-c',
    'playwright.deck.config.ts',
    ...args,
  ],
  { stdio: 'inherit', env, shell: process.platform === 'win32' },
);
process.exit(r.status ?? 1);
