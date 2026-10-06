import {
  type DefenseConfig,
  type DefenseShotView,
  type DefenseTowerKind,
  type DefenseTowerState,
  defenseTowerStats,
} from '@boia/engine/defense';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  type InstancedMesh,
  type Material,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { toScene } from './compress';
import { C } from './palette';
import { curveTree } from './planet';
import { instanced } from './survivors-props';

/**
 * Lo que hacen las islas construidas y el avión, a la vista (plan 014 T160,
 * decisión 9): el haz que gira del Faro, las bolas de nieve de Nochevieja,
 * el fuego en cono de Halloween, el cohete y el estallido del Puerto, las
 * monedas que saltan en Ibiza, la onda de graves de la Isla del Sonido, el
 * trazo del francotirador de Benidorm y las balas del avión. Todo sale del
 * último disparo de cada torre (`lastShot`, T159) y de la hora de la partida:
 * sin estado propio. Una `InstancedMesh` por pieza, de tope fijo (lo que
 * sobra no se pinta). Escena salvo donde se diga.
 */

/** s que se ve cada efecto después de su disparo. muestra */
export const FX_S = {
  snowball: 0.3,
  flame: 0.35,
  burst: 0.45,
  coins: 1.1,
  wave: 0.5,
  tracer: 0.25,
} as const;

/** Altura (escena) a la que va cada cosa sobre el agua. muestra */
const BEAM_Y = 1.1;
const SNOW_Y = 2.6;
const FLAME_Y = 0.6;
const WAVE_Y = 0.35;
const TRACER_Y = 5;
const ROCKET_ARC = 9;
const PLANE_SHOT_Y = 5.2;

/** Cuántas piezas de cada efecto caben (más islas: no se pintan las de más). */
const CAP = { beams: 3 * 48, balls: 96, flames: 64, rockets: 64, bursts: 64, coins: 3 * 48, waves: 64, tracers: 64, shots: 96 } as const;

/** Un sector plano de radio 1 y medio ángulo `half` (rad), hacia +x. */
function sectorGeometry(half: number, segments = 10): BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = -half + (2 * half * i) / segments;
    const a1 = -half + (2 * half * (i + 1)) / segments;
    pos.push(0, 0, 0, Math.cos(a1), 0, Math.sin(a1), Math.cos(a0), 0, Math.sin(a0));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const glowMat = (color: string, opacity: number) =>
  new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });

/** Lo que la vista sabe hacer: de la partida (u) a la escena, y la hora. */
export interface FxFrame {
  /** Un punto de la partida en la escena (x, z). */
  at(x: number, y: number): { x: number; z: number };
  /** Un rumbo de la partida en el mar. */
  heading(h: number): number;
}

export class DefenseFx {
  readonly meshes: InstancedMesh[];
  private readonly beams: InstancedMesh;
  private readonly balls: InstancedMesh;
  private readonly flames: InstancedMesh;
  private readonly rockets: InstancedMesh;
  private readonly bursts: InstancedMesh;
  private readonly coins: InstancedMesh;
  private readonly waves: InstancedMesh;
  private readonly tracers: InstancedMesh;
  private readonly shots: InstancedMesh;
  private readonly d = new Object3D();
  private readonly cfg: DefenseConfig;
  /** Lo que se pintó en el último `update`, por tipo de efecto (pruebas). */
  readonly drawn: Record<string, number> = {};

