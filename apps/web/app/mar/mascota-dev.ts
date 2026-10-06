import { CANONCITO, ESTELA_VORTICE, MINIKRAKEN, type ProgressApi, TORTUGA_TURBO } from '@boia/store';
import { type DevEnv, devEnv, devStartRewards } from './survivors';

/**
 * Atajo de desarrollo de las mascotas y la estela (plan 013 T154, plan 015
 * T175): `/mar?mascota=1` da el minikraken como si se hubiera vencido al
 * Kraken (completa y reclama el logro que lo regala, `canon-kraken`);
 * `?mascota=canoncito`, `?mascota=tortuga-turbo` (o varias con comas) y
 * `?estela=vortice` dan los premios del castillo y la carrera: por su logro
 * si lo tienen (T176) y, si no, concedidos sin más (`grantCosmetic`). Para
 * probar Mi Barco, la cubierta y la estela sin jugar. Sólo donde una partida
 * de prueba puede pagar (`devStartRewards`: `pnpm dev` y las e2e); en la
 * versión de prueba nunca, tampoco con `?dev=1`: daría puntos y la mascota a
 * cualquiera.
 */
export const MASCOT_DEV_PARAM = 'mascota';
export const WAKE_DEV_PARAM = 'estela';

/** Lo que pide cada valor del atajo: el id del cosmético. */
const MASCOT_VALUES: Readonly<Record<string, string>> = {
  '1': MINIKRAKEN,
  minikraken: MINIKRAKEN,
  canoncito: CANONCITO,
  'tortuga-turbo': TORTUGA_TURBO,
};
const WAKE_VALUES: Readonly<Record<string, string>> = { vortice: ESTELA_VORTICE };

/** Los cosméticos que pide la URL (vacío si no pide ninguno o no se puede dar aquí). */
export function devCosmeticsWanted(env: DevEnv = devEnv()): string[] {
  if (!devStartRewards(env)) return [];
  const q = new URLSearchParams(env.search);
  const pick = (param: string, table: Readonly<Record<string, string>>) =>
    (q.get(param) ?? '')
      .split(',')
      .map((v) => table[v.trim()])
      .filter((id): id is string => !!id);
  return [...new Set([...pick(MASCOT_DEV_PARAM, MASCOT_VALUES), ...pick(WAKE_DEV_PARAM, WAKE_VALUES)])];
}

/** ¿Pide la URL alguna mascota o estela y se puede dar aquí? */
export function wantsDevMascot(env: DevEnv = devEnv()): boolean {
  return devCosmeticsWanted(env).length > 0;
}

/**
 * Da los cosméticos que pide el atajo; devuelve cuántos ha dado ahora (0 si
 * no pide ninguno, no se puede o ya eran tuyos). Con logro que lo regale, por
 * el logro (completado y reclamado); sin él, concedido sin más.
 */
export async function devGrantMascot(
  progress: ProgressApi,
  env: DevEnv = devEnv(),
): Promise<number> {
  const wanted = devCosmeticsWanted(env);
  if (wanted.length === 0) return 0;
  let given = 0;
  const shop = await progress.shop();
  const achievements = await progress.achievements();
  for (const id of wanted) {
    if (shop.find((i) => i.cosmetic.id === id)?.owned) continue;
    const giver = achievements.find((a) => a.definition.cosmeticKey === id);
    if (giver) {
      await progress.completeAchievement(giver.definition.id, { dev: true });
      if ((await progress.claimAchievement(giver.definition.id)).claimed) given++;
    } else if ((await progress.grantCosmetic(id, { sourceRef: 'dev:atajo' })).granted) given++;
  }
  return given;
}
