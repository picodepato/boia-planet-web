#!/usr/bin/env node
/**
 * Servidor de las pruebas e2e (`webServer` de playwright.config.ts): `next
 * build` y después `next start` en el puerto pedido, los dos con este mismo
 * Node, sin pnpm de por medio.
 *
 * Por qué (T29): con `pnpm run build && pnpm exec next start`, pnpm dejaba el
 * `next-server` en otro grupo de procesos; al terminar, Playwright mataba el
 * grupo del comando pero no ése, y se quedaba esperando a que cerrara su
 * salida, con las pruebas ya terminadas. Aquí `next start` es hijo directo:
 * cae con el grupo, y además se le reenvían las señales y se para solo si
 * Playwright desaparece.
 *
 * Uso: node scripts/e2e-server.mjs <puerto>
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.argv[2] ?? '3107';
const cwd = join(dirname(fileURLToPath(import.meta.url)), '..');
const next = createRequire(join(cwd, 'package.json')).resolve('next/dist/bin/next');

// Atlas por sector (T47) antes del build, como `pnpm build`.
spawnSync(process.execPath, ['scripts/atlas.mjs'], { cwd, stdio: 'inherit' });
const build = spawnSync(process.execPath, [next, 'build'], { cwd, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', port], {
  cwd,
  stdio: 'inherit',
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  server.kill('SIGTERM');
  setTimeout(() => {
    server.kill('SIGKILL');
    process.exit(code);
  }, 3000).unref();
}
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => stop(0));
server.on('exit', (code) => process.exit(code ?? 0));

// Si Playwright muere sin avisar, el servidor no se queda huérfano.
const parent = process.ppid;
setInterval(() => {
  try {
    process.kill(parent, 0);
  } catch {
    stop(0);
  }
}, 1000).unref();
