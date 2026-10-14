/**
 * Las pistas de la boia de los secretos (plan 029 T274): una pista críptica por
 * secreto que el jugador aún no ha encontrado, elegida al azar entre las que
 * faltan; si ya están todos, una felicitación. Todo puro salvo la lectura del
 * progreso (`secretHintKey`). Los textos van por i18n (`es-mar-banter.ts`), `muestra`.
 */
import { AFTER_ACHIEVEMENT, type AchievementProgress, type ProgressApi } from '@boia/store';

/** La boia que da las pistas (`map.ts`, INFO_BOIES). */
export const SECRET_HINT_BUOY = 'boia-secretos';

/** Cada secreto de este plan con su pista (clave i18n). Sin spoilers: sólo un guiño. */
export const SECRET_HINT_KEYS: Readonly<Record<string, string>> = {
  'salto-mortal': 'mar.pista.salto',
  'gaviota-pillada': 'mar.pista.gaviota',
  'fiestera-bailando': 'mar.pista.fiesta',
  [AFTER_ACHIEVEMENT]: 'mar.pista.after',
};

/** La felicitación cuando ya no falta ningún secreto. */
export const SECRETS_ALL_FOUND_KEY = 'mar.pista.todas';

/** Los secretos con pista que faltan: activos y todavía en curso (no completados). */
export function missingSecrets(
  list: readonly Pick<AchievementProgress, 'state' | 'definition'>[],
): string[] {
  return list
    .filter(
      (a) =>
        a.state === 'in_progress' &&
        a.definition.active &&
        SECRET_HINT_KEYS[a.definition.id] !== undefined,
    )
    .map((a) => a.definition.id);
}

/** La clave de una pista al azar entre `missing`, o la felicitación si no falta ninguna. */
export function pickSecretHint(
  missing: readonly string[],
  rng: () => number = Math.random,
): string {
  const keys = missing.flatMap((id) => {
    const k = SECRET_HINT_KEYS[id];
    return k === undefined ? [] : [k];
  });
  if (keys.length === 0) return SECRETS_ALL_FOUND_KEY;
  const i = Math.min(keys.length - 1, Math.floor(rng() * keys.length));
  return keys[i]!;
}

/** La clave de la pista que toca ahora, leyendo el progreso del jugador. */
export async function secretHintKey(
  progress: ProgressApi,
  rng: () => number = Math.random,
): Promise<string> {
  return pickSecretHint(missingSecrets(await progress.achievements()), rng);
}
