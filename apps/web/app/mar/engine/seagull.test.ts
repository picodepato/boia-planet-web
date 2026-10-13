import { SEAGULL_TUNING, type SeagullEvent, characterRng } from '@boia/engine/characters';
import { describe, expect, it } from 'vitest';
import { SEAGULL_LOOK, Seagull, type SeagullFrame } from './seagull';

/**
 * La gaviota ladrona (plan 029 T270) en la escena: llega por detrás y alta,
 * baja hasta el barco, huye bajo y más despacio que el barco (se la puede
 * perseguir), el barco la pilla al alcanzarla, y nada de esto en una partida.
 */

const DT = 1 / 60;
const PERIOD = { w: 400, h: 300 };

function frame(over: Partial<SeagullFrame> = {}): SeagullFrame {
  return {
    ship: { x: 10, z: 20 },
    heading: 0,
    focus: { x: 10, z: 20 },
    period: PERIOD,
    busy: false,
    coins: 12,
    reduced: false,
    hidden: false,
    ...over,
  };
}

function run(g: Seagull, seconds: number, f: () => SeagullFrame): SeagullEvent[] {
  const out: SeagullEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) out.push(...g.update(DT, f()));
  return out;
}

describe('Seagull (T270): el vuelo de la ladrona', () => {
  it('ataca con `attack()`: llega alta y por detrás, baja hasta el barco y roba a la altura del agua', () => {
    const g = new Seagull({ rng: characterRng(4) });
    expect(g.visual).toBe('no');
    expect(g.group.visible).toBe(false);
    g.attack();
    expect(g.visual).toBe('baja');
    g.update(DT, frame());
    expect(g.group.visible).toBe(true);
    expect(g.pos.y).toBeGreaterThan(SEAGULL_LOOK.fromHeight * 0.9);
    expect(g.pos.x).toBeLessThan(10);
    const events = run(g, SEAGULL_TUNING.diveS + 0.1, () => frame());
    const steal = events.find((e) => e.type === 'steal');
    expect(steal).toEqual({ type: 'steal', coins: SEAGULL_TUNING.cap });
    expect(g.visual).toBe('huye');
    expect(g.pos.y).toBeLessThan(SEAGULL_LOOK.fleeHeight + 0.5);
    // Al robar estaba junto a la popa.
    expect(Math.hypot(g.pos.x - 10, g.pos.z - 20)).toBeLessThan(2.5);
  });

  it('huye más despacio que el barco y bajo, así que el barco la alcanza y la pilla', () => {
    const g = new Seagull({ rng: characterRng(4) });
    g.attack();
    run(g, SEAGULL_TUNING.diveS + 0.1, () => frame());
    // Recién robado está pegada al barco: todavía no cuenta como pillada.
    expect(g.catchable).toBe(false);
    // El barco se queda quieto: la gaviota se aleja, pero despacio.
    run(g, SEAGULL_LOOK.catchGraceS + 0.1, () => frame());
    expect(g.catchable).toBe(true);
    const far = Math.hypot(g.pos.x - 10, g.pos.z - 20);
    expect(far).toBeGreaterThan(SEAGULL_LOOK.catchRadius);
    expect(far).toBeLessThan(SEAGULL_LOOK.fleeSpeed * (SEAGULL_LOOK.catchGraceS + 0.1) + 2.5);
    expect(g.pos.y).toBeLessThan(SEAGULL_LOOK.fleeHeight + 0.3);
    // El barco va a por ella a toda máquina (0,94 u/s) y la alcanza.
    const ship = { x: 10, z: 20 };
    const events: SeagullEvent[] = [];
    for (let i = 0; i < 60 * 12 && !events.some((e) => e.type === 'caught'); i++) {
      const dx = g.pos.x - ship.x;
      const dz = g.pos.z - ship.z;
      const d = Math.hypot(dx, dz) || 1;
      ship.x += (dx / d) * 0.94 * DT;
      ship.z += (dz / d) * 0.94 * DT;
      events.push(...g.update(DT, frame({ ship: { ...ship }, focus: { ...ship } })));
    }
    const caught = events.find((e) => e.type === 'caught');
    expect(caught).toEqual({
      type: 'caught',
      coins: SEAGULL_TUNING.cap,
      bonus: SEAGULL_TUNING.bonus,
    });
    expect(g.visual).toBe('pillada');
    expect(g.catchable).toBe(false);
    // Se va volando y desaparece.
    run(g, SEAGULL_LOOK.leaveS + 0.2, () => frame({ ship: { ...ship }, focus: { ...ship } }));
    expect(g.visual).toBe('no');
    expect(g.group.visible).toBe(false);
  });

  it('sin pillarla, se ríe y se va; con el barco volando o en partida no se ve ni roba', () => {
    const g = new Seagull({ rng: characterRng(9) });
    g.attack();
    run(g, SEAGULL_TUNING.diveS + 0.1, () => frame());
    const events = run(g, SEAGULL_TUNING.catchS + 0.2, () => frame());
    expect(events.find((e) => e.type === 'escaped')).toEqual({
      type: 'escaped',
      coins: SEAGULL_TUNING.cap,
    });
    expect(g.visual).toBe('rie');
    run(g, SEAGULL_TUNING.laughS + SEAGULL_LOOK.leaveS + 0.3, () => frame());
    expect(g.visual).toBe('no');

    const busy = new Seagull({ rng: characterRng(9) });
    const none = run(busy, SEAGULL_TUNING.first * 3, () => frame({ busy: true }));
    expect(none).toEqual([]);
    expect(busy.group.visible).toBe(false);

    const flying = new Seagull({ rng: characterRng(9) });
    flying.attack();
    flying.update(DT, frame({ hidden: true }));
    expect(flying.group.visible).toBe(false);
  });

  it('se dibuja en la copia del planeta más cercana al foco', () => {
    const g = new Seagull({ rng: characterRng(2) });
    g.attack();
    g.update(DT, frame({ focus: { x: 10 + PERIOD.w, z: 20 } }));
    expect(g.group.position.x).toBeGreaterThan(PERIOD.w - 30);
    expect(Math.abs(g.group.position.x - (g.pos.x + PERIOD.w))).toBeLessThan(1e-6);
    g.dispose();
    expect(g.update(DT, frame())).toEqual([]);
  });
});
