import {
  DEFENSE_CONFIG,
  DEFENSE_TOWER_KINDS,
  createDefense,
  defenseSchedule,
  type DefenseEvent,
} from '@boia/engine/defense';
import { describe, expect, it, vi } from 'vitest';
import { reaches, setup } from './audio-test-helpers';
import { createPageCanonAudio } from './canon-audio';
import { CASTLE_SFX_GAP, CastleAudio, type CastleSfx } from './castillo-audio';
import { DefenseRun } from './castillo';
import { CROSSFADE_S, SEA_FADE_S } from './canon-audio';

function castleSetup() {
  const base = setup();
  const castle = new CastleAudio(base.audio);
  const game = createDefense(DEFENSE_CONFIG, 7);
  return { ...base, castle, game };
}

describe('sonido del castillo (T164)', () => {
  it('antes del gesto no crea contexto, voces ni temporizador, y no reproduce efectos pendientes', () => {
    const { castle, game, contexts, pumps, audio, ctx } = castleSetup();
    castle.start(game.snapshot(), game.config);
    for (const id of Object.keys(CASTLE_SFX_GAP) as CastleSfx[]) castle.play(id);
    castle.events([{ type: 'towerSold', towerId: 1, kind: 'tienda', refund: 20 }]);
    castle.end('fallen');
    expect(contexts).toHaveLength(0);
    expect(pumps).toHaveLength(0);
    audio.unlock();
    expect(ctx().started).toHaveLength(0);
    expect(audio.state().music).toBe('sea');
  });

  it('el adaptador de página ignora eventos sintéticos y sólo desbloquea con un gesto real', () => {
    const gestures = new Map<string, EventListener>();
    let visibility: EventListener | undefined;
    const win = {
      addEventListener: (id: string, fn: EventListener) => gestures.set(id, fn),
      removeEventListener: (id: string) => gestures.delete(id),
    } as unknown as Window;
    const doc = {
      visibilityState: 'visible',
      addEventListener: (_id: string, fn: EventListener) => {
        visibility = fn;
      },
      removeEventListener: () => {
        visibility = undefined;
      },
    } as unknown as Document;
    const { prefs, ctx, audio: mock } = setup();
    mock.unlock();
    const create = vi.fn(function () {
      return ctx() as unknown as AudioContext;
    });
    vi.stubGlobal('AudioContext', create);
    try {
      const loop = createPageCanonAudio(prefs, () => undefined, win, doc);
      const castle = new CastleAudio(loop);
      gestures.get('click')!({ isTrusted: false } as Event);
      castle.play('build');
      expect(create).not.toHaveBeenCalled();
      gestures.get('pointerdown')!({ isTrusted: true } as Event);
      expect(create).toHaveBeenCalledTimes(1);
      castle.play('build');
      expect(ctx().started.length).toBeGreaterThan(0);
      castle.dispose();
      expect(gestures.size).toBe(0);
      expect(visibility).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sintetiza todos los efectos en el bus de efectos con voces de ataque ligeras', () => {
    const { castle, audio, ctx, sfxBus } = castleSetup();
    audio.unlock();
    for (const id of Object.keys(CASTLE_SFX_GAP) as CastleSfx[]) {
      const before = ctx().started.length;
      const gainBefore = ctx().gains.length;
      castle.play(id);
      const fresh = ctx().started.slice(before);
      expect(fresh.length, id).toBeGreaterThan(0);
      expect(
        fresh.every((s) => reaches(s.node, sfxBus())),
        id,
      ).toBe(true);
      if (DEFENSE_TOWER_KINDS.includes(id as (typeof DEFENSE_TOWER_KINDS)[number])) {
        expect(fresh.length, id).toBeLessThanOrEqual(2);
        for (const gain of ctx().gains.slice(gainBefore)) {
          expect(
            Math.max(...gain.gain.calls.filter((c) => c.kind === 'exp').map((c) => c.value)),
            id,
          ).toBeLessThanOrEqual(0.06);
        }
      }
    }
  });

  it('limita cada tipo entre todas sus torres, deja sonar los siete juntos y vuelve tras el intervalo', () => {
    const { castle, game, audio, ctx } = castleSetup();
    audio.unlock();
    castle.start(game.snapshot(), game.config);
    for (const kind of DEFENSE_TOWER_KINDS) {
      const shot = { atS: 0, targetIds: [1] };
      const event: DefenseEvent = { type: 'towerShot', kind, towerId: 1, shot };
      const before = ctx().started.length;
      if (kind === 'faro') castle.play(kind);
      else castle.events([event]);
      const after = ctx().started.length;
      expect(after, kind).toBeGreaterThan(before);
      for (let i = 2; i < 30; i++) {
        if (kind === 'faro') castle.play(kind);
        else castle.events([{ ...event, towerId: i }]);
      }
      expect(ctx().started.length, kind).toBe(after);
      ctx().currentTime += CASTLE_SFX_GAP[kind] + 0.001;
      castle.play(kind);
      expect(ctx().started.length, kind).toBeGreaterThan(after);
    }
  });

  it('los siete tipos pueden sonar en el mismo instante sin bloquearse entre ellos', () => {
    const { castle, audio, ctx } = castleSetup();
    audio.unlock();
    for (const kind of DEFENSE_TOWER_KINDS) {
      const before = ctx().started.length;
      castle.play(kind);
      expect(ctx().started.length, kind).toBeGreaterThan(before);
    }
    expect(ctx().started.length).toBeLessThanOrEqual(14);
    const all = ctx().started.length;
    for (const kind of DEFENSE_TOWER_KINDS) castle.play(kind);
    expect(ctx().started.length).toBe(all);
  });

  it('Puerto suena al impacto e Ibiza sólo por towerShot; construir/mejorar/castillo/vender/golpe/avión se conectan', () => {
    const { castle, game, audio } = castleSetup();
    audio.unlock();
    castle.start(game.snapshot(), game.config);
    const play = vi.spyOn(castle, 'play');
    castle.events([
      { type: 'towerBuilt', towerId: 1, kind: 'cala', x: 0, y: 0, cost: 100 },
      { type: 'towerUpgrade', towerId: 1, kind: 'cala', level: 2, cost: 100 },
      { type: 'planeUpgrade', stat: 'damage', level: 2, cost: 100 },
      { type: 'castleUpgrade', level: 2, maxLife: 150, cost: 100 },
      { type: 'towerSold', towerId: 1, kind: 'cala', refund: 120 },
      { type: 'castleHit', id: 1, kind: 'piranha', damage: 4, life: 96 },
      { type: 'planeShot', shotId: 1, targetId: 1 },
      {
        type: 'towerShot',
        towerId: 2,
        kind: 'cala',
        shot: { atS: 0, targetIds: [1], flightS: 0.5 },
      },
      { type: 'towerShot', towerId: 2, kind: 'cala', shot: { atS: 0.5, targetIds: [1] } },
      { type: 'coins', amount: 10, towerId: 3 },
      {
        type: 'towerShot',
        towerId: 3,
        kind: 'tienda',
        shot: { atS: 0, targetIds: [], amount: 10 },
      },
    ]);
    expect(play.mock.calls.map(([id]) => id)).toEqual([
      'build',
      'upgrade',
      'upgrade',
      'castle',
      'sell',
      'hit',
      'plane',
      'cala',
      'tienda',
    ]);
  });

  it('Faro renueva el zumbido desde el snapshot mientras toca blancos, nunca durante pausa', () => {
    const { castle, game, audio, ctx } = castleSetup();
    game.addTower('faro', 0, 600);
    const tower = game.snapshot().towers[0]!;
    tower.lastShot = { atS: 0, targetIds: [1] };
    audio.unlock();
    castle.start(game.snapshot(), game.config);
    const before = ctx().started.length;
    castle.sync(game.snapshot());
    expect(ctx().started.length).toBe(before);
    ctx().currentTime = 1;
    castle.sync(game.snapshot());
    expect(ctx().started.length).toBeGreaterThan(before);
    const after = ctx().started.length;
    game.setPaused(true);
    ctx().currentTime = 2;
    castle.sync(game.snapshot());
    expect(ctx().started.length).toBe(after);
    game.setPaused(false);
    tower.lastShot.targetIds = [];
    castle.sync(game.snapshot());
    expect(ctx().started.length).toBe(after);
  });

  it('avisa una vez al cambiar de oleada, sin repetir por pausa ni reproducir anteriores en atajos', () => {
    const { castle, game, audio } = castleSetup();
    audio.unlock();
    const schedule = defenseSchedule(game.config, 5, 'normal');
    const next = schedule.find((s) => s.wave === 1)!.atS;
    const play = vi.spyOn(castle, 'play');
    castle.start(game.snapshot(), game.config);
    expect(play).not.toHaveBeenCalledWith('wave');
    castle.sync({ ...game.snapshot(), activeS: game.config.waves.firstAtS });
    castle.sync({ ...game.snapshot(), activeS: game.config.waves.firstAtS });
    const s = { ...game.snapshot(), activeS: next };
    castle.sync(s);
    castle.sync({ ...s, status: 'paused' });
    castle.sync(s);
    expect(play.mock.calls.filter(([id]) => id === 'wave')).toHaveLength(2);
    play.mockClear();
    castle.start({ ...s, activeS: 150 }, game.config);
    castle.sync({ ...s, activeS: 150 });
    expect(play.mock.calls.filter(([id]) => id === 'wave')).toHaveLength(0);
  });

  it('batalla → miniboss/boss → batalla → mar con fundidos y sin reencender al terminar', () => {
    const { castle, game, audio, ctx, bus, pumps, sea } = castleSetup();
    audio.unlock();
    castle.start(game.snapshot(), game.config);
    pumps[0]!();
    expect(ctx().started.some((s) => reaches(s.node, bus('battle')))).toBe(true);
    const bossAt = defenseSchedule(game.config, 5, 'normal').find((s) => s.boss)!.atS;
    const bossGame = createDefense(game.config, 7, { startAtS: bossAt });
    bossGame.step();
    const boss = bossGame.snapshot().enemies.find((e) => e.boss)!;
    expect(boss).toBeDefined();
    ctx().currentTime = 8;
    castle.sync({ ...game.snapshot(), enemies: [boss] });
    expect(audio.state().music).toBe('boss');
    expect(bus('boss').gain.calls.at(-1)!.time).toBeCloseTo(8 + CROSSFADE_S);
    pumps[0]!();
    expect(ctx().started.some((s) => reaches(s.node, bus('boss')))).toBe(true);
    castle.sync(game.snapshot());
    expect(audio.state().music).toBe('battle');
    ctx().currentTime = 20;
    castle.end('held');
    expect(audio.state().music).toBe('sea');
    expect(sea).toEqual([false, true]);
    expect(bus('battle').gain.calls.at(-1)!.time).toBeCloseTo(20 + SEA_FADE_S);
    ctx().currentTime = 20 + SEA_FADE_S + 1;
    const done = ctx().started.length;
    castle.sync({ ...game.snapshot(), enemies: [boss] });
    pumps[0]!();
    expect(ctx().started.length).toBe(done);
    expect(audio.state().music).toBe('sea');
  });

  it.each(['held', 'fallen', 'quit', 'abandoned'] as const)(
    'el final %s suena una vez y vuelve al mar',
    (reason) => {
      const { castle, game, audio, ctx } = castleSetup();
      audio.unlock();
      castle.start(game.snapshot(), game.config);
      const play = vi.spyOn(castle, 'play');
      castle.events([{ type: 'end', reason }]);
      ctx().currentTime = 3;
      castle.end(reason);
      castle.sync({ ...game.snapshot(), end: reason });
      expect(play.mock.calls.map(([id]) => id)).toEqual(
        reason === 'held' ? ['win'] : reason === 'fallen' ? ['loss'] : [],
      );
      expect(audio.state().music).toBe('sea');
    },
  );

  it('usa volumen/silencio compartidos, ajustes globales, pausa y visibilidad; dispose cierra el contexto', () => {
    const { castle, audio, game, ctx, prefs, master, sfxBus } = castleSetup();
    audio.unlock();
    castle.start(game.snapshot(), game.config);
    prefs.setVolume(0.35);
    expect(master().gain.target).toBeCloseTo(0.35);
    const music = ctx().gains[2]!;
    audio.setPaused(true);
    expect(music.gain.target).toBeCloseTo(0.55 * 0.3);
    prefs.toggleMuted();
    const n = ctx().started.length;
    castle.play('build');
    expect(ctx().started.length).toBe(n);
    prefs.toggleMuted();
    audio.setGlobal({ music: 0, sfx: 0 });
    expect(sfxBus().gain.target).toBe(0);
    expect(music.gain.target).toBe(0);
    castle.play('build');
    expect(ctx().started.length).toBe(n);
    audio.setGlobal({ music: 1, sfx: 1 });
    audio.setHidden(true);
    castle.play('build');
    expect(ctx().state).toBe('suspended');
    expect(ctx().started.length).toBe(n);
    audio.setHidden(false);
    castle.play('build');
    expect(ctx().started.length).toBeGreaterThan(n);
    castle.dispose();
    expect(ctx().state).toBe('closed');
    const done = ctx().started.length;
    castle.play('loss');
    audio.unlock();
    expect(ctx().started.length).toBe(done);
  });

  it('recibe eventos de DefenseRun y vuelve al mar también al terminar desde el menú', () => {
    const { castle, audio } = castleSetup();
    audio.unlock();
    const run = new DefenseRun({
      seed: 7,
      quality: 'baja',
      devCoins: 1000,
      onEvents: (e) => {
        castle.events(e);
        castle.sync(run.snapshot());
      },
      onEnd: (reason) => castle.end(reason),
    });
    castle.start(run.snapshot(), run.config);
    const play = vi.spyOn(castle, 'play');
    run.upgradePlane();
    run.step(null);
    expect(play).toHaveBeenCalledWith('upgrade');
    run.quit();
    expect(audio.state().music).toBe('sea');
  });
});
