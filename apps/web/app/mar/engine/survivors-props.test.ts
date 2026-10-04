import {
  type DefeatStyle,
  type EnemyId,
  NOTE_FIGURES,
  SURVIVORS_CONFIG,
  type SurvivorsConfig,
} from '@boia/engine/survivors';
import { WORLD_REGISTRY } from '@boia/world';
import { Box3, type BufferGeometry, Color, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { es } from '../../../lib/i18n/es';
import {
  DEFEAT_STYLES,
  type DevEnv,
  SurvivorsRun,
  canonShortcut,
  nextDefeatStyle,
  startDefeatStyle,
  survivorsSea,
} from '../survivors';
import { marWorld } from './compact';
import { C } from './palette';
import { MAR_SHIP_CONFIG } from './steering';
import {
  ENEMY_COLORS,
  ENEMY_MODELS,
  NOTE_COLORS,
  boatVisible,
  cannonBallGeometry,
  crabGeometry,
  defeatPlan,
  hitShake,
  noteGeometry,
  piranhaGeometry,
  pufCapacity,
} from './survivors-props';
import { SurvivorsView } from './survivors-view';
import { planetRect } from './wrap';

/**
 * Las piezas de la beta del Cañón (plan 010, T117): los modelos de la
 * piraña, el cangrejo acorazado, la bola y las notas por figura, una pieza
 * instanciada por tipo con el tope de la calidad; los dos estilos de
 * derrota (de la config y del interruptor de desarrollo); y el movimiento
 * reducido (sin parpadeo, sin temblor, efecto mínimo).
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const period = planetRect(world.bounds);
const spawn = world.spawn ?? { x: 0, y: 0, heading: 0 };
const ENEMY_IDS = Object.keys(SURVIVORS_CONFIG.enemies) as EnemyId[];

const withStyle = (defeatStyle: DefeatStyle): SurvivorsConfig => ({
  ...SURVIVORS_CONFIG,
  defeatStyle,
});

/** Los colores (hex) de los vértices de una geometría pintada. */
function colorsOf(g: BufferGeometry): Set<string> {
  const col = g.getAttribute('color');
  const out = new Set<string>();
  const c = new Color();
  for (let i = 0; i < col.count; i++)
    out.add(c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).getHexString());
  return out;
}
const hex = (s: string) => new Color(s).getHexString();
const size = (g: BufferGeometry) =>
  new Box3().setFromBufferAttribute(g.getAttribute('position') as never).getSize(new Vector3());

/** Una partida ya empezada (con enemigos y notas) para pintar. */
function game(quality: 'alta' | 'baja' = 'alta') {
  return new SurvivorsRun(survivorsSea(world, period, { x: spawn.x, y: spawn.y }), {
    seed: 5,
    quality,
    ship: MAR_SHIP_CONFIG,
    startAtS: 90,
  });
}

describe('los modelos de la beta', () => {
  it('cada enemigo de la config tiene su modelo; los de la beta, uno propio', () => {
    for (const id of ['piranha', 'crab'] as const) {
      expect(ENEMY_IDS).toContain(id);
      expect(ENEMY_MODELS[id], id).toBeDefined();
    }
  });

  it('la piraña es roja y alargada; el cangrejo, naranja con coraza y más ancho que largo', () => {
    const fish = piranhaGeometry();
    const crab = crabGeometry();
    expect(colorsOf(fish).has(hex(ENEMY_COLORS.piranha.body))).toBe(true);
    expect(colorsOf(crab).has(hex(ENEMY_COLORS.crab.shell))).toBe(true);
    expect(colorsOf(crab).has(hex(ENEMY_COLORS.crab.armour))).toBe(true);
    expect(colorsOf(crab).has(hex(ENEMY_COLORS.piranha.body))).toBe(false);
    expect(colorsOf(fish).has(hex(ENEMY_COLORS.crab.shell))).toBe(false);
    const f = size(fish);
    const c = size(crab);
    // Siluetas que no se confunden: la piraña, larga hacia donde nada (+x); el cangrejo, ancho.
    expect(f.x / f.z).toBeGreaterThan(1.8);
    expect(c.z / c.x).toBeGreaterThan(1);
  });

  it('cada figura de nota tiene su forma y su color, con el aro de espuma en el agua', () => {
    const geos = NOTE_FIGURES.map((f) => noteGeometry(f));
    const colors = NOTE_FIGURES.map((f) => hex(NOTE_COLORS[f]));
    expect(new Set(colors).size).toBe(NOTE_FIGURES.length);
    geos.forEach((g, i) => {
      const cs = colorsOf(g);
      expect(cs.has(colors[i]!), NOTE_FIGURES[i]).toBe(true);
      expect(cs.has(hex(C.white)), NOTE_FIGURES[i]).toBe(true);
      // Ninguna se hunde: de pie sobre el agua.
      const box = new Box3().setFromBufferAttribute(g.getAttribute('position') as never);
      expect(box.min.y, NOTE_FIGURES[i]).toBeGreaterThan(-0.2);
    });
    const counts = geos.map((g) => g.getAttribute('position').count);
    expect(new Set(counts).size).toBe(NOTE_FIGURES.length);
    // La redonda no tiene plica: es la más baja.
    const heights = geos.map((g) => size(g).y);
    expect(Math.min(...heights)).toBe(heights[NOTE_FIGURES.indexOf('redonda')]);
  });

  it('la bola del cañón es azul de agua', () => {
    expect(colorsOf(cannonBallGeometry()).has(hex('#bfe9ff'))).toBe(true);
  });
});

