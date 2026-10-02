'use client';

import { useEffect } from 'react';

/** Duración de la celebración de la entrega (ms). muestra */
export const CELEBRATION_MS = 4200;

const PIECES = 36;
const COLORS = ['#f26a1b', '#ffd23f', '#e43b30', '#3aa3c4', '#f4efe6', '#8fbf6a'];

/**
 * Celebración de la entrega de la Boia Fiestera (REQ-AVE-008): confeti por
 * encima del mar, sin tapar el juego ni recoger toques. Con movimiento
 * reducido, el confeti no cae (ver juego.css).
 */
export function Celebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, CELEBRATION_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <div className="juego-fiesta" data-testid="celebracion" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          className="juego-fiesta-pieza"
          style={{
            left: `${(i * 97) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 9) * 0.12}s`,
            animationDuration: `${2.4 + (i % 5) * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}
