/**
 * Los artistas que se dieron de alta con el enlace de artistas (plan 019
 * T217, decisión 10), para la lista de /artistas: su Carnet (apodo, foto o
 * avatar) y el enlace a su música que pusieron al crearlo.
 *
 * - Modo local (D-20): el Carnet de este navegador, si es de artista.
 * - Con cuentas: los Carnets marcados como artista, que la RLS deja leer a
 *   cualquiera (los ocultos por la moderación no llegan), con la ficha a la
 *   que el Admin los unió (plan 031 T295). Una base sin la migración
 *   20261008100200 (sin las columnas de música) los da sin música; sin la
 *   20261015100200, sin unir.
 * - En modo local no hay unión (no hay Admin de socios): cada Carnet sale
 *   aparte, como antes.
 */
import { type MusicLink, musicLinkSchema } from '@boia/contracts';
import type { BoiaRepository, CarnetView } from '@boia/store';
import { accountClient } from '../account/session';
import { neutralAvatar } from '../mundo/carnet/avatar';
import type { ArtistCarnet } from './entries';

/** Cuántos se leen como mucho del servidor. */
const SERVER_LIMIT = 300;

function avatarOf(key: string | null): ArtistCarnet['avatar'] {
  const a = neutralAvatar(key);
  return { glyph: a.glyph, bg: a.bg };
}

function musicOf(platform: unknown, url: unknown): MusicLink | null {
  const parsed = musicLinkSchema.safeParse({ platform, url });
  return parsed.success ? parsed.data : null;
}

/** El Carnet propio de artista (modo local o la copia de la cuenta). */
export function ownArtistCarnet(c: CarnetView | null): ArtistCarnet | null {
  if (!c?.isArtist) return null;
  return {
    userId: c.userId,
    nickname: c.nickname,
    avatarImage: c.avatarImage,
    avatar: avatarOf(c.avatarKey),
    music: c.musicLink ?? null,
  };
}

interface ServerArtistRow {
  user_id: string;
  nickname: string;
  avatar_key: string | null;
  avatar_image: string | null;
  music_platform?: string | null;
  music_url?: string | null;
  artist_profile_id?: string | null;
}

/**
 * Las columnas que se piden, de más a menos: con la ficha unida (plan 031
 * T295, migración 20261015100200), sólo con la música (T217, migración
 * 20261008100200) y lo básico. Una base sin una de esas migraciones da error
 * por la columna que no tiene: se repite con el siguiente nivel y el que va
 * se recuerda en sessionStorage, así las siguientes cargas de la sesión no
 * hacen la petición que falla.
 */
const BASE_COLUMNS = 'user_id, nickname, avatar_key, avatar_image';
const MUSIC_COLUMNS = `${BASE_COLUMNS}, music_platform, music_url`;
export const COLUMN_LEVELS = [`${MUSIC_COLUMNS}, artist_profile_id`, MUSIC_COLUMNS, BASE_COLUMNS];
const COLUMNS_KEY = 'boia.artists.columns';

/** El nivel de columnas que esta sesión ya sabe que va (0, el más completo, si no se sabe). */
export function readColumnLevel(): number {
  try {
    const v = Number(globalThis.sessionStorage?.getItem(COLUMNS_KEY) ?? '0');
    return Number.isInteger(v) && v >= 0 && v < COLUMN_LEVELS.length ? v : 0;
  } catch {
    return 0;
  }
}

export function writeColumnLevel(level: number): void {
  try {
    globalThis.sessionStorage?.setItem(COLUMNS_KEY, String(level));
  } catch {
    // Sin almacenamiento (privado, bloqueado): sólo se repite la petición.
  }
}

function profileIdOf(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

async function serverArtistCarnets(): Promise<ArtistCarnet[]> {
  const sb = await accountClient();
  if (!sb) return [];
  const query = (cols: string) =>
    sb.from('carnets').select(cols).eq('is_artist', true).limit(SERVER_LIMIT);
  try {
    let level = readColumnLevel();
    let res = await query(COLUMN_LEVELS[level]!);
    while (res.error && level < COLUMN_LEVELS.length - 1) {
      level += 1;
      res = await query(COLUMN_LEVELS[level]!);
    }
    if (res.error || !res.data) return [];
    writeColumnLevel(level);
    return (res.data as unknown as ServerArtistRow[]).map((r) => ({
      userId: r.user_id,
      nickname: r.nickname,
      avatarImage: r.avatar_image,
      avatar: avatarOf(r.avatar_key),
      music: musicOf(r.music_platform, r.music_url),
      artistProfileId: profileIdOf(r.artist_profile_id),
    }));
  } catch {
    return [];
  }
}

/** Los Carnets de artista para la lista, sin repetir. */
export async function readArtistCarnets(repo: BoiaRepository): Promise<ArtistCarnet[]> {
  const [mine, server] = await Promise.all([
    repo.carnet.mine().then(ownArtistCarnet, () => null),
    serverArtistCarnets(),
  ]);
  const out = new Map<string, ArtistCarnet>();
  for (const c of server) out.set(c.userId, c);
  // El propio, con la música que se acaba de poner aquí si el servidor aún no la tiene.
  if (mine) {
    const known = out.get(mine.userId);
    out.set(mine.userId, {
      ...mine,
      music: mine.music ?? known?.music ?? null,
      // La unión la decide el Admin en el servidor (plan 031 T295).
      artistProfileId: known?.artistProfileId ?? null,
    });
  }
  return [...out.values()];
}
