/**
 * La app instalable (plan 027 T264): qué aviso toca enseñar y si el visitante
 * ya lo cerró. Sin React ni DOM, para probarlo aparte (install.test.ts) y para
 * que lo cargue sin peso el trozo pequeño de la landing (`pwa-lazy.tsx`).
 */

/** Clave de `localStorage`: el aviso ya se cerró (o, en iPhone, ya se vio). */
export const PWA_DISMISS_KEY = 'boia.pwa.aviso';

/** Lo que guarda la clave; cualquier otro valor no cuenta. */
const DISMISSED = '1';

/** Ruta del service worker (`public/sw.js`). */
export const SW_PATH = '/sw.js';

/** Espera antes de enseñar el aviso: después de la entrada de la landing. */
export const PROMPT_DELAY_MS = 15_000;

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

/** ¿El visitante ya cerró el aviso? Sin almacenamiento, se trata como cerrado. */
export function isDismissed(storage: ReadStore | null | undefined): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(PWA_DISMISS_KEY) === DISMISSED;
  } catch {
    return true;
  }
}

/** Recuerda que se cerró: no vuelve a salir en este navegador. */
export function rememberDismiss(storage: WriteStore | null | undefined): void {
  try {
    storage?.setItem(PWA_DISMISS_KEY, DISMISSED);
  } catch {
    // Modo privado o almacenamiento lleno: se volverá a ver, sin más.
  }
}

/** Safari en iPhone o iPad (incluido el iPad que dice ser un Mac). */
export function isIosSafari(userAgent: string, maxTouchPoints = 0): boolean {
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!ios) return false;
  // Chrome, Firefox, Edge y otros en iOS no saben «Añadir a pantalla de inicio».
  return /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
}

export type PromptKind = 'android' | 'ios' | null;

/**
 * El aviso que toca: `android` si el navegador ofreció instalar
 * (`beforeinstallprompt`), `ios` en Safari de iPhone, y ninguno si ya está
 * instalada, si se cerró antes o si quien navega es un robot de pruebas.
 */
export function promptKind(env: {
  dismissed: boolean;
  standalone: boolean;
  webdriver: boolean;
  canPrompt: boolean;
  iosSafari: boolean;
}): PromptKind {
  if (env.dismissed || env.standalone || env.webdriver) return null;
  if (env.canPrompt) return 'android';
  if (env.iosSafari) return 'ios';
  return null;
}

/** URL de registro del service worker, con los textos de su página sin red. */
export function swUrl(texts: { title: string; offline: string }): string {
  const q = new URLSearchParams({ title: texts.title, offline: texts.offline });
  return `${SW_PATH}?${q.toString()}`;
}
