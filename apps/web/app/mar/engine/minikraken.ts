import type { QualityTier } from '@boia/engine/streaming';
import {
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  type MeshLambertMaterial,
  SphereGeometry,
} from 'three';
import { MINIKRAKEN_COLORS as K } from '../../../lib/barco/dressing';
import { litMaterial } from './characters';
import { Kit } from './kit';

/**
 * El minikraken (plan 013 T154): la primera mascota de cubierta, el premio de
 * `canon-kraken`. Low-poly como el resto del barco (barro pintado, caras
 * planas, color por vértice): una cúpula morada con su franja naranja de
 * BOIA, dos ojos grandes y seis tentáculos cortos. Mira a +x (la proa).
 *
 * Tres piezas, una llamada de dibujo cada una, con el mismo material:
 * - `head`: cabeza, ojos y manchas;
 * - `skirt`: los tentáculos de apoyo (se mecen como un pulpo que nada);
 * - `arm`: un tentáculo que saluda cerca de una isla, sobre su hombro.
 *
 * Se anima sólo con transformaciones (nada se crea en `update`). En `baja`
 * la geometría es más simple y los tentáculos no se mecen (sólo flota y
 * saluda); con movimiento reducido, quieto. No toca la física ni el juego.
 */

/** Alto del modelo en sus unidades (el barco lo escala con `MINIKRAKEN_SCALE`). */
export const MINIKRAKEN_HEIGHT = 1.15;
/** Escala en cubierta: un poco más bajo que la Fiestera (0,32 de una bola de radio 1). */
export const MINIKRAKEN_SCALE = 0.5;
/** A qué distancia de un lugar (escena) saluda. */
export const MINIKRAKEN_WAVE_DISTANCE = 45;

export interface MinikrakenState {
  /** Cerca de una isla: saluda. */
  waving: boolean;
  quality: QualityTier;
  reduced: boolean;
}

export interface Minikraken {
  group: Group;
  head: Mesh;
  skirt: Mesh;
  /** El hombro del tentáculo que saluda (gira) y el tentáculo. */
  shoulder: Group;
  arm: Mesh;
  /** Calidad con la que se construyó (en `baja`, menos caras). */
  quality: QualityTier;
  update(t: number, dt: number, s: MinikrakenState): void;
  dispose(): void;
}

/** Un tentáculo: un cono curvado en tres tramos, con la punta rizada. */
function tentacle(kit: Kit, low: boolean, at: { x: number; z: number; yaw: number }): void {
  const seg = low ? 4 : 5;
  const out = [Math.cos(at.yaw), Math.sin(at.yaw)] as const;
  // Raíz bajo la cabeza, saliendo hacia fuera y abajo; luego la punta sube.
  const pts = [
    { d: 0, y: 0.3, r: 0.11 },
    { d: 0.16, y: 0.12, r: 0.085 },
    { d: 0.32, y: 0.06, r: 0.06 },
    { d: 0.42, y: 0.14, r: 0.04 },
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = (b.d - a.d) * out[0];
    const dz = (b.d - a.d) * out[1];
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy, dz);
    const mid = {
      x: at.x + (a.d + b.d) * 0.5 * out[0],
      y: (a.y + b.y) * 0.5,
      z: at.z + (a.d + b.d) * 0.5 * out[1],
    };
    // Cilindro (eje y) inclinado hacia fuera: giro en z por la pendiente, luego en y por el rumbo.
    const tilt = Math.atan2(Math.hypot(dx, dz), dy);
    kit.add(new CylinderGeometry(b.r, a.r, len, seg), K.tentacle, {
      p: [mid.x, mid.y, mid.z],
      r: [0, -at.yaw, -tilt],
    });
  }
  const tip = pts[pts.length - 1]!;
  kit.add(new SphereGeometry(tip.r * 1.2, seg, 3), K.sucker, {
    p: [at.x + tip.d * out[0], tip.y + 0.02, at.z + tip.d * out[1]],
  });
}

