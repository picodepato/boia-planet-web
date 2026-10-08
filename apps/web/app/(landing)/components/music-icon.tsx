import type { MusicPlatform } from '@boia/contracts';

/**
 * El icono de cada plataforma del botón de música (plan 019 T217): dibujos
 * propios y sencillos en `currentColor`, a 16 px, sin cargar nada de fuera.
 */
const PATHS: Record<MusicPlatform, readonly string[]> = {
  // Un disco con tres ondas.
  spotify: [
    'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Z',
    'M4.2 6.1c2.6-.8 5.3-.5 7.6.8',
    'M4.6 8.4c2.1-.6 4.2-.4 6 .7',
    'M5 10.6c1.6-.4 3.1-.3 4.4.5',
  ],
  // Una nube con barras.
  soundcloud: [
    'M7 11.5h6a2.4 2.4 0 0 0 0-4.8 3.6 3.6 0 0 0-6-1.9v6.7Z',
    'M5 11.5V6.5',
    'M3 11.5V7.8',
    'M1 11.5V9',
  ],
  // El paralelogramo.
  bandcamp: ['M1 12 5.5 4H15l-4.5 8H1Z'],
  // La cámara.
  instagram: [
    'M2 2h12v12H2V2Z',
    'M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z',
    'M11.6 4.4h.01',
  ],
};

export function MusicIcon({ platform }: { platform: MusicPlatform }) {
  return (
    <svg
      className="music-icon"
      data-platform={platform}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[platform].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
