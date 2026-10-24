import type { Photo } from '@boia/contracts';

/**
 * Ajustes de cada pieza de la Galería desde el Admin (plan 048 T329): si sale
 * en la portada, su puesto en el orden (el de la portada y el de la galería)
 * y si está borrada (oculta). Se guardan por id de pieza: con cuentas, en la
 * tabla `media_settings` de Supabase (migración 20261024100100); en la demo,
 * en este navegador. Sin ajuste, cada pieza se queda como la deja el código
 * (la portada por defecto de T328; lo subido, sólo en la galería).
 */

export interface MediaSetting {
  /** En portada (y en la galería); false, sólo en la galería; null o sin decir, lo del código. */
  onHome?: boolean | null;
  /** Puesto en el orden (0, 1, 2…); sin él, detrás de las ordenadas, en el orden del contenido. */
  sort?: number | null;
  /** Borrada: ni en la portada ni en la galería. */
  hidden?: boolean;
}

export type MediaSettings = ReadonlyMap<string, MediaSetting>;

export const NO_MEDIA_SETTINGS: MediaSettings = new Map();

/** Una fila de `media_settings` tal como la lee cualquiera. */
export interface MediaSettingRow {
  piece_id: string;
  on_home: boolean | null;
  sort: number | null;
  hidden: boolean;
}

/** Las columnas públicas de `media_settings` (quién y cuándo no se leen). */
export const MEDIA_SETTINGS_COLUMNS = 'piece_id, on_home, sort, hidden';

export function mediaSettingsFromRows(rows: readonly MediaSettingRow[]): MediaSettings {
  return new Map(
    rows.map((r) => [r.piece_id, { onHome: r.on_home, sort: r.sort, hidden: r.hidden }]),
  );
}

/**
 * Las piezas con los ajustes puestos: sin las borradas, en su orden (las
 * ordenadas primero; las demás detrás, en el orden en que llegan) y con
 * `selection` (portada) como diga el ajuste.
 */
export function applyMediaSettings<P extends Pick<Photo, 'id' | 'selection'>>(
  photos: readonly P[],
  settings: MediaSettings,
): P[] {
  if (settings.size === 0) return [...photos];
  const kept = photos
    .map((p, i) => ({ p, i, s: settings.get(p.id) }))
    .filter((x) => !x.s?.hidden);
  const rank = (s: MediaSetting | undefined) =>
    s?.sort === null || s?.sort === undefined ? Infinity : s.sort;
  kept.sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i);
  return kept.map(({ p, s }) =>
    s?.onHome === null || s?.onHome === undefined || s.onHome === p.selection
      ? p
      : { ...p, selection: s.onHome },
  );
}

/** El contenido con los ajustes puestos en sus piezas. */
export function withMediaSettings<C extends { photos: readonly Photo[] }>(
  content: C,
  settings: MediaSettings,
): C {
  if (settings.size === 0) return content;
  return { ...content, photos: applyMediaSettings(content.photos, settings) };
}

/** Los ids en el orden nuevo tras subir (-1) o bajar (+1) una pieza; igual si no se mueve. */
export function movePiece(ids: readonly string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next[from] = ids[to]!;
  next[to] = id;
  return next;
}

// ---------------------------------------------------------------------------
// La demo (sin Supabase): los ajustes viven en este navegador.

export const LOCAL_MEDIA_SETTINGS_KEY = 'boia-media-settings';

type LocalDoc = Record<string, MediaSetting>;

function readLocalDoc(): LocalDoc {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_MEDIA_SETTINGS_KEY);
    const doc: unknown = raw ? JSON.parse(raw) : null;
    return doc && typeof doc === 'object' && !Array.isArray(doc) ? (doc as LocalDoc) : {};
  } catch {
    return {};
  }
}

function writeLocalDoc(doc: LocalDoc): void {
  globalThis.localStorage?.setItem(LOCAL_MEDIA_SETTINGS_KEY, JSON.stringify(doc));
}

/** Los ajustes de la demo guardados en este navegador. */
export function readLocalMediaSettings(): MediaSettings {
  const doc = readLocalDoc();
  const out = new Map<string, MediaSetting>();
  for (const [id, s] of Object.entries(doc)) {
    if (!s || typeof s !== 'object') continue;
    out.set(id, {
      onHome: typeof s.onHome === 'boolean' ? s.onHome : null,
      sort: typeof s.sort === 'number' && Number.isFinite(s.sort) ? s.sort : null,
      hidden: s.hidden === true,
    });
  }
  return out;
}

/** Cambia el ajuste de una pieza en la demo. */
export function patchLocalMediaSetting(id: string, patch: MediaSetting): void {
  const doc = readLocalDoc();
  doc[id] = { ...doc[id], ...patch };
  writeLocalDoc(doc);
}

/** El orden entero en la demo: cada id, su puesto. */
export function setLocalMediaOrder(ids: readonly string[]): void {
  const doc = readLocalDoc();
  ids.forEach((id, sort) => {
    doc[id] = { ...doc[id], sort };
  });
  writeLocalDoc(doc);
}

/** Olvida los ajustes de la demo (restablecer la galería). */
export function clearLocalMediaSettings(): void {
  try {
    globalThis.localStorage?.removeItem(LOCAL_MEDIA_SETTINGS_KEY);
  } catch {
    // Sin almacenamiento: no había nada.
  }
}
