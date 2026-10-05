import {
  type BossView,
  type BossWarningView,
  createSurvivors,
  type KrakenView,
  ROCK_ATTACK,
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  type SurvivorsSnapshot,
  TENTACLE_ATTACK,
} from '@boia/engine/survivors';
import { Box3, Color, type Material, Matrix4, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../lib/i18n';
import { toScene } from './compress';
import {
  GRAB_ARMS,
  KRAKEN_COLORS,
  KRAKEN_HEAD_Y,
  SurvivorsKraken,
  headOut,
  krakenHeadGeometry,
  tentacleBaseGeometry,
} from './survivors-kraken';
import { SurvivorsView } from './survivors-view';

/**
 * El Kraken en el mar 3D (plan 012 T142): la sombra mientras persigue, la
 * cabeza al salir, los tentáculos desde sus círculos, las rocas con su
 * círculo de caída, los brazos sobre la isla agarrada; crear, pintar y
 * soltar; con movimiento reducido, nada se mece.
 */

const KRAKEN = SURVIVORS_CONFIG.bosses.kraken!;

function setup(reduced = false, quality: 'alta' | 'baja' = 'alta') {
  const config: SurvivorsConfig = structuredClone(SURVIVORS_CONFIG);
  config.acts = [{ act: 1, durationS: 420, tracks: [], events: [] }];
  config.weapons.canon!.base.damage = 0;
  config.player.waterCapacity = 1e12;
  config.salvavidas.offerChance = 0;
  const world = {
    bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
    obstacles: [],
    start: { x: 0, y: 0 },
  };
  const game = createSurvivors(config, 7, world);
  const view = new SurvivorsView(config, game.caps, { reduced, quality, sea: world });
  let time = 0;
  const step = (seconds: number) => {
    for (let k = 0; k < Math.round(seconds / SURVIVORS_STEP_S); k++) game.step();
    time += seconds;
    view.update(game.snapshot(), time);
  };
  return { game, view, step, kraken: view.kraken! };
}

/** Pasos hasta que `until` diga que sí (con un tope). */
function stepUntil(step: (s: number) => void, until: () => boolean, maxS = 40): void {
  for (let s = 0; s < maxS && !until(); s += 0.1) step(0.1);
  expect(until()).toBe(true);
}

/** Un Kraken a mano, para pintar estados que la partida tarda en dar. */
function fakeBoss(kraken: Partial<KrakenView>, over: Partial<BossView> = {}): BossView {
  return {
    id: 1,
    boss: 'kraken',
    kind: 'boss',
    nameKey: KRAKEN.i18nKey,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    heading: 0,
    radius: KRAKEN.radius,
    hp: 100,
    maxHp: 100,
    hpFraction: 1,
    phase: 1,
    phaseCount: 3,
    invulnerable: false,
    attack: null,
    attackStage: null,
    fantasma: null,
    kraken: {
      mode: 'emerged',
      progress: 0.5,
      exposed: false,
      exposedS: 0,
      island: -1,
      tentacles: [],
      rocks: [],
      ...kraken,
    },
    ...over,
  };
}

function circle(attack: string, x: number, y: number, progress: number, hit = false): BossWarningView {
  return {
    id: 1,
    boss: 'kraken',
    attack,
    kind: 'circles',
    x,
    y,
    heading: 0,
    length: 0,
    radius: 40,
    thickness: 0,
    gaps: 0,
    gapRad: 0,
    gapPhase: 0,
    ringRadius: 0,
    progress,
    hit,
  };
}

function snap(boss: BossView | null, warnings: BossWarningView[] = []): SurvivorsSnapshot {
  return { bosses: boss ? [boss] : [], bossWarnings: warnings } as unknown as SurvivorsSnapshot;
}

const matrixOf = (mesh: { getMatrixAt(i: number, m: Matrix4): void }, i: number) => {
  const m = new Matrix4();
  mesh.getMatrixAt(i, m);
  return m;
};
const positionOf = (m: Matrix4) => new Vector3().setFromMatrixPosition(m);

describe('Kraken low-poly models', () => {
  it('builds a head with eyes looking forward and tentacles that stand from the water', () => {
    const head = krakenHeadGeometry('baja');
    const size = new Box3().setFromBufferAttribute(head.getAttribute('position') as never).getSize(new Vector3());
    expect(size.y).toBeGreaterThan(1.8);
    expect(head.getAttribute('position').count).toBeLessThan(3000);
    const colors = head.getAttribute('color');
    for (const hex of [KRAKEN_COLORS.skin, KRAKEN_COLORS.eye, KRAKEN_COLORS.pupil]) {
      const c = new Color(hex);
      let found = false;
      for (let k = 0; k < colors.count && !found; k++) {
        found = Math.abs(colors.getX(k) - c.r) + Math.abs(colors.getY(k) - c.g) + Math.abs(colors.getZ(k) - c.b) < 1e-6;
      }
      expect(found).toBe(true);
    }
    const base = new Box3().setFromBufferAttribute(tentacleBaseGeometry().getAttribute('position') as never);
    expect(base.min.y).toBeCloseTo(0, 5);
    expect(base.max.y).toBeCloseTo(1, 5);
    expect(t(KRAKEN.i18nKey as never)).toBe(t('survivors.boss.kraken'));
    expect(t('survivors.boss.kraken')).toBeTruthy();
    head.dispose();
  });

  it('the head is out by mode and progress', () => {
    expect(headOut('submerged', 0.7)).toBe(0);
    expect(headOut('emerging', 0.25)).toBe(0.25);
    expect(headOut('emerged', 0)).toBe(1);
    expect(headOut('grabbing', 0)).toBe(1);
    expect(headOut('diving', 0.25)).toBe(0.75);
  });
});

describe('Kraken view on a real game', () => {
  it('shows a shadow while it chases, then the head and the tentacles out of their circles; clears after defeat', () => {
    const { game, view, step, kraken } = setup(false, 'baja');
    step(0);
    expect(kraken.shown()).toBeNull();
    expect(view.bossesWhere(() => true)).toEqual([]);
    game.spawnBoss('kraken', 400, 0);
    step(0.1);
    // Sumergido: sólo la sombra, alargada en su rumbo, a ras de agua.
    expect(game.snapshot().bosses[0]!.kraken!.mode).toBe('submerged');
    expect(kraken.shadow.visible).toBe(true);
    expect(kraken.head.visible).toBe(false);
    expect(kraken.shadow.position.y).toBeLessThan(0.1);
    expect(kraken.shadow.scale.x).toBeGreaterThan(kraken.shadow.scale.z);
    expect(view.bossesWhere(() => true)).toEqual(['kraken:submerged']);
    expect(view.bossesWhere(() => false)).toEqual([]);
    // Sale: la cabeza aparece y la sombra se va.
    stepUntil(step, () => game.snapshot().bosses[0]?.kraken?.mode === 'emerged');
    const s = game.snapshot().bosses[0]!;
    expect(kraken.head.visible).toBe(true);
    expect(kraken.shadow.visible).toBe(false);
    expect(kraken.head.position.x).toBeCloseTo(toScene(s.x), 5);
    expect(kraken.head.scale.x).toBeCloseTo(toScene(s.radius), 5);
    expect(view.bossesWhere(() => true)).toEqual(['kraken:emerged']);
    // Un tentáculo avisa con su círculo antes de salir de él.
    stepUntil(step, () => game.snapshot().bossWarnings.some((w) => w.attack === TENTACLE_ATTACK));
    expect(kraken.circleTrack.visible).toBe(true);
    expect(kraken.circleTrack.count).toBe(
      game.snapshot().bossWarnings.filter((w) => w.boss === 'kraken' && w.kind === 'circles').length,
    );
    stepUntil(step, () => game.snapshot().bosses[0]!.kraken!.tentacles.some((x) => x.stage === 'up'));
    const up = game.snapshot().bosses[0]!.kraken!.tentacles.filter((x) => x.stage !== 'warning');
    expect(kraken.tentacleBase.count).toBe(up.length);
    expect(kraken.tentacleTip.count).toBe(up.length);
    const at = positionOf(matrixOf(kraken.tentacleBase, 0));
    expect(up.some((x) => Math.hypot(at.x - toScene(x.x), at.z - toScene(x.y)) < 1e-4)).toBe(true);
    // Sin boss (vencido o retirado): nada queda pintado.
    view.update({ ...game.snapshot(), bosses: [], bossWarnings: [] }, 100);
    expect(kraken.shown()).toBeNull();
    expect(view.bossesWhere(() => true)).toEqual([]);
    for (const m of kraken.instancedMeshes()) expect(m.visible).toBe(false);
    expect(kraken.exposedRing.visible).toBe(false);
    view.dispose();
  });
});

describe('Kraken view states', () => {
  it('exposed head rises with a steady gold ring; tentacle and rock circles fill with progress in their colors', () => {
    const k = new SurvivorsKraken('alta');
    k.update(snap(fakeBoss({ exposed: false })), 0, true);
    expect(k.head.position.y).toBeCloseTo(KRAKEN_HEAD_Y.out * toScene(KRAKEN.radius), 5);
    expect(k.exposedRing.visible).toBe(false);
    k.update(snap(fakeBoss({ exposed: true, exposedS: 3 })), 0.1, true);
    expect(k.head.position.y).toBeCloseTo(KRAKEN_HEAD_Y.exposed * toScene(KRAKEN.radius), 5);
    expect(k.exposedRing.visible).toBe(true);
    const ringMat = k.exposedRing.material as Material & { opacity: number };
    const opacity = ringMat.opacity;
    k.update(snap(fakeBoss({ exposed: true, exposedS: 2 })), 0.5, false);
    expect(ringMat.opacity).toBe(opacity);

    k.update(
      snap(fakeBoss({}), [circle(TENTACLE_ATTACK, 100, 0, 0.5), circle(ROCK_ATTACK, -100, 0, 0.25)]),
      1,
      true,
    );
    expect(k.circleTrack.count).toBe(2);
    expect(k.circleFill.count).toBe(2);
    const track = new Vector3().setFromMatrixScale(matrixOf(k.circleTrack, 0)).x;
    const fill = new Vector3().setFromMatrixScale(matrixOf(k.circleFill, 0)).x;
    expect(track).toBeCloseTo(toScene(40), 5);
    expect(fill).toBeCloseTo(toScene(40) * 0.5, 5);
    const c0 = new Color();
    const c1 = new Color();
    k.circleTrack.getColorAt(0, c0);
    k.circleTrack.getColorAt(1, c1);
    expect(c0.getHexString()).toBe(new Color(KRAKEN_COLORS.tentacleWarning).getHexString());
    expect(c1.getHexString()).toBe(new Color(KRAKEN_COLORS.rockWarning).getHexString());
    // Subiendo (golpe): relleno entero.
    k.update(snap(fakeBoss({}), [circle(TENTACLE_ATTACK, 100, 0, 0.1, true)]), 1.1, true);
    expect(new Vector3().setFromMatrixScale(matrixOf(k.circleFill, 0)).x).toBeCloseTo(toScene(40), 5);
    k.dispose();
  });

  it('rocks fly in an arc from the Kraken to their landing circle', () => {
    const k = new SurvivorsKraken('baja');
    const rock = (progress: number) => ({ id: 9, fromX: 0, fromY: 0, x: 400, y: 0, radius: 60, progress });
    k.update(snap(fakeBoss({ mode: 'grabbing', rocks: [rock(0.5)] })), 0, true);
    expect(k.rocks.count).toBe(1);
    const mid = positionOf(matrixOf(k.rocks, 0));
    expect(mid.x).toBeCloseTo(toScene(200), 4);
    k.update(snap(fakeBoss({ mode: 'grabbing', rocks: [rock(0.99)] })), 0.1, true);
    const end = positionOf(matrixOf(k.rocks, 0));
    expect(end.x).toBeGreaterThan(mid.x);
    expect(end.y).toBeLessThan(mid.y);
    k.dispose();
  });

  it('grabbing an island lays two arms towards it', () => {
    const sea = {
      bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
      obstacles: [{ x: 0, y: 300, radius: 120 }],
    };
    const k = new SurvivorsKraken('alta', sea);
    k.update(snap(fakeBoss({ mode: 'grabbing', island: 0 }, { x: 0, y: 120 })), 0, true);
    expect(k.tentacleBase.count).toBe(GRAB_ARMS);
    for (let i = 0; i < GRAB_ARMS; i++) {
      // La punta queda del lado de la isla (z mayor en la escena).
      const tip = positionOf(matrixOf(k.tentacleTip, i));
      expect(tip.z).toBeGreaterThan(toScene(120));
    }
    k.update(snap(fakeBoss({ mode: 'emerged', island: -1 })), 0.1, true);
    expect(k.tentacleBase.count).toBe(0);
    k.dispose();
  });

  for (const reduced of [false, true]) {
    it(`reduced motion keeps the same frame still (reduced=${reduced})`, () => {
      const k = new SurvivorsKraken('baja');
      const boss = fakeBoss({
        mode: 'emerged',
        tentacles: [{ id: 3, x: 120, y: 40, radius: 30, stage: 'up', progress: 1, hp: 10, maxHp: 10 }],
        rocks: [{ id: 4, fromX: 0, fromY: 0, x: 300, y: 0, radius: 60, progress: 0.4 }],
      });
      k.update(snap(boss), 1, reduced);
      const a = {
        head: k.head.matrix.clone().compose(k.head.position, k.head.quaternion, k.head.scale).elements,
        tentacle: matrixOf(k.tentacleTip, 0).elements,
        rock: matrixOf(k.rocks, 0).elements,
      };
      k.update(snap(boss), 1.7, reduced);
      const b = {
        head: k.head.matrix.clone().compose(k.head.position, k.head.quaternion, k.head.scale).elements,
        tentacle: matrixOf(k.tentacleTip, 0).elements,
        rock: matrixOf(k.rocks, 0).elements,
      };
      if (reduced) expect(b).toEqual(a);
      else {
        expect(b.tentacle).not.toEqual(a.tentacle);
        expect(b.rock).not.toEqual(a.rock);
      }
      k.dispose();
    });
  }

  it('disposes every geometry and material once, standalone and from the view', () => {
    const k = new SurvivorsKraken('baja');
    const resources = new Set<{ addEventListener(type: 'dispose', fn: () => void): void }>();
    k.group.traverse((o) => {
      const m = o as unknown as { isMesh?: boolean; geometry: never; material: never };
      if (!m.isMesh) return;
      resources.add(m.geometry);
      resources.add(m.material);
    });
    const spies = [...resources].map((r) => {
      const fn = vi.fn();
      r.addEventListener('dispose', fn);
      return fn;
    });
    // Base y punta comparten material: se suelta una vez.
    expect(k.tentacleBase.material).toBe(k.tentacleTip.material);
    k.dispose();
    for (const fn of spies) expect(fn).toHaveBeenCalledTimes(1);

    const { view, kraken } = setup(true);
    const head = vi.fn();
    kraken.head.geometry.addEventListener('dispose', head);
    view.dispose();
    expect(kraken.group.parent).toBeNull();
    expect(head).toHaveBeenCalledTimes(1);
  });
});
