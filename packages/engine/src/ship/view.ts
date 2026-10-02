import {
  DIRECTIONS,
  type Direction,
  type Vec2,
  findShipAnimation,
  findShipImage,
  screenToWorld,
} from '@boia/world';
import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { LoadedShipManifest } from '../manifest-loader';
import { shipArtScale } from '../world/visual';
import { DirectionPicker } from './direction';
import { type DressedShip, type ShipDressing, flagPieces, flagQuad } from './dressing';
import {
  BOIA_NAVY,
  BOIA_ORANGE,
  SAIL_WHITE,
  SHIP_SIZE_FACTOR,
  provisionalShipView,
} from './provisional';

/** Bajo esta velocidad (u/s) el barco está parado y se balancea. muestra */
export const IDLE_SPEED = 4;
/** Balanceo por código en las vistas sin fotogramas `bob`: px y s por ciclo. muestra */
const BOB_AMPLITUDE = 0.9;
const BOB_PERIOD = 2.2;

interface Frame {
  node: Container;
  /** `wake_origin` en px de pantalla relativos al pivote. */
  wakeOrigin: Vec2;
  /** `slot_passenger` (pie de la pasajera) en px de pantalla relativos al pivote. */
  passengerSlot: Vec2;
  /** Sprites del manifiesto: imagen fija, con pasajera y balanceo. */
  sprite?: Sprite;
  still?: Texture;
  withPassenger?: Texture | null;
  bob?: Texture[];
  bobFps?: number;
  /** Barco provisional: figura de la pasajera dibujada sobre el slot. */
  passengerNode?: Container;
}

/**
 * Arte de la tripulante (T18: la pieza `tripulante` del mundo, p. ej. la
 * Boia Fiestera bailando): se dibuja con su pivote sobre `slot_passenger` de
 * la vista que se ve, encima del barco.
 */
export interface CrewArt {
  frames: Texture[];
  fps: number;
  /** Pivote en px de la imagen. */
  pivot: Vec2;
  /** px de pantalla por px de imagen (la escala del arte del mundo). */
  scale: number;
}

/**
 * Sprite del barco: una imagen por cada una de las 8 vistas, elegida por el
 * rumbo real del casco. El pivote (contacto con el agua) queda en (0, 0).
 */
export class ShipSprite {
  readonly view = new Container();
  readonly source: 'manifest' | 'provisional';
  /** Cuerpo del barco: se desplaza con el balanceo; `view` queda en el pivote. */
  private readonly body = new Container();
  private readonly frames: Map<Direction, Frame>;
  private readonly picker: DirectionPicker;
  private shown: Direction | null = null;
  private passenger = false;
  private crewArt: CrewArt | null = null;
  private crew: Sprite | null = null;
  /** Cosméticos pintados (T40): bandera en el mástil y tinte de la estela. */
  readonly dressing: ShipDressing;

  private constructor(
    frames: Map<Direction, Frame>,
    source: 'manifest' | 'provisional',
    heading: number,
    dressing: ShipDressing = { flag: null, wakeTint: null },
  ) {
    this.frames = frames;
    this.source = source;
    this.dressing = dressing;
    this.picker = new DirectionPicker(heading);
    this.view.addChild(this.body);
    for (const f of frames.values()) {
      f.node.visible = false;
      this.body.addChild(f.node);
    }
    this.update(heading);
  }

