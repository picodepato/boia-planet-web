import type { WorldEvent } from '@boia/engine';
import type { Notice } from '@boia/engine/ui';
import { type FoundDiscount, type ProgressApi, isStoreError } from '@boia/store';
import { recordSignal } from './achievements';
import { t } from '../i18n';

/**
 * Del mar al repositorio local (T20, D-20): lo que el motor emite (premios,
 * descuentos, descubrimientos, encuentros de la web) se guarda en
 * `repo.progress` y sólo avisa si de verdad se concedió. El motor ya no
 * repite en la misma visita; el repositorio no repite nunca (las claves van
 * por id de lugar, así sobreviven a recargar y a cambiar de mundo).
 *
 * Los logros los completa `achievements.ts` (T21, T36); desde aquí salen las
 * señales de los encuentros (el delfín) y del mundo en que se navega.
 */

export interface ProgressContext {
  /** Visita (carga de página): las recompensas «por sesión» vuelven en otra. */
  sessionId: string;
  /** Mundo que se juega: temporada de los descuentos y de lo «por temporada». */
  worldId: string;
}

export type ProgressOutcome =
  { kind: 'notice'; notice: Notice } | { kind: 'discount'; found: FoundDiscount; notice: Notice };

/** Textos de los premios. muestra */
export function rewardTitle(kind: 'coins' | 'points', n: number): string {
  if (kind === 'coins') return `+${n} ${n === 1 ? 'moneda' : 'monedas'}`;
  return `+${n} ${n === 1 ? 'punto' : 'puntos'}`;
}

export function discountTitle(f: FoundDiscount): string {
  if (f.status === 'expired')
    return t('juego.worldProgress.codigoCaducado', { code: f.discount.code });
  return t('juego.worldProgress.descuentoEncontrado', { code: f.discount.code });
}

/** Origen estable de un premio del mundo: lugar, tipo y, si es por visita, la visita. */
export function rewardSource(
  objectId: string,
  kind: string,
  frequency: string,
  ctx: ProgressContext,
): { sourceRef: string; policy: 'once' | 'season' } {
  const base = `lugar:${objectId}:${kind}`;
  if (frequency === 'season') return { sourceRef: base, policy: 'season' };
  if (frequency === 'once') return { sourceRef: base, policy: 'once' };
  // «Por sesión» (restos, cofres) y repetibles: una vez por visita.
  return { sourceRef: `${base}@visita:${ctx.sessionId}`, policy: 'once' };
}

/** Guarda lo que toca de un evento del mundo y devuelve lo que hay que enseñar. */
export async function persistWorldEvent(
  progress: ProgressApi,
  e: WorldEvent,
  ctx: ProgressContext,
): Promise<ProgressOutcome[]> {
  if (e.type !== 'reward') return [];
  if (e.kind === 'discount') {
    if (!e.ref) return [];
    return discountFound(progress, e.ref, ctx);
  }
  if (e.kind !== 'coins' && e.kind !== 'points') return [];
  if (e.amount <= 0) return [];
  const { sourceRef, policy } = rewardSource(e.objectId, e.kind, e.frequency, ctx);
  const r = await progress.grantWorldReward({ sourceRef, [e.kind]: e.amount, policy });
  if (!r.granted) return [];
  return [
    {
      kind: 'notice',
      notice: { id: `premio:${sourceRef}`, kind: 'reward', title: rewardTitle(e.kind, e.amount) },
    },
  ];
}

/**
 * Un descuento escondido encontrado (REQ-COM-021): se premia sólo la primera
 * vez; uno que no existe (lo quitó el Admin) no hace nada.
 */
export async function discountFound(
  progress: ProgressApi,
  discountId: string,
  ctx: ProgressContext,
): Promise<ProgressOutcome[]> {
  try {
    const f = await progress.findDiscount(discountId, { worldId: ctx.worldId });
    if (!f.first) return [];
    return [
      {
        kind: 'discount',
        found: f,
        notice: { id: `descuento:${discountId}`, kind: 'reward', title: discountTitle(f) },
      },
    ];
  } catch (err) {
    if (isStoreError(err, 'not_found')) return [];
    throw err;
  }
}

/** Primera llegada a un lugar (REQ-AVE-013), por id: sobrevive a recargar. */
export async function discoverPlace(
  progress: ProgressApi,
  placeId: string,
  ctx: ProgressContext,
): Promise<boolean> {
  const r = await progress.discover(`lugar:${placeId}`, { worldId: ctx.worldId });
  // Llegar a un lugar es navegar en ese mundo (logro «Entre dos mundos»).
  await recordSignal({ progress }, { trigger: 'visit_world', worldId: ctx.worldId }).catch(
    (err: unknown) => console.warn('[boia] no se pudo apuntar el logro', err),
  );
  return r.first;
}

/** Los lugares ya descubiertos en este navegador (para la brújula y el mapa). */
export async function discoveredPlaces(progress: ProgressApi): Promise<string[]> {
  return (await progress.discoveries())
    .map((d) => d.key)
    .filter((k) => k.startsWith('lugar:'))
    .map((k) => k.slice('lugar:'.length));
}

/**
 * El encuentro que termina un premio de encuentro: seguir al delfín hasta el
 * final (`lugar:<id>:seguir`) es el encuentro `<id>`; el remolino no cuenta.
 */
export function encounterOf(sourceRef: string): string | null {
  return /^lugar:([^:@]+):seguir$/.exec(sourceRef)?.[1] ?? null;
}

/**
 * Premio de un encuentro de la web (delfín, remolino), idempotente por su
 * origen, y la señal del logro del encuentro (aunque el premio de hoy ya se
 * diera: el logro cuenta el encuentro terminado).
 */
export async function grantEncounter(
  progress: ProgressApi,
  sourceRef: string,
  coins: number,
  policy: 'once' | 'daily' | 'season',
): Promise<ProgressOutcome[]> {
  const r = await progress.grantWorldReward({ sourceRef, coins, policy });
  const out: ProgressOutcome[] = r.granted
    ? [
        {
          kind: 'notice',
          notice: {
            id: `premio:${sourceRef}:${r.entry.id}`,
            kind: 'reward',
            title: rewardTitle('coins', coins),
          },
        },
      ]
    : [];
  const encounter = encounterOf(sourceRef);
  if (encounter) {
    const done = await recordSignal({ progress }, { trigger: 'complete_encounter', encounter });
    out.push(...done.map((notice): ProgressOutcome => ({ kind: 'notice', notice })));
  }
  return out;
}
