import type { ArtistEntry } from '../../../lib/artists/entries';
import { t } from '../../../lib/landing/texts';
import { MusicIcon } from './music-icon';

/** Iniciales para el avatar neutro mientras no haya foto aprobada (REQ-COM-027). */
export function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  const letters =
    words.length > 1 ? [words[0]![0], words[1]![0]] : [...(words[0] ?? '?')].slice(0, 2);
  return letters.join('').toUpperCase();
}

/**
 * Un artista (plan 019 T217, decisión 10): su imagen al lado, el nombre que
 * abre su Carnet y dos botones, «Ver carnet» y su música (Spotify,
 * SoundCloud, Bandcamp o Instagram). La música es un enlace sin más (plan
 * 007 T79): nada se carga de la plataforma.
 */
export function ArtistCard({ artist, genresLabel }: { artist: ArtistEntry; genresLabel: string }) {
  const music = artist.music;
  return (
    <article className="artist-card">
      {artist.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- fotos del Admin o del Carnet
        <img
          className="artist-card__photo"
          src={artist.photoUrl}
          alt=""
          width={96}
          height={96}
          loading="lazy"
        />
      ) : (
        <span
          className="artist-card__avatar"
          aria-hidden="true"
          style={artist.avatar ? { background: artist.avatar.bg } : undefined}
        >
          {artist.avatar?.glyph ?? initials(artist.name)}
        </span>
      )}
      <h3 className="artist-card__name">
        <a href={artist.carnetHref} data-testid="artista-nombre">
          {artist.name}
        </a>
      </h3>
      {artist.genres.length > 0 ? (
        <p className="artist-card__genres">
          <span className="visually-hidden">{genresLabel}: </span>
          {artist.genres.join(', ')}
        </p>
      ) : null}
      <p className="artist-card__actions">
        <a
          className="artist-card__button artist-card__carnet"
          href={artist.carnetHref}
          aria-label={t('artist.carnet.aria', { name: artist.name })}
          data-testid="artista-carnet"
        >
          {t('artist.carnet')}
        </a>
        {music ? (
          <a
            className={`artist-card__button artist-card__music artist-card__music--${music.platform}`}
            href={music.url}
            target="_blank"
            rel="noopener noreferrer"
            data-platform={music.platform}
            data-testid="artista-musica"
            aria-label={t('artist.music.aria', {
              name: artist.name,
              platform: t(`artist.music.${music.platform}`),
            })}
          >
            <MusicIcon platform={music.platform} />
            {t(`artist.music.${music.platform}`)}
          </a>
        ) : null}
      </p>
    </article>
  );
}
