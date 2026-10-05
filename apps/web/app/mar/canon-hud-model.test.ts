import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { t as msg } from '../../lib/i18n';
import { es } from '../../lib/i18n/es';
import {
  CARD_ARM_MS,
  END_KEYS,
  EVOLUTION_ICON,
  FALLBACK_ICON,
  FLAME_ICON,
  SALVAVIDAS_ICON,
  UPGRADE_ICON,
  VINYL_ICON,
  WEAPON_ICON,
  WATER_ALERT,
  WATER_DANGER,
  canonPrize,
  canonResult,
  canonView,
  cardAmount,
  cardIcon,
  cardView,
  cardKeyAction,
  cardKeys,
  formatClock,
  formatPlayed,
  percent,
  prizeLine,
  sameView,
  slotsKey,
  slotsView,
  waterLevelOf,
} from './canon-hud-model';
import { marWorld } from './engine/compact';
import { MAR_SHIP_CONFIG } from './engine/steering';
import { planetRect } from './engine/wrap';
import { SurvivorsRun, survivorsSea } from './survivors';

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const period = planetRect(world.bounds);
const spawn = world.spawn ?? { x: 0, y: 0, heading: 0 };
const run = (opts: { seed?: number; startAtS?: number } = {}) =>
  new SurvivorsRun(survivorsSea(world, period, { x: spawn.x, y: spawn.y }), {
    seed: opts.seed ?? 4,
    quality: 'alta',
    ship: MAR_SHIP_CONFIG,
    ...(opts.startAtS ? { startAtS: opts.startAtS } : {}),
  });
const idle = { dirX: 0, dirY: 0, throttle: 0, drift: false };

describe('la cuenta atrás y el tiempo jugado', () => {
  it('la partida entera empieza en su duración y acaba en 0:00', () => {
    const d = SURVIVORS_CONFIG.durationS;
    expect(formatClock(d)).toBe(`${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`);
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-3)).toBe('0:00');
  });

  it('la cuenta atrás redondea hacia arriba; el tiempo jugado, hacia abajo', () => {
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(0.4)).toBe('0:01');
    expect(formatClock(605)).toBe('10:05');
    expect(formatPlayed(59.9)).toBe('0:59');
    expect(formatPlayed(192.5)).toBe('3:12');
    // Un tiempo hecho de pasos de 1/60 s no pierde el segundo por el redondeo.
    const steps = SURVIVORS_CONFIG.durationS * 60;
    expect(formatPlayed(steps * (1 / 60))).toBe(formatClock(SURVIVORS_CONFIG.durationS));
    expect(formatPlayed(-1)).toBe('0:00');
  });
});

