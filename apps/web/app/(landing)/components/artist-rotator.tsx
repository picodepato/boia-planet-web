'use client';

import type { Artist } from '@boia/contracts/content';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  type ArtistCarnet,
  type ArtistEntry,
  carnetArtistEntry,
  contentArtistEntry,
} from '../../../lib/artists/entries';
import { useLiveRepo } from '../../../lib/landing/use-live-home';
import { trioAt } from '../../../lib/landing/rotation';
import { ArtistCard } from './artist-card';

const NO_CARNETS: readonly ArtistCarnet[] = [];

/**
 * Los Carnets de artista (plan 019 T217) para la banda (plan 020 T227,
 * decisión 4): llegan del repositorio cuando el navegador está libre, con
 * `import()`, así `registered.ts` (zod, la cuenta) no entra en la ruta
 * crítica de la landing (D-26).
 */
function useArtistCarnets(): readonly ArtistCarnet[] {
  const { view } = useLiveRepo<readonly ArtistCarnet[]>(NO_CARNETS, async (repo) => {
    const { readArtistCarnets } = await import('../../../lib/artists/registered');
    return readArtistCarnets(repo);
  });
  return view;
}

/**
 * Los artistas de la banda, en el orden de la rotación: los del contenido (ya
 * barajados) y, detrás, los que se dieron de alta con su Carnet de artista.
 * Cada uno con la imagen de su Carnet (decisión 4).
 */
export function rotationEntries(
  artists: readonly Artist[],
  carnets: readonly ArtistCarnet[],
): ArtistEntry[] {
  return [...artists.map(contentArtistEntry), ...carnets.map(carnetArtistEntry)];
}

/**
 * Tres artistas que rotan cada `rotationMs` (REQ-COM-026). Se pausa con hover,
 * con foco dentro y con la pestaña oculta; con movimiento reducido no rota.
 * Debajo, «Ver todos los artistas» lleva a /artistas (plan 020 T227, decisión
 * 4: sustituye a «Pausar rotación»). El servidor pinta el primer trío: sin
 * JavaScript se queda fijo.
 */
export function ArtistRotator({
  artists,
  rotationMs,
  labels,
  allHref,
}: {
  artists: readonly Artist[];
  rotationMs: number;
  labels: { all: string; genres: string };
  /** La lista completa (/artistas). */
  allHref: string;
}) {
  const carnets = useArtistCarnets();
  const entries = rotationEntries(artists, carnets);
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);

  // With reduced motion nothing autoplays (T77 §9, T81).
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setReduced(true);
  }, []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const running = !hovered && !focused && !reduced && !hidden && entries.length > 3;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setStep((s) => s + 1), rotationMs);
    return () => window.clearInterval(id);
  }, [running, rotationMs]);

  const trio = trioAt(entries.length, step).map((i) => entries[i]!);

  return (
    <div
      className="artist-rotator"
      data-rotating={running ? 'true' : 'false'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <ul className="artist-trio" data-testid="artist-trio">
        {trio.map((artist) => (
          <li
            key={`${step}-${artist.key}`}
            className={
              step > 0 ? 'artist-trio__item artist-trio__item--enter' : 'artist-trio__item'
            }
          >
            <ArtistCard artist={artist} genresLabel={labels.genres} />
          </li>
        ))}
      </ul>
      <Link
        className="button button--ghost artist-rotator__all"
        href={allHref}
        prefetch={false}
        data-testid="artistas-ver-todos"
      >
        {labels.all}
      </Link>
    </div>
  );
}
