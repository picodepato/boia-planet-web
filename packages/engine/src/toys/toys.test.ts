import { describe, expect, it } from 'vitest';
import { HornClock, NapClock, TOYS_TUNING, hashId, hornVoice, napParam } from './index';

const T = TOYS_TUNING;
const still = { still: true, blocked: false };

describe('NapClock', () => {
  it('falls asleep after napAfterS of stillness, once', () => {
    const c = new NapClock();
    let slept = 0;
    for (let i = 0; i < (T.napAfterS + 5) * 10; i++) {
      slept += c.step(0.1, still).filter((e) => e.type === 'sleep').length;
    }
    expect(slept).toBe(1);
    expect(c.asleep).toBe(true);
  });

  it('input resets the count, and wakes a sleeper with one wake event', () => {
    const c = new NapClock();
    c.step(T.napAfterS - 1, still);
    expect(c.input()).toEqual([]);
    expect(c.idleS).toBe(0);
    expect(c.step(T.napAfterS - 1, still)).toEqual([]);
    expect(c.step(2, still).map((e) => e.type)).toEqual(['sleep']);
    expect(c.input()).toEqual([{ type: 'wake' }]);
    expect(c.asleep).toBe(false);
    expect(c.input()).toEqual([]);
  });

  it('reuses one event list (no garbage per frame)', () => {
    const c = new NapClock();
    expect(c.step(0.1, still)).toBe(c.step(0.1, still));
    expect(c.input()).toBe(c.step(0.1, still));
  });

  it('never counts while the boat moves or any UI is open', () => {
    const c = new NapClock();
    for (let i = 0; i < 100; i++) c.step(5, { still: false, blocked: false });
    expect(c.asleep).toBe(false);
    for (let i = 0; i < 100; i++) c.step(5, { still: true, blocked: true });
    expect(c.asleep).toBe(false);
    expect(c.idleS).toBe(0);
  });

  it('opening a UI while asleep wakes the boat', () => {
    const c = new NapClock();
    c.step(T.napAfterS + 1, still);
    expect(c.asleep).toBe(true);
    expect(c.step(0.1, { still: true, blocked: true })).toEqual([{ type: 'wake' }]);
    expect(c.gullOn).toBe(false);
  });

  it('snores on a rhythm and lands the gull once while asleep', () => {
    const c = new NapClock();
    c.step(T.napAfterS + 0.01, still);
    const seen: string[] = [];
    for (let i = 0; i < 200; i++) seen.push(...c.step(0.1, still).map((e) => e.type));
    expect(seen.filter((e) => e === 'gull')).toHaveLength(1);
    expect(seen.filter((e) => e === 'snore').length).toBeGreaterThanOrEqual(5);
    expect(c.gullOn).toBe(true);
  });

  it('?siesta=1 naps after 5 s', () => {
    expect(napParam('?siesta=1')).toBe(5);
    expect(napParam('?siesta')).toBe(5);
    expect(napParam('?siesta=20')).toBe(20);
    expect(napParam('')).toBeNull();
    const c = new NapClock();
    c.napAfterS = napParam('?siesta=1')!;
    expect(c.step(4.9, still)).toEqual([]);
    expect(c.step(0.2, still)).toEqual([{ type: 'sleep' }]);
  });
});

describe('HornClock', () => {
  it('has a cooldown that swallows spam', () => {
    const h = new HornClock();
    expect(h.honk(10, false).ok).toBe(true);
    expect(h.honk(10.2, false).ok).toBe(false);
    expect(h.cooldown(10.2)).toBeGreaterThan(0);
    expect(h.honk(10 + T.hornCooldownS, false).ok).toBe(true);
  });

  it('three honks near Fiestera inside the window make her dance, then it resets', () => {
    const h = new HornClock();
    expect(h.honk(0, true).dance).toBe(false);
    expect(h.honk(1.5, true).dance).toBe(false);
    expect(h.honk(3, true)).toEqual({ ok: true, dance: true });
    expect(h.honk(4.5, true).dance).toBe(false);
  });

  it('honks that are too slow, spammed or far away do not count', () => {
    const slow = new HornClock();
    slow.honk(0, true);
    slow.honk(4, true);
    expect(slow.honk(8, true).dance).toBe(false);
    const spam = new HornClock();
    spam.honk(0, true);
    spam.honk(0.1, true);
    expect(spam.honk(0.2, true).dance).toBe(false);
    const far = new HornClock();
    far.honk(0, true);
    far.honk(1.5, false);
    expect(far.honk(3, true).dance).toBe(false);
  });
});

describe('hornVoice', () => {
  it('is stable per boat and differs between boats', () => {
    expect(hornVoice('barco-a')).toEqual(hornVoice('barco-a'));
    const ids = ['barco-a', 'barco-b', 'barco-c', 'barco-d', 'barco-e', 'barco-f'];
    const keys = new Set(ids.map((i) => JSON.stringify(hornVoice(i))));
    expect(keys.size).toBeGreaterThan(3);
    expect(hashId('x')).toBe(hashId('x'));
    const v = hornVoice(null);
    expect(v.high).toBeGreaterThan(v.low);
    expect(v.length).toBeGreaterThan(0);
  });
});