describe('las barras', () => {
  it('porcentaje entero y acotado', () => {
    expect(percent(0, 100)).toBe(0);
    expect(percent(33.4, 100)).toBe(33);
    expect(percent(150, 100)).toBe(100);
    expect(percent(-5, 100)).toBe(0);
    expect(percent(5, 0)).toBe(0);
    expect(percent(Number.NaN, 10)).toBe(0);
    expect(percent(3, 8)).toBe(38);
  });

  it('el agua a bordo cambia de tramo (y de dibujo) en la mitad y en tres cuartos', () => {
    expect(waterLevelOf(0)).toBe('ok');
    expect(waterLevelOf(WATER_ALERT - 1)).toBe('ok');
    expect(waterLevelOf(WATER_ALERT)).toBe('alerta');
    expect(waterLevelOf(WATER_DANGER - 1)).toBe('alerta');
    expect(waterLevelOf(WATER_DANGER)).toBe('peligro');
    expect(waterLevelOf(100)).toBe('peligro');
  });

  it('el HUD sale del estado de la partida y sólo cambia si cambia lo que se ve', () => {
    const r = run({ startAtS: 120 });
    const s = r.snapshot();
    const v = canonView(s);
    expect(v.timeLeftS).toBe(Math.ceil(s.timeLeftS - 1e-6));
    expect(formatClock(v.timeLeftS)).toBe(formatClock(SURVIVORS_CONFIG.durationS - 120));
    expect(v.level).toBe(s.xp.level);
    expect(v.xpPct).toBe(percent(s.xp.xp, s.xp.toNext));
    expect(v.waterPct).toBe(percent(s.water.level, s.water.capacity));
    expect(v.waterCapacity).toBe(SURVIVORS_CONFIG.player.waterCapacity);
    expect(v.card).toBeNull();
    expect(sameView(v, canonView(r.snapshot()))).toBe(true);
    expect(sameView(v, { ...v, waterPct: v.waterPct + 1 })).toBe(false);
    expect(sameView(v, null)).toBe(false);
    expect(sameView(null, null)).toBe(true);
  });

  it('la Llama del botín (T135): sus segundos y su barrita mientras dura; apagada, 0', () => {
    const r = run();
    expect(canonView(r.snapshot())).toMatchObject({ flameS: 0, flamePct: 0 });
    const p = r.snapshot().player;
    r.game.spawnPickup('llama', p.x, p.y);
    r.step(idle);
    const d = SURVIVORS_CONFIG.drops.llama.durationS;
    const on = canonView(r.snapshot());
    expect(on.flameS).toBe(d);
    expect(on.flamePct).toBe(100);
    for (let i = 0; i < 60 * 3; i++) r.step(idle);
    const later = canonView(r.snapshot());
    expect(later.flameS).toBe(Math.ceil(r.snapshot().flame!.leftS - 1e-6));
    expect(later.flameS).toBeLessThan(d);
    expect(later.flamePct).toBe(percent(r.snapshot().flame!.leftS, d));
    expect(sameView(on, later)).toBe(false);
    expect(FLAME_ICON).toBeTruthy();
    expect(msg('mar.canon.llama', { s: 7 })).toContain('7');
  });
});

describe('las cartas de nivel', () => {
  it('cada mejora de la config tiene icono, nombre y lo que da, sin huecos sin rellenar', () => {
    for (const u of SURVIVORS_CONFIG.upgrades) {
      expect(UPGRADE_ICON[u.id], u.id).toBeTruthy();
      const keys = cardKeys(u);
      expect(es[keys.title], keys.title).toBeTruthy();
      expect(es[keys.effect], keys.effect).toBeTruthy();
      const text = msg(keys.effect, {
        amount: cardAmount(u),
        capacidad: SURVIVORS_CONFIG.player.waterCapacity,
      });
      expect(text, u.id).not.toMatch(/[{}]/);
      // Dice el número exacto que da.
      expect(text, u.id).toContain(String(cardAmount(u)));
    }
  });

  it('los extras van en porcentaje; las bolas y el achique, tal cual', () => {
    expect(cardAmount({ stat: 'damageBonus', amount: 0.25 })).toBe(25);
    expect(cardAmount({ stat: 'fireRateBonus', amount: 0.2 })).toBe(20);
    expect(cardAmount({ stat: 'magnetBonus', amount: 0.4 })).toBe(40);
    expect(cardAmount({ stat: 'speedBonus', amount: 0.1 })).toBe(10);
    expect(cardAmount({ stat: 'extraProjectiles', amount: 1 })).toBe(1);
    expect(cardAmount({ stat: 'bailPerS', amount: 1.5 })).toBe(1.5);
  });

  it('flechas para moverse (dan la vuelta), números para ir a una, Intro o espacio para elegir', () => {
    const n = SURVIVORS_CONFIG.cardChoices;
    expect(cardKeyAction('ArrowRight', 0, n)).toEqual({ kind: 'focus', index: 1 });
    expect(cardKeyAction('ArrowDown', n - 1, n)).toEqual({ kind: 'focus', index: 0 });
    expect(cardKeyAction('ArrowLeft', 0, n)).toEqual({ kind: 'focus', index: n - 1 });
    expect(cardKeyAction('ArrowUp', 1, n)).toEqual({ kind: 'focus', index: 0 });
    expect(cardKeyAction('Home', 2, n)).toEqual({ kind: 'focus', index: 0 });
    expect(cardKeyAction('End', 0, n)).toEqual({ kind: 'focus', index: n - 1 });
    for (let i = 0; i < n; i++) {
      expect(cardKeyAction(String(i + 1), 0, n)).toEqual({ kind: 'focus', index: i });
    }
    expect(cardKeyAction(String(n + 1), 0, n)).toBeNull();
    expect(cardKeyAction('0', 0, n)).toBeNull();
    expect(cardKeyAction('Enter', 2, n)).toEqual({ kind: 'choose', index: 2 });
    expect(cardKeyAction(' ', 1, n)).toEqual({ kind: 'choose', index: 1 });
    // El foco fuera de rango se acota; Escape y las demás no son de las cartas.
    expect(cardKeyAction('Enter', 9, n)).toEqual({ kind: 'choose', index: n - 1 });
    expect(cardKeyAction('Escape', 0, n)).toBeNull();
    expect(cardKeyAction('w', 0, n)).toBeNull();
    expect(cardKeyAction('Enter', 0, 0)).toBeNull();
    // Con menos opciones (todas las mejoras casi al máximo), también da la vuelta.
    expect(cardKeyAction('ArrowRight', 1, 2)).toEqual({ kind: 'focus', index: 0 });
    expect(CARD_ARM_MS).toBeGreaterThan(0);
  });

  it('una carta de verdad: tantas opciones como la config, y la elegida se aplica', () => {
    const r = run();
    r.devLevelUp();
    r.step(idle);
    const v = canonView(r.snapshot());
    expect(v.status).toBe('card');
    expect(v.card?.options).toHaveLength(SURVIVORS_CONFIG.cardChoices);
    const action = cardKeyAction('ArrowRight', 0, v.card!.options.length)!;
    const enter = cardKeyAction('Enter', action.index, v.card!.options.length)!;
    expect(enter).toEqual({ kind: 'choose', index: 1 });
    const pick = v.card!.options[enter.index]!;
    r.choose(enter.index);
    r.step(idle);
    const after = canonView(r.snapshot());
    expect(after.status).toBe('running');
    expect(after.card).toBeNull();
    expect(r.snapshot().upgrades[pick.upgrade]).toBe(1);
  });
});

