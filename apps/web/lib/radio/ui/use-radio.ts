'use client';

import { useSyncExternalStore } from 'react';
import { type RadioPlayer, type RadioState, radioPlayer } from '../player';

const SERVER_STATE: RadioState = {
  status: 'idle',
  catalog: null,
  song: null,
  elapsed: 0,
  duration: 0,
  shuffle: true,
  repeat: 'all',
  volume: 0.8,
  open: false,
  genreId: null,
  toast: null,
  error: false,
};

const noop = () => () => {};
const serverSnapshot = () => SERVER_STATE;

/** El reproductor de la página y su estado, vivo (plan 022 T247). */
export function useRadio(): [RadioState, RadioPlayer | null] {
  const player = typeof window === 'undefined' ? null : radioPlayer();
  const state = useSyncExternalStore(
    player?.subscribe ?? noop,
    player?.getState ?? serverSnapshot,
    serverSnapshot,
  );
  return [state, player];
}