  static provisional(heading: number): ShipSprite {
    const frames = new Map<Direction, Frame>();
    for (const d of DIRECTIONS) {
      const v = provisionalShipView(d);
      const g = new Graphics();
      // Sombra sobre el agua.
      g.ellipse(0, 0, 30, 12).fill({ color: 0x05202c, alpha: 0.28 });
      for (const face of v.hull) {
        g.poly(face.points).fill({ color: face.fill }).stroke({ width: 1.5, color: BOIA_NAVY });
      }
      g.poly(v.deck.points).fill({ color: v.deck.fill }).stroke({ width: 1.5, color: BOIA_NAVY });
      g.poly(v.prow).fill({ color: BOIA_NAVY });
      g.poly(v.sail)
        .fill({ color: SAIL_WHITE })
        .stroke({ width: 1.5, color: BOIA_NAVY, join: 'round' });
      g.moveTo(v.mast[0].x, v.mast[0].y)
        .lineTo(v.mast[1].x, v.mast[1].y)
        .stroke({ width: 3, color: BOIA_NAVY, cap: 'round' });
      g.poly(v.flag).fill({ color: BOIA_ORANGE }).stroke({ width: 1, color: BOIA_NAVY });
      // Slot TRIPULANTE: una figura sencilla, oculta hasta la misión Fiestera.
      const k = SHIP_SIZE_FACTOR;
      const slot = v.anchors.slot_passenger;
      const p = new Graphics()
        .roundRect(slot.x - 4 * k, slot.y - 16 * k, 8 * k, 14 * k, 3 * k)
        .fill({ color: BOIA_ORANGE })
        .stroke({ width: 1.2, color: BOIA_NAVY })
        .circle(slot.x, slot.y - 19 * k, 4 * k)
        .fill({ color: 0xf2c9a0 })
        .stroke({ width: 1.2, color: BOIA_NAVY });
      p.visible = false;
      const node = new Container();
      node.addChild(g, p);
      frames.set(d, {
        node,
        wakeOrigin: v.anchors.wake_origin,
        passengerSlot: slot,
        passengerNode: p,
      });
    }
    return new ShipSprite(frames, 'provisional', heading);
  }

  /**
   * Carga las 8 vistas de la skin; `null` si falta alguna imagen. Con
   * `dressing` (T40), la bandera va en el tope del mástil de cada vista.
   */
  static async fromManifest(
    loaded: LoadedShipManifest | DressedShip,
    heading: number,
  ): Promise<ShipSprite | null> {
    const dressing: ShipDressing = ('dressing' in loaded && loaded.dressing) || {
      flag: null,
      wakeTint: null,
    };
    const skin = loaded.skin ?? 'base';
    const scale = loaded.displayScale ?? shipArtScale(loaded.manifest);
    const m = loaded.manifest;
    const load = (file: string): Promise<Texture> =>
      Assets.load(new URL(file, loaded.baseUrl).href);
    const frames = new Map<Direction, Frame>();
    try {
      await Promise.all(
        DIRECTIONS.map(async (d) => {
          const img = findShipImage(m, skin, d, false);
          if (!img) throw new Error(`falta ${skin}/${d}`);
          const withP = findShipImage(m, skin, d, true);
          const bob = findShipAnimation(m, 'bob', skin, d, false);
          const [texture, passengerTexture, ...bobTextures] = await Promise.all([
            load(img.file),
            withP ? load(withP.file) : Promise.resolve(null),
            ...bob.map((b) => load(b.file)),
          ]);
          const a = m.anchors[d];
          const s = new Sprite(texture!);
          s.anchor.set(a.pivot.x / texture!.width, a.pivot.y / texture!.height);
          s.scale.set(scale);
          const rel = (p: Vec2) => ({ x: (p.x - a.pivot.x) * scale, y: (p.y - a.pivot.y) * scale });
          // La vista es el sprite y, encima, la bandera del cosmético si la hay.
          const node = new Container();
          node.addChild(s);
          if (dressing.flag) {
            const stern = rel(a.wake_origin);
            const bow = a.bow ? rel(a.bow) : { x: 0, y: 0 };
            const quad = flagQuad(
              rel(a.mast_top),
              { x: stern.x - bow.x, y: stern.y - bow.y },
              scale,
            );
            const flag = new Graphics();
            for (const piece of flagPieces(quad, dressing.flag))
              flag.poly(piece.points).fill(piece.color);
            flag.poly(quad).stroke({ width: Math.max(1, 2 * scale), color: 0x1a1446 });
            flag.label = 'bandera';
            node.addChild(flag);
          }
          frames.set(d, {
            node,
            sprite: s,
            still: texture!,
            withPassenger: passengerTexture,
            bob: bobTextures.filter((t): t is Texture => t !== null),
            bobFps: m.animations.bob?.fps ?? 8,
            wakeOrigin: rel(a.wake_origin),
            passengerSlot: rel(a.slot_passenger),
          });
        }),
      );
    } catch (err) {
      console.warn('[boia] sprites del barco incompletos; se usa el provisional', err);
      return null;
    }
    return new ShipSprite(frames, 'manifest', heading, dressing);
  }

