'use client';

import type { Artist } from '@boia/contracts/content';
import { useEffect, useState } from 'react';
import { trioAt } from '../../../lib/landing/rotation';
import { ArtistCard } from './artist-card';

/**
 * Tres artistas que rotan cada `rotationMs` (REQ-COM-026). Se pausa con hover,
 * con foco dentro, con la pestaña oculta y con el botón de pausa (WCAG 2.2.2);
 * con movimiento reducido empieza en pausa.
 * El servidor pinta el primer trío: sin JavaScript se queda fijo.
 */
export function ArtistRotator({
  artists,
  rotationMs,
  labels,
}: {
  artists: readonly Artist[];
  rotationMs: number;
  labels: { pause: string; resume: string; genres: string };
}) {
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);

  // With reduced motion nothing autoplays (T77 §9, T81): the rotation starts
  // paused and the button resumes it.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPaused(true);
  }, []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const running = !hovered && !focused && !paused && !hidden && artists.length > 3;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setStep((s) => s + 1), rotationMs);
    return () => window.clearInterval(id);
  }, [running, rotationMs]);

  const trio = trioAt(artists.length, step).map((i) => artists[i]!);

  return (
    <div
      className="artist-rotator"
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
            key={`${step}-${artist.id}`}
            className={
              step > 0 ? 'artist-trio__item artist-trio__item--enter' : 'artist-trio__item'
            }
          >
            <ArtistCard artist={artist} genresLabel={labels.genres} />
          </li>
        ))}
      </ul>
      {artists.length > 3 && (
        <button
          type="button"
          className="button button--ghost artist-rotator__toggle"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? labels.resume : labels.pause}
        </button>
      )}
    </div>
  );
}
