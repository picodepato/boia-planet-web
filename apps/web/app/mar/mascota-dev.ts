import { MINIKRAKEN, type ProgressApi } from '@boia/store';
import { type DevEnv, devEnv, devStartRewards } from './survivors';

/**
 * Atajo de desarrollo de la mascota (plan 013 T154): `/mar?mascota=1` da el
 * minikraken como si se hubiera vencido al Kraken (completa y reclama el
 * logro que lo regala, `canon-kraken`), para probar Mi Barco y la cubierta
 * sin jugar el Cañón. Sólo donde una partida de prueba puede pagar
 * (`devStartRewards`: `pnpm dev` y las e2e); en la versión de prueba nunca,
 * tampoco con `?dev=1`: daría puntos y la mascota a cualquiera.
 */
export const MASCOT_DEV_PARAM = 'mascota';

/** ¿Pide la URL la mascota y se puede dar aquí? */
export function wantsDevMascot(env: DevEnv = devEnv()): boolean {
  return (
    devStartRewards(env) && new URLSearchParams(env.search).get(MASCOT_DEV_PARAM) === '1'
  );
}

/**
 * Da la mascota por su logro si el atajo lo pide; true si la ha dado ahora.
 * Si ya es tuya, nada.
 */
export async function devGrantMascot(
  progress: ProgressApi,
  env: DevEnv = devEnv(),
): Promise<boolean> {
  if (!wantsDevMascot(env)) return false;
  const owned = (await progress.shop()).find((i) => i.cosmetic.id === MINIKRAKEN)?.owned;
  if (owned) return false;
  const giver = (await progress.achievements()).find(
    (a) => a.definition.cosmeticKey === MINIKRAKEN,
  );
  if (!giver) return false;
  await progress.completeAchievement(giver.definition.id, { dev: true });
  const claimed = await progress.claimAchievement(giver.definition.id);
  return claimed.claimed;
}
