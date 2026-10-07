/**
 * «Descargar mis datos» (plan 017 T193, REQ-IDE-050, decisión 6): un JSON
 * con todo lo de quien lo pide y nada de nadie más.
 *
 * - Modo local (D-20): lo de la identidad de este navegador, leído del
 *   repositorio por su API pública (Carnet, libro, logros, cosméticos,
 *   sellos, descubrimientos, descuentos, compras, botella). Los miembros de
 *   muestra, el contenido del Admin y la auditoría no entran.
 * - Con cuenta: lo mismo de la copia del navegador y, en `server`, lo que
 *   devuelve `export_my_data()` (migración 20261007100400): sólo filas de la
 *   cuenta que llama.
 *
 * Nunca lleva secretos: ni contraseñas, tokens, TOTP o códigos de respaldo
 * (`stripSecrets` quita cualquier clave con ese nombre, por si acaso).
 */
import type { BoiaRepository } from '@boia/store';

export const EXPORT_FORMAT = 'boia-planet-account-export';
export const EXPORT_VERSION = 1;

export interface AccountExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  /** `local`: sólo este navegador (D-20); `account`: la cuenta con email. */
  mode: 'local' | 'account';
  identity: { id: string; kind: string; createdAt: string } | null;
  carnet: unknown;
  balances: unknown;
  ledger: unknown[];
  achievements: unknown[];
  cosmetics: unknown[];
  equipped: Record<string, string>;
  stamps: unknown[];
  discoveries: unknown[];
  discounts: unknown[];
  purchases: unknown[];
  bottle: unknown;
  /** Con cuenta: lo que guarda el servidor (`export_my_data`). */
  server?: unknown;
}

/** Nombres de clave que nunca salen en la descarga. */
const SECRET_KEY = /pass(word)?|token|secret|totp|backup|code_hash|^salt$|^hash$|qr_?code|api_?key/i;

/** Copia sin las claves secretas, a cualquier profundidad. */
export function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = stripSecrets(v);
    }
    return out as T;
  }
  return value;
}

/** Lo de la identidad de este navegador. */
export async function buildLocalExport(
  repo: BoiaRepository,
  now: Date = new Date(),
): Promise<AccountExport> {
  const identity = await repo.identity.current();
  const me = identity?.id ?? null;
  const own = <T extends { userId?: string }>(rows: readonly T[]) =>
    rows.filter((r) => me !== null && r.userId === me);

  const [carnet, balances, ledger, achievements, cosmetics, equipped, stamps] = await Promise.all([
    repo.carnet.mine(),
    repo.progress.balances(),
    repo.progress.ledger(),
    repo.progress.achievements(),
    repo.progress.cosmetics(),
    repo.progress.equipped(),
    repo.progress.stamps(),
  ]);
  const [discoveries, discounts, purchases, bottle] = await Promise.all([
    repo.progress.discoveries(),
    repo.progress.discounts(),
    repo.purchases.list(),
    repo.bottles.mine(),
  ]);

  const data: AccountExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    mode: 'local',
    identity: identity
      ? { id: identity.id, kind: identity.kind, createdAt: identity.createdAt }
      : null,
    carnet: carnet && carnet.isMine ? carnet : null,
    balances,
    ledger: own(ledger),
    achievements: achievements
      .filter((a) => a.obtained)
      .map((a) => ({
        id: a.definition.id,
        title: a.definition.title,
        obtainedAt: a.obtainedAt,
        claimedAt: a.claimedAt,
      })),
    cosmetics: cosmetics.map((c) => ({
      id: c.id,
      name: c.cosmetic?.name ?? null,
      unlockedAt: c.unlockedAt,
      source: c.source,
    })),
    equipped,
    stamps,
    discoveries,
    discounts: discounts.map((d) => ({
      id: d.discount.id,
      label: d.discount.label,
      code: d.discount.code,
      scope: d.discount.scope,
      status: d.status,
      foundAt: d.foundAt,
      usedAt: d.usedAt,
      usedIn: d.usedIn,
    })),
    purchases: own(purchases),
    bottle: bottle && bottle.isMine ? bottle : null,
  };
  return stripSecrets(data);
}

/** Con cuenta: la copia del navegador más lo del servidor. */
export async function buildAccountExport(
  repo: BoiaRepository,
  server: () => Promise<unknown>,
  now: Date = new Date(),
): Promise<AccountExport> {
  const local = await buildLocalExport(repo, now);
  return stripSecrets({ ...local, mode: 'account', server: await server() });
}

/** Nombre del archivo: `boia-planet-mis-datos-AAAA-MM-DD.json`. */
export function exportFileName(now: Date = new Date()): string {
  return `boia-planet-mis-datos-${now.toISOString().slice(0, 10)}.json`;
}

/** Descarga el JSON en el navegador. */
export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
