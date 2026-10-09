/**
 * Los artistas que se dieron de alta con el enlace de artistas (plan 019
 * T217, decisión 10), para la lista de /artistas: su Carnet (apodo, foto o
 * avatar) y el enlace a su música que pusieron al crearlo.
 *
 * - Modo local (D-20): el Carnet de este navegador, si es de artista.
 * - Con cuentas: los Carnets marcados como artista, que la RLS deja leer a
 *   cualquiera (los ocultos por la moderación no llegan). Una base sin la
 *   migración 20261008100200 (sin las columnas de música) los da sin música.
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
}

/**
 * ¿Tiene la base las columnas de la música (T217, migración 20261008100200)?
 * Se aprende una vez por sesión del navegador: la primera consulta las pide;
 * si la base dice que no existen, se repite sin ellas y se recuerda el
 * resultado en sessionStorage, así las siguientes cargas de la sesión no hacen
 * la petición que falla. `null` = aún no se sabe.
 */
const MUSIC_FLAG_KEY = 'boia.artists.music-columns';

export function readMusicFlag(): boolean | null {
  try {
    const v = globalThis.sessionStorage?.getItem(MUSIC_FLAG_KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

export function writeMusicFlag(has: boolean): void {
  try {
    globalThis.sessionStorage?.setItem(MUSIC_FLAG_KEY, has ? '1' : '0');
  } catch {
    // Sin almacenamiento (privado, bloqueado): sólo se repite la petición.
  }
}

async function serverArtistCarnets(): Promise<ArtistCarnet[]> {
  const sb = await accountClient();
  if (!sb) return [];
  const base = 'user_id, nickname, avatar_key, avatar_image';
  const music = ', music_platform, music_url';
  const query = (cols: string) =>
    sb.from('carnets').select(cols).eq('is_artist', true).limit(SERVER_LIMIT);
  try {
    const askMusic = readMusicFlag() !== false;
    let res = await query(askMusic ? base + music : base);
    if (askMusic && res.error) {
      // Sin la migración de la música la base da error por esas columnas: se
      // repite sin ellas y, si eso va, se recuerda para no volver a pedirlas.
      res = await query(base);
      if (!res.error) writeMusicFlag(false);
    } else if (askMusic && !res.error) {
      writeMusicFlag(true);
    }
    if (res.error || !res.data) return [];
    return (res.data as unknown as ServerArtistRow[]).map((r) => ({
      userId: r.user_id,
      nickname: r.nickname,
      avatarImage: r.avatar_image,
      avatar: avatarOf(r.avatar_key),
      music: musicOf(r.music_platform, r.music_url),
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
    out.set(mine.userId, { ...mine, music: mine.music ?? known?.music ?? null });
  }
  return [...out.values()];
}
