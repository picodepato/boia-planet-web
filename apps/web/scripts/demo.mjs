#!/usr/bin/env node
/**
 * `pnpm demo`: arranca la demo (Next en desarrollo, 0.0.0.0) e imprime la URL
 * local y la de la red local, para abrirla desde un móvil en la misma Wi-Fi.
 * Sólo datos de muestra: sin Supabase ni correo.
 *
 *   pnpm demo              # puerto 3000
 *   PORT=3100 pnpm demo    # otro puerto
 *
 * Ctrl+C (o SIGTERM) para el servidor y todos sus procesos hijos: Next corre
 * en su propio grupo de procesos y se le manda la señal al grupo entero.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`demo: PORT no válido: ${process.env.PORT}`);
  process.exit(1);
}

/** IPv4 de la red local (Wi-Fi o cable), sin la de loopback. */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

/** true si el puerto está libre en todas las interfaces. */
function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => srv.close(() => resolve(true)))
      .listen(port, HOST);
  });
}

if (!(await portFree(PORT))) {
  console.error(
    `demo: el puerto ${PORT} está ocupado (¿otro servidor de desarrollo?).\n` +
      `      Prueba con otro: PORT=${PORT === 3000 ? 3100 : PORT + 1} pnpm demo`,
  );
  process.exit(1);
}

const next = createRequire(join(WEB, 'package.json')).resolve('next/dist/bin/next');
// Atlas por sector (T47), como `pnpm dev`.
spawnSync(process.execPath, ['scripts/atlas.mjs'], { cwd: WEB, stdio: 'inherit' });
const child = spawn(process.execPath, [next, 'dev', '--hostname', HOST, '--port', String(PORT)], {
  cwd: WEB,
  // Grupo de procesos propio: al parar se mata el grupo entero (Next arranca workers).
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(PORT) },
});

function banner() {
  const lan = lanAddresses();
  const lines = [
    '',
    '  BOIA.PLANET · demo con datos de muestra',
    '',
    `  En este ordenador:  http://localhost:${PORT}`,
    ...(lan.length
      ? lan.map(
          (ip, i) =>
            `  ${i === 0 ? 'En el móvil (Wi-Fi):' : '                    '} http://${ip}:${PORT}`,
        )
      : ['  Sin red local: conecta el ordenador a la Wi-Fi para abrirla en el móvil.']),
    '',
    '  / entrada y landing · /juego el mundo · /artistas la lista completa',
    '  La primera carga de cada página compila (unos segundos). Ctrl+C para parar.',
    '',
  ];
  console.log(lines.join('\n'));
}

let ready = false;
const relay = (stream, out) => {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    out.write(chunk);
    if (!ready && /Ready in|✓ Ready/.test(chunk)) {
      ready = true;
      banner();
    }
  });
};
relay(child.stdout, process.stdout);
relay(child.stderr, process.stderr);

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Ya no existe.
  }
  // Si en 5 s sigue algo vivo del grupo, a la fuerza.
  setTimeout(() => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // Ya no existe.
    }
    process.exit(signal === 'SIGINT' ? 130 : 143);
  }, 5000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal));
// Si este proceso muere por otra vía, que no quede el servidor huérfano.
process.on('exit', () => {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Ya no existe.
  }
});

child.on('exit', (code, signal) => {
  if (stopping) {
    // Next salió: por si quedara algún worker del grupo, se barre antes de salir.
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // Grupo vacío.
    }
    process.exit(0);
  }
  console.error(`demo: Next terminó (${signal ?? `código ${code}`})`);
  process.exit(code ?? 1);
});
