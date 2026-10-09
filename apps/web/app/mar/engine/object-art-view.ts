import type { Material, Object3D } from 'three';
import {
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { Kit } from './kit';
import { lambertize, loadGltf } from './models';
import { type ObjectArtDeps, type ObjectArtFormat, resolveObjectArt } from './object-art';
import { C } from './palette';
import { buoy } from './props';

/**
 * Cómo se pinta en el mar 3D el archivo subido de un objeto nuevo (T241):
 * un hueco con el respaldo hecho a mano (una boya naranja) que el modelo
 * `.glb` o la imagen sustituyen al llegar. Una imagen es un cartel plano que
 * mira a la cámara (lo gira el mar en cada fotograma). Si el archivo no llega,
 * se queda el respaldo.
 */

export type ObjectArtState = 'loading' | ObjectArtFormat | 'fallback';

/** El respaldo: una boya naranja con banda blanca (lo que se ve hasta que llega el archivo). */
export function objectArtFallback(lit: Material): Object3D {
  const k = new Kit();
  buoy(k, 0, 0, C.orange, C.white, 1.6);
  return new Mesh(k.build(), lit);
}

/**
 * Escala `model` para que quepa en la caja (`span` de ancho y fondo, `height`
 * de alto), centrado y apoyado sobre el agua (y = 0).
 */
export function fitModel(model: Object3D, box3: { span: number; height: number }): void {
  const box = new Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const size = box.getSize(new Vector3());
  const wide = Math.max(size.x, size.z);
  if (wide <= 0 && size.y <= 0) return;
  const s = Math.min(
    wide > 0 ? box3.span / wide : Infinity,
    size.y > 0 ? box3.height / size.y : Infinity,
  );
  model.scale.multiplyScalar(s);
  const fitted = new Box3().setFromObject(model);
  const center = fitted.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fitted.min.y + 0.1;
}

/** Un cartel con la imagen, con su proporción, dentro de la caja (`span` × `height`). */
export function imageBoard(
  texture: { image?: { width?: number; height?: number } | null },
  box: { span: number; height: number },
): { width: number; height: number } {
  const w = texture.image?.width ?? 1;
  const h = texture.image?.height ?? 1;
  const aspect = w > 0 && h > 0 ? w / h : 1;
  const height = Math.min(box.height, box.span / aspect);
  return { width: height * aspect, height };
}

/**
 * Carga el arte de `asset` y lo pone en `slot` en lugar de `fallback`.
 * Devuelve el estado final (`model`, `image` o `fallback`) y el tamaño que
 * ocupa (para el radio y la altura de la vista).
 */
export async function mountObjectArt(
  slot: Group,
  fallback: Object3D,
  asset: string,
  box: { span: number; height: number },
  deps: ObjectArtDeps,
  alive: () => boolean,
): Promise<{ state: Exclude<ObjectArtState, 'loading'>; art: Object3D | null; height: number }> {
  const art = await resolveObjectArt(asset, deps);
  if (art.status !== 'ready') return { state: 'fallback', art: null, height: 0 };
  try {
    let obj: Object3D;
    let height: number;
    if (art.format === 'model') {
      obj = await loadGltf(art.url);
      // Como las boias y el barco: Lambert (en el móvil cuesta menos y se ve con las luces del mar).
      lambertize(obj);
      fitModel(obj, box);
      height = new Box3().setFromObject(obj).getSize(new Vector3()).y;
    } else {
      const tex = await new TextureLoader().loadAsync(art.url);
      tex.colorSpace = SRGBColorSpace;
      const board = imageBoard(tex as { image?: { width?: number; height?: number } }, box);
      const mesh = new Mesh(
        new PlaneGeometry(board.width, board.height),
        new MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: DoubleSide }),
      );
      mesh.position.y = board.height / 2 + 0.2;
      mesh.name = 'cartel';
      obj = new Group();
      obj.add(mesh);
      height = board.height + 0.2;
    }
    if (!alive()) return { state: 'fallback', art: null, height: 0 };
    slot.remove(fallback);
    slot.add(obj);
    return { state: art.format, art: obj, height };
  } catch (err) {
    console.warn('[boia] arte subido de un objeto no disponible; se queda la boya', err);
    return { state: 'fallback', art: null, height: 0 };
  } finally {
    // El cargador ya leyó el archivo: la URL de objeto sobra.
    art.release();
  }
}
