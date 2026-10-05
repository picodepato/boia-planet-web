import { SURVIVORS_CONFIG, SURVIVORS_STEP_S, type SurvivorsConfig } from '@boia/engine/survivors';
import { WORLD_REGISTRY } from '@boia/world';
import { Box3, type BufferGeometry, Color, type Mesh, type MeshLambertMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { es } from '../../../lib/i18n/es';
import { SurvivorsRun, survivorsSea } from '../survivors';
import { marWorld } from './compact';
import { toScene } from './compress';
import { MAR_SHIP_CONFIG } from './steering';
import {
  BOSS_WARNING_CAP,
  GHOST_COLORS,
  GHOST_HOVER,
  GHOST_OPACITY,
  GHOST_PIRATE_CAP,
  GHOST_PIRATE_OPACITY,
  GHOST_SHIP_SCALE,
  ghostPirateMaterial,
  ghostShipGeometry,
  ghostShipMaterial,
  pirateGeometry,
} from './survivors-props';
import { SurvivorsView } from './survivors-view';
import { planetRect } from './wrap';

/**
 * El Barco Pirata Fantasma en el mar 3D (plan 012 T140): su modelo translúcido
 * de bajo poligonaje con un material por modo (una opacidad fija por
 * material), la pieza visible según esté sólido o desvanecido, los piratas
 * fantasma en su pieza teñida, las líneas de aviso de las andanadas, el
 * movimiento reducido y que todo se crea y se libera sin crear nada por
 * fotograma.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const period = planetRect(world.bounds);
const spawn = world.spawn ?? { x: 0, y: 0, heading: 0 };
const FANTASMA = SURVIVORS_CONFIG.bosses.fantasma!;

function colorsOf(g: BufferGeometry): Set<string> {
  const col = g.getAttribute('color');
  const out = new Set<string>();
  const c = new Color();
  for (let i = 0; i < col.count; i++) out.add(c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).getHexString());
  return out;
}
const hex = (s: string) => new Color(s).getHexString();
const size = (g: BufferGeometry) =>
  new Box3().setFromBufferAttribute(g.getAttribute('position') as never).getSize(new Vector3());

/** Una partida sin guion (sólo lo que la prueba pone), insumergible, con el Fantasma quieto o como se pida. */
function quietConfig(patch: (c: SurvivorsConfig) => void = () => {}): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
  c.player.waterCapacity = 1e12;
  c.salvavidas.offerChance = 0;
  patch(c);
  return c;
}

/** El Fantasma quieto con estas ventanas (y, si se pide, llamando a su tripulación). */
function stillGhost(c: SurvivorsConfig, solidS: number, ghostS: number, ghostAttacks: string[] = []): void {
  const b = c.bosses.fantasma!;
  b.phases = [
    {
      untilHpFraction: 0,
      untilS: 0,
      movement: 'still',
      standoff: 0,
      speedScale: 1,
      invulnerable: false,
      attacks: [],
      attackEveryS: 0,
      firstAttackS: 0,
    },
  ];
  b.fantasma = { ...b.fantasma!, ghostAttacks, phases: [{ solidS, ghostS }] };
}

function game(config: SurvivorsConfig, opts: { reduced?: boolean } = {}) {
  const run = new SurvivorsRun(survivorsSea(world, period, { x: spawn.x, y: spawn.y }), {
    seed: 5,
    quality: 'alta',
    ship: MAR_SHIP_CONFIG,
    config,
  });
  const view = new SurvivorsView(run.config, run.game.caps, { quality: 'alta', reduced: opts.reduced ?? false });
  return { run, view };
}

const IDLE = { dirX: 0, dirY: 0, throttle: 0, drift: false };

function steps(run: SurvivorsRun, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / SURVIVORS_STEP_S) && !run.ended; i++) run.step(IDLE);
}

const shipMeshes = (view: SurvivorsView) => ({
  solid: view.group.getObjectByName('survivors-boss-fantasma') as Mesh,
  ghost: view.group.getObjectByName('survivors-boss-fantasma-ghost') as Mesh,
});

