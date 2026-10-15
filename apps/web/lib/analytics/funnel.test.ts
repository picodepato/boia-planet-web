import { CLIENT_FUNNEL_EVENTS, FUNNEL_EVENTS } from '@boia/contracts/analytics';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import {
  FUNNEL_STEPS,
  FUNNEL_WINDOWS,
  type FunnelCountRow,
  funnelSummary,
  windowStart,
} from './funnel';
import {
  LOCAL_FUNNEL_DAYS,
  LOCAL_FUNNEL_KEY,
  addLocalFunnelStep,
  dayMinus,
  funnelDay,
  readLocalFunnelCounts,
} from './local-counts';

/**
 * Las cuentas del panel «Embudo» (plan 032 T301), los contadores del modo
 * local y la migración leída como texto (lo que esta máquina comprueba sin
 * PostgreSQL; contra la base, packages/db/src/supabase/funnel.supabase.ts).
 */

const TODAY = '2026-10-15';

describe('panel: por paso y % del anterior', () => {
  const rows: FunnelCountRow[] = [
    { day: TODAY, event: 'landing_view', count: 100 },
    { day: TODAY, event: 'explore_start', count: 40 },
    { day: TODAY, event: 'discount_found', count: 10 },
    { day: TODAY, event: 'tickets_panel_open', count: 0 },
    { day: TODAY, event: 'ticket_click_out', count: 3 },
    // Hace 6 días: dentro de los 7.
    { day: dayMinus(TODAY, 6), event: 'landing_view', count: 100 },
    // Hace 7 días: fuera de los 7, dentro de los 30.
    { day: dayMinus(TODAY, 7), event: 'landing_view', count: 50 },
    { day: dayMinus(TODAY, 7), event: 'explore_start', count: 20 },
    // Hace 30 días: fuera de las dos ventanas.
    { day: dayMinus(TODAY, 30), event: 'landing_view', count: 999 },
    // Mañana (reloj adelantado) y un nombre desconocido: no cuentan.
    { day: dayMinus(TODAY, -1), event: 'landing_view', count: 999 },
    { day: TODAY, event: 'otro', count: 999 },
  ];

  it('últimos 7 días, hoy incluido', () => {
    expect(funnelSummary(rows, TODAY, 7)).toEqual([
      { event: 'landing_view', count: 200, pctFromPrev: null },
      { event: 'explore_start', count: 40, pctFromPrev: 20 },
      { event: 'discount_found', count: 10, pctFromPrev: 25 },
      { event: 'tickets_panel_open', count: 0, pctFromPrev: 0 },
      // El anterior es 0: sin %.
      { event: 'ticket_click_out', count: 3, pctFromPrev: null },
    ]);
  });

  it('últimos 30 días', () => {
    const s = funnelSummary(rows, TODAY, 30);
    expect(s.map((x) => x.count)).toEqual([250, 60, 10, 0, 3]);
    expect(s.map((x) => x.pctFromPrev)).toEqual([null, 24, 17, 0, null]);
  });

  it('sin filas: todo a cero, sin %', () => {
    for (const s of funnelSummary([], TODAY, 7)) {
      expect(s.count).toBe(0);
      expect(s.pctFromPrev).toBeNull();
    }
  });

  it('las ventanas: 7 y 30 días, del primer día a hoy', () => {
    expect(FUNNEL_WINDOWS).toEqual([7, 30]);
    expect(windowStart(TODAY, 7)).toBe(dayMinus(TODAY, 6));
    expect(windowStart('2026-03-02', 7)).toBe('2026-02-24');
  });

  it('los pasos, en el orden del contrato; cada uno con su texto', () => {
    expect(FUNNEL_STEPS).toEqual(CLIENT_FUNNEL_EVENTS);
    for (const e of FUNNEL_STEPS) {
      expect(es[`admin.gestion.funnel.step.${e}` as keyof typeof es], e).toBeTruthy();
    }
  });
});

