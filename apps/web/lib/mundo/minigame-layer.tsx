'use client';

import {
  type MinigameRewardSink,
  isMinigameId,
  minigame,
  minigameSourceRef,
  mountMinigame,
} from '@boia/engine/minigames';
import { type Settings, browserStore, channelGain } from '@boia/engine/ui';
import type { ComposedWorld } from '@boia/world';
import { useEffect, useRef, useState } from 'react';
import { emitSignal } from './achievements';
import { gameRepository } from './repo';
import { t } from '../i18n';

/**
 * Punto de montaje de los minijuegos (T23, rehechos en T60) en el mar (el
 * 3D de /mar y, mientras exista, el 2D). El juego vive en
 * `@boia/engine/minigames`, con su propia capa; aquí sólo:
 * - el panel de la isla Faro o Cañón al acercarse (evento `minigame` de
 *   INICIAR_MINIJUEGO), que explica la actividad y la abre con «Jugar»;
 * - la ruta de prueba `?minijuego=faro|canon`, que la abre directamente;
 * - la capa a pantalla completa, que al salir deja el barco donde estaba.
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

export function MinigameLayer({
  offer,
  onDismiss,
  world,
  settings,
  sink,
}: {
  offer: MinigameOffer | null;
  onDismiss: () => void;
  world: ComposedWorld;
  settings: Settings;
  /** El libro del repositorio local (`repo.progress`). */
  sink: () => MinigameRewardSink | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  // La capa lee siempre lo último sin volver a montarse.
  const latest = useRef({ world, settings, sink });
  latest.current = { world, settings, sink };

  // Ruta de prueba: ?minijuego=faro|canon.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get(MINIGAME_PARAM);
    if (isMinigameId(id)) setOpen(id);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!open || !host) return;
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
  return (
    <>
      {def ? (
        <section className="juego-panel" data-testid="panel-minijuego" aria-label={def.title}>
          <button
            type="button"
            className="juego-panel-close"
            onClick={onDismiss}
            aria-label={t('juego.minigameLayer.cerrar')}
          >
            ×
          </button>
          <p className="juego-panel-kicker">{t('minigame.kicker')}</p>
          <h2>{def.title}</h2>
          <p>{def.summary}</p>
          <button
            type="button"
            className="juego-panel-cta"
            style={{
              width: '100%',
              border: 0,
              font: 'inherit',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            onClick={() => {
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
