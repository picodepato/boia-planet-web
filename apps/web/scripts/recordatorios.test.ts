import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyPlan,
  daysUntil,
  fetchOpenIssues,
  loadData,
  main,
  planReminders,
  thresholdFor,
  validateData,
  // @ts-expect-error: script de Node sin tipos
} from './recordatorios.mjs';

/**
 * Recordatorios de caducidades (plan 028 T266): qué issues abre o comenta
 * `recordatorios.mjs` según la fecha y los issues abiertos.
 */

const ROOT = path.resolve(__dirname, '../../..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

type Action = { type: string; id: string; number?: number; title?: string; body?: string };
type Issue = { number: number; body: string; comments: string[] };

const DATA = {
  avisos: [60, 30, 7],
  caducidades: [
    {
      id: 'dominio',
      que: 'Dominio `x.net`',
      fecha: '2027-10-12',
      rompe: 'La web se cae.',
      renovar: ['Pagar.', 'Comprobar.'],
    },
  ],
  mensuales: [] as unknown[],
};
const MENSUAL = {
  avisos: [60, 30, 7],
  caducidades: [],
  mensuales: [
    { id: 'hola', que: 'Enviar desde `hola@`', rompe: 'Caduca la clave.', hacer: ['Enviar.'] },
  ],
};

/** El día que queda a `days` días de la fecha del dominio. */
function dayBefore(days: number) {
  const ms = Date.parse(`${DATA.caducidades[0]!.fecha}T00:00:00Z`) - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const plan = (data: unknown, today: string, open: Issue[] = []) =>
  planReminders(data, today, open) as [Action, ...Action[]];

describe('thresholdFor y daysUntil', () => {
  it('cuenta días enteros en UTC', () => {
    expect(daysUntil('2027-10-12', '2027-10-12')).toBe(0);
    expect(daysUntil('2027-10-12', dayBefore(53))).toBe(53);
    expect(daysUntil('2027-10-12', dayBefore(-3))).toBe(-3);
  });

  it('elige el aviso más cercano alcanzado; fuera de plazo, null', () => {
    const [t60, t30, t7] = [60, 30, 7];
    expect(thresholdFor(t60 + 1, DATA.avisos)).toBeNull();
    expect(thresholdFor(t60, DATA.avisos)).toBe(t60);
    expect(thresholdFor(t30 + 1, DATA.avisos)).toBe(t60);
    expect(thresholdFor(t30, DATA.avisos)).toBe(t30);
    expect(thresholdFor(t7, DATA.avisos)).toBe(t7);
    expect(thresholdFor(-5, DATA.avisos)).toBe(t7);
  });
});

describe('planReminders: caducidades con fecha', () => {
  it('fuera de plazo (más de 60 días): nada', () => {
    expect(plan(DATA, dayBefore(61))).toEqual([]);
    expect(plan(DATA, dayBefore(400))).toEqual([]);
  });

  for (const aviso of DATA.avisos) {
    it(`a ${aviso} días sin issue abierto: abre uno con la marca del aviso`, () => {
      const [a] = plan(DATA, dayBefore(aviso));
      expect(a.type).toBe('open');
      expect(a.title).toContain(DATA.caducidades[0]!.fecha);
      expect(a.body).toContain('<!-- recordatorio:dominio -->');
      expect(a.body).toContain(`<!-- aviso:${aviso} -->`);
      expect(a.body).toContain('12 de octubre de 2027');
      expect(a.body).toContain('La web se cae.');
      expect(a.body).toContain('1. Pagar.\n2. Comprobar.');
    });
  }

  it('con su issue abierto y un aviso nuevo: comenta, no duplica', () => {
    const open = [
      { number: 4, body: '<!-- recordatorio:dominio -->\n<!-- aviso:60 -->', comments: [] },
    ];
    const actions = plan(DATA, dayBefore(30), open);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'comment', number: 4, id: 'dominio' });
    expect(actions[0].body).toContain('<!-- aviso:30 -->');
  });

  it('con el aviso ya dado (en el cuerpo o en un comentario): nada', () => {
    const body = '<!-- recordatorio:dominio -->\n<!-- aviso:60 -->';
    expect(plan(DATA, dayBefore(45), [{ number: 4, body, comments: [] }])[0].type).toBe('skip');
    const open = [{ number: 4, body, comments: ['<!-- aviso:30 -->\nAviso'] }];
    expect(plan(DATA, dayBefore(20), open)[0].type).toBe('skip');
    expect(plan(DATA, dayBefore(7), open)[0]).toMatchObject({ type: 'comment', number: 4 });
  });

  it('pasada la fecha sigue avisando y no cierra nada', () => {
    const actions = plan(DATA, dayBefore(-2));
    expect(actions[0].type).toBe('open');
    expect(actions[0].body).toContain('caducó hace 2 días');
    expect(actions.every((a) => ['open', 'comment', 'skip'].includes(a.type))).toBe(true);
  });

  it('un issue de otra cosa no cuenta', () => {
    const open = [
      { number: 9, body: '<!-- recordatorio:otra -->\n<!-- aviso:60 -->', comments: [] },
    ];
    expect(plan(DATA, dayBefore(50), open)[0].type).toBe('open');
  });
});

