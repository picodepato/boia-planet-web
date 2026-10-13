import { describe, expect, it } from 'vitest';
import {
  AFTER_HOURS,
  CRAB_BPM,
  SEAGULL_TUNING,
  type SeagullEvent,
  SeagullClock,
  alicanteHour,
  characterRng,
  crabBeatPhase,
  guiriLine,
  guiriLines,
  hourParam,
  isAfterHours,
  seagullParam,
  stealAmount,
} from './index';

const DT = 1 / 30;

/** Avanza el reloj `seconds` s; `busy(t)` dice si hay partida y `coins(t)` el saldo. */
function run(
  clock: SeagullClock,
  seconds: number,
  busy: (t: number) => boolean = () => false,
  coins: (t: number) => number = () => 20,
): { t: number; e: SeagullEvent }[] {
  const out: { t: number; e: SeagullEvent }[] = [];
  const n = Math.round(seconds / DT);
  for (let i = 1; i <= n; i++) {
    const t = i * DT;
    for (const e of clock.step(DT, busy(t), coins(t))) out.push({ t, e });
  }
  return out;
}

const of = (log: { t: number; e: SeagullEvent }[], type: SeagullEvent['type']) =>
  log.filter((x) => x.e.type === type);

describe('stealAmount (T270): lo que se lleva la gaviota', () => {
  it('nunca deja el saldo en negativo ni pasa del tope', () => {
    const cap = SEAGULL_TUNING.cap;
    for (let coins = -3; coins <= 40; coins++) {
      const take = stealAmount(coins);
      expect(take).toBeGreaterThanOrEqual(0);
      expect(take).toBeLessThanOrEqual(cap);
      expect(coins - take).toBeGreaterThanOrEqual(Math.min(0, coins));
      if (coins <= 0) expect(take).toBe(0);
      else expect(take).toBe(Math.min(cap, coins));
    }
    expect(stealAmount(2.9)).toBe(2);
    expect(stealAmount(Number.NaN)).toBe(0);
    expect(stealAmount(100, 3)).toBe(3);
  });
});

