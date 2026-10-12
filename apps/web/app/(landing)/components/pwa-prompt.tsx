'use client';

import { useEffect, useState } from 'react';
import { clearInstallPrompt, installPrompt, onInstallPrompt } from '../../../lib/pwa/capture';
import {
  isDismissed,
  isIosSafari,
  PROMPT_DELAY_MS,
  promptKind,
  rememberDismiss,
  swUrl,
  type PromptKind,
} from '../../../lib/pwa/install';
import { t } from '../../../lib/pwa/t';
import { t as tWeb } from '../../../lib/i18n/web';

/**
 * «Instalar app» (plan 027 T264), el trozo perezoso de `pwa-lazy.tsx`:
 * registra el service worker (`public/sw.js`, sólo en producción) y, pasado un
 * rato, enseña un aviso discreto abajo a la izquierda: con el botón del
 * navegador en Android/Chrome, o la pista «Compartir → Añadir a pantalla de
 * inicio» en Safari de iPhone (ésa, una sola vez). Cerrado, no vuelve
 * (`localStorage`, `lib/pwa/install.ts`).
 *
 * Aspecto: la tarjeta es un botón de recreativa más (borde negro, sombra dura,
 * como los de la web) y sube desde abajo meciéndose como una boia al salir a
 * flote, una sola vez; sin movimiento si el sistema lo pide. Los estilos van
 * aquí, en línea, para que no entren en la hoja de la landing.
 */
export function PwaPrompt() {
  const [kind, setKind] = useState<PromptKind>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(swUrl({ title: tWeb('site.title'), offline: t('pwa.offline') }), { scope: '/' })
        .catch((err: unknown) => console.warn('[boia] no se registró el service worker', err));
    }
  }, []);

  useEffect(() => {
    let ready = false;
    const decide = () => {
      if (!ready) return;
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const next = promptKind({
        dismissed: isDismissed(storage()),
        standalone,
        webdriver: navigator.webdriver === true,
        canPrompt: installPrompt() !== null,
        iosSafari: isIosSafari(navigator.userAgent, navigator.maxTouchPoints),
      });
      // La pista de iPhone sale una vez: vista, cuenta como cerrada.
      if (next === 'ios') rememberDismiss(storage());
      setKind(next);
    };
    const timer = window.setTimeout(() => {
      ready = true;
      decide();
    }, PROMPT_DELAY_MS);
    const off = onInstallPrompt(decide);
    return () => {
      window.clearTimeout(timer);
      off();
    };
  }, []);

  if (!kind) return null;

  const close = () => {
    rememberDismiss(storage());
    setKind(null);
  };
  const install = async () => {
    const ev = installPrompt();
    if (!ev) return close();
    clearInstallPrompt();
    await ev.prompt().catch(() => undefined);
    // Instalada o no, el aviso ya cumplió: no vuelve.
    close();
  };

  return (
    <aside className="pwa-card" aria-label={t('pwa.prompt.label')}>
      <style>{CSS}</style>
      {/* eslint-disable-next-line @next/next/no-img-element -- icono pequeño de public/, sin optimizar */}
      <img className="pwa-card__icon" src="/icons/icon-192.png" alt="" width={52} height={52} />
      <div className="pwa-card__body">
        <p className="pwa-card__title">{t('pwa.prompt.title')}</p>
        {kind === 'android' ? (
          <>
            <p className="pwa-card__text">{t('pwa.prompt.android.text')}</p>
            <div className="pwa-card__actions">
              <button type="button" className="pwa-card__install" onClick={() => void install()}>
                {t('pwa.prompt.android.install')}
              </button>
              <button type="button" className="pwa-card__later" onClick={close}>
                {t('pwa.prompt.dismiss')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="pwa-card__text">
              <ShareIcon />
              {t('pwa.prompt.ios.text')}
            </p>
            <div className="pwa-card__actions">
              <button type="button" className="pwa-card__later" onClick={close}>
                {t('pwa.prompt.ios.ok')}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** El icono «Compartir» de Safari: un cuadro con una flecha hacia arriba. */
function ShareIcon() {
  return (
    <svg
      className="pwa-card__share"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H5.5v10.5h13V10H16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

const CSS = `
.pwa-card {
  position: fixed;
  left: max(16px, env(safe-area-inset-left));
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 40;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  max-width: 360px;
  padding: 14px 16px 14px 12px;
  background: var(--boia-white, #fff);
  color: var(--boia-black, #000);
  border: var(--btn-border, 2px solid #000);
  box-shadow: var(--btn-shadow, 4px 4px 0 #000);
  font-family: var(--font-body);
  animation: pwa-surface 0.9s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}
.pwa-card__icon {
  flex: none;
  width: 52px;
  height: 52px;
  transform: rotate(-8deg);
}
.pwa-card__body {
  min-width: 0;
}
.pwa-card__title {
  margin: 0 0 4px;
  font-family: var(--font-title);
  font-size: 17px;
  line-height: 1.15;
  color: var(--boia-blue, #36278a);
}
.pwa-card__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}
.pwa-card__share {
  display: inline-block;
  vertical-align: -3px;
  margin-right: 6px;
  color: var(--boia-blue, #36278a);
}
.pwa-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 12px;
}
.pwa-card__install {
  min-height: 44px;
  padding: 0 16px;
  border: var(--btn-border, 2px solid #000);
  box-shadow: var(--btn-shadow, 4px 4px 0 #000);
  background: var(--boia-orange, #ec4f24);
  color: var(--boia-black, #000);
  font-family: var(--font-button);
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.pwa-card__install:active {
  transform: translate(3px, 3px);
  box-shadow: var(--btn-shadow-pressed, 1px 1px 0 #000);
}
.pwa-card__later {
  min-height: 44px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: inherit;
  font-family: var(--font-button);
  font-size: 15px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.pwa-card button:focus-visible {
  outline: 3px solid var(--boia-blue, #36278a);
  outline-offset: 3px;
}
@keyframes pwa-surface {
  0% { transform: translateY(140%) rotate(-3deg); }
  55% { transform: translateY(-8px) rotate(1.5deg); }
  78% { transform: translateY(3px) rotate(-0.8deg); }
  100% { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .pwa-card { animation: none; }
  .pwa-card__install { transition: none; }
}
`;