describe('el modelo del Barco Pirata Fantasma', () => {
  it('es un galeón largo hacia +x con casco azul noche, velas rasgadas, farol y bandera; su nombre tiene texto', () => {
    const g = ghostShipGeometry();
    const cs = colorsOf(g);
    for (const c of [GHOST_COLORS.hull, GHOST_COLORS.sail, GHOST_COLORS.sailTorn, GHOST_COLORS.lantern, GHOST_COLORS.flag]) {
      expect(cs.has(hex(c)), c).toBe(true);
    }
    const s = size(g);
    // Más largo que ancho y más alto que ancho (los mástiles).
    expect(s.x / s.z).toBeGreaterThan(2);
    expect(s.y).toBeGreaterThan(s.z);
    // Bajo poligonaje: menos vértices que diez piratas.
    expect(g.getAttribute('position').count).toBeLessThan(pirateGeometry().getAttribute('position').count * 10);
    expect(es[FANTASMA.i18nKey as keyof typeof es]).toBeTruthy();
  });

  it('un material por modo, con la opacidad fija: sólido opaco con brillo; desvanecido translúcido sin profundidad', () => {
    const solid = ghostShipMaterial(false);
    const ghost = ghostShipMaterial(true);
    expect(solid.transparent).toBe(false);
    expect(solid.opacity).toBe(1);
    expect(solid.emissiveIntensity).toBeGreaterThan(0);
    expect(ghost.transparent).toBe(true);
    expect(ghost.opacity).toBe(GHOST_OPACITY);
    expect(ghost.depthWrite).toBe(false);
    expect(ghost.emissiveIntensity).toBeGreaterThan(solid.emissiveIntensity);
    expect(GHOST_OPACITY).toBeLessThan(0.6);
    // Los piratas fantasma: el tinte celeste, translúcidos, también sin animar.
    const pirate = ghostPirateMaterial();
    expect(pirate.transparent).toBe(true);
    expect(pirate.opacity).toBe(GHOST_PIRATE_OPACITY);
    expect(pirate.depthWrite).toBe(false);
    expect(pirate.color.getHexString()).toBe(hex(GHOST_COLORS.tint));
  });
});

