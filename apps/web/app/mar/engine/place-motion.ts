import {
  type AnimationAction,
  AnimationMixer,
  type BufferGeometry,
  type Material,
  Mesh,
  type MeshLambertMaterial,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type PlaceMotionSpec, islandGlowIntensity } from './island-models';

/**
 * Lo que se mueve en los lugares de Blender de /mar (T112): la boia del club
 * de Benidorm sube y baja por su barra (el clip `boia-pole-dance` de T110) y
 * las pantallas del club laten. Todo sale del reloj de cada fotograma de
 * /mar (`t`), sin temporizadores propios: un mezclador de three por modelo
 * cargado, que se para y se suelta cuando el modelo se va (lejos, o al
 * destruir la escena). Con movimiento reducido, la pose quieta del
 * manifiesto (`static_frame`) y las pantallas fijas.
 */

/**
 * Los materiales (por su nombre de Blender) que son pantallas o luces del
 * club en cada lugar: laten de noche y de día. muestra
 */
export const PLACE_SCREENS: Readonly<Record<string, readonly string[]>> = {
  fotos: ['cyan', 'pink'],
};

/** Latidos por segundo de las pantallas (120 por minuto). muestra */
export const SCREEN_BEAT_HZ = 2;

/** Cuánto brillan las pantallas en un momento (× su brillo de la noche): entre 0.7 y 1.3. */
export function screenPulse(t: number, phase: number): number {
  const f = 0.5 + 0.5 * Math.cos(2 * Math.PI * (t * SCREEN_BEAT_HZ + phase));
  return 0.7 + 0.6 * f * f;
}

/** Los nodos que mueven los clips de una escena (el nombre antes del «.» de cada pista). */
export function animatedNodeNames(root: Object3D): string[] {
  const names = new Set<string>();
  for (const clip of root.animations) {
    for (const track of clip.tracks) {
      const node = track.name.split('.')[0];
      if (node) names.add(node);
    }
  }
  return [...names];
}

/**
 * Junta en una malla por material todo lo que cuelga de cada nodo que mueve
 * un clip (la boia del club: 46 piezas → una por material), para que bailar
 * cueste pocas llamadas de dibujo. El nodo sigue ahí con su nombre, así que
 * el clip lo encuentra; sus materiales son copias, para que no laten con las
 * pantallas. Si las piezas no se pueden juntar, se quedan como estaban.
 * Devuelve la misma escena (para encadenarla tras `loadGltf`).
 */
export function batchAnimatedNodes(root: Object3D): Object3D {
  for (const name of animatedNodeNames(root)) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    root.updateMatrixWorld(true);
    const inv = node.matrixWorld.clone().invert();
    const meshes: Mesh[] = [];
    node.traverse((o) => {
      if (o !== node && (o as Mesh).isMesh && !Array.isArray((o as Mesh).material)) {
        meshes.push(o as Mesh);
      }
    });
    if (meshes.length < 2) continue;
    const byMat = new Map<Material, BufferGeometry[]>();
    for (const m of meshes) {
      const g = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
      const mat = m.material as Material;
      byMat.set(mat, [...(byMat.get(mat) ?? []), g]);
    }
    const merged: [Material, BufferGeometry][] = [];
    for (const [mat, geos] of byMat) {
      const g = mergeGeometries(geos);
      for (const x of geos) x.dispose();
      if (!g) break;
      merged.push([mat, g]);
    }
    if (merged.length !== byMat.size) {
      for (const [, g] of merged) g.dispose();
      continue;
    }
    for (const m of meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    merged.forEach(([mat, g], i) => {
      const copy = mat.clone();
      copy.name = `${mat.name}:${name}`;
      const mesh = new Mesh(g, copy);
      mesh.name = `${name}_lote_${i}`;
      node.add(mesh);
    });
  }
  return root;
}

/** El movimiento de un modelo de lugar cargado. */
export interface PlaceMotion {
  /** Los clips que de verdad mueven un nodo del modelo. */
  readonly clips: readonly string[];
  /** Las pantallas que laten. */
  readonly screens: number;
  /** Lo pone en el momento `t` (s del reloj de /mar), con el brillo de la noche `glow`. */
  update(t: number, glow: number, reduced: boolean): void;
  /** La altura (y local, unidades del modelo) del primer nodo que se mueve, o null. */
  pose(): number | null;
  /** Para y suelta el mezclador (el modelo se va o se destruye la escena). */
  dispose(): void;
}

/**
 * El movimiento de una copia de un modelo de lugar: sus clips (`motion` del
 * manifiesto, por nombre de clip y de nodo) y sus pantallas. Sin nada que
 * mover, null.
 */
export function placeMotion(
  model: Object3D,
  entry: { motion?: readonly PlaceMotionSpec[] },
  screens: readonly string[] = [],
): PlaceMotion | null {
  const mixer = new AnimationMixer(model);
  const bound: { spec: PlaceMotionSpec; action: AnimationAction; node: Object3D }[] = [];
  for (const spec of entry.motion ?? []) {
    const clip = model.animations.find((c) => c.name === spec.clip);
    const node = model.getObjectByName(spec.node);
    if (!clip || !node) {
      console.warn(`[boia] el clip «${spec.clip}» de «${spec.node}» no está en el modelo`);
      continue;
    }
    const action = mixer.clipAction(clip);
    action.play();
    bound.push({ spec, action, node });
  }
  const names = new Set(screens);
  const lit: { mat: MeshLambertMaterial; phase: number }[] = [];
  const seen = new Set<Material>();
  model.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const l = mat as MeshLambertMaterial;
      if (seen.has(l) || !names.has(l.name) || !l.emissive || l.emissive.getHex() === 0) continue;
      seen.add(l);
      // Cada material de pantalla a destiempo del anterior: medio latido.
      lit.push({ mat: l, phase: screens.indexOf(l.name) * 0.5 });
    }
  });
  if (bound.length === 0 && lit.length === 0) {
    mixer.uncacheRoot(model);
    return null;
  }
  let stopped = false;
  return {
    clips: bound.map((b) => b.spec.clip),
    screens: lit.length,
    update(t, glow, reduced) {
      if (stopped) return;
      for (const b of bound) {
        b.action.time = reduced
          ? b.spec.staticTime
          : ((t % b.spec.duration) + b.spec.duration) % b.spec.duration;
      }
      if (bound.length > 0) mixer.update(0);
      const k = islandGlowIntensity(glow);
      for (const s of lit) s.mat.emissiveIntensity = k * (reduced ? 1 : screenPulse(t, s.phase));
    },
    pose() {
      return bound[0]?.node.position.y ?? null;
    },
    dispose() {
      if (stopped) return;
      stopped = true;
      mixer.stopAllAction();
      for (const b of bound) mixer.uncacheAction(b.action.getClip(), model);
      mixer.uncacheRoot(model);
    },
  };
}

/**
 * Para las pruebas: `data-lugares-movimiento` («id:baile», o «id:quieto»
 * con movimiento reducido) de cada lugar con un clip en marcha, y
 * `data-lugares-pose` («id:altura» de su nodo que se mueve, 3 decimales).
 */
export function placeMotionStates(
  list: Iterable<readonly [string, PlaceMotion | null]>,
  reduced: boolean,
): { motion: string; pose: string } {
  const on = [...list]
    .filter((e): e is readonly [string, PlaceMotion] => !!e[1] && e[1].clips.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  return {
    motion: on.map(([id]) => `${id}:${reduced ? 'quieto' : 'baile'}`).join(' '),
    pose: on.map(([id, m]) => `${id}:${(m.pose() ?? 0).toFixed(3)}`).join(' '),
  };
}
