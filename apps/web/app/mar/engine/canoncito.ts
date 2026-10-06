import type { QualityTier } from '@boia/engine/streaming';
import { BufferGeometry, Group, Mesh, type MeshLambertMaterial } from 'three';
import { litMaterial } from './characters';
import { type MascotModel, type MascotModelState, type MascotParts } from './mascot-models';

/**
 * El «Cañoncito» (plan 015 T175, decisión 16): la mascota de cubierta que
 * gana el castillo en Tormenta. Va en el mismo hueco que el minikraken, con
 * sus mismas reglas de sitio. Modelo de Blender en tres piezas
 * (`tools/blender/mascotas/canoncito.py`): la cureña, el tubo (pivote en los
 * muñones) y la nube de humo (pivote en la boca, escala 0 en reposo).
 *
 * Animación sólo con transformaciones, nada se crea en `update`: el tubo
 * cabecea despacio y, de vez en cuando, «dispara»: retrocede de golpe sobre
 * los muñones, la nube de humo crece y se deshace, y el cañón da un saltito.
 * En `baja` igual (es barato); con movimiento reducido, quieto y sin disparos.
 */

/** Cada cuántos s dispara, y cuánto dura el disparo (retroceso + humo). muestra */
export const CANONCITO_PERIOD_S = 6.5;
export const CANONCITO_SHOT_S = 1.1;
/** Cuánto retrocede el tubo al disparar (unidades del modelo). */
const RECOIL = 0.09;
/** Escala en cubierta: el modelo mide 0,39 de alto; así se lee como el minikraken (0,575). muestra */
export const CANONCITO_SCALE = 1.35;

export interface CanoncitoState {
  quality: QualityTier;
  reduced: boolean;
}

export interface Canoncito {
  group: Group;
  base: Mesh;
  barrel: Mesh;
  puff: Mesh;
  quality: QualityTier;
  modelState: MascotModelState;
  /** 0 en reposo; 1 justo al disparar (pruebas). */
  readonly shot: number;
  update(t: number, dt: number, s: CanoncitoState): void;
  dispose(): void;
}

/** Fase del disparo en t: 0 fuera del disparo; 1 → 0 mientras dura. */
export function canoncitoShotAt(t: number): number {
  const k = ((t % CANONCITO_PERIOD_S) + CANONCITO_PERIOD_S) % CANONCITO_PERIOD_S;
  return k < CANONCITO_SHOT_S ? 1 - k / CANONCITO_SHOT_S : 0;
}

export function createCanoncito(quality: QualityTier, model: MascotModel): Canoncito {
  const mat = litMaterial();
  const base = new Mesh(new BufferGeometry(), mat);
  const barrel = new Mesh(new BufferGeometry(), mat);
  const puff = new Mesh(new BufferGeometry(), mat);
  base.name = 'canoncito-base';
  barrel.name = 'canoncito-barrel';
  puff.name = 'canoncito-puff';
  puff.scale.setScalar(0);
  const group = new Group();
  group.name = 'canoncito';
  group.add(base, barrel, puff);
  group.scale.setScalar(CANONCITO_SCALE);
  let disposed = false;
  let shot = 0;

  const view: Canoncito = {
    group,
    base,
    barrel,
    puff,
    quality,
    modelState: 'cargando',
    get shot() {
      return shot;
    },
    update(t, _dt, st) {
      if (st.reduced) {
        shot = 0;
        group.position.y = 0;
        barrel.rotation.set(0, 0, 0);
        barrel.position.copy(pivotOf(parts, 'barrel'));
        puff.scale.setScalar(0);
        return;
      }
      shot = canoncitoShotAt(t);
      // Cabeceo lento del tubo; al disparar, retrocede de golpe y vuelve.
      const sway = Math.sin(t * 1.1) * 0.05;
      const kick = shot * shot;
      barrel.rotation.z = sway + kick * 0.18;
      barrel.rotation.y = Math.sin(t * 0.7) * 0.06;
      const pivot = pivotOf(parts, 'barrel');
      barrel.position.set(pivot.x - kick * RECOIL, pivot.y, pivot.z);
      // La nube: sale de golpe, crece y se deshace. El cañón da un saltito.
      const puffK = shot > 0 ? Math.sin((1 - shot) * Math.PI) : 0;
      puff.scale.setScalar(0.3 * shot + puffK * 1.1);
      puff.position.copy(pivotOf(parts, 'puff')).x += (1 - shot) * 0.12;
      group.position.y = kick * 0.04 * CANONCITO_SCALE;
    },
    dispose() {
      disposed = true;
      // Las geometrías son del modelo compartido (`release` las suelta), no se destruyen aquí.
      model.release();
      (mat as MeshLambertMaterial).dispose();
    },
  };

  let parts: MascotParts | null = null;
  void model.acquire().then((p) => {
    if (disposed) return;
    if (!p) {
      view.modelState = 'error';
      return;
    }
    parts = p;
    base.geometry = p.get('base')!.geometry;
    barrel.geometry = p.get('barrel')!.geometry;
    puff.geometry = p.get('puff')!.geometry;
    base.position.copy(p.get('base')!.pivot);
    barrel.position.copy(p.get('barrel')!.pivot);
    puff.position.copy(p.get('puff')!.pivot);
    view.modelState = 'glb';
  });
  return view;
}

const ZERO = { x: 0, y: 0, z: 0 };
function pivotOf(parts: MascotParts | null, name: string): { x: number; y: number; z: number } {
  return parts?.get(name)?.pivot ?? ZERO;
}