export function createMinikraken(quality: QualityTier): Minikraken {
  const low = quality === 'baja';
  const mat = litMaterial();

  // Cabeza: la cúpula, la franja, los ojos y unas manchas.
  const h = new Kit();
  h.add(new IcosahedronGeometry(0.4, low ? 0 : 1), K.skin, { p: [0, 0.68, 0], s: [1, 1.18, 1] });
  h.add(new CylinderGeometry(0.4, 0.37, 0.09, low ? 7 : 10), K.band, { p: [0, 0.46, 0] });
  h.add(new IcosahedronGeometry(0.33, 0), K.belly, { p: [0.06, 0.38, 0], s: [1, 0.5, 1] });
  for (const z of [-0.15, 0.15]) {
    h.add(new SphereGeometry(0.12, low ? 6 : 8, low ? 4 : 6), K.eye, {
      p: [0.33, 0.66, z],
      s: [0.6, 1.1, 1],
    });
    h.add(new SphereGeometry(0.06, 5, 4), K.pupil, { p: [0.4, 0.64, z * 1.05] });
  }
  h.add(new IcosahedronGeometry(0.07, 0), K.spots, { p: [-0.22, 0.92, 0.18] });
  h.add(new IcosahedronGeometry(0.05, 0), K.spots, { p: [-0.12, 1.04, -0.16] });
  h.add(new IcosahedronGeometry(0.06, 0), K.spots, { p: [-0.32, 0.72, -0.2] });
  const head = new Mesh(h.build(), mat);

  // Faldón de tentáculos: seis alrededor, el delantero libre (ahí va el que saluda).
  const s = new Kit();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + Math.PI / n;
    tentacle(s, low, { x: Math.cos(yaw) * 0.16, z: Math.sin(yaw) * 0.16, yaw });
  }
  const skirt = new Mesh(s.build(), mat);

  // El que saluda: un tentáculo recto con la punta clara, de pie desde el hombro.
  const a = new Kit();
  a.add(new ConeGeometry(0.075, 0.42, low ? 4 : 5), K.tentacle, { p: [0, 0.21, 0] });
  a.add(new SphereGeometry(0.05, 5, 3), K.sucker, { p: [0, 0.42, 0] });
  const arm = new Mesh(a.build(), mat);
  const shoulder = new Group();
  shoulder.position.set(0.12, 0.55, 0.3);
  shoulder.add(arm);

  const group = new Group();
  group.name = 'minikraken';
  group.add(head, skirt, shoulder);
  group.scale.setScalar(MINIKRAKEN_SCALE);

  // Cuánto saluda ahora (0 abajo, 1 arriba): sube y baja suave.
  let raise = 0;
  // Brazo bajado: tumbado hacia popa, pegado al cuerpo.
  const DOWN = 2.2;

  return {
    group,
    head,
    skirt,
    shoulder,
    arm,
    quality,
    update(t, dt, st) {
      const goal = st.waving && !st.reduced ? 1 : 0;
      raise += (goal - raise) * Math.min(1, dt * 4);
      if (st.reduced) {
        group.position.y = 0;
        skirt.rotation.y = 0;
        skirt.scale.y = 1;
        head.rotation.z = 0;
        shoulder.rotation.x = DOWN * (1 - raise);
        shoulder.rotation.z = 0;
        return;
      }
      // Flota: un saltito suave, como el pulpo que se impulsa.
      group.position.y = Math.abs(Math.sin(t * 2.6)) * 0.05;
      head.rotation.z = Math.sin(t * 1.3) * 0.08;
      if (!low) {
        skirt.rotation.y = Math.sin(t * 1.7) * 0.3;
        skirt.scale.y = 1 + Math.sin(t * 5.2) * 0.1;
      }
      // Saluda: de abajo a arriba y, arriba, de lado a lado.
      shoulder.rotation.x = DOWN * (1 - raise) - raise * 0.35;
      shoulder.rotation.z = raise * Math.sin(t * 9) * 0.55;
    },
    dispose() {
      for (const m of [head, skirt, arm]) (m.geometry as BufferGeometry).dispose();
      (mat as MeshLambertMaterial).dispose();
    },
  };
}