describe('modo local: los contadores de este navegador', () => {
  const storage = () => {
    const m = new Map<string, string>();
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };
  const at = (day: string) => new Date(`${day}T12:00:00Z`);

  it('suma por día y paso, y el panel lo lee', () => {
    const s = storage();
    expect(addLocalFunnelStep('landing_view', at(TODAY), s)).toBe(true);
    addLocalFunnelStep('landing_view', at(TODAY), s);
    addLocalFunnelStep('explore_start', at(TODAY), s);
    addLocalFunnelStep('landing_view', at(dayMinus(TODAY, 1)), s);
    const rows = readLocalFunnelCounts(s);
    expect(rows).toEqual(
      expect.arrayContaining([
        { day: TODAY, event: 'landing_view', count: 2 },
        { day: TODAY, event: 'explore_start', count: 1 },
        { day: dayMinus(TODAY, 1), event: 'landing_view', count: 1 },
      ]),
    );
    expect(funnelSummary(rows, TODAY, 7)[1]).toEqual({
      event: 'explore_start',
      count: 1,
      pctFromPrev: 33,
    });
  });

  it(`guarda sólo los últimos ${LOCAL_FUNNEL_DAYS} días; nada de identificadores`, () => {
    const s = storage();
    addLocalFunnelStep('landing_view', at(dayMinus(TODAY, LOCAL_FUNNEL_DAYS)), s);
    addLocalFunnelStep('landing_view', at(TODAY), s);
    expect(readLocalFunnelCounts(s).map((r) => r.day)).toEqual([TODAY]);
    expect(JSON.parse(s.m.get(LOCAL_FUNNEL_KEY)!)).toEqual({ [TODAY]: { landing_view: 1 } });
  });

  it('un paso desconocido, almacenamiento roto o sin almacenamiento: no suma', () => {
    const s = storage();
    expect(addLocalFunnelStep('otro' as never, at(TODAY), s)).toBe(false);
    expect(addLocalFunnelStep('landing_view', at(TODAY), null)).toBe(false);
    s.m.set(LOCAL_FUNNEL_KEY, 'no es json');
    expect(readLocalFunnelCounts(s)).toEqual([]);
    expect(addLocalFunnelStep('landing_view', at(TODAY), s)).toBe(true);
    expect(readLocalFunnelCounts(s)).toEqual([{ day: TODAY, event: 'landing_view', count: 1 }]);
  });

  it('el día es el de Alicante, no el UTC', () => {
    // 23:30 UTC del 15 de octubre (horario de verano, +2) = 16 en Alicante.
    expect(funnelDay(new Date('2026-10-15T23:30:00Z'))).toBe('2026-10-16');
    expect(funnelDay(new Date('2026-12-31T22:59:00Z'))).toBe('2026-12-31');
  });
});

describe('la migración (texto)', () => {
  const SQL = readFileSync(
    new URL('../../../../supabase/migrations/20261015101100_funnel_counts.sql', import.meta.url),
    'utf8',
  );
  const fn = (name: string) => {
    const start = SQL.indexOf(`create or replace function ${name}(`);
    expect(start, name).toBeGreaterThanOrEqual(0);
    return SQL.slice(start, SQL.indexOf('$$;', start));
  };

  it('funnel_hit acepta exactamente los pasos del navegador y mira el interruptor', () => {
    const body = fn('private.funnel_hit');
    const list = /if ev not in \(([^)]*)\)/.exec(body)![1]!;
    const names = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(names).toEqual([...CLIENT_FUNNEL_EVENTS]);
    expect(body).toContain("raise exception 'unknown_event'");
    expect(body).toContain('analytics_enabled');
    expect(body).toContain('security definer');
    expect(body).toContain("set search_path = ''");
    expect(body).toContain("'Europe/Madrid'");
  });

  it('leer, sólo un admin; sumar, también anon', () => {
    expect(fn('private.admin_funnel_counts')).toContain("perform private.require_staff('admin');");
    expect(SQL).toContain(
      'grant execute on function public.funnel_hit(text) to anon, authenticated;',
    );
    expect(SQL).toContain(
      'grant execute on function public.admin_funnel_counts(integer) to authenticated;',
    );
    expect(SQL).not.toMatch(/grant [^;]*admin_funnel_counts[^;]*anon/);
    expect(SQL).toContain(
      'revoke all on private.funnel_counts from public, anon, authenticated, service_role;',
    );
    // Ni ip, ni agente, ni ningún id de visitante: día, paso y cuántas.
    const table = SQL.slice(
      SQL.indexOf('create table'),
      SQL.indexOf(');', SQL.indexOf('create table')),
    );
    expect(table).not.toMatch(/\b(ip|user_agent|visitor|session|user_id)\b/);
  });
});

describe('REQ-ARQ-019: analítica del embudo sin terceros', () => {
  const SINK = readFileSync(new URL('./sink.ts', import.meta.url), 'utf8');

  it('REQ-ARQ-019: los pasos del navegador son todo el contrato menos purchase_confirmed', () => {
    expect(CLIENT_FUNNEL_EVENTS).toEqual(FUNNEL_EVENTS.filter((e) => e !== 'purchase_confirmed'));
    expect(CLIENT_FUNNEL_EVENTS).not.toContain('purchase_confirmed');
  });

  it('REQ-ARQ-019: cada paso sale sólo a la base propia (funnel_hit), sin PostHog ni otro host', () => {
    expect(SINK).toContain('/rest/v1/rpc/funnel_hit');
    expect(SINK).not.toMatch(/posthog/i);
    expect(SINK).not.toMatch(/https?:\/\//);
  });
});
