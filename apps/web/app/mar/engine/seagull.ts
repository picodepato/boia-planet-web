import { type SeagullEvent, SeagullClock, type SeagullClockOptions } from '@boia/engine/characters';
import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';
import { wrapD, type Period } from './wrap';

/**
 * La gaviota ladrona (plan 029 T270): de vez en cuando baja en picado hacia
 * el barco, se lleva unas monedas y huye despacio y bajo, con una moneda en
 * el pico, dando tiempo a perseguirla; si el barco la alcanza (o se la toca
 * en pantalla) suelta el botín; si no, se ríe y se va. El reloj puro
 * (`SeagullClock`, `@boia/engine/characters`) decide cuándo y cuánto; aquí
 * va el vuelo y el pájaro de a mano (estilo de `wildlife.ts`, algo mayor).
 *
 * Coordenadas de escena, guardadas en la copia del planeta por la que va el
 * barco; se re-basan cada fotograma al foco, como los peces. Números `muestra`.
 */
export const SEAGULL_LOOK = {
  /** Desde dónde llega al verla (u de escena, detrás y a un lado del barco) y a qué altura. */
  fromBehind: 13,
  fromSide: 7,
  fromHeight: 9,
  /** A qué altura agarra las monedas y a cuál huye (baja: se la puede alcanzar). */
  grabHeight: 1.1,
  fleeHeight: 1.9,
  /** Velocidad huyendo (u/s; el barco a toda máquina hace ~0,94) y cuánto zigzaguea. */
  fleeSpeed: 0.58,
  zigzag: 0.9,
  /** Radio (u, en horizontal) al que el barco la pilla mientras huye bajo, pasados `catchGraceS` s del robo. */
  catchRadius: 1.3,
  catchGraceS: 4,
  /** Radio del toque en pantalla (px) para pillarla con el dedo. */
  tapPx: 48,
  /** Cómo se va al terminar (u/s y s hasta desaparecer). */
  leaveSpeed: 4.5,
  leaveS: 2.2,
} as const;

export type SeagullVisual = 'no' | 'baja' | 'huye' | 'rie' | 'pillada' | 'se-va';

export interface SeagullFrame {
  /** El barco (escena) y su rumbo (rad). */
  ship: { x: number; z: number };
  heading: number;
  /** El foco de la vista: los dibujos se ponen en la copia más cercana a él. */
  focus: { x: number; z: number };
  period: Period;
  /** ¿Hay partida (carrera, minijuego)? No roba. */
  busy: boolean;
  /** Monedas del bolsillo ahora (nunca roba más de las que hay). */
  coins: number;
  reduced: boolean;
  /** El barco vuela o es el avión del castillo: escondida. */
  hidden: boolean;
}

function triangle(points: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return g;
}

export class Seagull {
  readonly group = new Group();
  readonly clock: SeagullClock;
  /** Cómo se ve ahora (para `data-gaviota` y las pruebas). */
  visual: SeagullVisual = 'no';
  /** Dónde está (escena, copia del barco) y hacia dónde vuela. */
  readonly pos = { x: 0, y: 0, z: 0 };
  private dir = 0;
  private from = { x: 0, z: 0 };
  private t = 0;
  private leaveT = 0;
  private time = 0;
  private readonly wings: { left: Group; right: Group };
  private readonly coin: Mesh;
  private readonly body: Group;
  private disposed = false;

