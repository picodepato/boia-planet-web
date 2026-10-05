import {
  type DefeatStyle,
  type EnemyId,
  type EnemyView,
  NOTE_FIGURES,
  SURVIVORS_CONFIG,
  type SurvivorsConfig,
  type SurvivorsSnapshot,
  type TelegraphView,
} from '@boia/engine/survivors';
import { WORLD_REGISTRY } from '@boia/world';
import { Box3, type BufferGeometry, Color, type InstancedMesh, Matrix4, Vector3 } from 'three';
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
import { toScene } from './compress';
import { C } from './palette';
import { MAR_SHIP_CONFIG } from './steering';
import {
  ELITE_COLOR,
  ENEMY_COLORS,
  ENEMY_MODELS,
  ENEMY_SHOT_COLOR,
  JELLY_GLOW,
  NOTE_COLORS,
  WARNING_COLORS,
  boatVisible,
  cannonBallGeometry,
  crabGeometry,
  defeatPlan,
  enemyMaterial,
  enemyShotGeometry,
  gullGeometry,
  hitShake,
  jellyfishGeometry,
  noteGeometry,
  piranhaGeometry,
  pirateGeometry,
  pufCapacity,
  swordfishGeometry,
  warningLineGeometry,
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
    for (const f of NOTE_FIGURES)
      expect(
        s.notes.some((n) => n.figure === f),
        f,
      ).toBe(true);
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

// --- T126: los enemigos de la beta 2 ---------------------------------------------------

const NEW_ENEMIES = ['gull', 'pirate', 'swordfish', 'jellyfish'] as const;
const NEW_GEOMETRY: Record<(typeof NEW_ENEMIES)[number], () => BufferGeometry> = {
  gull: gullGeometry,
  pirate: pirateGeometry,
  swordfish: swordfishGeometry,
  jellyfish: jellyfishGeometry,
};

/** Una partida tarde (después de las 3:30): ya hay de todos los tipos y élites. */
function lateGame(quality: 'alta' | 'baja' = 'alta') {
  return new SurvivorsRun(survivorsSea(world, period, { x: spawn.x, y: spawn.y }), {
    seed: 5,
    quality,
    ship: MAR_SHIP_CONFIG,
    startAtS: 240,
  });
}

const at = new Vector3();
const scl = new Vector3();
const m4 = new Matrix4();
/** Posición y escala (escena) de la pieza `i` de una `InstancedMesh`. */
function placed(mesh: InstancedMesh, i: number) {
  mesh.getMatrixAt(i, m4);
  at.setFromMatrixPosition(m4);
  scl.setFromMatrixScale(m4);
  return { x: at.x, y: at.y, z: at.z, sx: scl.x, sy: scl.y, sz: scl.z };
}

/** Un enemigo de mentira para pintar (en u de motor). */
function enemy(over: Partial<EnemyView> & Pick<EnemyView, 'id' | 'type'>): EnemyView {
  const def = SURVIVORS_CONFIG.enemies[over.type]!;
  return {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    heading: 0,
    hp: def.hp,
    maxHp: def.hp,
    ghost: false,
    radius: def.radius,
    elite: false,
    scale: 1,
    phase: 'move',
    ...over,
  };
}

/** La foto de una partida con estos enemigos, avisos y disparos (lo demás, de una real). */
function snapshotWith(
  enemies: EnemyView[],
  extra: Partial<Pick<SurvivorsSnapshot, 'telegraphs' | 'enemyProjectiles'>> = {},
): SurvivorsSnapshot {
  const base = game().snapshot();
  const byType: Partial<Record<EnemyId, EnemyView[]>> = {};
  for (const e of enemies) (byType[e.type] ??= []).push(e);
  return {
    ...base,
    enemies,
    enemiesByType: byType,
    projectiles: [],
    notes: [],
    telegraphs: extra.telegraphs ?? [],
    enemyProjectiles: extra.enemyProjectiles ?? [],
  };
}

describe('T126: los modelos de los enemigos nuevos', () => {
  it('cada enemigo de la config tiene su modelo propio (ninguno es la boya genérica)', () => {
    for (const id of ENEMY_IDS) expect(ENEMY_MODELS[id], id).toBeDefined();
    for (const id of NEW_ENEMIES) expect(ENEMY_MODELS[id]!.build, id).toBe(NEW_GEOMETRY[id]);
  });

  it('cada uno con sus colores: ninguno lleva el color principal de otro', () => {
    const main: Record<EnemyId, string> = {
      piranha: ENEMY_COLORS.piranha.body,
      crab: ENEMY_COLORS.crab.shell,
      gull: ENEMY_COLORS.gull.wing,
      pirate: ENEMY_COLORS.pirate.stripe,
      swordfish: ENEMY_COLORS.swordfish.back,
      jellyfish: ENEMY_COLORS.jellyfish.bell,
    };
    for (const id of NEW_ENEMIES) {
      const cs = colorsOf(NEW_GEOMETRY[id]());
      expect(cs.has(hex(main[id])), id).toBe(true);
      for (const other of NEW_ENEMIES) {
        if (other !== id && main[other] !== main[id]) {
          expect(cs.has(hex(main[other])), `${id} sin ${other}`).toBe(false);
        }
      }
    }
    // La pistola del pirata y su sombrero negro, la espada del pez espada.
    expect(colorsOf(pirateGeometry()).has(hex(ENEMY_COLORS.pirate.pistol))).toBe(true);
    expect(colorsOf(pirateGeometry()).has(hex(ENEMY_COLORS.pirate.hat))).toBe(true);
    expect(colorsOf(swordfishGeometry()).has(hex(ENEMY_COLORS.swordfish.sword))).toBe(true);
  });

  it('siluetas que no se confunden: la gaviota, alas anchas; el pez espada, muy largo; el pirata, alto; la medusa, una cúpula', () => {
    const gull = size(gullGeometry());
    const sword = size(swordfishGeometry());
    const pirate = size(pirateGeometry());
    const jelly = size(jellyfishGeometry());
    const fish = size(piranhaGeometry());
    // Vista desde arriba, la gaviota es más ancha que larga (alas abiertas).
    expect(gull.z / gull.x).toBeGreaterThan(1.4);
    // El pez espada es el más largo y estrecho: más que la piraña.
    expect(sword.x / sword.z).toBeGreaterThan(3);
    expect(sword.x / sword.z).toBeGreaterThan(fish.x / fish.z);
    // El pirata es lo más alto (de pie en su bote, con sombrero).
    for (const g of [gull, sword, jelly, fish]) expect(pirate.y).toBeGreaterThan(g.y);
    // La medusa, redonda y baja: casi tan ancha como larga, más ancha que alta.
    expect(Math.abs(jelly.x - jelly.z) / jelly.z).toBeLessThan(0.35);
    expect(jelly.z).toBeGreaterThan(jelly.y * 1.5);
    // La espada del pez espada y la pistola del pirata miran al frente (+x).
    const sb = new Box3().setFromBufferAttribute(
      swordfishGeometry().getAttribute('position') as never,
    );
    expect(sb.max.x).toBeGreaterThan(-sb.min.x * 1.5);
  });

  it('la medusa brilla (su material tiene brillo propio); los demás, no', () => {
    expect(enemyMaterial(ENEMY_MODELS.jellyfish!).emissive.getHexString()).toBe(hex(JELLY_GLOW));
    for (const id of ['piranha', 'crab', 'gull', 'pirate', 'swordfish'] as const) {
      expect(enemyMaterial(ENEMY_MODELS[id]!).emissive.getHex(), id).toBe(0);
    }
  });

  it('el disparo enemigo es rosa (la bola del barco, azul) y la línea de aviso va de 0 a 1 en x', () => {
    const shot = colorsOf(enemyShotGeometry());
    expect(shot.has(hex(ENEMY_SHOT_COLOR))).toBe(true);
    expect(shot.has(hex('#bfe9ff'))).toBe(false);
    const line = new Box3().setFromBufferAttribute(
      warningLineGeometry().getAttribute('position') as never,
    );
    expect(line.min.x).toBeCloseTo(0);
    expect(line.max.x).toBeCloseTo(1);
    // Plana, sobre el agua.
    expect(line.max.y - line.min.y).toBeCloseTo(0);
  });
});

describe('T126: cómo se pintan', () => {
  it('ya tarde, cada tipo se pinta en su pieza, con élites y sin pasarse del tope', () => {
    for (const q of ['alta', 'baja'] as const) {
      const run = lateGame(q);
      const view = new SurvivorsView(run.config, run.game.caps, { quality: q });
      for (let i = 0; i < 60; i++) run.step({ dirX: 1, dirY: 0, throttle: 1, drift: false });
      const s = run.snapshot();
      view.update(s, 1);
      const meshes = view.meshes();
      for (const id of ENEMY_IDS) {
        const n = s.enemiesByType[id]?.length ?? 0;
        // En `alta` hay de todos; en `baja` el tope (más pequeño) puede dejar fuera alguno.
        if (q === 'alta') expect(n, `${q}: hay ${id}`).toBeGreaterThan(0);
        expect(meshes[`survivors-${id}`]!.count, id).toBe(n);
        expect(meshes[`survivors-${id}`]!.visible, id).toBe(n > 0);
      }
      expect(s.enemies.length).toBeLessThanOrEqual(run.game.caps.enemies);
      expect(meshes['survivors-elite']!.count).toBe(s.enemies.filter((e) => e.elite).length);
      expect(meshes['survivors-enemy-shots']!.count).toBe(s.enemyProjectiles.length);
      expect(meshes['survivors-warning']!.count).toBe(s.telegraphs.length * 2);
      // Los topes, los de la calidad.
      const caps = run.game.caps;
      expect(view.capacity().enemyProjectiles).toBe(caps.enemyProjectiles);
      expect(view.capacity().elites).toBe(caps.enemies);
      view.dispose();
    }
  });

  it('una pieza vacía no se dibuja: en `baja`, pocas llamadas de dibujo', () => {
    const run = lateGame('baja');
    const view = new SurvivorsView(run.config, run.game.caps, { quality: 'baja' });
    const all = Object.values(view.meshes());
    // Antes de pintar, nada.
    expect(all.filter((m) => m.visible)).toHaveLength(0);
    view.update(run.snapshot(), 1);
    for (const m of all) expect(m.visible, m.name).toBe(m.count > 0);
    // Una llamada por tipo de pieza a la vista; nunca más que piezas hay.
    const drawn = all.filter((m) => m.visible).length;
    expect(drawn).toBeLessThanOrEqual(ENEMY_IDS.length + NOTE_FIGURES.length + 6);
    view.dispose();
  });

  it('la gaviota vuela: alta sobre el agua y más alta sobre una isla, con su sombra en el suelo', () => {
    const ISLAND = 6;
    const islandX = toScene(spawn.x + 400);
    const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta, {
      reduced: true,
      groundAt: (x) => (Math.abs(x - islandX) < 5 ? ISLAND : 0),
    });
    const fly = ENEMY_MODELS.gull!.fly!;
    const sea = enemy({ id: 1, type: 'gull' });
    const over = enemy({ id: 2, type: 'gull', x: spawn.x + 400 });
    const fish = enemy({ id: 3, type: 'piranha', x: spawn.x + 400 });
    const s = snapshotWith([sea, over, fish]);
    view.update(s, 1);
    const meshes = view.meshes();
    const gulls = meshes['survivors-gull']!;
    const [a, b] = [placed(gulls, 0), placed(gulls, 1)];
    expect(a.y).toBeCloseTo(fly);
    expect(b.y).toBeCloseTo(ISLAND + fly);
    // Lo que nada sigue en el agua.
    expect(placed(meshes['survivors-piranha']!, 0).y).toBeCloseTo(0);
    // Una sombra por gaviota, en el suelo que tiene debajo.
    const shadows = meshes['survivors-shadow']!;
    expect(shadows.count).toBe(2);
    expect(placed(shadows, 0).y).toBeLessThan(0.2);
    expect(placed(shadows, 1).y).toBeCloseTo(ISLAND + 0.05);
    // Al ir hacia una isla, sube antes de llegar.
    const toward = enemy({ id: 4, type: 'gull', x: spawn.x + 400 - 120, vx: 300 });
    view.update(snapshotWith([toward]), 2);
    expect(placed(gulls, 0).y).toBeGreaterThan(fly + ISLAND * 0.9);
    view.dispose();
  });

  it('los trozos de medusa se pintan con la misma pieza, más pequeños', () => {
    const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta, { reduced: true });
    const split = SURVIVORS_CONFIG.enemies.jellyfish!.split!;
    const r = SURVIVORS_CONFIG.enemies.jellyfish!.radius;
    view.update(
      snapshotWith([
        enemy({ id: 1, type: 'jellyfish' }),
        enemy({
          id: 2,
          type: 'jellyfish',
          x: spawn.x + 100,
          radius: r * split.scale,
          scale: split.scale,
        }),
        enemy({
          id: 3,
          type: 'jellyfish',
          x: spawn.x + 200,
          radius: r * split.scale,
          scale: split.scale,
        }),
      ]),
      1,
    );
    const mesh = view.meshes()['survivors-jellyfish']!;
    expect(mesh.count).toBe(3);
    const big = placed(mesh, 0).sx;
    expect(placed(mesh, 1).sx / big).toBeCloseTo(split.scale);
    expect(placed(mesh, 2).sx / big).toBeCloseTo(split.scale);
    view.dispose();
  });

  it('las élites llevan su aro dorado (a su altura, también la gaviota); late, salvo con movimiento reducido', () => {
    const list = [
      enemy({ id: 1, type: 'piranha', elite: true }),
      enemy({ id: 2, type: 'crab', x: spawn.x + 100 }),
      enemy({ id: 3, type: 'gull', x: spawn.x + 200, elite: true }),
    ];
    const s = snapshotWith(list);
    const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta);
    const halo = view.meshes()['survivors-elite']!;
    expect(new Color((halo.material as unknown as { color: Color }).color).getHexString()).toBe(
      hex(ELITE_COLOR),
    );
    const sizes = [0.1, 0.3, 0.5, 0.7].map((t) => {
      view.update(s, t);
      return placed(halo, 0).sx;
    });
    expect(halo.count).toBe(2);
    expect(new Set(sizes.map((v) => v.toFixed(4))).size).toBeGreaterThan(1);
    // El de la gaviota, en el aire.
    expect(placed(halo, 1).y).toBeGreaterThan(ENEMY_MODELS.gull!.fly! * 0.8);
    view.dispose();
    const calm = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta, {
      reduced: true,
    });
    const still = [0.1, 0.3, 0.5].map((t) => {
      calm.update(s, t);
      return placed(calm.meshes()['survivors-elite']!, 0).sx;
    });
    expect(new Set(still.map((v) => v.toFixed(6))).size).toBe(1);
    calm.dispose();
  });

  it('con movimiento reducido, nada se mece, late ni se ladea', () => {
    const list = NEW_ENEMIES.map((type, i) => enemy({ id: i + 1, type, x: spawn.x + i * 100 }));
    const s = snapshotWith(list);
    const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta, { reduced: true });
    const snap = (t: number) => {
      view.update(s, t);
      return NEW_ENEMIES.map((id) => {
        const m = view.meshes()[`survivors-${id}`]!;
        m.getMatrixAt(0, m4);
        return m4.elements.map((v) => v.toFixed(5)).join();
      });
    };
    expect(snap(1.0)).toEqual(snap(1.37));
    view.dispose();
    const lively = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta);
    lively.update(s, 1.0);
    const m = lively.meshes()['survivors-jellyfish']!;
    const a = placed(m, 0);
    lively.update(s, 1.37);
    expect(placed(m, 0).sy).not.toBeCloseTo(a.sy, 4);
    lively.dispose();
  });

  it('la línea de aviso del pez espada: del pez hacia donde embiste, tan larga como la embestida, y se llena con el progreso', () => {
    const def = SURVIVORS_CONFIG.enemies.swordfish!;
    const length = def.charger!.chargeDistance;
    const heading = Math.PI / 2;
    const tg = (progress: number): TelegraphView => ({
      id: 1,
      type: 'swordfish',
      x: spawn.x,
      y: spawn.y,
      heading,
      length,
      progress,
    });
    for (const reduced of [false, true]) {
      const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta, { reduced });
      const lines = view.meshes()['survivors-warning']!;
      const fish = [enemy({ id: 1, type: 'swordfish', heading, phase: 'telegraph' })];
      view.update(snapshotWith(fish, { telegraphs: [tg(0.25)] }), 1);
      expect(lines.count).toBe(2);
      const track = placed(lines, 0);
      const fill = placed(lines, 1);
      expect(track.x).toBeCloseTo(toScene(spawn.x));
      expect(track.z).toBeCloseTo(toScene(spawn.y));
      // Sobre el agua, lo lleno encima del tramo.
      expect(track.y).toBeGreaterThan(0);
      expect(fill.y).toBeGreaterThan(track.y);
      // El largo de la embestida; lo lleno, su parte.
      expect(track.sx).toBeCloseTo(toScene(length));
      expect(fill.sx).toBeCloseTo(toScene(length) * 0.25);
      // Rumbo π/2 del motor (+y) es +z en la escena: la punta de la línea va allí.
      lines.getMatrixAt(0, m4);
      const tip = new Vector3(1, 0, 0).applyMatrix4(m4);
      expect(tip.z - track.z).toBeCloseTo(toScene(length));
      expect(Math.abs(tip.x - track.x)).toBeLessThan(1e-6);
      // Colores: el tramo oscuro y lo lleno vivo.
      const c = new Color();
      lines.getColorAt(0, c);
      expect(c.getHexString()).toBe(hex(WARNING_COLORS.track));
      lines.getColorAt(1, c);
      expect(c.getHexString()).toBe(hex(WARNING_COLORS.fill));
      // A punto de embestir, casi entera.
      view.update(snapshotWith(fish, { telegraphs: [tg(0.95)] }), 1.5);
      expect(placed(lines, 1).sx).toBeCloseTo(toScene(length) * 0.95);
      // Sin aviso, sin línea.
      view.update(snapshotWith(fish), 2);
      expect(lines.count).toBe(0);
      expect(lines.visible).toBe(false);
      view.dispose();
    }
  });

  it('una partida real avisa antes de embestir, y la línea sale en el agua', () => {
    const run = lateGame();
    const view = new SurvivorsView(run.config, run.game.caps);
    let seen = 0;
    for (let i = 0; i < 60 * 40 && seen === 0 && !run.ended; i++) {
      run.step({ dirX: 0, dirY: 0, throttle: 0, drift: false });
      const s = run.snapshot();
      if (s.telegraphs.length > 0) {
        view.update(s, i / 60);
        seen = view.meshes()['survivors-warning']!.count;
      }
    }
    expect(seen).toBeGreaterThanOrEqual(2);
    view.dispose();
  });

  it('los disparos del pirata se pintan en su pieza, apuntando a donde van', () => {
    const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.alta);
    const shot = { id: 1, x: spawn.x, y: spawn.y, vx: 0, vy: 300, radius: 6 };
    view.update(
      snapshotWith([], { enemyProjectiles: [shot, { ...shot, id: 2, x: spawn.x + 50 }] }),
      1,
    );
    const shots = view.meshes()['survivors-enemy-shots']!;
    expect(shots.count).toBe(2);
    shots.getMatrixAt(0, m4);
    const nose = new Vector3(1, 0, 0).applyMatrix4(m4).sub(new Vector3().setFromMatrixPosition(m4));
    expect(nose.z).toBeGreaterThan(0);
    expect(Math.abs(nose.x)).toBeLessThan(1e-6);
    // Las bolas del barco, aparte.
    expect(view.meshes()['survivors-balls']!.count).toBe(0);
    view.dispose();
  });

  it('los dos estilos de derrota funcionan con cada tipo; la gaviota cae desde el aire', () => {
    for (const id of ENEMY_IDS) {
      const list = [enemy({ id: 7, type: id })];
      const s = snapshotWith(list);
      const sink = new SurvivorsView(withStyle('sumergirse'), SURVIVORS_CONFIG.caps.alta);
      sink.update(s, 10);
      sink.defeat(id, 7, spawn.x, spawn.y);
      sink.update(snapshotWith([]), 10.01);
      const sunk = sink.meshes()[`survivors-${id}-sink`]!;
      expect(sunk.count, id).toBe(1);
      expect(sunk.visible, id).toBe(true);
      if (id === 'gull') expect(placed(sunk, 0).y).toBeGreaterThan(ENEMY_MODELS.gull!.fly! * 0.8);
      else expect(placed(sunk, 0).y).toBeLessThan(1.5);
      sink.update(snapshotWith([]), 12);
      expect(sink.defeatsShown, id).toBe(0);
      sink.dispose();
      const puf = new SurvivorsView(withStyle('puf'), SURVIVORS_CONFIG.caps.alta);
      puf.update(s, 10);
      puf.defeat(id, 7, spawn.x, spawn.y);
      puf.update(snapshotWith([]), 10.1);
      const cloud = puf.meshes()['survivors-puf']!;
      expect(cloud.count, id).toBeGreaterThan(0);
      if (id === 'gull') expect(placed(cloud, 0).y).toBeGreaterThan(ENEMY_MODELS.gull!.fly! * 0.8);
      puf.dispose();
    }
  });

  it('un trozo de medusa se hunde a su tamaño, no al de la medusa entera', () => {
    const split = SURVIVORS_CONFIG.enemies.jellyfish!.split!;
    const r = SURVIVORS_CONFIG.enemies.jellyfish!.radius;
    const sizes = [1, split.scale].map((k) => {
      const view = new SurvivorsView(withStyle('sumergirse'), SURVIVORS_CONFIG.caps.alta, {
        reduced: true,
      });
      view.update(snapshotWith([enemy({ id: 9, type: 'jellyfish', radius: r * k, scale: k })]), 5);
      view.defeat('jellyfish', 9, spawn.x, spawn.y);
      view.update(snapshotWith([]), 5.01);
      const out = placed(view.meshes()['survivors-jellyfish-sink']!, 0).sx;
      view.dispose();
      return out;
    });
    expect(sizes[1]! / sizes[0]!).toBeCloseTo(split.scale, 1);
  });
});