describe('la pantalla final', () => {
  it('amanecer o inundado tienen pantalla, con el tiempo, enemigos, notas y nivel; el abandono no', () => {
    const s = run({ startAtS: 60 }).snapshot();
    for (const reason of ['survived', 'flooded', 'victory'] as const) {
      expect(canonResult(reason, s)).toEqual({
        reason,
        playedS: s.activeS,
        defeated: s.defeated,
        notes: s.notesPicked,
        level: s.xp.level,
        // T144: la medalla de cada final (sin minibosses vencidos, el amanecer es bronce).
        medal: reason === 'victory' ? 'oro' : reason === 'survived' ? 'bronce' : null,
        act: s.act,
        difficulty: s.difficulty,
        bosses: s.bossesDefeated,
      });
      expect(es[END_KEYS[reason].title]).toBeTruthy();
      expect(es[END_KEYS[reason].line]).toBeTruthy();
    }
    expect(msg(END_KEYS.survived.title)).toBe('¡Amanece!');
    expect(msg(END_KEYS.flooded.title)).toBe('¡Barco inundado!');
    // El boss final vencido (T140) tiene su final propio, distinto del amanecer.
    expect(END_KEYS.victory.title).not.toBe(END_KEYS.survived.title);
    expect(msg(END_KEYS.victory.title)).toMatch(/Fantasma/);
    expect(canonResult('abandoned', s)).toBeNull();
  });
});

