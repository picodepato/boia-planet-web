/**
 * Logros retirados (plan 014 T157): «Vigía del faro» (`faro`) salió con su
 * minijuego, la Vigilancia del faro. Quien lo tenía no lo conserva: la
 * migración v8 → v9 quita lo completado y su huella de victoria, y la copia
 * de una cuenta (Supabase) se limpia igual al hidratarla. Lo cobrado sigue
 * en el libro (es historia, como los débitos de las banderas de T167): sus
 * puntos y monedas se quedan, pero el logro no sale en el Carnet, las
 * insignias ni la lista de logros.
 */
export const RETIRED_ACHIEVEMENTS: ReadonlySet<string> = new Set(['faro']);

/** Huellas de victoria de los minijuegos retirados (`minijuego:<id>`). */
export const RETIRED_DISCOVERIES: ReadonlySet<string> = new Set(['minijuego:faro']);

export function isRetiredAchievement(id: string | null | undefined): boolean {
  return !!id && RETIRED_ACHIEVEMENTS.has(id);
}

/** Lo completado de un jugador sin los logros retirados. */
export function withoutRetiredAchievements<T>(achievements: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(achievements).filter(([id]) => !RETIRED_ACHIEVEMENTS.has(id)),
  );
}

/** Los descubrimientos de un jugador sin las huellas de los minijuegos retirados. */
export function withoutRetiredDiscoveries<T>(discoveries: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(discoveries).filter(([key]) => !RETIRED_DISCOVERIES.has(key)),
  );
}