describe('una pieza instanciada por tipo, del tope de la calidad', () => {
  it('cada enemigo y cada figura de nota: una `InstancedMesh` con el tope', () => {
    for (const q of ['alta', 'baja'] as const) {
      const caps = SURVIVORS_CONFIG.caps[q];
      const view = new SurvivorsView(SURVIVORS_CONFIG, caps, { quality: q });
      const meshes = view.meshes();
      for (const id of ENEMY_IDS) {
        const m = meshes[`survivors-${id}`];
        expect(m?.isInstancedMesh, id).toBe(true);
        expect(m!.instanceMatrix.count, `${q} ${id}`).toBe(caps.enemies);
      }
      for (const f of NOTE_FIGURES) {
        const m = meshes[`survivors-note-${f}`];
        expect(m?.isInstancedMesh, f).toBe(true);
        expect(m!.instanceMatrix.count, `${q} ${f}`).toBe(caps.notes);
      }
      expect(meshes['survivors-balls']!.instanceMatrix.count).toBe(caps.projectiles);
      // Las nubecillas de `puf`, todas en una sola pieza.
      expect(meshes['survivors-puf']!.instanceMatrix.count).toBe(pufCapacity(q));
      view.dispose();
    }
  });

  it('cada nota se pinta en la pieza de su figura', () => {
    const run = game();
    const view = new SurvivorsView(run.config, run.game.caps);
    // Una nota de cada figura, separadas (no se funden) y lejos del imán.
    const p = run.snapshot().player;
    NOTE_FIGURES.forEach((f, i) =>
      run.game.spawnNote(p.x + 300 + i * 120, p.y + 300, run.config.notes.values[f]),
    );
    const s = run.snapshot();
    for (const f of NOTE_FIGURES) expect(s.notes.some((n) => n.figure === f), f).toBe(true);
    view.update(s, 1);
    const meshes = view.meshes();
    for (const f of NOTE_FIGURES) {
      expect(meshes[`survivors-note-${f}`]!.count, f).toBe(
        s.notes.filter((n) => n.figure === f).length,
      );
    }
    for (const id of ENEMY_IDS) {
      expect(meshes[`survivors-${id}`]!.count, id).toBe(s.enemiesByType[id]?.length ?? 0);
    }
    view.dispose();
  });

  it('`baja` es más barata: menos derrotas a la vez y menos partículas', () => {
    for (const style of DEFEAT_STYLES) {
      const alta = defeatPlan(style, { quality: 'alta', reduced: false });
      const baja = defeatPlan(style, { quality: 'baja', reduced: false });
      expect(baja.pool).toBeLessThan(alta.pool);
      expect(baja.parts).toBeLessThanOrEqual(alta.parts);
    }
    expect(pufCapacity('baja')).toBeLessThan(pufCapacity('alta'));
  });

  it('pintar no crea piezas nuevas: las mismas matrices fotograma a fotograma', () => {
    const run = game();
    const view = new SurvivorsView(run.config, run.game.caps);
    const before = Object.values(view.meshes()).map((m) => m.instanceMatrix.array);
    for (let i = 0; i < 30; i++) {
      run.step({ dirX: 1, dirY: 0, throttle: 1, drift: false });
      view.update(run.snapshot(), i / 60);
    }
    const after = Object.values(view.meshes()).map((m) => m.instanceMatrix.array);
    expect(after).toHaveLength(before.length);
    after.forEach((a, i) => expect(a).toBe(before[i]));
    view.dispose();
  });
});

