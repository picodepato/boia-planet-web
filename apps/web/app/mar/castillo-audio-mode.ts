'use client';

import type { DefenseEndReason, DefenseEvent } from '@boia/engine/defense';
import { type Settings, channelGain } from '@boia/engine/ui';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanonAudioState } from './canon-audio';
import { soundPreferences } from './canon-sound-preferences';
import type { DefenseRun } from './castillo';
import type { CastleAudio } from './castillo-audio';

/** Mantiene el sintetizador vivo hasta salir de /mar, incluido el fundido final. */
export function useCastleAudio(
  runRef: RefObject<DefenseRun | null>,
  onSea?: (on: boolean) => void,
) {
  const audioRef = useRef<CastleAudio | null>(null);
  const loading = useRef(false);
  const generation = useRef(0);
  const paused = useRef(false);
  const settings = useRef<Settings | null>(null);
  const sea = useRef(onSea);
  sea.current = onSea;
  const [sound, setSound] = useState<CanonAudioState | null>(null);

  const applySettings = useCallback((audio: CastleAudio) => {
    const s = settings.current;
    if (s) audio.loop.setGlobal({ music: channelGain(s.music), sfx: channelGain(s.sfx) });
  }, []);

  const prepare = useCallback(() => {
    if (audioRef.current || loading.current || typeof window === 'undefined') return;
    loading.current = true;
    const at = generation.current;
    import('./castillo-audio')
      .then((m) => {
        if (at !== generation.current) return;
        const audio = m.createPageCastleAudio(soundPreferences(), (on) => sea.current?.(on));
        audioRef.current = audio;
        applySettings(audio);
        audio.loop.setPaused(paused.current);
        const run = runRef.current;
        if (run && !run.ended) audio.start(run.snapshot(), run.config);
        audio.loop.subscribe(() => setSound(audio.loop.state()));
        setSound(audio.loop.state());
      })
      .catch((err: unknown) => {
        if (at !== generation.current) return;
        console.warn('[boia] no se pudo cargar el sonido del castillo', err);
      })
      .finally(() => {
        if (at === generation.current) loading.current = false;
      });
  }, [applySettings, runRef]);

  const start = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const audio = audioRef.current;
    if (audio) audio.start(run.snapshot(), run.config);
    else {
      sea.current?.(false);
      prepare();
    }
  }, [prepare, runRef]);

  const events = useCallback(
    (events: readonly DefenseEvent[]) => {
      const audio = audioRef.current;
      audio?.events(events);
      const run = runRef.current;
      if (run) audio?.sync(run.snapshot());
    },
    [runRef],
  );

  const end = useCallback((reason: DefenseEndReason) => {
    if (audioRef.current) audioRef.current.end(reason);
    else sea.current?.(true);
  }, []);

  const sync = useCallback(() => {
    const run = runRef.current;
    if (run) audioRef.current?.sync(run.snapshot());
  }, [runRef]);

  const setPaused = useCallback((value: boolean) => {
    paused.current = value;
    audioRef.current?.loop.setPaused(value);
  }, []);

  const setAudioSettings = useCallback(
    (value: Settings | null) => {
      settings.current = value;
      if (audioRef.current) applySettings(audioRef.current);
    },
    [applySettings],
  );

  useEffect(
    () => () => {
      generation.current++;
      loading.current = false;
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  return useMemo(
    () => ({ prepare, start, events, end, sync, setPaused, setAudioSettings, sound }),
    [prepare, start, events, end, sync, setPaused, setAudioSettings, sound],
  );
}
