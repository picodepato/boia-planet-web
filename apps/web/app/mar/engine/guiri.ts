import { BufferGeometry, Group, Mesh, type MeshLambertMaterial } from 'three';
import { litMaterial } from './characters';
import { type MascotModel, type MascotModelState, type MascotParts } from './mascot-models';
import { wrapD, type Period } from './wrap';

/**
 * El guiri del flamenco (plan 029 T270): un turista en un flamenco hinchable
 * que va a la deriva, despacio, por todo el mapa, sin saber dónde está el
 * after. Modelo de Blender en tres piezas (`tools/blender/personajes/
 * guiri.py`): el flotador, el guiri y el brazo derecho (pivote en el hombro),
 * que saluda al tocarlo. Se carga perezoso: sólo cuando el barco se acerca
 * (`GUIRI_LOOK.loadWithin`); hasta entonces no hay nada en la escena.
 *
 * Deriva: un paseo al azar sobre el agua (el rumbo gira poco a poco; si por
 * delante hay tierra, vira), dentro del periodo del planeta. Sólo
 * transformaciones: el flotador cabecea con el agua, el guiri se bambolea.
 */
export const GUIRI_LOOK = {
  /** u de escena por s a la deriva (el barco a toda máquina hace ~0,94). */
  speed: 0.32,
  /** Cuánto gira el rumbo por s (rad, al azar) y cuánto mira por delante para esquivar tierra (u). */
  wander: 0.5,
  lookAhead: 5,
  /** A menos de esta distancia del barco (u de escena) se pide el modelo. */
  loadWithin: 90,
  /** s que saluda al tocarlo. */
  waveS: 2.4,
  /** Radio del toque en pantalla (px). */
  tapPx: 52,
} as const;

export interface GuiriFrame {
  ship: { x: number; z: number };
  period: Period;
  /** ¿Es agua (escena)? Para no derivar hacia tierra. */
  isWater: (x: number, z: number) => boolean;
  reduced: boolean;
}

const PART_NAMES = ['flotador', 'guiri', 'brazo'] as const;

export class Guiri {
  readonly group = new Group();
  readonly parts: Record<(typeof PART_NAMES)[number], Mesh>;
  /** Dónde está (escena, canónico dentro del periodo) y hacia dónde deriva (rad). */
  readonly pos: { x: number; z: number };
  heading: number;
  modelState: MascotModelState | 'lejos' = 'lejos';
  private loaded: MascotParts | null = null;
  private requested = false;
  private wave = -1;
  private time = 0;
  private disposed = false;
  private readonly mat = litMaterial();

  constructor(
    private readonly model: MascotModel,
    start: { x: number; z: number; heading: number },
    private readonly random: () => number = Math.random,
  ) {
    this.group.name = 'guiri-flamenco';
    this.group.visible = false;
    this.pos = { x: start.x, z: start.z };
    this.heading = start.heading;
    const mk = (name: string) => {
      const m = new Mesh(new BufferGeometry(), this.mat);
      m.name = `guiri-${name}`;
      return m;
    };
    this.parts = { flotador: mk('flotador'), guiri: mk('guiri'), brazo: mk('brazo') };
    this.group.add(this.parts.flotador, this.parts.guiri, this.parts.brazo);
  }

  /** Un toque: saluda. */
  tap(): void {
    this.wave = 0;
  }

  get waving(): boolean {
    return this.wave >= 0;
  }

  /** ¿Ya se ve (el modelo llegó)? */
  get visible(): boolean {
    return this.loaded !== null;
  }

  update(dt: number, t: number, frame: GuiriFrame): void {
    if (this.disposed) return;
    const step = Math.max(0, Math.min(0.1, dt));
    this.time += step;
    this.drift(step, frame);
    const d = Math.hypot(
      wrapD(this.pos.x - frame.ship.x, frame.period.w),
      wrapD(this.pos.z - frame.ship.z, frame.period.h),
    );
    if (!this.requested && d < GUIRI_LOOK.loadWithin) this.request();
    this.group.visible = this.loaded !== null;
    if (!this.loaded) return;
    this.group.rotation.y = -this.heading;
    const { flotador, guiri, brazo } = this.parts;
    if (frame.reduced) {
      this.group.position.y = -0.03;
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
      guiri.rotation.set(0, 0, 0);
      brazo.rotation.set(0, 0, this.wave >= 0 ? 0.6 : 0);
    } else {
      // El flotador cabecea con el agua; el guiri se bambolea un poco más.
      this.group.position.y = -0.06 + Math.sin(t * 0.9) * 0.05;
      this.group.rotation.x = Math.sin(t * 0.7) * 0.05;
      this.group.rotation.z = Math.sin(t * 1.1) * 0.04;
      guiri.rotation.z = Math.sin(t * 1.3 + 0.5) * 0.05;
      guiri.rotation.x = Math.sin(t * 0.8) * 0.03;
      brazo.rotation.z =
        this.wave >= 0 ? 0.5 + Math.sin(this.time * 11) * 0.45 : Math.sin(t * 0.9) * 0.08;
    }
    flotador.rotation.set(0, 0, 0);
    if (this.wave >= 0) {
      this.wave += step;
      if (this.wave >= GUIRI_LOOK.waveS) this.wave = -1;
    }
  }

  private drift(dt: number, frame: GuiriFrame): void {
    const L = GUIRI_LOOK;
    this.heading += (this.random() - 0.5) * L.wander * dt;
    // Tierra por delante: vira hasta ver agua (a lo sumo una vuelta).
    for (let i = 0; i < 12; i++) {
      const ax = this.pos.x + Math.cos(this.heading) * L.lookAhead;
      const az = this.pos.z + Math.sin(this.heading) * L.lookAhead;
      if (frame.isWater(ax, az)) break;
      this.heading += Math.PI / 6;
    }
    const nx = this.pos.x + Math.cos(this.heading) * L.speed * dt;
    const nz = this.pos.z + Math.sin(this.heading) * L.speed * dt;
    if (frame.isWater(nx, nz)) {
      this.pos.x = nx;
      this.pos.z = nz;
    }
    // Siempre en la copia del planeta por la que va el barco.
    const P = frame.period;
    this.pos.x = frame.ship.x + wrapD(this.pos.x - frame.ship.x, P.w);
    this.pos.z = frame.ship.z + wrapD(this.pos.z - frame.ship.z, P.h);
  }

  private request(): void {
    this.requested = true;
    this.modelState = 'cargando';
    void this.model.acquire().then((p) => {
      if (this.disposed) return;
      if (!p) {
        this.modelState = 'error';
        return;
      }
      this.loaded = p;
      for (const name of PART_NAMES) {
        const part = p.get(name)!;
        this.parts[name].geometry = part.geometry;
        this.parts[name].position.copy(part.pivot);
      }
      this.modelState = 'glb';
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    if (this.requested) this.model.release();
    (this.mat as MeshLambertMaterial).dispose();
  }
}