describe('los dos estilos de derrota', () => {
  const sumOf = (view: SurvivorsView, re: RegExp) =>
    Object.entries(view.meshes())
      .filter(([name]) => re.test(name))
      .reduce((n, [, m]) => n + m.count, 0);

  /** Una derrota de piraña a mitad del efecto. */
  function defeatOnce(view: SurvivorsView) {
    const run = game();
    const s = run.snapshot();
    view.update(s, 10);
    view.defeat('piranha', 1, spawn.x, spawn.y);
    view.update(s, 10.15);
  }

  it('la config elige el estilo: `puf` o `sumergirse`', () => {
    for (const style of DEFEAT_STYLES) {
      const view = new SurvivorsView(withStyle(style), SURVIVORS_CONFIG.caps.alta);
      expect(view.defeatStyle).toBe(style);
      view.dispose();
    }
    // Sin decir nada, el de la config del modo.
    const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta);
    expect(view.defeatStyle).toBe(SURVIVORS_CONFIG.defeatStyle);
    view.dispose();
  });

  it('`puf`: una nubecilla de varias partículas, en una sola pieza; nada se hunde', () => {
    const view = new SurvivorsView(withStyle('puf'), SURVIVORS_CONFIG.caps.alta);
    defeatOnce(view);
    expect(view.defeatsShown).toBe(1);
    expect(view.meshes()['survivors-puf']!.count).toBe(
      defeatPlan('puf', { quality: 'alta', reduced: false }).parts,
    );
    expect(sumOf(view, /-sink$|splash/)).toBe(0);
    view.dispose();
  });

  it('`sumergirse`: el mismo enemigo se hunde con un aro de espuma; sin nubecillas', () => {
    const view = new SurvivorsView(withStyle('sumergirse'), SURVIVORS_CONFIG.caps.alta);
    defeatOnce(view);
    expect(view.defeatsShown).toBe(1);
    expect(view.meshes()['survivors-piranha-sink']!.count).toBe(1);
    expect(view.meshes()['survivors-puf']!.count).toBe(0);
    // Salta primero y el aro llega al entrar en el agua.
    view.update(game().snapshot(), 10 + 0.85 * 0.6);
    expect(view.meshes()['survivors-splash']!.count).toBe(1);
    // Y se acaba.
    view.update(game().snapshot(), 12);
    expect(view.defeatsShown).toBe(0);
    expect(sumOf(view, /-sink$|splash|puf/)).toBe(0);
    view.dispose();
  });

  it('el interruptor de desarrollo cambia el estilo en vivo, de uno al otro', () => {
    expect(nextDefeatStyle('puf')).toBe('sumergirse');
    expect(nextDefeatStyle('sumergirse')).toBe('puf');
    const view = new SurvivorsView(withStyle('sumergirse'), SURVIVORS_CONFIG.caps.alta);
    view.setDefeatStyle(nextDefeatStyle(view.defeatStyle));
    expect(view.defeatStyle).toBe('puf');
    defeatOnce(view);
    expect(view.meshes()['survivors-puf']!.count).toBeGreaterThan(0);
    view.setDefeatStyle(nextDefeatStyle(view.defeatStyle));
    expect(view.defeatStyle).toBe('sumergirse');
    // Lo del estilo anterior se apaga al cambiar.
    expect(view.meshes()['survivors-puf']!.count).toBe(0);
    view.dispose();
  });

  it('el interruptor (y `&derrota=`) sólo cuenta con los atajos de desarrollo', () => {
    const env = (over: Partial<DevEnv>): DevEnv => ({
      nodeEnv: 'production',
      webdriver: false,
      search: '',
      ...over,
    });
    const other = SURVIVORS_CONFIG.defeatStyle === 'puf' ? 'sumergirse' : 'puf';
    expect(startDefeatStyle(other, SURVIVORS_CONFIG, env({ nodeEnv: 'development' }))).toBe(other);
    expect(startDefeatStyle(other, SURVIVORS_CONFIG, env({ webdriver: true }))).toBe(other);
    expect(startDefeatStyle(other, SURVIVORS_CONFIG, env({ search: '?dev=1' }))).toBe(other);
    expect(startDefeatStyle(other, SURVIVORS_CONFIG, env({}))).toBe(SURVIVORS_CONFIG.defeatStyle);
    expect(startDefeatStyle(null, withStyle('puf'), env({ nodeEnv: 'development' }))).toBe('puf');
    const dev = env({ nodeEnv: 'development' });
    expect(canonShortcut('?minijuego=canon&derrota=puf', dev)?.defeatStyle).toBe('puf');
    expect(canonShortcut('?minijuego=canon&derrota=sumergirse', dev)?.defeatStyle).toBe(
      'sumergirse',
    );
    expect(canonShortcut('?minijuego=canon&derrota=otro', dev)?.defeatStyle).toBeNull();
  });

  it('el botón del interruptor tiene sus textos', () => {
    expect(es['mar.canon.dev.derrota']).toContain('{estilo}');
    expect(es['mar.canon.dev.derrota.aria']).toBeTruthy();
    for (const s of DEFEAT_STYLES) expect(es[`mar.canon.dev.derrota.${s}`]).toBeTruthy();
  });
});

