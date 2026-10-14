import { ICON_PALETTE } from './mundo/menu/icons';

/**
 * La moneda del juego (T280): un SVG pequeño hecho en código, en lugar del
 * emoji de la moneda (U+1FA99), que en Windows 10 (Unicode 13) sale como una caja vacía. Va en
 * línea con el texto (mide 1em) junto al número de monedas: en los saldos del
 * mar, el premio de un logro y la tienda. Donde el texto va suelto (avisos,
 * etiquetas, `aria-label`) se dice «monedas» con la palabra.
 *
 * Sin `label` es decorativo (`aria-hidden`); con `label`, se lee con ese nombre.
 */
export function CoinIcon({ label }: { label?: string }) {
  return (
    <svg
      className="boia-coin"
      data-boia-coin=""
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      style={{ display: 'inline-block', verticalAlign: '-0.14em', flex: 'none' }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
    >
      <circle cx="8" cy="8" r="7" fill={ICON_PALETTE.sun} stroke={COIN_EDGE} strokeWidth="1.6" />
      <circle cx="8" cy="8" r="4.2" fill="none" stroke={COIN_EDGE} strokeWidth="1.2" />
      <path d="M5.2 4.6a4.4 4.4 0 0 1 3-1.5" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** El borde de la moneda: el sol del juego, tostado. */
const COIN_EDGE = '#b97800';
