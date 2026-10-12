import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

/**
 * El service worker que se publica (`public/sw.js`, plan 027 T264), cargado
 * tal cual en un contexto aparte con un `self` de mentira: nunca guarda nada y
 * sólo responde a las navegaciones, con la red primero.
 */
const SOURCE = readFileSync(join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://boiaplanet.net';

type Listener = (e: unknown) => void;

function loadSw(fetchImpl: (req: unknown) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const caches = { open: vi.fn(), match: vi.fn(), keys: vi.fn(), delete: vi.fn() };
  const self = {
    location: new URL(`${ORIGIN}/sw.js?title=BOIA.PLANET&offline=Sin%20red`),
    addEventListener: (type: string, f: Listener) => {
      listeners[type] = f;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    caches,
  };
  const fetch = vi.fn(fetchImpl);
  runInNewContext(SOURCE, { self, fetch, URL, URLSearchParams, Response, Promise, String });
  const api = (self as unknown as { __boiaSw: { route: (r: unknown, o: string) => string } })
    .__boiaSw;
  return { listeners, caches, fetch, api, self };
}

/** Un FetchEvent mínimo: guarda lo que se pase a `respondWith`. */
function fetchEvent(url: string, init: { mode?: string; method?: string } = {}) {
  const request = { url, mode: init.mode ?? 'cors', method: init.method ?? 'GET' };
  let responded: Promise<Response> | null = null;
  return {
    event: { request, respondWith: (p: Promise<Response>) => (responded = p) },
    responded: () => responded,
  };
}

describe('service worker (public/sw.js)', () => {
  it('sólo intercepta navegaciones GET del propio sitio; /api, Supabase y los recursos pasan', () => {
    const { api } = loadSw(() => Promise.resolve(new Response('ok')));
    const r = (url: string, mode = 'cors', method = 'GET') =>
      api.route({ url, mode, method }, ORIGIN);
    expect(r(`${ORIGIN}/`, 'navigate')).toBe('navigate');
    expect(r(`${ORIGIN}/eventos/all-day`, 'navigate')).toBe('navigate');
    expect(r(`${ORIGIN}/mar`, 'navigate')).toBe('navigate');
    // La API, aunque sea una navegación, nunca.
    expect(r(`${ORIGIN}/api/checkout`, 'navigate')).toBe('pass');
    expect(r(`${ORIGIN}/api/health`)).toBe('pass');
    // Supabase y otros orígenes.
    expect(r('https://abc.supabase.co/rest/v1/events')).toBe('pass');
    expect(r('https://abc.supabase.co/auth/v1/callback', 'navigate')).toBe('pass');
    // Scripts, modelos 3D, imágenes: los resuelve el navegador.
    expect(r(`${ORIGIN}/_next/static/chunks/app.js`)).toBe('pass');
    // La marca de versión (plan 027 T263) nunca pasa por el service worker.
    expect(r(`${ORIGIN}/version.json?t=1`)).toBe('pass');
    expect(r(`${ORIGIN}/art/mar/isla.glb`)).toBe('pass');
    // Lo que no es GET.
    expect(r(`${ORIGIN}/`, 'navigate', 'POST')).toBe('pass');
  });

  it('navegación: responde la red, sin guardar nada en caché', async () => {
    const page = new Response('<html>build nuevo</html>', { status: 200 });
    const { listeners, caches, fetch } = loadSw(() => Promise.resolve(page));
    const { event, responded } = fetchEvent(`${ORIGIN}/`, { mode: 'navigate' });
    listeners.fetch!(event);
    const res = await responded();
    expect(res).toBe(page);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(caches.open).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });

  it('sin red, la página mínima «sin conexión» (generada, 503, no-store)', async () => {
    const { listeners, caches } = loadSw(() => Promise.reject(new TypeError('offline')));
    const { event, responded } = fetchEvent(`${ORIGIN}/galeria`, { mode: 'navigate' });
    listeners.fetch!(event);
    const res = await responded()!;
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const html = await res.text();
    expect(html).toContain('Sin red');
    expect(html).toContain('BOIA.PLANET');
    expect(caches.match).not.toHaveBeenCalled();
  });

  it('API, Supabase y recursos: no llama a respondWith (ni a fetch)', () => {
    const { listeners, fetch } = loadSw(() => Promise.resolve(new Response('x')));
    for (const url of [
      `${ORIGIN}/api/checkout`,
      'https://abc.supabase.co/rest/v1/rpc/x',
      `${ORIGIN}/_next/static/chunks/main.js`,
      `${ORIGIN}/art/mar/isla.glb`,
    ]) {
      const { event, responded } = fetchEvent(url);
      listeners.fetch!(event);
      expect(responded()).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('el archivo no usa la Cache Storage ni precarga nada', () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/caches\s*\.|cache\.put|addAll\s*\(/);
    expect(code).not.toMatch(/importScripts/);
  });

  it('se activa enseguida: skipWaiting al instalar y clients.claim al activar', async () => {
    const { listeners, self } = loadSw(() => Promise.resolve(new Response('x')));
    listeners.install!({});
    expect(self.skipWaiting).toHaveBeenCalled();
    let waited: Promise<unknown> | null = null;
    listeners.activate!({ waitUntil: (p: Promise<unknown>) => (waited = p) });
    await waited;
    expect(self.clients.claim).toHaveBeenCalled();
  });
});
