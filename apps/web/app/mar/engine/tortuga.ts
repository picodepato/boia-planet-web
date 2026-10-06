import type { QualityTier } from '@boia/engine/streaming';
import { BufferGeometry, Group, Mesh, type MeshLambertMaterial } from 'three';
import { litMaterial } from './characters';
import { type MascotModel, type MascotModelState, type MascotParts } from './mascot-models';

/**
 * La «Tortuga turbo» (plan 015 T175, decisión 16): la mascota que gana la
 * carrera. No va en cubierta: **nada detrás del barco**, por su estela,
 * siguiendo el camino que acaba de recorrer a una distancia corta, y le
 * sigue el ritmo también en turbo. Ocupa la ranura de mascota (una a la
 * vez). Modelo de Blender en cinco piezas (`tools/blender/mascotas/
 * tortuga_turbo.py`): el cuerpo y las cuatro aletas (pivote en el hombro).
 *
 * Animación sólo con transformaciones: las aletas reman (más rápido cuanto
 * más corre), el cuerpo se hunde y asoma despacio, y cabecea un poco. Con
 * movimiento reducido no rema ni se hunde (sólo sigue al barco). En `baja`
 * lo mismo que en alta: es una pieza por aleta, barato.
 */

/** A qué distancia de la popa nada (unidades de escena, por el camino). muestra */
export const TORTUGA_BEHIND = 2.6;
/** Nunca más cerca de la popa que esto (si el barco frena de golpe). */
export const TORTUGA_MIN_BEHIND = 1.3;
/** Cómo de rápido alcanza su sitio (1/s). */
const CATCH_UP = 6;
/** Un salto mayor que esto del barco es un cambio de copia del planeta o un viaje: la tortuga va con él. */
const JUMP = 20;
/** Cuántos puntos del camino se guardan (a 20 por s de trazo, unos 3 s de camino a toda máquina). */
const TRAIL_N = 64;
const TRAIL_EVERY_S = 0.05;

/**
 * El camino reciente de la popa y dónde va la tortuga sobre él: `TORTUGA_BEHIND`
 * unidades por detrás, siguiendo el trazo (curvas incluidas). Sin three:
 * se prueba sola.
 */
export class WakeFollower {
  /** Puntos de la popa, el más nuevo primero. */
  private readonly trail: { x: number; z: number }[] = [];
  private acc = 0;
  /** Dónde está la tortuga ahora. */
  readonly pos = { x: 0, z: 0 };
  /** Hacia dónde mira (rumbo, rad, como el del barco). */
  heading = 0;
  private started = false;

  /**
   * Avanza con la popa en (`x`, `z`), rumbo `heading` (hacia donde mira la
   * proa) y la velocidad del barco (`speed`, u de escena por s; con turbo
   * va más rápido y la tortuga no se queda atrás porque sigue el trazo).
   */
  update(dt: number, x: number, z: number, heading: number, speed: number): void {
    const head = this.trail[0];
    if (!this.started || (head && Math.hypot(x - head.x, z - head.z) > JUMP)) {
      // Primer fotograma, o un salto (otra copia del planeta, un viaje): detrás del barco ya.
      this.trail.length = 0;
      this.trail.push({ x, z });
      this.pos.x = x - Math.cos(heading) * TORTUGA_BEHIND;
      this.pos.z = z - Math.sin(heading) * TORTUGA_BEHIND;
      this.heading = heading;
      this.started = true;
      return;
    }
    this.acc += dt;
    if (this.acc >= TRAIL_EVERY_S) {
      this.acc = 0;
      const last = this.trail[0]!;
      if (Math.hypot(x - last.x, z - last.z) > 0.02) {
        this.trail.unshift({ x, z });
        if (this.trail.length > TRAIL_N) this.trail.pop();
      }
    }
    // El objetivo: TORTUGA_BEHIND por el trazo desde la popa de ahora; si el trazo no llega
    // tan lejos (el barco acaba de arrancar o va despacio), en línea recta hacia popa.
    let tx: number;
    let tz: number;
    let left = TORTUGA_BEHIND;
    let ax = x;
    let az = z;
    let found = false;
    for (const p of this.trail) {
      const d = Math.hypot(p.x - ax, p.z - az);
      if (d >= left) {
        const k = d > 0 ? left / d : 0;
        ax += (p.x - ax) * k;
        az += (p.z - az) * k;
        found = true;
        break;
      }
      left -= d;
      ax = p.x;
      az = p.z;
    }
    if (found) {
      tx = ax;
      tz = az;
    } else {
      tx = ax - Math.cos(heading) * left;
      tz = az - Math.sin(heading) * left;
    }
    // Nunca por delante ni pegada a la popa: por detrás de la proa, al menos a TORTUGA_MIN_BEHIND.
    const hx = Math.cos(heading);
    const hz = Math.sin(heading);
    const ahead = (tx - x) * hx + (tz - z) * hz;
    if (ahead > -TORTUGA_MIN_BEHIND) {
      tx -= (ahead + TORTUGA_MIN_BEHIND) * hx;
      tz -= (ahead + TORTUGA_MIN_BEHIND) * hz;
    }
    // Se acerca a su sitio suave; a toda máquina (y en turbo), más deprisa para no soltarse.
    const k = Math.min(1, dt * (CATCH_UP + speed * 2));
    this.pos.x += (tx - this.pos.x) * k;
    this.pos.z += (tz - this.pos.z) * k;
    // Mira hacia donde va: hacia el barco por el trazo, o el rumbo del barco si está quieta.
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const want = Math.hypot(dx, dz) > 0.05 && speed > 0.05 ? Math.atan2(dz, dx) : heading;
    this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * Math.min(1, dt * 5);
  }