describe('golpe en el barco y movimiento reducido', () => {
  const inv = SURVIVORS_CONFIG.player.invulnerableS;
  const samples = Array.from({ length: 50 }, (_, i) => (inv * (i + 0.5)) / 50);

  it('el barco parpadea mientras es invulnerable, y deja de hacerlo al acabar', () => {
    const shown = samples.map((s) =>
      boatVisible({ invulnerableS: s, running: true, reduced: false }),
    );
    expect(shown.filter((v) => !v).length).toBeGreaterThan(5);
    expect(shown.filter((v) => v).length).toBeGreaterThan(5);
    expect(boatVisible({ invulnerableS: 0, running: true, reduced: false })).toBe(true);
    // En pausa o con la carta abierta, siempre se ve.
    for (const s of samples)
      expect(boatVisible({ invulnerableS: s, running: false, reduced: false })).toBe(true);
  });

  it('con movimiento reducido, ni parpadeo ni temblor de cámara', () => {
    for (const s of samples)
      expect(boatVisible({ invulnerableS: s, running: true, reduced: true })).toBe(true);
    expect(hitShake(true)).toBe(0);
    expect(hitShake(false)).toBeGreaterThan(0);
  });

  it('con movimiento reducido, el efecto de derrota mínimo: sin partículas que vuelen, sin salto ni chapoteo', () => {
    for (const quality of ['alta', 'baja'] as const) {
      const puf = defeatPlan('puf', { quality, reduced: true });
      expect(puf.reduced).toBe(true);
      expect(puf.parts).toBe(1);
      expect(puf.spread).toBe(0);
      const sink = defeatPlan('sumergirse', { quality, reduced: true });
      expect(sink.hop).toBe(false);
      expect(sink.splash).toBe(false);
      expect(sink.lifeS).toBeLessThan(defeatPlan('sumergirse', { quality, reduced: false }).lifeS);
    }
  });

  it('la pieza usa el efecto mínimo con movimiento reducido', () => {
    const puf = new SurvivorsView(withStyle('puf'), SURVIVORS_CONFIG.caps.alta, { reduced: true });
    const s = game().snapshot();
    puf.update(s, 10);
    puf.defeat('crab', 1, spawn.x, spawn.y);
    puf.update(s, 10.1);
    expect(puf.meshes()['survivors-puf']!.count).toBe(1);
    puf.dispose();
    const sink = new SurvivorsView(withStyle('sumergirse'), SURVIVORS_CONFIG.caps.alta, {
      reduced: true,
    });
    for (let i = 0; i < 10; i++) {
      sink.update(s, 10 + i * 0.05);
      if (i === 0) sink.defeat('crab', 1, spawn.x, spawn.y);
      expect(sink.meshes()['survivors-splash']!.count).toBe(0);
    }
    sink.dispose();
  });
});
