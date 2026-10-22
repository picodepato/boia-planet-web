import { describe, expect, it } from 'vitest';
import {
  closedThisVisit,
  hasInstalledRelatedApp,
  isMarkedInstalled,
  markInstalled,
  PWA_INSTALLED_KEY,
  FIRST_VISIT_DELAY_MS,
  elapsedSinceLoad,
  isDismissed,
  isIosSafari,
  promptDelay,
  promptKind,
  PWA_DISMISS_KEY,
  rememberClosedThisVisit,
  RETURN_VISIT_DELAY_MS,
  rememberDismiss,
  SW_PATH,
  swUrl,
} from './install';

/** Un `localStorage` en memoria. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const base = {
  closedThisVisit: false,
  standalone: false,
  webdriver: false,
  canPrompt: false,
  iosSafari: false,
};

describe('aviso «Instalar app» (lib/pwa/install.ts)', () => {
  it('cerrado una vez, queda recordado en el almacenamiento', () => {
    const s = memoryStorage();
    expect(isDismissed(s)).toBe(false);
    rememberDismiss(s);
    expect(isDismissed(s)).toBe(true);
    expect(s.getItem(PWA_DISMISS_KEY)).not.toBeNull();
    // Y con eso, las siguientes visitas esperan más, pero el aviso puede volver.
    expect(promptDelay(isDismissed(s))).toBe(RETURN_VISIT_DELAY_MS);
    expect(promptKind({ ...base, canPrompt: true })).toBe('android');
    expect(promptKind({ ...base, iosSafari: true })).toBe('ios');
  });

  it('otro valor en la clave no cuenta como cerrado', () => {
    const s = memoryStorage();
    s.setItem(PWA_DISMISS_KEY, 'quizá');
    expect(isDismissed(s)).toBe(false);
  });

  it('sin almacenamiento (o si falla) se trata como visita de vuelta', () => {
    expect(isDismissed(null)).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(isDismissed(broken)).toBe(true);
    expect(() =>
      rememberDismiss({
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    ).not.toThrow();
  });

  it('qué aviso toca', () => {
    expect(promptKind({ ...base, canPrompt: true })).toBe('android');
    expect(promptKind({ ...base, iosSafari: true })).toBe('ios');
    expect(promptKind(base)).toBeNull();
    // Ya instalada, o un robot de pruebas: nada.
    expect(promptKind({ ...base, canPrompt: true, standalone: true })).toBeNull();
    expect(promptKind({ ...base, iosSafari: true, webdriver: true })).toBeNull();
  });

  it('Safari de iPhone (y de iPad que dice ser Mac), no otros navegadores', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(IPAD_AS_MAC, 5)).toBe(true);
    expect(isIosSafari(IPAD_AS_MAC, 0)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME, 5)).toBe(false);
  });

  it('la URL del service worker lleva sus textos y apunta a public/sw.js', () => {
    const url = new URL(
      swUrl({ title: 'BOIA.PLANET', offline: 'Sin conexión & más' }),
      'https://x',
    );
    expect(url.pathname).toBe(SW_PATH);
    expect(url.searchParams.get('offline')).toBe('Sin conexión & más');
    expect(url.searchParams.get('title')).toBe('BOIA.PLANET');
  });
});

describe('espera del aviso', () => {
  it('primera visita 30 s, visita de vuelta 2 min', () => {
    expect(FIRST_VISIT_DELAY_MS).toBe(30_000);
    expect(RETURN_VISIT_DELAY_MS).toBe(120_000);
    expect(promptDelay(false)).toBe(FIRST_VISIT_DELAY_MS);
    expect(promptDelay(true)).toBe(RETURN_VISIT_DELAY_MS);
  });
  it('lo cerrado en esta visita no vuelve en la misma visita', () => {
    const s = memoryStorage();
    expect(closedThisVisit(s)).toBe(false);
    rememberClosedThisVisit(s);
    expect(closedThisVisit(s)).toBe(true);
    expect(promptKind({ ...base, closedThisVisit: true, canPrompt: true })).toBeNull();
    expect(promptKind({ ...base, closedThisVisit: true, iosSafari: true })).toBeNull();
    expect(closedThisVisit(null)).toBe(false);
  });
  it('cuenta desde el load, no desde que llega el trozo', () => {
    expect(elapsedSinceLoad(10_000, 12_100)).toBe(2_100);
    expect(elapsedSinceLoad(0, 30_000)).toBe(0);
    expect(elapsedSinceLoad(20_000, 5_000)).toBe(0);
  });
});

describe('app ya instalada', () => {
  it('marcar el dispositivo oculta el aviso en Android y en iPhone', () => {
    const s = memoryStorage();
    expect(isMarkedInstalled(s)).toBe(false);
    markInstalled(s);
    expect(isMarkedInstalled(s)).toBe(true);
    expect(s.getItem(PWA_INSTALLED_KEY)).not.toBeNull();
    const installed = isMarkedInstalled(s);
    expect(promptKind({ ...base, installed, canPrompt: true })).toBeNull();
    expect(promptKind({ ...base, installed, iosSafari: true })).toBeNull();
  });
  it('sin almacenamiento o si falla, no consta y no revienta', () => {
    expect(isMarkedInstalled(null)).toBe(false);
    expect(() => markInstalled(null)).not.toThrow();
    expect(() =>
      markInstalled({
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    ).not.toThrow();
  });
  it('standalone sigue ocultando el aviso', () => {
    expect(promptKind({ ...base, standalone: true, canPrompt: true })).toBeNull();
  });
  it('getInstalledRelatedApps: una app instalada cuenta; sin API o con fallo, no', async () => {
    expect(await hasInstalledRelatedApp({ getInstalledRelatedApps: async () => [{}] })).toBe(true);
    expect(await hasInstalledRelatedApp({ getInstalledRelatedApps: async () => [] })).toBe(false);
    expect(await hasInstalledRelatedApp({})).toBe(false);
    expect(
      await hasInstalledRelatedApp({
        getInstalledRelatedApps: async () => {
          throw new Error('x');
        },
      }),
    ).toBe(false);
  });
});