  constructor(cfg: DefenseConfig, low: boolean) {
    this.cfg = cfg;
    const seg = low ? 20 : 36;
    // El haz: una banda en el agua de largo 1 hacia +x.
    this.beams = instanced(
      new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0),
      glowMat('#fff1a8', 0.45),
      CAP.beams,
      'defense-fx-beam',
    );
    this.balls = instanced(new IcosahedronGeometry(1, low ? 0 : 1), new MeshBasicMaterial({ color: '#ffffff' }), CAP.balls, 'defense-fx-snowball');
    this.flames = instanced(sectorGeometry(1, low ? 6 : 10), glowMat('#ff7a2e', 0.6), CAP.flames, 'defense-fx-flame');
    this.rockets = instanced(new ConeGeometry(0.35, 1.4, 6).rotateZ(-Math.PI / 2), new MeshBasicMaterial({ color: C.pink }), CAP.rockets, 'defense-fx-rocket');
    this.bursts = instanced(new RingGeometry(0.75, 1, seg).rotateX(-Math.PI / 2), glowMat('#ffd23f', 0.75), CAP.bursts, 'defense-fx-burst');
    this.coins = instanced(new CylinderGeometry(0.5, 0.5, 0.14, low ? 8 : 12).rotateX(Math.PI / 2), new MeshBasicMaterial({ color: C.gold }), CAP.coins, 'defense-fx-coin');
    this.waves = instanced(new RingGeometry(0.85, 1, seg).rotateX(-Math.PI / 2), glowMat('#b38bff', 0.55), CAP.waves, 'defense-fx-wave');
    this.tracers = instanced(new BoxGeometry(1, 0.18, 0.18).translate(0.5, 0, 0), glowMat('#ffffff', 0.85), CAP.tracers, 'defense-fx-tracer');
    this.shots = instanced(new SphereGeometry(1, 8, 6), new MeshBasicMaterial({ color: '#9fe8ff' }), CAP.shots, 'defense-fx-plane-shot');
    this.d.rotation.order = 'YXZ';
    this.meshes = [
      this.beams,
      this.balls,
      this.flames,
      this.rockets,
      this.bursts,
      this.coins,
      this.waves,
      this.tracers,
      this.shots,
    ];
    for (const m of this.meshes) {
      m.renderOrder = 2;
      curveTree(m, true);
    }
  }

  /**
   * Pinta los efectos de ahora. `nowS`: s de tiempo activo de la partida.
   */
  update(
    towers: readonly DefenseTowerState[],
    shots: readonly DefenseShotView[],
    nowS: number,
    f: FxFrame,
    reduced: boolean,
  ): void {
    const n = { beams: 0, balls: 0, flames: 0, rockets: 0, bursts: 0, coins: 0, waves: 0, tracers: 0 };
    const d = this.d;
    for (const tw of towers) {
      const s = tw.lastShot;
      if (!s) continue;
      const age = nowS - s.atS;
      if (age < -1e-6) continue;
      const o = f.at(tw.x, tw.y);
      switch (tw.kind as DefenseTowerKind) {
        case 'faro': {
          if (age > 0.2) break;
          const st = defenseTowerStats(this.cfg, 'faro', tw.level);
          const len = toScene(s.radius ?? st.range);
          const w = toScene(st.beamWidth) * 2;
          for (let k = 0; k < st.beams && n.beams < CAP.beams; k++) {
            const a = f.heading((s.angle ?? 0) + (k / st.beams) * Math.PI * 2);
            d.position.set(o.x, BEAM_Y, o.z);
            d.rotation.set(0, -a, 0);
            d.scale.set(len, 1, w);
            d.updateMatrix();
            this.beams.setMatrixAt(n.beams++, d.matrix);
          }
          break;
        }
        case 'ultima': {
          if (age > FX_S.snowball || s.x === undefined || s.y === undefined || n.balls >= CAP.balls) break;
          const p = f.at(s.x, s.y);
          const k = age / FX_S.snowball;
          d.position.set(o.x + (p.x - o.x) * k, SNOW_Y + Math.sin(k * Math.PI) * 2, o.z + (p.z - o.z) * k);
          d.rotation.set(0, 0, 0);
          d.scale.setScalar(0.7);
          d.updateMatrix();
          this.balls.setMatrixAt(n.balls++, d.matrix);
          break;
        }
        case 'halloween': {
          if (age > FX_S.flame || n.flames >= CAP.flames) break;
          const st = defenseTowerStats(this.cfg, 'halloween', tw.level);
          const r = toScene(s.radius ?? st.range);
          const k = reduced ? 1 : 0.6 + 0.4 * Math.min(1, age / 0.12);
          d.position.set(o.x, FLAME_Y, o.z);
          d.rotation.set(0, -f.heading(s.angle ?? 0), 0);
          // El sector de medio ángulo 1 rad, estrechado al cono de la isla.
          d.scale.set(r * k, 1, (r * k * Math.tan(st.coneRad)) / Math.tan(1));
          d.updateMatrix();
          this.flames.setMatrixAt(n.flames++, d.matrix);
          break;
        }
        case 'cala': {
          if (s.x === undefined || s.y === undefined) break;
          const p = f.at(s.x, s.y);
          if (s.flightS) {
            if (age > s.flightS || n.rockets >= CAP.rockets) break;
            const k = age / s.flightS;
            d.position.set(o.x + (p.x - o.x) * k, 2 + Math.sin(k * Math.PI) * ROCKET_ARC, o.z + (p.z - o.z) * k);
            d.rotation.set(0, -Math.atan2(p.z - o.z, p.x - o.x), Math.cos(k * Math.PI) * 0.9);
            d.scale.setScalar(1);
            d.updateMatrix();
            this.rockets.setMatrixAt(n.rockets++, d.matrix);
          } else if (age <= FX_S.burst && n.bursts < CAP.bursts) {
            const r = toScene(s.radius ?? 80);
            const k = reduced ? 1 : 0.25 + 0.75 * (age / FX_S.burst);
            d.position.set(p.x, WAVE_Y + 0.1, p.z);
            d.rotation.set(0, 0, 0);
            d.scale.set(r * k, 1, r * k);
            d.updateMatrix();
            this.bursts.setMatrixAt(n.bursts++, d.matrix);
          }
          break;
        }
        case 'tienda': {
          if (age > FX_S.coins) break;
          const k = age / FX_S.coins;
          for (let c = 0; c < 3 && n.coins < CAP.coins; c++) {
            const a = c * 2.1 + tw.id;
            d.position.set(o.x + Math.cos(a) * 1.4 * k, 4 + k * 5 + c * 0.6, o.z + Math.sin(a) * 1.4 * k);
            d.rotation.set(0, reduced ? 0 : age * 9 + c, 0);
            d.scale.setScalar(1 - k * 0.5);
            d.updateMatrix();
            this.coins.setMatrixAt(n.coins++, d.matrix);
          }
          break;
        }
        case 'allday': {
          if (age > FX_S.wave || n.waves >= CAP.waves) break;
          const r = toScene(s.radius ?? 170);
          const k = reduced ? 1 : Math.max(0.1, age / FX_S.wave);
          d.position.set(o.x, WAVE_Y, o.z);
          d.rotation.set(0, 0, 0);
          d.scale.set(r * k, 1, r * k);
          d.updateMatrix();
          this.waves.setMatrixAt(n.waves++, d.matrix);
          break;
        }
        case 'fotos': {
          if (age > FX_S.tracer || s.x === undefined || s.y === undefined || n.tracers >= CAP.tracers) break;
          const p = f.at(s.x, s.y);
          const dx = p.x - o.x;
          const dz = p.z - o.z;
          const top = TRACER_Y + 6;
          const len = Math.hypot(dx, dz, top - 1);
          d.position.set(o.x, top, o.z);
          // Del rascacielos al blanco: rumbo en el agua y caída.
          d.rotation.set(0, -Math.atan2(dz, dx), -Math.atan2(top - 1, Math.hypot(dx, dz)));
          const thin = 1 - age / FX_S.tracer;
          d.scale.set(len, 0.5 + thin, 0.5 + thin);
          d.updateMatrix();
          this.tracers.setMatrixAt(n.tracers++, d.matrix);
          break;
        }
        default:
          break;
      }
    }
    let ns = 0;
    for (const sh of shots) {
      if (ns >= CAP.shots) break;
      const p = f.at(sh.x, sh.y);
      d.position.set(p.x, PLANE_SHOT_Y, p.z);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(Math.max(0.35, toScene(sh.radius) * 1.4));
      d.updateMatrix();
      this.shots.setMatrixAt(ns++, d.matrix);
    }
    const counts: [InstancedMesh, number, string][] = [
      [this.beams, n.beams, 'haz'],
      [this.balls, n.balls, 'nieve'],
      [this.flames, n.flames, 'fuego'],
      [this.rockets, n.rockets, 'cohete'],
      [this.bursts, n.bursts, 'estallido'],
      [this.coins, n.coins, 'monedas'],
      [this.waves, n.waves, 'onda'],
      [this.tracers, n.tracers, 'trazo'],
      [this.shots, ns, 'balas'],
    ];
    for (const [m, c, name] of counts) {
      m.count = c;
      m.visible = c > 0;
      if (c > 0) m.instanceMatrix.needsUpdate = true;
      this.drawn[name] = c;
    }
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
  }
}