describe('el premio en la pantalla final (T119)', () => {
  it('liquidándose no dice nada; ganado, lo que da; repetido o sin validez, por qué no', () => {
    expect(canonPrize(null)).toBe('pending');
    expect(prizeLine(null)).toBeNull();
    const won = { granted: true as const, points: 150, coins: 50 };
    expect(canonPrize(won)).toBe('granted');
    const line = prizeLine(won)!;
    expect(msg(line.key, line.params)).toBe('+150 puntos y +50 monedas');
    expect(canonPrize({ granted: false, reason: 'duplicate' })).toBe('duplicate');
    expect(prizeLine({ granted: false, reason: 'duplicate' })?.key).toBe(
      'mar.canon.premio.repetido',
    );
    // Inundado: el final ya lo dice; no hay línea de premio.
    expect(prizeLine({ granted: false, reason: 'not_won' })).toBeNull();
    for (const reason of ['abandoned', 'implausible_duration', 'no_sink', 'error'] as const) {
      expect(canonPrize({ granted: false, reason })).toBe(reason);
      expect(prizeLine({ granted: false, reason })?.key).toBe('mar.canon.premio.no');
    }
    // Partida de prueba (atajo de desarrollo) en producción: lo dice (T121).
    const test = { granted: false as const, reason: 'test_start' as const };
    expect(canonPrize(test)).toBe('test_start');
    expect(prizeLine(test)?.key).toBe('mar.canon.premio.prueba');
    for (const key of [
      'mar.canon.premio.ganado',
      'mar.canon.premio.repetido',
      'mar.canon.premio.no',
      'mar.canon.premio.prueba',
    ] as const) {
      expect(es[key]).toBeTruthy();
    }
  });
});

describe('las cartas de la beta 2 (T130): una por clase de oferta', () => {
  const mix = (): SurvivorsRun => {
    const r = new SurvivorsRun(survivorsSea(world, period, { x: spawn.x, y: spawn.y }), {
      seed: 11,
      quality: 'alta',
      ship: MAR_SHIP_CONFIG,
      devMix: true,
    });
    r.devMixCard();
    r.step(idle);
    return r;
  };

  it('el atajo surtido abre una carta con las seis clases, cada una con sus textos y su nivel', () => {
    const r = mix();
    const card = r.snapshot().card!;
    expect(card).not.toBeNull();
    const kinds = card.options.map((o) => o.kind).sort();
    expect(kinds).toEqual(
      ['evolution', 'salvavidas', 'vinyl-level', 'vinyl-new', 'weapon-level', 'weapon-new'].sort(),
    );
    const ids = new Set<string>();
    for (const o of card.options) {
      const v = cardView(o);
      ids.add(v.id);
      expect(v.icon, o.kind).toBeTruthy();
      expect(es[v.title], v.title).toBeTruthy();
      expect(es[v.effect], v.effect).toBeTruthy();
      expect(es[v.tag], v.tag).toBeTruthy();
      const text = msg(v.effect, { amount: cardAmount(o), capacidad: 100 });
      expect(text, o.kind).not.toMatch(/[{}]/);
      // Las de nivel dicen su nivel y lo que dan («Nivel 3: …»).
      if (o.kind === 'weapon-level' || o.kind === 'vinyl-level') {
        expect(text).toContain(`Nivel ${o.targetLevel}`);
        expect(v.level).toBe(o.targetLevel);
        expect(v.fresh).toBe(false);
      }
      if (o.kind === 'weapon-new' || o.kind === 'vinyl-new') expect(v.fresh).toBe(true);
      expect(v.evolution).toBe(o.kind === 'evolution');
    }
    // Cada opción de la oferta tiene identidad propia (clave de React y de pruebas).
    expect(ids.size).toBe(card.options.length);
  });

  it('el icono sale de lo que es la carta, no de un alias de la beta 1', () => {
    const card = mix().snapshot().card!;
    const by = (k: string) => card.options.find((o) => o.kind === k)!;
    expect(cardIcon(by('evolution'))).toBe(EVOLUTION_ICON[by('evolution').evolutionId!]);
    expect(cardIcon(by('weapon-new'))).toBe(WEAPON_ICON[by('weapon-new').weaponId!]);
    expect(cardIcon(by('vinyl-new'))).toBe(VINYL_ICON[by('vinyl-new').vinylId!]);
    expect(cardIcon(by('salvavidas'))).toBe(SALVAVIDAS_ICON);
    expect(cardIcon({ kind: 'fallback' })).toBe(FALLBACK_ICON);
  });

  it('cada arma, vinilo y evolución de la config tiene icono', () => {
    for (const id of Object.keys(SURVIVORS_CONFIG.weapons)) {
      expect(WEAPON_ICON[id as keyof typeof WEAPON_ICON], id).toBeTruthy();
    }
    for (const id of Object.keys(SURVIVORS_CONFIG.passives)) {
      expect(VINYL_ICON[id as keyof typeof VINYL_ICON], id).toBeTruthy();
    }
    for (const e of SURVIVORS_CONFIG.evolutions) expect(EVOLUTION_ICON[e.id], e.id).toBeTruthy();
  });

  it('elegir la evolución la deja en la fila, destacada', () => {
    const r = mix();
    const i = r.snapshot().card!.options.findIndex((o) => o.kind === 'evolution');
    r.choose(i);
    r.step(idle);
    const slots = slotsView(r.snapshot());
    const evolved = slots.weapons.filter((w) => w.evolved);
    expect(evolved).toHaveLength(1);
    expect(evolved[0]!.icon).toBe(EVOLUTION_ICON.drop);
  });
});

