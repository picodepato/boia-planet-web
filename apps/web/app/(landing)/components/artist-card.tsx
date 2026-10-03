import type { Artist } from '@boia/contracts/content';
import { t } from '../../../lib/landing/texts';

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

export function ArtistCard({ artist, genresLabel }: { artist: Artist; genresLabel: string }) {
  return (
    <article className="artist-card">
      {artist.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- fotos del Admin, dominio aún sin fijar
        <img
          className="artist-card__photo"
          src={artist.photoUrl}
          alt=""
          width={96}
          height={96}
          loading="lazy"
        />
      ) : (
        <span className="artist-card__avatar" aria-hidden="true">
          {initials(artist.name)}
        </span>
      )}
      <h3 className="artist-card__name">{artist.name}</h3>
      <p className="artist-card__genres">
        <span className="visually-hidden">{genresLabel}: </span>
        {artist.genres.join(', ')}
      </p>
      {/* A plain link (plan 007 T79): no player, nothing loaded from Spotify. */}
      {artist.spotifyUrl ? (
        <a
          className="artist-card__spotify"
          href={artist.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('artist.spotify.aria', { name: artist.name })}
        >
          {t('artist.spotify')}
        </a>
      ) : null}
    </article>
  );
}
