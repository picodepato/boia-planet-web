import { CRAB_BPM, crabBeatPhase } from '@boia/engine/characters';
import type { BufferGeometry } from 'three';
import {
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';

/**
 * El cangrejo bailarín (plan 029 T270): vive en una roca junto al puerto y
 * baila. Con la radio puesta sigue su compás (`crabBeatPhase`, a los BPM de
 * muestra sobre el tiempo de la canción); sin radio, un paseíto de lado.
 * Tocarlo le saca su paso especial: un giro con salto. Todo de a mano, estilo
 * de `wildlife.ts`; sólo transformaciones. Con movimiento reducido se queda
 * quieto (levanta una pinza al tocarlo, sin giro).
 */
export const CRAB_LOOK = {
  /** s que dura el paso especial. */
  specialS: 1.3,
  /** Hz del paseíto sin radio. */
  idleHz: 0.8,
  /** Cuánto se levanta del suelo al compás y en el salto (u). */
  hop: 0.12,
  jump: 0.45,
  /** Radio del toque en pantalla (px). */
  tapPx: 44,
} as const;

export type CrabVisual = 'quieto' | 'pasea' | 'baila' | 'giro';

export interface CrabBeat {
  /** ¿Suena la radio? Entonces baila a su compás. */
  playing: boolean;
  /** s de canción (para el compás). */
  elapsed: number;
}

export class Crab {
  readonly group = new Group();
  /** El cangrejo solo (sobre la roca), para animarlo. */
  readonly body = new Group();
  visual: CrabVisual = 'quieto';
  /** Altura de la cima de la roca sobre el agua (donde está el cangrejo). */
  readonly top: number;
  private readonly claws: { left: Group; right: Group };
  private readonly legs: Group[] = [];
  private special = -1;
  private time = 0;
  private disposed = false;

  constructor() {
    this.group.name = 'cangrejo-bailarin';
    const rock = new MeshLambertMaterial({ color: '#6b6a72', flatShading: true });
    const rockLight = new MeshLambertMaterial({ color: '#8a8793', flatShading: true });
    const shell = new MeshLambertMaterial({ color: '#e8532a', flatShading: true });
    const shellDark = new MeshLambertMaterial({ color: '#b83a1c', flatShading: true });
    const dark = new MeshBasicMaterial({ color: '#1c1d26' });
    const white = new MeshBasicMaterial({ color: '#ffffff' });
    // La roca: dos peñascos, el de arriba plano donde baila.
    const base = new Mesh(new DodecahedronGeometry(1.1, 0), rock);
    base.scale.set(1.4, 0.8, 1.2);
    base.position.y = 0.1;
    const top = new Mesh(new DodecahedronGeometry(0.75, 0), rockLight);
    top.scale.set(1.2, 0.55, 1.0);
    top.position.set(0.1, 0.78, -0.05);
    this.group.add(base, top);
    this.top = 1.05;
    // El cangrejo: caparazón, ojos en sus tallos, dos pinzas y ocho patas.
    const body = this.body;
    body.position.set(0.1, this.top, -0.05);
    const claws: Group[] = [];
    const carapace = new Mesh(new SphereGeometry(0.3, 8, 5), shell);
    carapace.scale.set(1.5, 0.6, 1.0);
    carapace.position.y = 0.2;
    body.add(carapace);
    for (const side of [-1, 1]) {
      const stalk = new Mesh(new CylinderGeometry(0.03, 0.03, 0.22, 5), shellDark);
      stalk.position.set(side * 0.12, 0.4, 0.26);
      body.add(stalk);
      const eye = new Mesh(new SphereGeometry(0.06, 6, 4), white);
      eye.position.set(side * 0.12, 0.52, 0.27);
      body.add(eye);
      const pupil = new Mesh(new SphereGeometry(0.028, 5, 4), dark);
      pupil.position.set(side * 0.12, 0.53, 0.32);
      body.add(pupil);
      // La pinza: brazo y tenaza, con el pivote en el hombro.
      const claw = new Group();
      claw.position.set(side * 0.36, 0.22, 0.14);
      const arm = new Mesh(new CylinderGeometry(0.05, 0.06, 0.28, 6), shellDark);
      arm.rotation.z = side * -0.9;
      arm.position.set(side * 0.1, 0.06, 0.04);
      const pincer = new Mesh(new SphereGeometry(0.13, 7, 5), shell);
      pincer.scale.set(1.3, 0.8, 0.9);
      pincer.position.set(side * 0.24, 0.1, 0.08);
      const tip = new Mesh(new SphereGeometry(0.07, 6, 4), shellDark);
      tip.position.set(side * 0.33, 0.17, 0.1);
      claw.add(arm, pincer, tip);
      body.add(claw);
      claws.push(claw);
      for (let i = 0; i < 4; i++) {
        const leg = new Group();
        leg.position.set(side * 0.3, 0.12, -0.2 + i * 0.13);
        const seg = new Mesh(new CylinderGeometry(0.025, 0.035, 0.3, 5), shellDark);
        seg.rotation.z = side * -1.1;
        seg.position.set(side * 0.13, -0.04, 0);
        leg.add(seg);
        body.add(leg);
        this.legs.push(leg);
      }
    }
    this.claws = { left: claws[0]!, right: claws[1]! };
    this.group.add(body);
  }

  /** Un toque: el paso especial (un giro con salto). */
  tap(): void {
    this.special = 0;
    this.visual = 'giro';
  }

  update(dt: number, beat: CrabBeat | null, reduced: boolean): void {
    if (this.disposed) return;
    const step = Math.max(0, Math.min(0.1, dt));
    this.time += step;
    const b = this.body;
    const L = CRAB_LOOK;
    if (this.special >= 0) {
      this.special += step;
      const k = Math.min(1, this.special / L.specialS);
      if (k >= 1) {
        this.special = -1;
        b.rotation.y = 0;
      } else {
        this.visual = 'giro';
        // Sin movimiento reducido, una vuelta entera con salto; con él, sólo levanta las pinzas.
        b.rotation.y = reduced ? 0 : k * Math.PI * 2;
        b.position.y = this.top + (reduced ? 0 : Math.sin(k * Math.PI) * L.jump);
        this.claws.left.rotation.z = 1.1;
        this.claws.right.rotation.z = -1.1;
        this.legs.forEach(
          (l, i) => (l.rotation.x = reduced ? 0 : Math.sin(this.time * 18 + i) * 0.5),
        );
        return;
      }
    }
    if (reduced) {
      this.visual = 'quieto';
      b.position.y = this.top;
      b.position.x = 0.1;
      b.rotation.set(0, 0, 0);
      this.claws.left.rotation.set(0, 0, 0);
      this.claws.right.rotation.set(0, 0, 0);
      for (const l of this.legs) l.rotation.x = 0;
      return;
    }
    if (beat?.playing) {
      // Al compás: salta en cada pulso y alterna las pinzas; las patas marcan el paso.
      this.visual = 'baila';
      const ph = crabBeatPhase(beat.elapsed);
      const beatNo = Math.floor((beat.elapsed * CRAB_BPM) / 60);
      const up = Math.sin(ph * Math.PI);
      b.position.y = this.top + up * L.hop;
      b.position.x = 0.1 + (beatNo % 2 === 0 ? 1 : -1) * ph * 0.08;
      b.rotation.z = (beatNo % 2 === 0 ? 1 : -1) * up * 0.18;
      b.rotation.y = Math.sin(beat.elapsed * 1.3) * 0.25;
      this.claws.left.rotation.z = beatNo % 2 === 0 ? 0.3 + up * 0.9 : 0.2;
      this.claws.right.rotation.z = beatNo % 2 === 1 ? -0.3 - up * 0.9 : -0.2;
      this.legs.forEach((l, i) => (l.rotation.x = Math.sin(ph * Math.PI * 2 + i * 0.8) * 0.4));
      return;
    }
    // Sin radio: un paseíto de lado, perezoso.
    this.visual = 'pasea';
    const w = this.time * L.idleHz * Math.PI * 2;
    b.position.y = this.top + Math.max(0, Math.sin(w * 2)) * 0.02;
    b.position.x = 0.1 + Math.sin(w * 0.5) * 0.12;
    b.rotation.set(0, Math.sin(w * 0.25) * 0.2, Math.sin(w) * 0.05);
    this.claws.left.rotation.z = 0.15 + Math.sin(w) * 0.1;
    this.claws.right.rotation.z = -0.15 + Math.sin(w + 1) * 0.1;
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(w + i * 0.8) * 0.25));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    const geometry = new Set<BufferGeometry>();
    const materials = new Set<MeshBasicMaterial | MeshLambertMaterial>();
    this.group.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      geometry.add(m.geometry);
      for (const material of Array.isArray(m.material) ? m.material : [m.material])
        materials.add(material as MeshBasicMaterial);
    });
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}
