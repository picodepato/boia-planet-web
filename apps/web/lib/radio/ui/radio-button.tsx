'use client';

import type { RadioState } from '../player';
import { t } from './t';

/** Un altavoz con dos ondas, dibujado aquí (nada de fuera), en `currentColor`. */
export function RadioIcon({ playing = false }: { playing?: boolean }) {
  return (
    <svg
      className="radio-icon"
      data-playing={playing || undefined}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" fill="currentColor" stroke="none" />
      <path className="radio-icon__wave" d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8" />
      <path className="radio-icon__wave radio-icon__wave--far" d="M12.6 3.6a6.4 6.4 0 0 1 0 8.8" />
    </svg>
  );
}

export type RadioButtonVariant = 'hero' | 'header' | 'mar';

/**
 * El botón de la radio (plan 022 T247). Tres sitios: arriba a la derecha de
 * la landing (`hero`: el primer toque enciende la música, los siguientes
 * abren el reproductor), junto a «Entradas» en la cabecera (`header`: brilla
 * y abre el reproductor) y el HUD de `/mar` (`mar`).
 */
export function RadioButton({
  variant,
  state,
  onClick,
  className = '',
}: {
  variant: RadioButtonVariant;
  state: RadioState;
  onClick: () => void;
  className?: string;
}) {
  const playing = state.status === 'playing' || state.status === 'loading';
  const started = state.song !== null;
  const label =
    variant === 'hero'
      ? started
        ? t('radio.boton.sonando')
        : t('radio.boton.poner')
      : state.open
        ? t('radio.boton.cerrar')
        : t('radio.boton.abrir');
  const text = variant === 'mar' ? t('radio.boton.radio') : t('radio.boton.musica');
  return (
    <button
      type="button"
      className={`radio-btn radio-btn--${variant} ${className}`.trim()}
      data-testid={`radio-boton-${variant}`}
      data-playing={playing || undefined}
      aria-label={label}
      aria-pressed={variant === 'hero' ? playing : undefined}
      aria-expanded={variant === 'hero' ? undefined : state.open}
      aria-haspopup="dialog"
      title={label}
      onClick={onClick}
    >
      <RadioIcon playing={playing} />
      <span className="radio-btn__label">{text}</span>
    </button>
  );
}
