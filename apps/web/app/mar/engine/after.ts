import { AFTER_TUNING, type FishPose, afterGlow, fishPose } from '@boia/engine/after';
import { ConeGeometry, Group, Mesh, type Object3D, SphereGeometry } from 'three';
import { litMaterial } from './characters';
import { Kit } from './kit';
import { C } from './palette';

/**
 * La isla del after en el mar 3D (plan 029 T273): lo que se ve, con la
 * lógica pura de `@boia/engine/after`. La isla (su composición a mano o su
 * modelo de Blender) sube del agua a las 03:00 y se hunde a las 07:00
 * (`fade` 0..1 del `AfterClock`); mientras está fuera, un corro de peces
 * baila alrededor saltando al compás y el neón late con la música
 * (`afterGlow`). Todo cuelga del grupo de la isla, así que se mueve con ella.
 */

/** Colores de los peces del after. muestra */
const FISH_COLORS = [C.pink, C.yellow, '#7af7ff', C.orange, '#b58cff'] as const;

/** Cuánto baja la isla bajo el agua (escena) al estar cerrada: su radio y pico. */
const sinkDepth = (R: number) => 4 + R * 0.6;

function fishGeometry(color: string) {
  const k = new Kit();
  // Cuerpo hacia +x, cola detrás.
  k.add(new ConeGeometry(0.22, 0.7, 6), color, { p: [0.1, 0, 0], r: [0, 0, -Math.PI / 2] });
  k.add(new ConeGeometry(0.16, 0.3, 4), color, { p: [-0.38, 0, 0], r: [0, 0, Math.PI / 2] });
  k.add(new SphereGeometry(0.05, 4, 4), '#1a1020', { p: [0.3, 0.08, 0.12] });
  k.add(new SphereGeometry(0.05, 4, 4), '#1a1020', { p: [0.3, 0.08, -0.12] });
  return k.build();
}

export class AfterIsland {
  /** El corro de peces: va en el grupo de la isla. */
  readonly fish = new Group();
  private readonly fishes: Mesh[] = [];
  private readonly pose: FishPose = { x: 0, y: 0, z: 0, yaw: 0 };
  private readonly depth: number;
  private lastFade = -1;

  constructor(private readonly R: number) {
    this.depth = sinkDepth(R);
    const mat = litMaterial();
    for (let i = 0; i < AFTER_TUNING.fish; i++) {
      const m = new Mesh(fishGeometry(FISH_COLORS[i % FISH_COLORS.length]!), mat);
      this.fishes.push(m);
      this.fish.add(m);
    }
    this.fish.visible = false;
  }

  /**
   * Un fotograma: hunde o saca lo que cuelga del grupo de la isla según
   * `fade` (0: bajo el agua; 1: fuera) y mueve los peces. `reduced`: sin
   * saltos (los peces nadan en corro, quietos de altura).
   */
  update(island: Object3D, t: number, fade: number, reduced: boolean): void {
    if (fade !== this.lastFade) {
      this.lastFade = fade;
      const y = -(1 - fade) * this.depth;
      for (const c of island.children) if (c !== this.fish) c.position.y = y;
      this.fish.visible = fade > 0.999;
    }
    // Cada fotograma: el mar 3D vuelve a poner visible la vista antes de llamar aquí.
    island.visible = fade > 0.001;
    if (!this.fish.visible) return;
    const n = this.fishes.length;
    for (let i = 0; i < n; i++) {
      const p = fishPose(i, n, t, this.R, this.pose);
      const m = this.fishes[i]!;
      m.position.set(p.x, reduced ? -0.2 : p.y, p.z);
      m.rotation.y = p.yaw;
      // Nariz arriba al saltar.
      m.rotation.z = reduced ? 0 : Math.max(0, p.y) * 0.5;
    }
  }

  /** El brillo del neón ahora (sobre el del ambiente), latiendo con la música. */
  glow(moodGlow: number, t: number): number {
    return afterGlow(moodGlow, t);
  }

  dispose(): void {
    for (const m of this.fishes) m.geometry.dispose();
    (this.fishes[0]?.material as { dispose?: () => void } | undefined)?.dispose?.();
  }
}
