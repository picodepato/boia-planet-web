/**
 * Argumentos de los scripts del Admin y de limpieza (T94), separados para
 * probarlos sin red: `pnpm admin:grant -- <email> <rol>` y
 * `pnpm db:clean-test-users [--all | --minutes N]`.
 */

export const STAFF_ROLES = ['owner', 'admin', 'editor'] as const;
export type GrantRole = (typeof STAFF_ROLES)[number] | 'none';

export function parseGrantArgs(argv: readonly string[]): { email: string; role: GrantRole } {
  const args = argv.filter((a) => a !== '--');
  const [email, role] = args;
  if (args.length !== 2 || !email || !role) {
    throw new Error('uso: pnpm admin:grant -- <email> <owner|admin|editor|none>');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error(`email no válido: ${email}`);
  }
  if (role !== 'none' && !(STAFF_ROLES as readonly string[]).includes(role)) {
    throw new Error(`rol no válido: ${role} (owner, admin, editor o none)`);
  }
  return { email: email.trim().toLowerCase(), role: role as GrantRole };
}

/** Minutos de margen: 30 por defecto (no pisa otra ejecución), 0 con `--all`. */
export function cleanMinutes(argv: readonly string[]): number {
  if (argv.includes('--all')) return 0;
  const i = argv.indexOf('--minutes');
  if (i < 0) return 30;
  const n = Number(argv[i + 1]);
  if (!Number.isFinite(n) || n < 0) throw new Error('--minutes N: un número de minutos');
  return n;
}
