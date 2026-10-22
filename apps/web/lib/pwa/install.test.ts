import { describe, expect, it } from 'vitest';
import {
  isDismissed,
  isIosSafari,
  promptKind,
  PWA_DISMISS_KEY,
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
  dismissed: false,
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
    // Y con eso, no vuelve a salir ni en Android ni en iPhone.
    expect(promptKind({ ...base, dismissed: isDismissed(s), canPrompt: true })).toBeNull();
    expect(promptKind({ ...base, dismissed: isDismissed(s), iosSafari: true })).toBeNull();
  });

  it('otro valor en la clave no cuenta como cerrado', () => {
    const s = memoryStorage();
    s.setItem(PWA_DISMISS_KEY, 'quizá');
    expect(isDismissed(s)).toBe(false);
  });

  it('sin almacenamiento (o si falla) no molesta: se trata como cerrado', () => {
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
