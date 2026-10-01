'use client';

import type { Rect } from '@boia/engine/ui';
import { ClaimBadge, claimLabel } from '../logros/claim-badge';
import { useReadyCount } from '../logros/use-logros';
import { t } from '../i18n';

/**
 * Botones fijos del HUD: brújula y ancla del Menú de a bordo. Se colocan en
 * los rectángulos de `hudLayout` (nunca sobre la zona del joystick).
 */

const place = (r: Rect) => ({ left: r.x, top: r.y, width: r.w, height: r.h });

/**
 * Brújula (REQ-MUN-022): la aguja señala en pantalla el objetivo elegido o lo
 * más cercano sin explorar. Sin nada pendiente, la aguja se retira. Tocarla
 * abre el mapa para elegir otro objetivo.
 */
export function Compass({
  rect,
  angle,
  selected,
  onClick,
}: {
  rect: Rect;
  /** rad en pantalla (0 = derecha, horario), o null si no queda nada. */
  angle: number | null;
  selected: boolean;
  onClick: () => void;
}) {
  const deg = angle === null ? 0 : (angle * 180) / Math.PI + 90;
  return (
    <button
      type="button"
      data-testid="brujula"
      data-hud="brujula"
      data-angle={angle === null ? '' : angle.toFixed(3)}
      className={`juego-hud-button juego-compass${selected ? ' is-selected' : ''}`}
      style={place(rect)}
      onClick={onClick}
      aria-label={
        angle === null
          ? t('hud.compass.done')
          : selected
            ? t('hud.compass.target')
            : t('hud.compass.next')
      }
      title={t('juego.hudButtons.brujula')}
    >
      <svg viewBox="-16 -16 32 32" width="30" height="30" aria-hidden="true">
        <circle r="14" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
        {angle === null ? (
          <circle r="3" fill="#fff" />
        ) : (
          <g style={{ transform: `rotate(${deg}deg)`, transition: 'transform 250ms linear' }}>
            <path d="M0 -12 L5 2 L0 -1 L-5 2 Z" fill="#f26a1b" />
            <path d="M0 12 L4 2 L0 4 L-4 2 Z" fill="rgba(255,255,255,.6)" />
          </g>
        )}
      </svg>
    </button>
  );
}

/**
 * Ancla del Menú de a bordo. Con logros completados sin reclamar lleva su
 * número (T37); se reclaman en la sección «Logros».
 */
export function MenuAnchor({
  rect,
  pulse,
  open,
  onClick,
}: {
  rect: Rect;
  pulse: number;
  open: boolean;
  onClick: () => void;
}) {
  const ready = useReadyCount();
  return (
    <button
      key={pulse}
      type="button"
      data-testid="menu-ancla"
      data-hud="menu-ancla"
      className={`juego-hud-button juego-anchor${pulse ? ' juego-pulse-short' : ''}`}
      style={place(rect)}
      aria-label={claimLabel(t('menu.aria'), ready)}
      aria-expanded={open}
      aria-haspopup="dialog"
      title={claimLabel(t('menu.aria'), ready)}
      data-por-reclamar={ready}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v14M7 11h10M4 14c0 4 4 7 8 7s8-3 8-7" />
        </g>
      </svg>
      <ClaimBadge count={ready} testId="menu-ancla-contador" />
    </button>
  );
}
