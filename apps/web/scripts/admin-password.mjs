// Cambia la contraseña del Admin de la demo (modo local): pnpm admin:password
// Pide la contraseña nueva dos veces con la entrada oculta, hace un hash con
// sal nueva y reescribe DEMO_ADMIN_PASSWORD en lib/admin/demo-auth.ts. Sólo
// imprime «hash actualizado»: la contraseña no se enseña ni se guarda.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MIN_LENGTH,
  currentIterations,
  makeHash,
  readHash,
  replaceHash,
  typeKeys,
  verifyHash,
} from './admin-password-lib.mjs';

const target = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../lib/admin/demo-auth.ts',
);

/** Lee una línea de la terminal sin enseñar lo que se escribe (modo crudo, sin eco). */
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      // Sin terminal (un pipe, o Git Bash/mintty sin winpty) no se puede
      // ocultar lo que se escribe: no se lee nada.
      reject(
        new Error(
          'Hace falta una terminal interactiva: la contraseña no se lee de un pipe. ' +
            'En Windows, usa PowerShell o cmd; en Git Bash, «winpty node apps/web/scripts/admin-password.mjs» desde la raíz.',
        ),
      );
      return;
    }
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let text = '';
    const finish = (fn, value) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
      fn(value);
    };
    const onData = (chunk) => {
      const r = typeKeys(text, chunk);
      text = r.text;
      if (r.end === 'enter') finish(resolve, text);
      else if (r.end === 'cancel') finish(reject, new Error('Cancelado. No se ha cambiado nada.'));
    };
    stdin.on('data', onData);
  });
}

try {
  const first = await askHidden('Contraseña nueva del Admin: ');
  if (first.length < MIN_LENGTH)
    throw new Error(`Mínimo ${MIN_LENGTH} caracteres. No se ha cambiado nada.`);
  const second = await askHidden('Otra vez: ');
  if (first !== second) throw new Error('No coinciden. No se ha cambiado nada.');
  const source = readFileSync(target, 'utf8');
  const hash = makeHash(first, currentIterations(source));
  const next = replaceHash(source, hash);
  // Antes de escribir: lo que queda en el archivo se lee y verifica con la contraseña.
  if (!verifyHash(first, readHash(next)))
    throw new Error('El hash nuevo no verifica. No se ha cambiado nada.');
  writeFileSync(target, next);
  console.log('hash actualizado');
  console.log('Falta: commit + push para que los dos hosts (Cloudflare y Vercel) lo tengan.');
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Error');
  process.exitCode = 1;
}
