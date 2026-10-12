/**
 * El ofrecimiento de instalar de Chrome/Android (`beforeinstallprompt`, plan
 * 027 T264). Llega cuando quiere, a menudo antes de que cargue el aviso
 * perezoso, así que este módulo pequeño lo recoge en cuanto la página corre y
 * lo guarda para `pwa-prompt.tsx`. Cancela la mini barra del navegador: el
 * aviso propio es el único (y el menú del navegador sigue ofreciendo instalar).
 */

/** El evento de Chrome; no está en los tipos del DOM. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

let started = false;

/** Empieza a escuchar (una vez). */
export function captureInstallPrompt(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    for (const f of listeners) f();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    for (const f of listeners) f();
  });
}

/** El ofrecimiento guardado, si lo hay. */
export function installPrompt(): InstallPromptEvent | null {
  return deferred;
}

/** Avisa cuando llega (o se gasta) el ofrecimiento; devuelve cómo dejar de escuchar. */
export function onInstallPrompt(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Ya se usó: el navegador no deja llamar a `prompt()` dos veces. */
export function clearInstallPrompt(): void {
  deferred = null;
}
