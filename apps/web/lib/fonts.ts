import localFont from 'next/font/local';

/**
 * Tipografías de toda la web y del mundo (plan 019 T213, decisión 2 de la
 * reunión del 2026-10-08), el único sitio que las define. Tres fuentes de
 * videojuego de la lista de 1001freefonts que eligió Hernán (combinación 4):
 *
 * - Títulos (`--font-display` → `--font-title`): Upheaval, de Brian Kent
 *   (Ænigma Fonts). Freeware para uso personal y comercial; su licencia
 *   (public/fonts/LICENCIA-upheaval.txt) no deja alterar el archivo, así que
 *   va el TTF original sin subconjunto ni conversión. Es la única que se
 *   precarga (el primer título de la landing; cuenta en su presupuesto,
 *   scripts/landing-budget.mjs).
 * - Botones (`--font-btn` → `--font-button`): Press Start 2P, SIL OFL
 *   (public/fonts/OFL-press-start-2p.txt). Botones de la landing, del mundo y
 *   el menú de arriba.
 * - Texto (`--font-text` → `--font-body`): 8-bit Operator+, SIL OFL
 *   (public/fonts/OFL-8bit-operator-plus.txt), regular y negrita.
 *
 * Las dos OFL van en woff2 enteras (con nombre reservado, sin subconjunto);
 * las instala tools/fonts/subset.py. Las de un solo peso declaran todo el
 * rango para que el navegador no les fabrique una negrita borrosa: son de
 * píxel y ya son gruesas.
 */
export const fuenteTitulo = localFont({
  src: '../public/fonts/upheavtt.ttf',
  weight: '100 900',
  display: 'swap',
  variable: '--font-display',
  fallback: ['Arial Black', 'Arial', 'system-ui', 'sans-serif'],
});

export const fuenteBoton = localFont({
  src: '../public/fonts/press-start-2p.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-btn',
  fallback: ['Courier New', 'monospace'],
});

export const fuenteTexto = localFont({
  src: [
    { path: '../public/fonts/8bit-operator-plus-regular.woff2', weight: '400' },
    { path: '../public/fonts/8bit-operator-plus-bold.woff2', weight: '700' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-text',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/** Las clases que declaran `--font-display`, `--font-btn` y `--font-text`; van en <html>. */
export const fuentesClassName = `${fuenteTitulo.variable} ${fuenteBoton.variable} ${fuenteTexto.variable}`;
