import type { WorldEvent } from '@boia/engine';
import {
  type AchievementDefinition,
  type BoiaRepository,
  MemoryStorage,
  createLocalRepository,
} from '@boia/store';
import type { Notice } from '@boia/engine/ui';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_READY_BODY,
  type AchievementSignal,
  TIME_PLAYED_TICK_S,
  WORLD_TRIGGER_ALIASES,
  achievementFacts,
  achievementGoal,
  emitSignal,
  onAchievementNotices,
  recordSignal,
  signalFromWorldEvent,
} from './achievements';

/**
 * Logros con el repositorio local de verdad (T21, T36; REQ-IDE-024…027,
 * D-22 punto 5): cada logro del catálogo (el aprobado, también los ocultos)
 * se completa una sola vez, cuando se cumple su condición y no antes, sin
 * tocar el libro; no vuelve tras recargar; y reclamarlo da su premio una vez.
 * Cada «visita» es un repositorio nuevo sobre el mismo almacenamiento.
 */

function browser() {
  const storage = new MemoryStorage();
  const clock = new Date('2026-09-29T18:00:00Z');
  return () => createLocalRepository({ storage, now: () => clock, watch: false });
}

const param = (d: AchievementDefinition, k: string) =>
  (d.triggerParams as Record<string, unknown>)[k];
