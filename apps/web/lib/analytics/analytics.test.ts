import { CLIENT_FUNNEL_EVENTS, type ClientFunnelEvent } from '@boia/contracts/analytics';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AnalyticsModule from './index';

/**
 * Los contadores propios del embudo (plan 032 T301) desde el navegador:
 * cada paso sale como mucho una vez por visita, nada sale con la analítica
 * apagada en el Admin (plan 019 T223) y un nombre que no es un paso no se
 * apunta ni se manda.
 */

type Analytics = typeof AnalyticsModule;

/** Un `sessionStorage` de mentira: sobrevive a «recargar» (resetModules). */
function fakeStorage(): Storage {
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

let sent: ClientFunnelEvent[];
let switchOn: boolean;

/** Carga el módulo como una página nueva de la misma pestaña. */
async function load(): Promise<Analytics> {
  vi.resetModules();
  // Sin window al cargar: el arranque no manda nada antes de poner los dobles.
  vi.stubGlobal('window', undefined);
  const mod = await import('./index');
  mod.setAnalyticsSwitchReader(async () => switchOn);
  mod.setFunnelSender(async (e) => {
    sent.push(e);
    return true;
  });
  vi.stubGlobal('window', { location: { pathname: '/prueba' } });
  return mod;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('embudo: track()', () => {
  beforeEach(() => {
    sent = [];
    switchOn = true;
    vi.stubGlobal('sessionStorage', fakeStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cada paso sale una vez por visita, aunque se repita o se recargue la página', async () => {
    let a = await load();
    for (const e of CLIENT_FUNNEL_EVENTS) a.track(e, {} as never);
    a.track('landing_view', { intro: 'none' });
    a.track('ticket_click_out', { eventId: 'x', source: 'island' });
    await settle();
    expect(sent.sort()).toEqual([...CLIENT_FUNNEL_EVENTS].sort());

    // Otra página de la misma pestaña: ya contados.
    a = await load();
    a.track('landing_view', { intro: 'none' });
    a.track('discount_found', { discountId: 'dto' });
    await settle();
    expect(sent).toHaveLength(CLIENT_FUNNEL_EVENTS.length);
    // En la página quedan todos, para depurar.
    expect(window.__boiaAnalytics).toHaveLength(2);
  });

  it('una pestaña nueva es otra visita', async () => {
    const a = await load();
    a.track('explore_start', { source: 'hero' });
    await settle();
    vi.stubGlobal('sessionStorage', fakeStorage());
    const b = await load();
    b.track('explore_start', { source: 'hero' });
    await settle();
    expect(sent).toEqual(['explore_start', 'explore_start']);
  });

  it('apagada en el Admin: no sale nada, y no se manda más tarde', async () => {
    switchOn = false;
    const a = await load();
    a.track('landing_view', { intro: 'none' });
    a.track('explore_start', { source: 'intro' });
    await settle();
    expect(sent).toEqual([]);
    expect(window.__boiaAnalytics).toHaveLength(2);
    a.setAnalyticsSwitch(true);
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(sent).toEqual([]);
  });

  it('si no se puede leer el interruptor, apagada; el Admin la cambia al momento', async () => {
    const a = await load();
    a.setAnalyticsSwitchReader(() => Promise.reject(new Error('sin red')));
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(sent).toEqual([]);
    a.setAnalyticsSwitch(true);
    a.track('explore_start', { source: 'hero' });
    await settle();
    expect(sent).toEqual(['explore_start']);
    a.setAnalyticsSwitch(false);
    a.track('tickets_panel_open', { source: 'world' });
    await settle();
    expect(sent).toEqual(['explore_start']);
  });

  it('un nombre que no es un paso: ni se apunta ni se manda', async () => {
    const a = await load();
    for (const bad of ['purchase_confirmed', 'otro', '', 'LANDING_VIEW']) {
      a.track(bad as ClientFunnelEvent, {} as never);
    }
    await settle();
    expect(sent).toEqual([]);
    expect(window.__boiaAnalytics).toBeUndefined();
    expect(sessionStorage.getItem(a.VISIT_KEY)).toBeNull();
  });

  it('un paso que no llegó (la página navegó) sale al cargar la siguiente', async () => {
    const a = await load();
    a.setFunnelSender(async () => false);
    a.track('explore_start', { source: 'hero' });
    await settle();
    expect(sent).toEqual([]);

    // /mar: el módulo arranca y manda lo pendiente, una vez.
    vi.resetModules();
    const fresh = await import('./index');
    fresh.setAnalyticsSwitchReader(async () => true);
    fresh.setFunnelSender(async (e) => {
      sent.push(e);
      return true;
    });
    fresh.track('explore_start', { source: 'hero' });
    await settle();
    expect(sent).toEqual(['explore_start']);
  });

  it('sin almacenamiento (modo privado): una vez por página', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    const a = await load();
    a.track('landing_view', { intro: 'none' });
    a.track('landing_view', { intro: 'none' });
    await settle();
    expect(sent).toEqual(['landing_view']);
  });
});