describe('el Fantasma en la vista', () => {
  it('crea las dos piezas del barco, la de los piratas fantasma y las líneas de aviso de boss; escondidas sin boss', () => {
    const { run, view } = game(quietConfig());
    const { solid, ghost } = shipMeshes(view);
    expect(solid?.isMesh).toBe(true);
    expect(ghost?.isMesh).toBe(true);
    // El mismo modelo, dos materiales.
    expect(solid.geometry).toBe(ghost.geometry);
    expect((solid.material as MeshLambertMaterial).transparent).toBe(false);
    expect((ghost.material as MeshLambertMaterial).transparent).toBe(true);
    const cap = view.capacity();
    expect(cap['pirate-ghost']).toBe(Math.min(run.game.caps.enemies, GHOST_PIRATE_CAP));
    expect(cap.bossWarnings).toBe(BOSS_WARNING_CAP);
    view.update(run.snapshot(), 0);
    expect(solid.visible).toBe(false);
    expect(ghost.visible).toBe(false);
    expect(view.meshes()['survivors-boss-warning']!.count).toBe(0);
    expect(view.bossesWhere(() => true)).toEqual([]);
    view.dispose();
  });

  it('sólido se ve la pieza opaca en su sitio; desvanecido, la translúcida un poco más alta; nunca las dos', () => {
    const { run, view } = game(quietConfig((c) => stillGhost(c, 1, 2)));
    const p = run.snapshot().player;
    run.game.spawnBoss('fantasma', p.x + 300, p.y);
    view.update(run.snapshot(), 1);
    const { solid, ghost } = shipMeshes(view);
    const b = run.snapshot().bosses[0]!;
    expect(b.fantasma!.mode).toBe('solid');
    expect(solid.visible).toBe(true);
    expect(ghost.visible).toBe(false);
    expect(solid.position.x).toBeCloseTo(toScene(b.x), 5);
    expect(solid.position.z).toBeCloseTo(toScene(b.y), 5);
    expect(solid.scale.x).toBeCloseTo(toScene(b.radius) * GHOST_SHIP_SCALE, 5);
    expect(solid.rotation.y).toBeCloseTo(-b.heading, 5);
    expect(view.bossesWhere(() => true)).toEqual(['fantasma:solid']);
    // Pasa a fantasma: cambia la pieza, no el material.
    steps(run, 1.2);
    const g = run.snapshot().bosses[0]!;
    expect(g.fantasma!.mode).toBe('ghost');
    view.update(run.snapshot(), 2.2);
    expect(solid.visible).toBe(false);
    expect(ghost.visible).toBe(true);
    expect(ghost.position.y).toBeGreaterThanOrEqual(GHOST_HOVER - 0.1);
    expect((ghost.material as MeshLambertMaterial).opacity).toBe(GHOST_OPACITY);
    expect(view.bossesWhere(() => true)).toEqual(['fantasma:ghost']);
    // Sólo donde `test` lo acepta.
    expect(view.bossesWhere((x) => x > ghost.position.x + 1)).toEqual([]);
    view.dispose();
  });

  it('los piratas fantasma van a su pieza teñida y cuentan como piratas en pantalla; los normales, a la suya', () => {
    const { run, view } = game(quietConfig((c) => stillGhost(c, 0.5, 30, ['tripulacion'])));
    const p = run.snapshot().player;
    run.game.spawnBoss('fantasma', p.x + 300, p.y);
    steps(run, 2);
    run.game.spawnEnemy('pirate', p.x - 400, p.y + 200);
    const s = run.snapshot();
    const pirates = s.enemiesByType.pirate ?? [];
    const ghosts = pirates.filter((e) => e.ghost).length;
    expect(ghosts).toBeGreaterThan(0);
    expect(pirates.length - ghosts).toBe(1);
    view.update(s, 3);
    const meshes = view.meshes();
    expect(meshes['survivors-pirate-ghost']!.count).toBe(ghosts);
    expect(meshes['survivors-pirate']!.count).toBe(1);
    expect(meshes['survivors-pirate-ghost']!.visible).toBe(true);
    expect(view.typesWhere(() => true)).toContain('pirate');
    view.dispose();
  });

  it('cada andanada avisada pinta dos líneas por costado (tramo y relleno) perpendiculares al rumbo', () => {
    const { run, view } = game(
      quietConfig((c) => {
        const b = c.bosses.fantasma!;
        b.fantasma = { ...b.fantasma!, ghostAttacks: [], phases: b.phases.map(() => ({ solidS: 1e6, ghostS: 1 })) };
      }),
    );
    const p = run.snapshot().player;
    run.game.spawnBoss('fantasma', p.x + 300, p.y);
    let seen = 0;
    for (let i = 0; i < Math.round(12 / SURVIVORS_STEP_S) && seen === 0; i++) {
      run.step(IDLE);
      const s = run.snapshot();
      const lines = s.bossWarnings.filter((w) => w.kind === 'broadside');
      if (lines.length === 0) continue;
      seen = lines.length;
      view.update(s, i / 60);
      const mesh = view.meshes()['survivors-boss-warning']!;
      expect(mesh.count).toBe(lines.length * 2);
      expect(mesh.visible).toBe(true);
      const a = mesh.instanceMatrix.array;
      // Cada tramo entero mide el alcance de la andanada (escena) y el relleno, lo del progreso.
      for (let k = 0; k < lines.length; k++) {
        const o = k * 32;
        const len = Math.hypot(a[o]!, a[o + 1]!, a[o + 2]!);
        expect(len).toBeCloseTo(toScene(lines[k]!.length), 3);
        const fill = Math.hypot(a[o + 16]!, a[o + 17]!, a[o + 18]!);
        expect(fill).toBeLessThanOrEqual(len + 1e-6);
      }
    }
    expect(seen).toBe(2);
    view.dispose();
  });

  it('con movimiento reducido el barco no se mece ni se ladea; pintar no crea piezas nuevas', () => {
    const { run, view } = game(quietConfig((c) => stillGhost(c, 60, 1)), { reduced: true });
    const p = run.snapshot().player;
    run.game.spawnBoss('fantasma', p.x + 300, p.y);
    const { solid } = shipMeshes(view);
    const before = Object.values(view.meshes()).map((m) => m.instanceMatrix.array);
    for (let i = 0; i < 30; i++) {
      run.step(IDLE);
      view.update(run.snapshot(), 1 + i / 60);
      expect(solid.position.y).toBe(0);
      expect(solid.rotation.z).toBe(0);
    }
    const after = Object.values(view.meshes()).map((m) => m.instanceMatrix.array);
    expect(after).toHaveLength(before.length);
    after.forEach((a, i) => expect(a).toBe(before[i]));
    // Liberar: la vista se va de la escena con sus piezas.
    view.dispose();
    expect(view.group.parent).toBeNull();
    expect(solid.parent).toBe(view.group);
  });
});