  /** Tinte de la estela del cosmético equipado (0xffffff: espuma blanca). */
  get wakeTint(): number {
    return this.dressing.wakeTint ?? 0xffffff;
  }

  get direction(): Direction {
    return this.picker.current;
  }

  /**
   * Elige la vista por el rumbo y, con `time` (s) y `speed` (u/s), balancea el
   * barco parado: los fotogramas `bob` del manifiesto donde existen (vista S)
   * y un vaivén de ±1 px por código en el resto.
   */
  update(heading: number, time = 0, speed = Infinity): void {
    const d = this.picker.pick(heading);
    if (d !== this.shown) {
      if (this.shown) this.frames.get(this.shown)!.node.visible = false;
      this.frames.get(d)!.node.visible = true;
      this.shown = d;
    }
    const f = this.frames.get(d)!;
    const idle = speed < IDLE_SPEED;
    let framesBob = false;
    if (f.sprite && f.still) {
      let t = f.still;
      if (this.passenger && f.withPassenger && !this.crewArt) t = f.withPassenger;
      else if (idle && f.bob && f.bob.length > 0) {
        t = f.bob[Math.floor(time * (f.bobFps ?? 8)) % f.bob.length]!;
        framesBob = true;
      }
      if (f.sprite.texture !== t) f.sprite.texture = t;
    }
    // Con arte de tripulante, ése manda sobre la pasajera del barco (imagen `_p` o figura).
    const crew = this.crew && this.crewArt ? this.crew : null;
    if (crew && this.crewArt) {
      crew.visible = this.passenger;
      if (this.passenger) {
        crew.position.set(f.passengerSlot.x, f.passengerSlot.y);
        const n = this.crewArt.frames.length;
        if (n > 1) crew.texture = this.crewArt.frames[Math.floor(time * this.crewArt.fps) % n]!;
      }
    }
    if (f.passengerNode) f.passengerNode.visible = this.passenger && !crew;
    // El vaivén se atenúa al arrancar, sin salto.
    const k = framesBob ? 0 : Math.max(0, 1 - speed / (IDLE_SPEED * 10));
    this.body.y = Math.sin((time * 2 * Math.PI) / BOB_PERIOD) * BOB_AMPLITUDE * k;
  }

  /** Slot TRIPULANTE: visible sólo con la Boia Fiestera a bordo (§8.2, REQ-AVE-007). */
  setPassenger(on: boolean): void {
    this.passenger = on;
  }

  /** Arte de la tripulante (el del mundo que se juega); null vuelve a la del barco. */
  setCrewArt(art: CrewArt | null): void {
    this.crew?.destroy();
    this.crew = null;
    this.crewArt = art && art.frames.length > 0 ? art : null;
    if (!this.crewArt) return;
    const t = this.crewArt.frames[0]!;
    const s = new Sprite(t);
    s.anchor.set(this.crewArt.pivot.x / t.width, this.crewArt.pivot.y / t.height);
    s.scale.set(this.crewArt.scale);
    s.visible = false;
    this.crew = s;
    this.body.addChild(s);
  }

  get crewArtInUse(): CrewArt | null {
    return this.crewArt;
  }

  get hasPassenger(): boolean {
    return this.passenger;
  }

  /** `slot_passenger` de la vista actual, en px de pantalla relativos al pivote. */
  passengerSlot(): Vec2 {
    return this.frames.get(this.picker.current)!.passengerSlot;
  }

  /** `wake_origin` de la vista actual, en coordenadas de mundo relativas al barco. */
  wakeOriginOffset(): Vec2 {
    const o = this.frames.get(this.picker.current)!.wakeOrigin;
    const w = screenToWorld(o, 0);
    return { x: w.x, y: w.y };
  }
}
