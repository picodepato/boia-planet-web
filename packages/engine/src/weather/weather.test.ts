import { describe, expect, it } from 'vitest';
import {
  WEATHER_KINDS,
  WEATHER_TUNING,
  type WeatherEvent,
  WeatherClock,
  episodeStrength,
  weatherParam,
  weatherRng,
} from './index';

const DT = 1 / 30;

/** Avanza el reloj `seconds` s; `busy` dice si hay partida en cada instante. */
function run(
  clock: WeatherClock,
  seconds: number,
  busy: (t: number) => boolean = () => false,
): { t: number; e: WeatherEvent }[] {
  const out: { t: number; e: WeatherEvent }[] = [];
  const n = Math.round(seconds / DT);
  for (let i = 1; i <= n; i++) {
    const t = i * DT;
    for (const e of clock.step(DT, busy(t))) out.push({ t, e });
  }
  return out;
}

const starts = (log: { t: number; e: WeatherEvent }[]) => log.filter((x) => x.e.type === 'start');

describe('WeatherClock (T268)', () => {
  it('el primer episodio no entra antes de ~4 min de juego', () => {
    const minFirst = WEATHER_TUNING.every - WEATHER_TUNING.jitter;
    for (let seed = 1; seed <= 40; seed++) {
      const clock = new WeatherClock({ rng: weatherRng(seed) });
      const first = starts(run(clock, WEATHER_TUNING.every + WEATHER_TUNING.jitter + 1))[0];
      expect(first, `semilla ${seed}`).toBeDefined();
      expect(first!.t).toBeGreaterThanOrEqual(minFirst - DT);
      expect(first!.t).toBeGreaterThan(180);
    }
  });

  it('cada episodio dura lo que dice la configuración, con fundido suave', () => {
    const clock = new WeatherClock({ rng: weatherRng(7) });
    const log = run(clock, 3 * (WEATHER_TUNING.every + WEATHER_TUNING.jitter + 40));
    const s = log.filter((x) => x.e.type === 'start');
    const e = log.filter((x) => x.e.type === 'end');
    expect(s.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < s.length; i++) {
      if (!e[i]) break;
      expect(e[i]!.t - s[i]!.t).toBeCloseTo(WEATHER_TUNING.duration, 0);
    }
    // El fundido: empieza y acaba en 0, y está entero a mitad.
    const D = WEATHER_TUNING.duration;
    const F = WEATHER_TUNING.fade;
    expect(episodeStrength(0, D, F)).toBe(0);
    expect(episodeStrength(D, D, F)).toBe(0);
    expect(episodeStrength(D / 2, D, F)).toBe(1);
    expect(episodeStrength(F / 2, D, F)).toBeGreaterThan(0);
    expect(episodeStrength(F / 2, D, F)).toBeLessThan(1);
  });

  it('avisa del fundido de salida antes de irse', () => {
    const clock = new WeatherClock({ rng: weatherRng(3) });
    clock.start('calima');
    const log = run(clock, WEATHER_TUNING.duration + 1);
    const ending = log.find((x) => x.e.type === 'ending');
    const end = log.find((x) => x.e.type === 'end');
    expect(ending).toBeDefined();
    expect(end!.t - ending!.t).toBeCloseTo(WEATHER_TUNING.fade, 0);
  });

  it('no entra ningún episodio mientras hay una partida', () => {
    const clock = new WeatherClock({ rng: weatherRng(11) });
    // Partida de 20 min seguidos.
    const log = run(clock, 1200, () => true);
    expect(starts(log)).toHaveLength(0);
    expect(clock.state.kind).toBeNull();
  });

  it('tras una partida espera un rato de calma antes de un episodio', () => {
    const clock = new WeatherClock({ rng: weatherRng(5) });
    const busyUntil = 600;
    const log = run(clock, 700, (t) => t < busyUntil);
    const first = starts(log)[0];
    expect(first).toBeDefined();
    expect(first!.t).toBeGreaterThanOrEqual(busyUntil + WEATHER_TUNING.afterBusy - 1);
  });

  it('un episodio en curso se va suave cuando empieza una partida', () => {
    const clock = new WeatherClock({ rng: weatherRng(9) });
    clock.start('levante');
    run(clock, 10);
    expect(clock.state.strength).toBe(1);
    const log = run(clock, 0.5, () => true);
    expect(log[0]!.e).toMatchObject({ type: 'ending', kind: 'levante' });
    // Sigue ahí, pero bajando, sin corte.
    expect(clock.state.kind).toBe('levante');
    expect(clock.state.strength).toBeGreaterThan(0);
    expect(clock.state.strength).toBeLessThan(1);
    const rest = run(clock, WEATHER_TUNING.fade + 1, () => true);
    expect(rest.some((x) => x.e.type === 'end')).toBe(true);
    expect(clock.state).toMatchObject({ kind: null, strength: 0 });
  });

  it('con la misma semilla, lo mismo; con otra, otra cosa', () => {
    const a = run(new WeatherClock({ rng: weatherRng(42) }), 1500);
    const b = run(new WeatherClock({ rng: weatherRng(42) }), 1500);
    const c = run(new WeatherClock({ rng: weatherRng(43) }), 1500);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toEqual(c);
  });

  it('salen los tres episodios y nunca el mismo dos veces seguidas', () => {
    const log = starts(run(new WeatherClock({ rng: weatherRng(1) }), 60 * 60));
    const kinds = log.map((x) => (x.e as { kind: string }).kind);
    expect(new Set(kinds)).toEqual(new Set(WEATHER_KINDS));
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
  });

  it('la tormenta trae rayos espaciados y cada trueno llega un momento después', () => {
    const clock = new WeatherClock({ rng: weatherRng(21) });
    clock.start('tormenta');
    const log = run(clock, WEATHER_TUNING.duration + 3);
    const flashes = log.filter((x) => x.e.type === 'flash');
    const thunders = log.filter((x) => x.e.type === 'thunder');
    expect(flashes.length).toBeGreaterThan(0);
    expect(thunders).toHaveLength(flashes.length);
    for (let i = 1; i < flashes.length; i++) {
      // Muy por debajo de 3 por segundo.
      expect(flashes[i]!.t - flashes[i - 1]!.t).toBeGreaterThanOrEqual(WEATHER_TUNING.strikeMin);
    }
    for (let i = 0; i < flashes.length; i++) {
      const gap = thunders[i]!.t - flashes[i]!.t;
      expect(gap).toBeGreaterThanOrEqual(WEATHER_TUNING.thunderMin - DT);
      expect(gap).toBeLessThanOrEqual(WEATHER_TUNING.thunderMax + DT);
    }
    // El destello nunca es pantalla blanca: no pasa de 1 y se apaga solo.
    const peak = Math.max(...flashes.map((x) => (x.e as { strength: number }).strength));
    expect(peak).toBeLessThanOrEqual(1);
  });

  it('con movimiento reducido no hay destellos, sólo truenos', () => {
    const clock = new WeatherClock({ rng: weatherRng(21), noFlash: true });
    clock.start('tormenta');
    let maxFlash = 0;
    const log: WeatherEvent[] = [];
    for (let t = 0; t < WEATHER_TUNING.duration + 3; t += DT) {
      log.push(...clock.step(DT, false));
      maxFlash = Math.max(maxFlash, clock.state.flash);
    }
    expect(log.filter((e) => e.type === 'flash')).toHaveLength(0);
    expect(log.filter((e) => e.type === 'thunder').length).toBeGreaterThan(0);
    expect(maxFlash).toBe(0);
  });

  it('levante y calima no traen rayos', () => {
    for (const kind of ['levante', 'calima'] as const) {
      const clock = new WeatherClock({ rng: weatherRng(2) });
      clock.start(kind);
      const log = run(clock, WEATHER_TUNING.duration + 3);
      expect(log.some((x) => x.e.type === 'flash' || x.e.type === 'thunder')).toBe(false);
    }
  });

  it('el parámetro de desarrollo trae un episodio ya', () => {
    expect(weatherParam('?clima=tormenta')).toBe('tormenta');
    expect(weatherParam('?x=1&clima=calima')).toBe('calima');
    expect(weatherParam('?clima=granizo')).toBeNull();
    expect(weatherParam('')).toBeNull();
    const clock = new WeatherClock({ rng: weatherRng(1) });
    expect(clock.start('levante')).toEqual([{ type: 'start', kind: 'levante' }]);
    expect(clock.state.kind).toBe('levante');
    // Otro encima: el anterior se corta y entra el nuevo.
    expect(clock.start('calima').map((e) => e.type)).toEqual(['end', 'start']);
  });
});
