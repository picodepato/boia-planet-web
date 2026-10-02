import localFont from 'next/font/local';

/**
 * Tipografías de toda la web (plan 006 T74), el único sitio que las define.
 * Referencia de Álvaro: draaimolen.nu/story, Druk Wide Medium para títulos e
 * Inter para el texto.
 *
 * Títulos: Druk es comercial (Commercial Type), así que hasta que haya
 * licencia va Archivo en su anchura máxima (wdth 125, peso 700, la «Archivo
 * Expanded Bold»), SIL OFL (public/fonts/OFL-archivo.txt). Para pasar a Druk
 * Wide Medium se regenera `titulo-latin.woff2` con tools/fonts/subset.py y se
 * cambia la licencia (README, «Tipografías»); nada más en la web nombra la
 * fuente: el CSS usa `--font-title`.
 *
 * Texto: Inter variable (peso 400–900), SIL OFL (public/fonts/OFL-inter.txt).
 *
 * Ambas en subconjunto latino woff2 servidas desde la web. Sólo se precarga
 * la de títulos (el h1 de la primera vista; cuenta en el presupuesto de la
 * landing, scripts/landing-budget.mjs). Inter (33 kB) no cabe en él: entra con
 * `swap` sobre un respaldo del sistema con sus métricas ajustadas.
 */
export const fuenteTitulo = localFont({
  src: '../public/fonts/titulo-latin.woff2',
  weight: '700',
  display: 'swap',
  variable: '--font-display',
  fallback: ['Arial Black', 'Arial', 'system-ui', 'sans-serif'],
});

export const fuenteTexto = localFont({
  src: '../public/fonts/inter-latin.woff2',
  weight: '400 900',
  display: 'swap',
  preload: false,
  variable: '--font-text',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/** Las clases que declaran `--font-display` y `--font-text`; van en <html>. */
export const fuentesClassName = `${fuenteTitulo.variable} ${fuenteTexto.variable}`;