describe('planReminders: recordatorio mensual', () => {
  it('sin issue abierto: abre el del mes', () => {
    const [a] = plan(MENSUAL, '2026-10-12');
    expect(a.type).toBe('open');
    expect(a.title).toBe('Enviar desde hola@ (octubre de 2026)');
    expect(a.body).toContain('<!-- recordatorio:hola -->');
    expect(a.body).toContain('<!-- mes:2026-10 -->');
  });

  it('el del mes anterior sigue abierto: comenta en él', () => {
    const open = [
      { number: 7, body: '<!-- recordatorio:hola -->\n<!-- mes:2026-10 -->', comments: [] },
    ];
    const [a] = plan(MENSUAL, '2026-11-02', open);
    expect(a).toMatchObject({ type: 'comment', number: 7 });
    expect(a.body).toContain('<!-- mes:2026-11 -->');
    expect(a.body).toContain('noviembre de 2026');
  });

  it('ya abierto o comentado este mes: nada (se puede correr varias veces)', () => {
    const body = '<!-- recordatorio:hola -->\n<!-- mes:2026-10 -->';
    expect(plan(MENSUAL, '2026-10-20', [{ number: 7, body, comments: [] }])[0].type).toBe('skip');
    const comments = ['<!-- mes:2026-11 -->\nSigue'];
    expect(plan(MENSUAL, '2026-11-20', [{ number: 7, body, comments }])[0].type).toBe('skip');
  });
});

describe('caducidades.json', () => {
  const data = loadData();

  it('es válido: campos, fechas e ids', () => {
    expect(validateData(data)).toEqual([]);
    expect(validateData({ avisos: [], caducidades: [{ id: 'a', fecha: '2027-02-30' }] })).toEqual(
      expect.arrayContaining([
        'avisos: tienen que ser días enteros positivos',
        'caducidades/a: fecha no válida: 2027-02-30',
      ]),
    );
  });

  it('tiene el dominio, la clave de Brevo y el envío mensual desde hola@', () => {
    const ids = [...data.caducidades, ...data.mensuales].map((i: { id: string }) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(['dominio-boiaplanet', 'brevo-smtp-hola', 'enviar-desde-hola']),
    );
  });

  it('cada caducidad sale en la tabla de docs/DESPLIEGUE.md §8 con su fecha', () => {
    const doc = readFileSync(path.join(ROOT, 'docs', 'DESPLIEGUE.md'), 'utf8');
    const s8 = doc.slice(doc.indexOf('## 8. Cosas que caducan'));
    for (const item of data.caducidades) expect(s8).toContain(item.fecha);
    expect(s8).toContain('recordatorios.yml');
  });
});