const num = (v: unknown, fallback: number) => (typeof v === 'number' && v > 0 ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const times = <T>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

/** Un paso: lo que hace el juego y la señal que manda. */
type Step = (repo: BoiaRepository) => Promise<Notice[]>;
const signal =
  (s: AchievementSignal): Step =>
  (repo) =>
    recordSignal(repo, s);

/** Una compra de prueba de un evento (puesto a la venta) y su señal. */
const buy =
  (i: number): Step =>
  async (repo) => {
    const events = await repo.content.list('events');
    const ev = events[i % events.length]!;
    await repo.admin.upsert('events', { ...ev, state: 'on_sale' });
    await repo.purchases.confirmSandbox({ purchaseId: `compra-${i}`, eventId: ev.id });
    return recordSignal(repo, { trigger: 'buy_ticket', eventId: ev.id });
  };

/** Los pasos que cumplen la condición de un logro, en orden (el último la cumple). */
function stepsFor(d: AchievementDefinition): Step[] {
  const n = num(param(d, 'count'), 1);
  switch (d.trigger) {
    case 'find_buoy':
      return times(n, (i) => signal({ trigger: 'find_buoy', objectId: `boia-${i}` }));
    case 'visit_island':
      return times(n, (i) => signal({ trigger: 'visit_island', objectId: `isla-${i}` }));
    case 'collect_objects': {
      const category = str(param(d, 'category'), 'objeto');
      return times(n, (i) =>
        signal({ trigger: 'collect_objects', objectId: `${category}-${i}`, category }),
      );
    }
    case 'time_played': {
      const ticks = Math.ceil((num(param(d, 'minutes'), 1) * 60) / TIME_PLAYED_TICK_S);
      return times(ticks, () => signal({ trigger: 'time_played', seconds: TIME_PLAYED_TICK_S }));
    }
    case 'rescue_character':
    case 'deliver_character':
      return [signal({ trigger: d.trigger, character: str(param(d, 'character'), 'alguien') })];
    case 'complete_circuit': {
      const circuit = str(param(d, 'circuit'), 'circuito');
      const maxMs = num(param(d, 'maxMs'), 0);
      const via = typeof param(d, 'via') === 'string' ? [str(param(d, 'via'), '')] : [];
      // Una vuelta lenta por la ruta segura cumple «una vuelta»; las otras piden más.
      const slow = signal({ trigger: d.trigger, circuit, ms: 120_000, via: ['ruta-segura'] });
      if (maxMs > 0) return [slow, signal({ trigger: d.trigger, circuit, ms: maxMs, via: [] })];
      if (via.length > 0) return [slow, signal({ trigger: d.trigger, circuit, ms: 120_000, via })];
      return [slow];
    }
    case 'win_minigame': {
      const game = param(d, 'game');
      if (typeof game === 'string') return [signal({ trigger: d.trigger, game })];
      return times(n, (i) => signal({ trigger: 'win_minigame', game: `juego-${i}` }));
    }
    case 'complete_encounter':
      return [signal({ trigger: d.trigger, encounter: str(param(d, 'encounter'), 'encuentro') })];
    case 'read_bottle':
    case 'throw_bottle': {
      const trigger = d.trigger;
      return times(n, (i) => signal({ trigger, bottleId: `botella-${i}` }));
    }
    case 'create_carnet':
      return [signal({ trigger: d.trigger })];
    case 'answer_question':
      // De una en una: contestar la misma otra vez no cuenta doble.
      return times(n, (i) =>
        signal({ trigger: 'answer_question', questionIds: times(i + 1, (k) => `pregunta-${k}`) }),
      );
    case 'visit_world':
      return times(n, (i) => signal({ trigger: 'visit_world', worldId: `mundo-${i}` }));
    case 'buy_ticket':
      return times(n, (i) => buy(i));
  }
}

const defs = await createLocalRepository({ storage: null }).content.list('achievements');

describe('cada logro del catálogo se completa una vez y se reclama una vez', () => {
  it('el catálogo usa cada condición del contrato', () => {
    const triggers = new Set(defs.map((d) => d.trigger));
    for (const t of [
      'find_buoy',
      'visit_island',
      'buy_ticket',
      'time_played',
      'rescue_character',
      'deliver_character',
      'complete_circuit',
      'collect_objects',
      'win_minigame',
      'complete_encounter',
      'read_bottle',
      'throw_bottle',
      'create_carnet',
      'answer_question',
      'visit_world',
    ] as const) {
      expect(triggers, t).toContain(t);
    }
  });

  for (const d of defs) {
    it(`${d.id} (${d.trigger})`, async () => {
      const open = browser();
      const repo = open();
      const steps = stepsFor(d);
      const id = `logro:${d.id}`;
      const ids = (ns: Notice[]) => ns.map((n) => n.id);
      // Antes del último paso, no.
      for (const step of steps.slice(0, -1)) expect(ids(await step(repo))).not.toContain(id);
      const state = async (r: BoiaRepository) =>
        (await r.progress.achievements()).find((a) => a.definition.id === d.id)?.state;
      expect(await state(repo)).toBe('in_progress');
      const now = await steps.at(-1)!(repo);
      expect(now.filter((n) => n.id === id)).toHaveLength(1);
      expect(now.find((n) => n.id === id)).toMatchObject({
        kind: 'achievement',
        title: d.title,
        body: ACHIEVEMENT_READY_BODY,
      });
      // Completado: listo para reclamar, sin nada en el libro todavía.
      expect(await state(repo)).toBe('ready');
      const rows = async (r: BoiaRepository) =>
        (await r.progress.ledger()).filter(
          (e) => e.kind === 'achievement' && e.achievementId === d.id,
        );
      expect(await rows(repo)).toHaveLength(0);
      // Repetir el paso, en la misma visita o tras recargar, no lo vuelve a avisar.
      expect(ids(await steps.at(-1)!(repo))).not.toContain(id);
      const again = open();
      expect(ids(await steps.at(-1)!(again))).not.toContain(id);
      // Reclamar da el premio una vez.
      expect((await again.progress.claimAchievement(d.id)).claimed).toBe(true);
      expect((await again.progress.claimAchievement(d.id)).claimed).toBe(false);
      expect(await rows(again)).toHaveLength(1);
      expect(await state(again)).toBe('claimed');
    });
  }

  it('los puntos y monedas del logro llegan al reclamar, a saldos separados', async () => {
    const repo = browser()();
    const d = defs.find((x) => x.coins > 0 && x.trigger === 'rescue_character')!;
    const before = await repo.progress.balances();
    await stepsFor(d)[0]!(repo);
    expect(await repo.progress.balances()).toEqual(before);
    await repo.progress.claimAchievement(d.id);
    const after = await repo.progress.balances();
    expect(after.points - before.points).toBe(d.points);
    expect(after.coins - before.coins).toBe(d.coins);
  });

  it('la misma boia dos veces cuenta una', async () => {
    const repo = browser()();
    await recordSignal(repo, { trigger: 'find_buoy', objectId: 'a' });
    await recordSignal(repo, { trigger: 'find_buoy', objectId: 'a' });
    expect((await achievementFacts(repo.progress)).buoys).toBe(1);
  });

  it('una vuelta por la ruta segura no cumple el atajo, ni una lenta la vuelta rápida', async () => {
    const repo = browser()();
    const shortcut = defs.find((x) => typeof param(x, 'via') === 'string')!;
    const fast = defs.find((x) => typeof param(x, 'maxMs') === 'number')!;
    const circuit = str(param(fast, 'circuit'), '');
    const maxMs = num(param(fast, 'maxMs'), 1);
    await recordSignal(repo, {
      trigger: 'complete_circuit',
      circuit,
      ms: maxMs + 1,
      via: ['otra-rama'],
    });
    const facts = await achievementFacts(repo.progress);
    expect(achievementGoal(shortcut, facts)).toMatchObject({ have: 0, need: 1, done: false });
    expect(achievementGoal(fast, facts)).toMatchObject({
      have: maxMs + 1,
      need: maxMs,
      unit: 'ms',
      done: false,
    });
  });
});

describe('progreso lleva/pide de cada logro con escalones', () => {
  const tiered = defs.filter(
    (d) => num(param(d, 'count'), 1) > 1 || num(param(d, 'minutes'), 1) > 1,
  );

  it('hay logros con escalones en el catálogo', () => {
    expect(tiered.length).toBeGreaterThan(0);
  });

  for (const d of tiered) {
    it(`${d.id}: sube de uno en uno hasta la meta`, async () => {
      const repo = browser()();
      const steps = stepsFor(d);
      const minutes = d.trigger === 'time_played';
      const need = minutes ? num(param(d, 'minutes'), 1) : num(param(d, 'count'), 1);
      expect(achievementGoal(d, await achievementFacts(repo.progress))).toMatchObject({
        have: 0,
        need,
        unit: minutes ? 'minutos' : 'veces',
        done: false,
      });
      for (const [i, step] of steps.entries()) {
        await step(repo);
        const done = i === steps.length - 1;
        const have = minutes ? Math.floor(((i + 1) * TIME_PLAYED_TICK_S) / 60) : i + 1;
        expect(achievementGoal(d, await achievementFacts(repo.progress)), `paso ${i + 1}`).toEqual({
          have,
          need,
          unit: minutes ? 'minutos' : 'veces',
          done,
        });
      }
    });
  }
});

describe('señales sueltas', () => {
  it('emitSignal guarda y reparte los avisos a quien escucha', async () => {
    const repo = browser()();
    const d = defs.find((x) => x.trigger === 'create_carnet')!;
    const heard: Notice[] = [];
    const off = onAchievementNotices((ns) => heard.push(...ns));
    await emitSignal(repo, { trigger: 'create_carnet' });
    await emitSignal(repo, { trigger: 'create_carnet' });
    off();
    expect(heard.map((n) => n.id)).toEqual([`logro:${d.id}`]);
  });
});

describe('del mundo a las señales', () => {
  const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
  const achievementsOf = world.objects.flatMap((o) =>
    o.behaviors.flatMap((b) =>
      b.type === 'achievement' ? [{ o, trigger: b.params.trigger }] : [],
    ),
  );

  it('cada disparador del mapa es del catálogo (o tiene alias)', () => {
    const catalog = new Set(defs.map((d) => d.trigger as string));
    for (const { o, trigger } of achievementsOf) {
      expect(catalog, `${o.identity.id}: ${trigger}`).toContain(
        WORLD_TRIGGER_ALIASES[trigger] ?? trigger,
      );
    }
  });

  it('las islas del mapa llegan para la meta más alta de islas', () => {
    const islands = new Set(
      achievementsOf
        .filter(({ trigger }) => trigger === 'visit_island')
        .map(({ o }) => o.identity.id),
    );
    const most = Math.max(
      ...defs.filter((d) => d.trigger === 'visit_island').map((d) => num(param(d, 'count'), 1)),
    );
    expect(islands.size).toBeGreaterThanOrEqual(most);
  });

  it('un secreto cuenta por su categoría', () => {
    const secret = achievementsOf.find(({ trigger }) => trigger === 'collect_objects')!;
    const e: WorldEvent = {
      type: 'achievement',
      objectId: secret.o.identity.id,
      trigger: 'collect_objects',
      amount: 1,
    };
    expect(signalFromWorldEvent(e, world)).toEqual({
      trigger: 'collect_objects',
      objectId: secret.o.identity.id,
      category: secret.o.identity.category,
    });
  });
});