describe('la fila de armas y vinilos (T130)', () => {
  it('empieza con el arma inicial y los huecos libres que da la config', () => {
    const s = run().snapshot();
    const v = slotsView(s);
    expect(v.weapons).toHaveLength(SURVIVORS_CONFIG.slots.weapons);
    expect(v.vinyls).toHaveLength(SURVIVORS_CONFIG.slots.vinyls);
    expect(v.weapons[0]).toMatchObject({
      id: SURVIVORS_CONFIG.startingWeapon,
      level: 1,
      evolved: false,
    });
    expect(v.weapons.filter((w) => w.id === null)).toHaveLength(SURVIVORS_CONFIG.slots.weapons - 1);
    expect(v.vinyls.every((x) => x.id === null)).toBe(true);
    expect(v.salvavidas).toBe(false);
  });

  it('refleja los niveles y el vinilo, y su clave cambia sólo si cambia lo que se ve', () => {
    const r = run();
    const before = canonView(r.snapshot());
    r.game.addVinyl('techno');
    r.game.levelUpWeapon(SURVIVORS_CONFIG.startingWeapon);
    const s = r.snapshot();
    const v = slotsView(s);
    expect(v.weapons[0]!.level).toBe(2);
    expect(v.vinyls[0]).toMatchObject({ id: 'techno', level: 1, maxLevel: 5 });
    const after = canonView(s);
    expect(after.slotsKey).not.toBe(before.slotsKey);
    expect(sameView(before, after)).toBe(false);
    expect(slotsKey(run().snapshot())).toBe(slotsKey(run().snapshot()));
  });

  it('las plazas se leen de la config y nunca se pasan de ella', () => {
    const s = run().snapshot();
    const fake = {
      ...s,
      slots: { weapons: 2, vinyls: 1 },
      weapons: [s.weapons[0]!, s.weapons[0]!, s.weapons[0]!],
    };
    expect(slotsView(fake).weapons).toHaveLength(3);
    expect(slotsView({ ...fake, weapons: [] }).weapons).toHaveLength(2);
    expect(slotsView({ ...fake, salvavidas: 'held' }).salvavidas).toBe(true);
    expect(slotsView({ ...fake, salvavidas: 'consumed' }).salvavidas).toBe(false);
  });

  it('los textos de la fila existen y no dejan huecos por rellenar', () => {
    for (const key of [
      'mar.canon.equipo.aria',
      'mar.canon.equipo.armas',
      'mar.canon.equipo.vinilos',
      'mar.canon.equipo.hueco',
      'mar.canon.equipo.salvavidas',
    ] as const) {
      expect(es[key], key).toBeTruthy();
    }
    expect(msg('mar.canon.equipo.nivel', { nombre: 'X', n: 2, max: 5 })).toBe('X, nivel 2 de 5');
    expect(msg('mar.canon.equipo.evolucionada', { nombre: 'X' })).not.toMatch(/[{}]/);
  });
});