  /** Cuánto queda por detrás de la popa, en el rumbo del barco (> 0: detrás; pruebas). */
  behind(x: number, z: number, heading: number): number {
    return -((this.pos.x - x) * Math.cos(heading) + (this.pos.z - z) * Math.sin(heading));
  }
}

export interface TortugaState {
  /** La popa del barco (escena) y su rumbo. */
  x: number;
  z: number;
  heading: number;
  /** Velocidad del barco (u de escena por s). */
  speed: number;
  quality: QualityTier;
  reduced: boolean;
  /** Escondida (el barco vuela o es el avión del castillo). */
  hidden: boolean;
}

export interface Tortuga {
  group: Group;
  body: Mesh;
  flippers: readonly Mesh[];
  follower: WakeFollower;
  quality: QualityTier;
  modelState: MascotModelState;
  update(t: number, dt: number, s: TortugaState): void;
  dispose(): void;
}

const FLIPPER_NAMES = ['fl', 'fr', 'bl', 'br'] as const;

export function createTortuga(quality: QualityTier, model: MascotModel): Tortuga {
  const mat = litMaterial();
  const body = new Mesh(new BufferGeometry(), mat);
  body.name = 'tortuga-body';
  const flippers = FLIPPER_NAMES.map((n) => {
    const m = new Mesh(new BufferGeometry(), mat);
    m.name = `tortuga-${n}`;
    return m;
  });
  const group = new Group();
  group.name = 'tortuga-turbo';
  group.add(body, ...flippers);
  group.visible = false;
  const follower = new WakeFollower();
  let disposed = false;
  let parts: MascotParts | null = null;
  // Cuánto ha remado (fase), para que las aletas sigan suaves al cambiar de velocidad.
  let stroke = 0;

  const view: Tortuga = {
    group,
    body,
    flippers,
    follower,
    quality,
    modelState: 'cargando',
    update(t, dt, st) {
      follower.update(dt, st.x, st.z, st.heading, st.speed);
      group.visible = !st.hidden && parts !== null;
      group.position.x = follower.pos.x;
      group.position.z = follower.pos.z;
      group.rotation.y = -follower.heading;
      if (st.reduced) {
        group.position.y = -0.04;
        group.rotation.x = 0;
        group.rotation.z = 0;
        for (const f of flippers) f.rotation.set(0, 0, 0);
        return;
      }
      // Rema: más deprisa cuanto más corre el barco; parada, apenas flota.
      const pace = 1.2 + st.speed * 1.1;
      stroke += dt * pace;
      const amp = 0.25 + Math.min(0.55, st.speed * 0.12);
      flippers.forEach((f, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const back = i >= 2 ? Math.PI * 0.5 : 0;
        // Barrido hacia atrás y adelante (eje y) con un leve giro (eje x) al recoger.
        f.rotation.y = side * Math.sin(stroke * Math.PI * 2 + back) * amp;
        f.rotation.x = side * Math.cos(stroke * Math.PI * 2 + back) * amp * 0.35;
      });
      // Se hunde y asoma despacio; cabecea con las brazadas.
      group.position.y = -0.12 + Math.sin(t * 0.55) * 0.1 + Math.sin(stroke * Math.PI * 2) * 0.015;
      group.rotation.z = Math.sin(stroke * Math.PI * 2) * 0.05;
      group.rotation.x = Math.sin(t * 0.9) * 0.04;
    },
    dispose() {
      disposed = true;
      model.release();
      (mat as MeshLambertMaterial).dispose();
    },
  };

  void model.acquire().then((p) => {
    if (disposed) return;
    if (!p) {
      view.modelState = 'error';
      return;
    }
    parts = p;
    body.geometry = p.get('body')!.geometry;
    body.position.copy(p.get('body')!.pivot);
    flippers.forEach((f, i) => {
      const part = p.get(FLIPPER_NAMES[i]!)!;
      f.geometry = part.geometry;
      f.position.copy(part.pivot);
    });
    view.modelState = 'glb';
  });
  return view;
}
