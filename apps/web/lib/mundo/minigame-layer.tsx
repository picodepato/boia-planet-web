'use client';

import { minigame } from '@boia/engine/minigames';
import type { ReactNode } from 'react';
import { t } from '../i18n';

/**
 * El panel de la isla de un minijuego (T23) en el mar 3D: al acercarse a la
 * isla (evento `minigame` de INICIAR_MINIJUEGO) explica la actividad y la
 * empieza con «Jugar». Todos los juegos se juegan en el propio mar: su
 * panel los empieza con `onPlayInWorld` (o explica con `blockedReason` por
 * qué ahora no). La capa 2D (el minijuego del faro, T60, y su ruta de
 * prueba `?minijuego=`) se quitó en el plan 014 (T157).
 *
 * Un juego que aún no está en el registro del motor (el Castillo hasta T162)
 * sale igual si `copy` lo conoce: su título, su resumen y, en
 * `blockedReason`, «Próximamente», con «Jugar» apagado.
 */

export interface MinigameOffer {
  objectId: string;
  gameId: string;
}

/** Lo que el panel dice de un juego que se juega en el mar (título y resumen). */
export interface InWorldCopy {
  title: string;
  summary: string;
}

export function MinigameLayer({
  offer,
  onDismiss,
  inWorld = [],
  onPlayInWorld,
  blockedReason,
  copy,
  extra,
}: {
  offer: MinigameOffer | null;
  onDismiss: () => void;
  /** Juegos que el panel puede empezar (todos se juegan en el mar 3D). */
  inWorld?: readonly string[];
  /** «Jugar» en el panel de un juego de `inWorld`. */
  onPlayInWorld?: (gameId: string) => void;
  /** Por qué no se puede empezar ahora (texto), o null. */
  blockedReason?: (gameId: string) => string | null;
  /** El título y el resumen de un juego de `inWorld`. */
  copy?: (gameId: string) => InWorldCopy | null;
  /** Algo junto a «Jugar» de un juego de `inWorld` (las dificultades del Cañón, T131). */
  extra?: (gameId: string) => ReactNode;
}) {
  const id = offer && inWorld.includes(offer.gameId) ? offer.gameId : null;
  const def = id ? minigame(id) : null;
  const text = id ? (copy?.(id) ?? null) : null;
  const title = text?.title ?? def?.title ?? '';
  const summary = text?.summary ?? def?.summary ?? '';
  if (!id || (!def && !text)) return null;
  const blocked = blockedReason?.(id) ?? null;
  return (
    <section
      className="juego-panel"
      data-testid="panel-minijuego"
      data-game={id}
      data-bloqueado={blocked ? 'si' : undefined}
      aria-label={title}
    >
      <button
        type="button"
        className="juego-panel-close"
        onClick={onDismiss}
        aria-label={t('juego.minigameLayer.cerrar')}
      >
        ×
      </button>
      <p className="juego-panel-kicker">{t('minigame.kicker')}</p>
      <h2>{title}</h2>
      <p>{summary}</p>
      {blocked ? (
        <p className="juego-panel-bloqueo" data-testid="panel-minijuego-bloqueo" role="status">
          {blocked}
        </p>
      ) : null}
      {extra?.(id) ?? null}
      <button
        type="button"
        className="juego-panel-cta"
        disabled={!!blocked}
        style={{
          width: '100%',
          border: 0,
          font: 'inherit',
          fontWeight: 800,
          cursor: blocked ? 'not-allowed' : 'pointer',
          opacity: blocked ? 0.5 : 1,
        }}
        onClick={() => {
          if (blocked) return;
          onDismiss();
          onPlayInWorld?.(id);
        }}
      >
        {t('juego.minigameLayer.jugar')}
      </button>
    </section>
  );
}
