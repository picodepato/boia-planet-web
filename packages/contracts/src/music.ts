import { z } from 'zod';

/**
 * El enlace a la música de un artista (plan 019 T217, decisión 10): uno, el
 * que prefiera, de Spotify, SoundCloud, Bandcamp o, en su defecto,
 * Instagram. Lo pone el propio artista al crear su Carnet (o el Admin en la
 * ficha). Es un enlace sin más: nada se carga de esas plataformas.
 */
export const MUSIC_PLATFORMS = ['spotify', 'soundcloud', 'bandcamp', 'instagram'] as const;
export type MusicPlatform = (typeof MUSIC_PLATFORMS)[number];

/** Lo más largo que se guarda (lo mismo que la columna `carnets.music_url`). */
export const MUSIC_URL_MAX = 300;

/** Los dominios de cada plataforma (con o sin subdominio: `alba.bandcamp.com`). */
const HOSTS: Record<MusicPlatform, readonly string[]> = {
  spotify: ['spotify.com', 'spotify.link'],
  soundcloud: ['soundcloud.com', 'on.soundcloud.com'],
  bandcamp: ['bandcamp.com'],
  instagram: ['instagram.com', 'instagr.am'],
};

const onHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * La plataforma de un enlace por su dominio, o null si no es https de una de
 * las cuatro. Acepta el enlace sin `https://` (lo que se copia de la app).
 */
export function musicPlatformOf(raw: string): MusicPlatform | null {
  const url = normalizeMusicUrl(raw);
  if (!url) return null;
  const host = new URL(url).hostname.toLowerCase();
  return MUSIC_PLATFORMS.find((p) => HOSTS[p].some((d) => onHost(host, d))) ?? null;
}

/** El enlace limpio (https, sin espacios), o null si no es una URL https. */
export function normalizeMusicUrl(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
    const out = url.toString();
    return out.length <= MUSIC_URL_MAX ? out : null;
  } catch {
    return null;
  }
}

/** El enlace guardado: la plataforma y su URL. */
export const musicLinkSchema = z.object({
  platform: z.enum(MUSIC_PLATFORMS),
  url: z
    .url()
    .max(MUSIC_URL_MAX)
    .refine((u) => u.startsWith('https://'), 'https'),
});
export type MusicLink = z.infer<typeof musicLinkSchema>;

/**
 * El enlace que escribe un artista, listo para guardar: su plataforma sale
 * del dominio. null si está vacío; `invalid` si no es de una de las cuatro.
 */
export function musicLinkFrom(raw: string): MusicLink | null | 'invalid' {
  if (!raw.trim()) return null;
  const url = normalizeMusicUrl(raw);
  const platform = url ? musicPlatformOf(url) : null;
  return url && platform ? { platform, url } : 'invalid';
}
