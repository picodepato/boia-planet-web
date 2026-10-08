import type { Artist } from '@boia/contracts';
import {
  type ArtistCarnet,
  carnetArtistEntry,
  contentArtistEntry,
} from '../../../lib/artists/entries';
import { t } from '../../../lib/landing/texts';
import { alphabeticalArtists } from '../../../lib/landing/resolve';
import { ArtistCard } from './artist-card';

/**
 * Lista completa de /artistas (T12; plan 019 T217, decisión 10): de la A a
 * la Z, cada artista con su imagen al lado, el nombre que abre su Carnet,
 * «Ver carnet» y su música. Los del contenido y los que se dieron de alta
 * con su Carnet de artista, juntos.
 */
export function ArtistsList({
  artists,
  carnets = [],
}: {
  artists: readonly Artist[];
  carnets?: readonly ArtistCarnet[];
}) {
  const sorted = alphabeticalArtists([
    ...artists.map(contentArtistEntry),
    ...carnets.map(carnetArtistEntry),
  ]);
  return (
    <>
      <h1 id="artistas-title" className="section__title">
        {t('artists.page.title')}
      </h1>
      <p className="section__lead">{t('artists.page.lead', { count: sorted.length })}</p>
      <ul
        className="artists-page__list"
        aria-label={t('artists.azLabel')}
        data-testid="artistas-lista"
      >
        {sorted.map((artist) => (
          <li key={artist.key} data-artist={artist.key}>
            <ArtistCard artist={artist} genresLabel={t('artists.genres')} />
          </li>
        ))}
      </ul>
    </>
  );
}
