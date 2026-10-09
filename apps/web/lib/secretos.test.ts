import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * REQ-ARQ-012 (P2, prueba 9): ningún secreto en el cliente, los logs, el
 * repositorio ni los archivos de ejemplo. Se buscan formas de secreto real
 * (no los nombres de las variables): claves secretas de Supabase y Stripe,
 * JWT completos, claves privadas PEM y URL de Postgres con contraseña. Los
 * valores de prueba cortos (`sb_secret_x`) no tienen forma de clave real.
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const WEB = join(ROOT, 'apps/web');

const SECRET_SHAPES: readonly [string, RegExp][] = [
  ['clave secreta de Supabase', /sb_secret_[A-Za-z0-9_-]{20,}/],
  ['clave de Stripe', /[sr]k_live_[A-Za-z0-9]{10,}/],
  ['JWT completo', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['URL de Postgres con contraseña', /postgres(?:ql)?:\/\/[^\s:@/]+:(?!<)[^\s@<>]{6,}@/],
];

function secretsIn(text: string): string[] {
  return SECRET_SHAPES.filter(([, re]) => re.test(text)).map(([name]) => name);
}

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\0').filter((f) => f && !/\.(png|jpe?g|webp|gif|glb|gltf|bin|ttf|otf|woff2?|mp3|ogg|wav|mp4|webm|pdf|blend|ico|zip)$/i.test(f));
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('secretos (REQ-ARQ-012)', () => {
  it('REQ-ARQ-012: ningún archivo del repositorio lleva un secreto', () => {
    const files = trackedFiles();
    expect(files.length).toBeGreaterThan(100);
    const hits = files.flatMap((f) => {
      const p = join(ROOT, f);
      if (!existsSync(p)) return [];
      return secretsIn(readFileSync(p, 'utf8')).map((kind) => `${f}: ${kind}`);
    });
    expect(hits).toEqual([]);
  });

  it('REQ-ARQ-012: las variables de ejemplo de claves van vacías', () => {
    const lines = readFileSync(join(ROOT, '.env.example'), 'utf8').split('\n');
    const keyed = lines
      .map((l) => /^#?\s*([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)=(.*)$/.exec(l.trim()))
      .filter((m): m is RegExpExecArray => m !== null);
    expect(keyed.length).toBeGreaterThan(0);
    expect(keyed.filter((m) => m[2]!.trim() !== '').map((m) => m[1])).toEqual([]);
  });

  it('REQ-ARQ-012: ningún log del código imprime una variable secreta', () => {
    const sources = trackedFiles().filter(
      (f) => /\.(ts|tsx|mjs|js)$/.test(f) && /^(apps|packages|tools)\//.test(f),
    );
    const leaks = sources.flatMap((f) =>
      readFileSync(join(ROOT, f), 'utf8')
        .split('\n')
        .filter((l) => /console\.\w+\(.*(SERVICE_ROLE|DB_URL|serviceKey|secretKey|password)/i.test(l))
        .map((l) => `${f}: ${l.trim()}`),
    );
    expect(leaks).toEqual([]);
  });

  // El cliente es lo que sirve `next build`; sin build hecho no hay nada que mirar.
  it.skipIf(!existsSync(join(WEB, '.next/static')))(
    'REQ-ARQ-012: el JavaScript del cliente (build) no lleva secretos',
    () => {
      const files = walk(join(WEB, '.next/static')).filter((f) => /\.(js|css|json|html)$/.test(f));
      const hits = files.flatMap((f) => secretsIn(readFileSync(f, 'utf8')).map((k) => `${f}: ${k}`));
      expect(hits).toEqual([]);
    },
  );
});
