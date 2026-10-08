import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AnalyticsModule from './index';

/**
 * El interruptor de la analítica del Admin (plan 019 T223, decisión 17): con
 * la clave de PostHog puesta, sólo sale una petición si la analítica está
 * encendida.
 */

type Analytics = typeof AnalyticsModule;

async function load(): Promise<Analytics> {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_prueba');
  // Sin window al cargar: el módulo no lee el interruptor real del Admin.
  const mod = await import('./index');
  vi.stubGlobal('window', { location: { pathname: '/prueba' } });
  return mod;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('interruptor de la analítica', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('apagada en el Admin: no sale ninguna petición', async () => {
    const a = await load();
    a.setAnalyticsSwitchReader(async () => false);
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    // Queda sólo en la página, para depurar.
    expect((globalThis as { window?: Window }).window?.__boiaAnalytics).toHaveLength(1);
  });

  it('encendida: sale a PostHog', async () => {
    const a = await load();
    a.setAnalyticsSwitchReader(async () => true);
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/i\/v0\/e\/$/);
    expect(JSON.parse(init.body as string)).toMatchObject({
      api_key: 'phc_prueba',
      event: 'landing_view',
    });
  });

  it('si no se puede leer el interruptor, apagada; el Admin la cambia al momento', async () => {
    const a = await load();
    a.setAnalyticsSwitchReader(() => Promise.reject(new Error('sin red')));
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    a.setAnalyticsSwitch(true);
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    a.setAnalyticsSwitch(false);
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
