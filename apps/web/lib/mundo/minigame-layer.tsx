'use client';

import {
  type MinigameRewardSink,
  isMinigameId,
  layerMinigame,
  minigame,
  minigameSourceRef,
  mountMinigame,
} from '@boia/engine/minigames';
import { type Settings, browserStore, channelGain } from '@boia/engine/ui';
import type { ComposedWorld } from '@boia/world';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { emitSignal } from './achievements';
import { gameRepository } from './repo';
import { t } from '../i18n';

/**
 * Punto de montaje de los minijuegos (T23, rehechos en T60) en el mar (el
 * 3D de /mar y, mientras exista, el 2D). El juego vive en
 * `@boia/engine/minigames`, con su propia capa; aquí sólo:
 * - el panel de la isla Faro o Cañón al acercarse (evento `minigame` de
 *   INICIAR_MINIJUEGO), que explica la actividad y la abre con «Jugar»;
 * - la ruta de prueba `?minijuego=faro`, que la abre directamente;
 * - la capa a pantalla completa, que al salir deja el barco donde estaba.
 *
 * Los juegos de `inWorld` (el Cañón desde el plan 010) se juegan en el
 * propio mar: su panel los empieza con `onPlayInWorld` (o explica con
 * `blockedReason` por qué ahora no) y nunca se montan aquí, tampoco con
 * `?minijuego=`; el Cañón ya no tiene capa 2D (T119): sólo se monta aquí lo
 * que `layerMinigame` da (el Faro, que sigue igual).
 */

export const MINIGAME_PARAM = 'minijuego';

/**
 * El libro de los premios, con la señal del logro al ganar: el motor sólo
 * pide el premio de una partida ganada y válida (REQ-AVE-038), así que cada
 * petición es una victoria de ese juego, aunque el premio de hoy ya se diera.
 */
export function withWinSignal(
  sink: MinigameRewardSink | null,
  gameId: string,
  onWin: (gameId: string) => void,
): MinigameRewardSink | null {
  if (!sink) return null;
  const ref = isMinigameId(gameId) ? minigameSourceRef(gameId) : null;
  return {
    grantWorldReward: async (input) => {
      const r = await sink.grantWorldReward(input);
      if (ref && input.sourceRef === ref) onWin(gameId);
      return r;
    },
  };
}

export interface MinigameOffer {
  objectId: string;
  gameId: string;
}

function clearParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(MINIGAME_PARAM)) return;
  url.searchParams.delete(MINIGAME_PARAM);
  window.history.replaceState(window.history.state, '', url.href);
}

/** Lo que el panel dice de un juego que se juega en el mar (título y resumen). */
export interface InWorldCopy {
  title: string;
  summary: string;
  /** Una etiqueta junto al título (el «BETA» del Cañón, T118) y su nombre accesible. */
  badge?: string;
  badgeLabel?: string;
}

export function MinigameLayer({
  offer,
  onDismiss,
  world,
  settings,
  sink,
  inWorld = [],
  onPlayInWorld,
  blockedReason,
  copy,
  extra,
}: {
  offer: MinigameOffer | null;
  onDismiss: () => void;
  world: ComposedWorld;
  settings: Settings;
  /** El libro del repositorio local (`repo.progress`). */
  sink: () => MinigameRewardSink | null;
  /** Juegos que se juegan en el mar 3D, no en esta capa. */
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
  const [open, setOpen] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  // La capa lee siempre lo último sin volver a montarse.
  const latest = useRef({ world, settings, sink });
  latest.current = { world, settings, sink };

  const inWorldRef = useRef(inWorld);
  inWorldRef.current = inWorld;

  // Ruta de prueba: ?minijuego=faro (los juegos del mar tienen su atajo en el mar).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get(MINIGAME_PARAM);
    if (id && layerMinigame(id) && !inWorldRef.current.includes(id)) setOpen(id);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!open || !host || !layerMinigame(open)) return;
    const { world: w, settings: s, sink: getSink } = latest.current;
    const mounted = mountMinigame(host, {
      gameId: open,
      worldId: w.id,
      theme: w.theme,
      sink: withWinSignal(getSink(), open, (game) => {
        void emitSignal(gameRepository(), { trigger: 'win_minigame', game });
      }),
      records: browserStore(),
      volume: channelGain(s.sfx),
      onExit: () => {
        clearParam();
        setOpen(null);
      },
    });
    return () => mounted.destroy();
  }, [open]);

  const def = offer && !open ? minigame(offer.gameId) : null;
  const here = def ? inWorld.includes(def.id) : false;
  const text = def && here ? (copy?.(def.id) ?? null) : null;
  const title = text?.title ?? def?.title ?? '';
  const blocked = def && here ? (blockedReason?.(def.id) ?? null) : null;
  return (
    <>
      {def ? (
        <section
          className="juego-panel"
          data-testid="panel-minijuego"
          data-game={def.id}
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
          <h2>
            {title}
            {text?.badge ? (
              <>
                {' '}
                <span
                  className="juego-panel-badge"
                  data-testid="panel-minijuego-beta"
                  title={text.badgeLabel}
                >
                  {text.badge}
                </span>
              </>
            ) : null}
          </h2>
          <p>{text?.summary ?? def.summary}</p>
          {blocked ? (
            <p className="juego-panel-bloqueo" data-testid="panel-minijuego-bloqueo" role="status">
              {blocked}
            </p>
          ) : null}
          {here ? (extra?.(def.id) ?? null) : null}
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
              if (here) {
                onDismiss();
                onPlayInWorld?.(def.id);
                return;
              }
              if (!layerMinigame(def.id)) return;
              setOpen(def.id);
              onDismiss();
            }}
          >
            {t('juego.minigameLayer.jugar')}
          </button>
        </section>
      ) : null}
      <div ref={hostRef} data-testid="minijuego-capa" />
    </>
  );
}