  constructor(opts: SeagullClockOptions = {}) {
    this.clock = new SeagullClock(opts);
    this.group.name = 'gaviota-ladrona';
    this.group.visible = false;
    const white = new MeshLambertMaterial({
      color: '#fffaf0',
      flatShading: true,
      side: DoubleSide,
    });
    const grey = new MeshLambertMaterial({ color: '#8a97a6', flatShading: true });
    const dark = new MeshBasicMaterial({ color: '#2b3340' });
    const yellow = new MeshLambertMaterial({ color: '#f2c230', flatShading: true });
    const gold = new MeshLambertMaterial({ color: '#ffd23f', flatShading: true });
    const body = new Group();
    const torso = new Mesh(new SphereGeometry(0.22, 8, 6), white);
    torso.scale.set(1.6, 0.8, 0.9);
    body.add(torso);
    const head = new Mesh(new SphereGeometry(0.15, 8, 6), white);
    head.position.set(0.36, 0.14, 0);
    body.add(head);
    const beak = new Mesh(new ConeGeometry(0.06, 0.22, 6), yellow);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.56, 0.1, 0);
    body.add(beak);
    for (const side of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.03, 5, 4), dark);
      eye.position.set(0.44, 0.19, side * 0.09);
      body.add(eye);
    }
    const tail = new Mesh(triangle([-0.3, 0, 0, -0.62, 0.03, 0.14, -0.62, 0.03, -0.14]), grey);
    body.add(tail);
    const wing = triangle([0, 0, 0, -0.25, 0.02, 1.05, 0.3, 0.02, 0.6]);
    const left = new Group();
    const right = new Group();
    const lw = new Mesh(wing, white);
    const rw = new Mesh(wing, white);
    rw.scale.z = -1;
    const lt = new Mesh(new SphereGeometry(0.07, 5, 4), grey);
    lt.position.set(-0.2, 0.02, 1.0);
    const rt = new Mesh(new SphereGeometry(0.07, 5, 4), grey);
    rt.position.set(-0.2, 0.02, -1.0);
    left.add(lw, lt);
    right.add(rw, rt);
    left.position.set(0.05, 0.1, 0.12);
    right.position.set(0.05, 0.1, -0.12);
    body.add(left, right);
    // La moneda en el pico: sólo mientras huye con el botín.
    const coin = new Mesh(new CylinderGeometry(0.11, 0.11, 0.03, 10), gold);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(0.68, 0.08, 0);
    coin.visible = false;
    body.add(coin);
    this.group.add(body);
    this.body = body;
    this.wings = { left, right };
    this.coin = coin;
  }

  /** ¿Se la puede pillar ahora (huye bajo con las monedas, ya algo lejos del barco)? */
  get catchable(): boolean {
    const st = this.clock.state;
    return st.at === 'fleeing' && st.t >= SEAGULL_LOOK.catchGraceS;
  }

  /** El barco la alcanzó o el dedo la tocó: lo que diga el reloj. */
  catch(): SeagullEvent[] {
    return this.apply(this.clock.catch());
  }

  /** El ataque, ya (parámetro de desarrollo). */
  attack(): SeagullEvent[] {
    return this.apply(this.clock.attack());
  }

  /** Avanza el reloj y el vuelo; devuelve lo que pasó (para el sonido, las monedas y los avisos). */
  update(dt: number, frame: SeagullFrame): SeagullEvent[] {
    if (this.disposed) return [];
    const step = Math.max(0, Math.min(0.1, dt));
    this.time += step;
    const events = this.apply(this.clock.step(step, frame.busy, frame.coins), frame);
    this.fly(step, frame);
    // El barco la alcanza mientras huye bajo.
    if (this.catchable && !frame.hidden) {
      const d = Math.hypot(
        wrapD(this.pos.x - frame.ship.x, frame.period.w),
        wrapD(this.pos.z - frame.ship.z, frame.period.h),
      );
      if (d < SEAGULL_LOOK.catchRadius) events.push(...this.catch());
    }
    this.draw(frame);
    return events;
  }

  /** Dónde se dibuja ahora (escena, en la copia del foco), o null si no se ve. */
  get drawn(): { x: number; y: number; z: number } | null {
    return this.group.visible ? { ...this.group.position } : null;
  }

  private apply(events: SeagullEvent[], frame?: SeagullFrame): SeagullEvent[] {
    for (const e of events) {
      if (e.type === 'dive') {
        this.visual = 'baja';
        this.t = 0;
        if (frame) {
          // Llega por detrás y a un lado, alta.
          const h = frame.heading;
          const side = Math.sin(this.time * 7.3) >= 0 ? 1 : -1;
          this.from.x =
            frame.ship.x -
            Math.cos(h) * SEAGULL_LOOK.fromBehind -
            Math.sin(h) * side * SEAGULL_LOOK.fromSide;
          this.from.z =
            frame.ship.z -
            Math.sin(h) * SEAGULL_LOOK.fromBehind +
            Math.cos(h) * side * SEAGULL_LOOK.fromSide;
        } else {
          this.from.x = this.pos.x - SEAGULL_LOOK.fromBehind;
          this.from.z = this.pos.z;
        }
        this.pos.x = this.from.x;
        this.pos.z = this.from.z;
        this.pos.y = SEAGULL_LOOK.fromHeight;
        this.coin.visible = false;
      } else if (e.type === 'steal') {
        this.visual = 'huye';
        this.t = 0;
        this.coin.visible = true;
        // Huye hacia delante y a un lado del barco, nunca hacia atrás (que la persigan).
        const h = frame?.heading ?? 0;
        this.dir = h + (Math.sin(this.time * 3.1) >= 0 ? 0.9 : -0.9);
      } else if (e.type === 'escaped') {
        this.visual = 'rie';
        this.t = 0;
      } else if (e.type === 'caught') {
        this.visual = 'pillada';
        this.coin.visible = false;
        this.leaveT = 0;
      } else if (e.type === 'nothing' || e.type === 'dropped') {
        this.coin.visible = false;
      } else if (e.type === 'gone') {
        // Pillada, se va igual, pero se sigue viendo «pillada» hasta que desaparece.
        if (this.visual !== 'no' && this.visual !== 'pillada') {
          this.visual = 'se-va';
          this.leaveT = 0;
          this.coin.visible = false;
        }
      }
    }
    return events;
  }

  private fly(dt: number, frame: SeagullFrame): void {
    const L = SEAGULL_LOOK;
    const st = this.clock.state;
    this.t += dt;
    if (st.at === 'diving') {
      // En picado hacia la popa del barco, suave al final.
      const k = Math.min(1, this.t / this.clock.tuning.diveS);
      const e = k * k * (3 - 2 * k);
      const tx = frame.ship.x - Math.cos(frame.heading) * 0.8;
      const tz = frame.ship.z - Math.sin(frame.heading) * 0.8;
      this.pos.x = this.from.x + wrapD(tx - this.from.x, frame.period.w) * e;
      this.pos.z = this.from.z + wrapD(tz - this.from.z, frame.period.h) * e;
      this.pos.y = L.fromHeight + (L.grabHeight - L.fromHeight) * e;
      this.dir = Math.atan2(tz - this.pos.z, tx - this.pos.x);
    } else if (st.at === 'fleeing') {
      const wob = Math.sin(this.t * 1.4) * L.zigzag;
      const d = this.dir + wob;
      this.pos.x += Math.cos(d) * L.fleeSpeed * dt;
      this.pos.z += Math.sin(d) * L.fleeSpeed * dt;
      this.pos.y += (L.fleeHeight - this.pos.y) * Math.min(1, dt * 2);
    } else if (st.at === 'laughing') {
      this.pos.y = L.fleeHeight + Math.sin(this.t * 9) * 0.12;
    } else if (this.visual === 'pillada' || this.visual === 'se-va') {
      this.leaveT += dt;
      this.pos.x += Math.cos(this.dir) * L.leaveSpeed * dt;
      this.pos.z += Math.sin(this.dir) * L.leaveSpeed * dt;
      this.pos.y += L.leaveSpeed * 0.6 * dt;
      if (this.leaveT >= L.leaveS) this.visual = 'no';
    }
    // Siempre en la copia del planeta por la que va el barco.
    this.pos.x = frame.ship.x + wrapD(this.pos.x - frame.ship.x, frame.period.w);
    this.pos.z = frame.ship.z + wrapD(this.pos.z - frame.ship.z, frame.period.h);
  }

  private draw(frame: SeagullFrame): void {
    const on = this.visual !== 'no' && !frame.hidden;
    this.group.visible = on;
    if (!on) return;
    this.group.position.set(
      frame.focus.x + wrapD(this.pos.x - frame.focus.x, frame.period.w),
      this.pos.y,
      frame.focus.z + wrapD(this.pos.z - frame.focus.z, frame.period.h),
    );
    this.group.rotation.y = -this.dir;
    const flap = frame.reduced ? 0.12 : this.visual === 'rie' ? 0.5 : 0.32;
    const rate = this.visual === 'baja' ? 3 : this.visual === 'rie' ? 14 : 7;
    const f = Math.sin(this.time * rate) * flap;
    this.wings.left.rotation.x = -f;
    this.wings.right.rotation.x = f;
    this.body.rotation.z =
      this.visual === 'baja'
        ? -0.35
        : this.visual === 'rie'
          ? Math.sin(this.time * 14) * 0.1
          : 0.05;
    const s = 0.55;
    this.group.scale.setScalar(s);
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
