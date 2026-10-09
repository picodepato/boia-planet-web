'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { setMusicEnabledForRadio } from '../bridge';
import { MUSIC_SETTINGS_KEY, readMusicOn } from '../music-setting';
import { RadioButton } from './radio-button';
import { RadioToastView } from './radio-toast';
import { RadioWindow } from './radio-window';
import { useRadio } from './use-radio';
import './radio.css';
import './radio-window.css';

/**
 * Hasta dónde se ve el botón de arriba a la derecha (pantallas de scroll):
 * mientras se ve el hero, hasta que el velo negro de la presentación lo tapa.
 * = `PRESENTATION.beats` (lo comprueba radio-mount.test.ts); a mano para que
 * este trozo no comparta módulos con el de la landing (cada módulo compartido
 * es otro trozo en la tabla del runtime, que sí cuenta en la ruta crítica).
 */
export const HERO_BUTTON_UNTIL = 0.42;

/** El 🔊 de la cabecera de la landing (`sound-toggle.tsx`). */
const SOUND_TOGGLE = '[data-testid="cabecera-sonido"]';

/**
 * La radio en una página (plan 022 T247): sus botones, el reproductor y el
 * aviso de la canción. Todo el módulo llega perezoso (un `import()` desde la
 * landing, en reposo o al primer gesto, y desde `/mar`), así que el
 * reproductor no pesa en la ruta crítica. En la landing: el botón de arriba a la
 * derecha mientras se ve el hero y, al bajar, junto a «Entradas» en la
 * cabecera (un portal a un hueco que se abre delante del botón). En `/mar`:
 * el botón del HUD. La música vive en `radioPlayer()`, fuera de React.
 */
export function RadioMount({
  surface,
  onEnableMusic,
}: {
  surface: 'landing' | 'mar';
  /** `/mar`: enciende «Música» en sus Ajustes cuando la radio va a sonar. */
  onEnableMusic?: () => void;
}) {
  const [state, player] = useRadio();

  useEffect(() => {
    if (!player || !onEnableMusic) return;
    player.setEnableMusic(onEnableMusic);
    return () => player.setEnableMusic(undefined);
  }, [player, onEnableMusic]);
  const [onHero, setOnHero] = useState(surface === 'landing');
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  // El catálogo, en reposo (o al primer toque, desde `start()`); y dónde va
  // la música, guardado al salir de la página.
  useEffect(() => {
    if (!player) return;
    const warm = () => void player.catalog().catch(() => undefined);
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(warm, { timeout: 8000 })
      : window.setTimeout(warm, 3000);
    const onHide = () => player.saveNow();
    window.addEventListener('pagehide', onHide);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
      window.removeEventListener('pagehide', onHide);
    };
  }, [player]);

  // Landing: el 🔊 de la cabecera (música y efectos) manda también en la
  // radio. Se sabe por su `aria-pressed` (y por `storage`, desde otra
  // pestaña), sin importar `sound-pref.ts` aquí: ver `HERO_BUTTON_UNTIL`.
  useEffect(() => {
    if (surface !== 'landing') return;
    const sync = () => setMusicEnabledForRadio(readMusicOn());
    sync();
    const observer = new MutationObserver(sync);
    for (const el of document.querySelectorAll(SOUND_TOGGLE)) {
      observer.observe(el, { attributes: true, attributeFilter: ['aria-pressed'] });
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === MUSIC_SETTINGS_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
    };
  }, [surface]);

  // Landing: el botón de arriba se va al bajar; vuelve junto a «Entradas».
  useEffect(() => {
    if (surface !== 'landing') return;
    const onScroll = () => setOnHero(window.scrollY < window.innerHeight * HERO_BUTTON_UNTIL);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [surface]);

  useEffect(() => {
    if (surface !== 'landing') return;
    const tickets = document.querySelector<HTMLElement>('[data-tickets-open="header"]');
    if (!tickets?.parentElement) return;
    const slot = document.createElement('span');
    slot.className = 'radio-slot';
    tickets.parentElement.insertBefore(slot, tickets);
    setHeaderSlot(slot);
    return () => {
      slot.remove();
      setHeaderSlot(null);
    };
  }, [surface]);

  const close = useCallback(() => player?.close(), [player]);
  const dismiss = useCallback((key: number) => player?.dismissToast(key), [player]);
  if (!player) return null;

  const openOrClose = () => (state.open ? player.close() : player.open());

  return (
    <>
      {surface === 'landing' ? (
        <RadioButton
          variant="hero"
          state={state}
          className={onHero ? '' : 'is-away'}
          onClick={() => void player.tapButton()}
        />
      ) : null}
      {surface === 'landing' && headerSlot
        ? createPortal(
            <RadioButton variant="header" state={state} onClick={openOrClose} />,
            headerSlot,
          )
        : null}
      {surface === 'mar' ? <RadioButton variant="mar" state={state} onClick={openOrClose} /> : null}
      {state.open ? <RadioWindow onClose={close} /> : null}
      <RadioToastView
        toast={state.open ? null : state.toast}
        onDone={dismiss}
        onOpen={() => player.open()}
      />
    </>
  );
}