describe('SeagullClock (T270)', () => {
  it('el primer ataque llega tras la calma inicial y roba hasta el tope', () => {
    const clock = new SeagullClock({ rng: characterRng(7) });
    const log = run(clock, SEAGULL_TUNING.first + SEAGULL_TUNING.diveS + 1);
    const dive = of(log, 'dive')[0]!;
    expect(dive.t).toBeGreaterThanOrEqual(SEAGULL_TUNING.first - DT);
    const steal = of(log, 'steal')[0]!;
    expect(steal.e).toEqual({ type: 'steal', coins: SEAGULL_TUNING.cap });
    expect(steal.t - dive.t).toBeCloseTo(SEAGULL_TUNING.diveS, 0);
    expect(clock.state.at).toBe('fleeing');
  });

  it('con pocas monedas se lleva las que hay (nunca más) y con el bolsillo vacío se va sin nada', () => {
    const poor = new SeagullClock({ rng: characterRng(1) });
    const log = run(
      poor,
      SEAGULL_TUNING.first + SEAGULL_TUNING.diveS + 1,
      () => false,
      () => 2,
    );
    expect(of(log, 'steal')[0]!.e).toEqual({ type: 'steal', coins: 2 });
    const broke = new SeagullClock({ rng: characterRng(1) });
    const log2 = run(
      broke,
      SEAGULL_TUNING.first + SEAGULL_TUNING.diveS + 1,
      () => false,
      () => 0,
    );
    expect(of(log2, 'steal')).toHaveLength(0);
    expect(of(log2, 'nothing')).toHaveLength(1);
    expect(of(log2, 'gone')).toHaveLength(1);
    expect(broke.state.at).toBe('away');
  });

  it('pillarla a tiempo devuelve lo robado con propina; después del plazo se ríe y se va', () => {
    const quick = new SeagullClock({ rng: characterRng(3) });
    run(
      quick,
      SEAGULL_TUNING.first + SEAGULL_TUNING.diveS + 1,
      () => false,
      () => 9,
    );
    run(quick, SEAGULL_TUNING.catchS - 2);
    expect(quick.catchLeft).toBeGreaterThan(0);
    expect(quick.catch()).toEqual([
      { type: 'caught', coins: SEAGULL_TUNING.cap, bonus: SEAGULL_TUNING.bonus },
      { type: 'gone' },
    ]);
    expect(quick.catch()).toEqual([]);
    expect(quick.state.at).toBe('away');

    const slow = new SeagullClock({ rng: characterRng(3) });
    run(
      slow,
      SEAGULL_TUNING.first + SEAGULL_TUNING.diveS + 1,
      () => false,
      () => 9,
    );
    const log = run(slow, SEAGULL_TUNING.catchS + SEAGULL_TUNING.laughS + 1);
    expect(of(log, 'escaped')[0]!.e).toEqual({ type: 'escaped', coins: SEAGULL_TUNING.cap });
    expect(of(log, 'caught')).toHaveLength(0);
    expect(of(log, 'gone')).toHaveLength(1);
    expect(slow.catch()).toEqual([]);
  });

  it('no roba durante una partida: ni ataca, ni baja, y si huía suelta lo robado', () => {
    // Partida todo el rato: nunca ataca.
    const busy = new SeagullClock({ rng: characterRng(5) });
    const log = run(busy, SEAGULL_TUNING.first * 4, () => true);
    expect(of(log, 'dive')).toHaveLength(0);
    expect(of(log, 'steal')).toHaveLength(0);
    // Partida mientras baja: se va sin robar.
    const diving = new SeagullClock({ rng: characterRng(5) });
    run(diving, SEAGULL_TUNING.first + 0.5);
    expect(diving.state.at).toBe('diving');
    const cut = diving.step(DT, true, 50);
    expect(cut).toEqual([{ type: 'gone' }]);
    // Partida mientras huye: suelta las monedas.
    const fleeing = new SeagullClock({ rng: characterRng(5) });
    run(fleeing, SEAGULL_TUNING.first + SEAGULL_TUNING.diveS + 1);
    expect(fleeing.state.at).toBe('fleeing');
    const drop = fleeing.step(DT, true, 50);
    expect(drop).toEqual([{ type: 'dropped', coins: SEAGULL_TUNING.cap }, { type: 'gone' }]);
    // Y tras la partida, calma antes de volver.
    expect(fleeing.untilNext).toBeGreaterThanOrEqual(SEAGULL_TUNING.afterBusy);
  });

  it('con semilla siempre lo mismo, y entre ataques pasan `every` ± `jitter` s', () => {
    const a = run(new SeagullClock({ rng: characterRng(11) }), 900);
    const b = run(new SeagullClock({ rng: characterRng(11) }), 900);
    expect(a).toEqual(b);
    const dives = of(a, 'dive').map((x) => x.t);
    const gones = of(a, 'gone').map((x) => x.t);
    expect(dives.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < dives.length; i++) {
      const gap = dives[i]! - gones[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(SEAGULL_TUNING.every - SEAGULL_TUNING.jitter - DT);
      expect(gap).toBeLessThanOrEqual(SEAGULL_TUNING.every + SEAGULL_TUNING.jitter + DT);
    }
  });

  it('`attack()` trae el ataque ya y `?gaviota=1` lo pide', () => {
    const clock = new SeagullClock({ rng: characterRng(2) });
    expect(clock.attack()).toEqual([{ type: 'dive' }]);
    expect(clock.state.at).toBe('diving');
    expect(seagullParam('?gaviota=1')).toBe(true);
    expect(seagullParam('?gaviota=0')).toBe(false);
    expect(seagullParam('')).toBe(false);
  });
});

describe('la hora de Alicante y las frases del guiri (T270)', () => {
  it('`?hora=4` finge la hora; sin él, la de Europe/Madrid', () => {
    expect(hourParam('?hora=4')).toBe(4);
    expect(hourParam('?hora=23')).toBe(23);
    expect(hourParam('?hora=24')).toBeNull();
    expect(hourParam('?hora=x')).toBeNull();
    expect(hourParam('')).toBeNull();
    expect(alicanteHour(new Date('2026-07-15T02:30:00Z'), null)).toBe(4); // CEST, UTC+2
    expect(alicanteHour(new Date('2026-01-15T02:30:00Z'), null)).toBe(3); // CET, UTC+1
    expect(alicanteHour(new Date('2026-01-15T23:30:00Z'), null)).toBe(0);
    expect(alicanteHour(new Date('2026-07-15T12:00:00Z'), 4)).toBe(4);
  });

  it('entre las 03:00 y las 07:00 hay una tercera frase, la del after', () => {
    for (let h = 0; h < 24; h++) {
      const after = h >= AFTER_HOURS.from && h < AFTER_HOURS.to;
      expect(isAfterHours(h)).toBe(after);
      expect(guiriLines(h)).toEqual(after ? ['where', 'always', 'after'] : ['where', 'always']);
    }
    expect([0, 1, 2, 3].map((i) => guiriLine(i, 12))).toEqual([
      'where',
      'always',
      'where',
      'always',
    ]);
    expect([0, 1, 2, 3].map((i) => guiriLine(i, 4))).toEqual(['where', 'always', 'after', 'where']);
    expect(guiriLine(-1, 4)).toBe('after');
  });
});

describe('el compás del cangrejo (T270)', () => {
  it('va a CRAB_BPM, una vuelta por pulso', () => {
    expect(crabBeatPhase(0)).toBe(0);
    expect(crabBeatPhase(60 / CRAB_BPM)).toBeCloseTo(0, 6);
    expect(crabBeatPhase(30 / CRAB_BPM)).toBeCloseTo(0.5, 6);
    expect(crabBeatPhase(1, 60)).toBeCloseTo(0, 6);
    expect(crabBeatPhase(Number.NaN)).toBe(0);
  });
});