describe('ejecución contra la API (fetch de mentira)', () => {
  function fakeApi(issues: unknown[], comments: Record<number, string[]> = {}) {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      const method = init.method ?? 'GET';
      calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
      const u = new URL(url);
      if (method === 'GET' && u.pathname.endsWith('/issues')) {
        return Response.json(u.searchParams.get('page') === '1' ? issues : []);
      }
      const m = u.pathname.match(/\/issues\/(\d+)\/comments$/);
      if (method === 'GET' && m)
        return Response.json((comments[Number(m[1])] ?? []).map((body) => ({ body })));
      if (method === 'POST') return Response.json({ number: 99 }, { status: 201 });
      return new Response('no', { status: 404 });
    });
    return { fetchImpl, calls };
  }

  it('lee sólo los issues con marca (sin PR) y sus comentarios', async () => {
    const { fetchImpl } = fakeApi(
      [
        { number: 1, body: '<!-- recordatorio:hola -->', comments: 1 },
        { number: 2, body: 'otro', comments: 0 },
        { number: 3, body: '<!-- recordatorio:x -->', comments: 0, pull_request: {} },
      ],
      { 1: ['<!-- mes:2026-11 -->'] },
    );
    const open = await fetchOpenIssues(fetchImpl, 't', 'o/r');
    expect(open).toEqual([
      { number: 1, body: '<!-- recordatorio:hola -->', comments: ['<!-- mes:2026-11 -->'] },
    ]);
  });

  it('abre y comenta con POST; las omitidas no llaman a nada', async () => {
    const { fetchImpl, calls } = fakeApi([]);
    const done = await applyPlan(
      [
        { type: 'open', id: 'a', title: 'T', body: 'B' },
        { type: 'comment', id: 'b', number: 5, body: 'C' },
        { type: 'skip', id: 'c', reason: 'r' },
      ],
      fetchImpl,
      't',
      'o/r',
    );
    expect(done).toEqual(['abierto #99 [a]', 'comentado #5 [b]']);
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      'POST /repos/o/r/issues',
      'POST /repos/o/r/issues/5/comments',
    ]);
    expect(calls.every((c) => c.method !== 'PATCH')).toBe(true);
  });

  it('--dry-run no escribe nada, aunque haya token', async () => {
    const { fetchImpl, calls } = fakeApi([]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await main(
      ['--dry-run', '--fecha', '2026-10-12'],
      { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' },
      fetchImpl,
    );
    log.mockRestore();
    expect(code).toBe(0);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('sin --dry-run y sin token: sale con 2', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main([], {}, vi.fn())).toBe(2);
    expect(await main(['--dry-run', '--fecha', 'mañana'], {}, vi.fn())).toBe(2);
    err.mockRestore();
  });
});

describe('flujos programados', () => {
  // Todos los que tienen `schedule:`: GitHub los desactiva a los 60 días.
  const files = readdirSync(WORKFLOWS).filter(
    (f) =>
      /\.ya?ml$/.test(f) && /^\s+schedule:/m.test(readFileSync(path.join(WORKFLOWS, f), 'utf8')),
  );

  it('hay flujos programados, recordatorios.yml entre ellos', () => {
    expect(files).toContain('recordatorios.yml');
    expect(files).toContain('supabase-keepalive.yml');
  });

  it('recordatorios.yml corre el script con permiso para issues', () => {
    const wf = readFileSync(path.join(WORKFLOWS, 'recordatorios.yml'), 'utf8');
    expect(wf).toContain('node apps/web/scripts/recordatorios.mjs');
    expect(wf).toMatch(/issues: write/);
    expect(wf).toContain('workflow_dispatch');
  });

  for (const f of files) {
    it(`${f} reactiva los flujos programados (60 días de inactividad)`, () => {
      const wf = readFileSync(path.join(WORKFLOWS, f), 'utf8');
      expect(wf).toMatch(/keepalive-workflows:\n\s+runs-on:/);
      expect(wf).toMatch(/permissions:\n\s+actions: write/);
      expect(wf).toContain('/enable');
    });
  }
});
