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

/** Primera visita (nada recordado en este dispositivo): espera tras el `load`. */
export const FIRST_VISIT_DELAY_MS = 30_000;

/** Visitas posteriores (ya se cerró alguna vez): espera, cada vez que se entra. */
export const RETURN_VISIT_DELAY_MS = 120_000;

/** Clave de `localStorage`: este dispositivo ya tiene la app instalada. */
export const PWA_INSTALLED_KEY = 'boia.pwa.instalada';

/** Clave de `sessionStorage`: el aviso ya se cerró (o se vio) en esta visita. */
export const PWA_VISIT_KEY = 'boia.pwa.visita';

/** La espera que toca: corta la primera vez, larga si ya se cerró antes. */
export function promptDelay(returning: boolean): number {
  return returning ? RETURN_VISIT_DELAY_MS : FIRST_VISIT_DELAY_MS;
}

/**
 * Tiempo ya pasado en la página al montar el trozo perezoso, contado desde el
 * `load` (`loadEnd` y `now`: ms desde el inicio de la navegación; sin `load`
 * aún, `loadEnd` ≤ 0, vale 0).
 */
export function elapsedSinceLoad(loadEnd: number, now: number): number {
  return loadEnd > 0 ? Math.max(0, now - loadEnd) : 0;
}

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

/** ¿Se marcó este dispositivo como «app ya instalada»? Sin almacenamiento, no. */
export function isMarkedInstalled(storage: ReadStore | null | undefined): boolean {
  try {
    return storage?.getItem(PWA_INSTALLED_KEY) === DISMISSED;
  } catch {
    return false;
  }
}

/** Marca el dispositivo como instalado: el aviso no vuelve a salir. */
export function markInstalled(storage: WriteStore | null | undefined): void {
  try {
    storage?.setItem(PWA_INSTALLED_KEY, DISMISSED);
  } catch {
    // Sin almacenamiento: queda la señal del navegador (evento, modo standalone).
  }
}

/**
 * ¿Chrome dice que la app ya está instalada? `getInstalledRelatedApps()` (si
 * existe) devuelve las apps relacionadas del manifiesto instaladas; basta una.
 */
export async function hasInstalledRelatedApp(nav: {
  getInstalledRelatedApps?: () => Promise<unknown[]>;
}): Promise<boolean> {
  try {
    if (typeof nav.getInstalledRelatedApps !== 'function') return false;
    return (await nav.getInstalledRelatedApps()).length > 0;
  } catch {
    return false;
  }
}

/** ¿Se cerró o se vio ya en esta visita? Sin almacenamiento, no consta. */
export function closedThisVisit(storage: ReadStore | null | undefined): boolean {
  try {
    return storage?.getItem(PWA_VISIT_KEY) === DISMISSED;
  } catch {
    return false;
  }
}

/** Recuerda que en esta visita ya no vuelve a salir. */
export function rememberClosedThisVisit(storage: WriteStore | null | undefined): void {
  try {
    storage?.setItem(PWA_VISIT_KEY, DISMISSED);
  } catch {
    // Sin almacenamiento de sesión: manda la memoria del componente.
  }
}

/**
 * ¿El visitante ya cerró (o vio) el aviso alguna vez en este dispositivo? Ya no
 * lo oculta para siempre: sólo pasa la espera de 30 s a 5 min. Sin
 * almacenamiento se trata como visita de vuelta.
 */
export function isDismissed(storage: ReadStore | null | undefined): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(PWA_DISMISS_KEY) === DISMISSED;
  } catch {
    return true;
  }
}

/** Recuerda que se cerró: las siguientes visitas esperan `RETURN_VISIT_DELAY_MS`. */
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
 * instalada, si ya se cerró en esta visita o si quien navega es un robot.
 */
export function promptKind(env: {
  closedThisVisit: boolean;
  installed?: boolean;
  standalone: boolean;
  webdriver: boolean;
  canPrompt: boolean;
  iosSafari: boolean;
}): PromptKind {
  if (env.closedThisVisit || env.installed || env.standalone || env.webdriver) return null;
  if (env.canPrompt) return 'android';
  if (env.iosSafari) return 'ios';
  return null;
}

/** URL de registro del service worker, con los textos de su página sin red. */
export function swUrl(texts: { title: string; offline: string }): string {
  const q = new URLSearchParams({ title: texts.title, offline: texts.offline });
  return `${SW_PATH}?${q.toString()}`;
}
