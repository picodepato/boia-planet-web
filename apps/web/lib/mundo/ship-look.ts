import {
  SHIP_SKIN_STORAGE_KEY,
  SHIP_STYLE_PARAM,
  SHIP_STYLE_STORAGE_KEY,
  requestedShipSkin,
} from '@boia/engine/ui';
import type { ProgressApi } from '@boia/store';
import { BASE_SKIN, type ShipLook, resolveLook, styleOf } from '../barco/shop-model';

/**
 * Aspecto del barco (estilo + skin) en el 2D y /mar (T12, T40). Qué se
 * carga al entrar (`resolveLook`): `?estilo=<id>` si viene en la URL y es
 * tuyo, si no lo equipado en el repositorio, si no lo último elegido en este
 * navegador antes de la tienda y, si no, el barco del mundo. Equipar en la
 * tienda lo guarda en el repositorio y, por compatibilidad, aquí también.
 */

export type { ShipLook };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Lo último elegido en este navegador (claves de T11/T12, anteriores a la tienda). */
export function legacyLook(): { style: string | null; skin: string | null } {
  const s = storage();
  let style: string | null = null;
  try {
    style = s?.getItem(SHIP_STYLE_STORAGE_KEY) ?? null;
  } catch {
    style = null;
  }
  return { style, skin: requestedShipSkin(s) };
}

/**
 * El aspecto que toca ahora, con lo equipado (bandera y estela incluidas):
 * lee la tienda del repositorio y la URL.
 */
export async function storedLook(
  progress: ProgressApi,
  world: { style: string; skin?: string | undefined },
  search: string,
): Promise<ShipLook & { source: string; equipped: Record<string, string> }> {
  const [items, equipped] = await Promise.all([progress.shop(), progress.equipped()]);
  const urlStyle = new URLSearchParams(search).get(SHIP_STYLE_PARAM);
  const look = resolveLook({ urlStyle, equipped, legacy: legacyLook(), items, world });
  return { ...look, equipped };
}

/**
 * Equipa en el repositorio un aspecto que ya es tuyo (p. ej. el de
 * `?estilo=`): el barco y su skin, o la base. Lo que no es tuyo no se toca.
 */
export async function equipLook(progress: ProgressApi, look: ShipLook): Promise<void> {
  const items = await progress.shop();
  const ship = items.find((i) => i.cosmetic.slot === 'ship' && styleOf(i) === look.style);
  if (!ship?.owned) return;
  const skin = items.find(
    (i) =>
      i.cosmetic.slot === 'skin' &&
      i.forShip === ship.cosmetic.id &&
      i.cosmetic.assetKey === look.skin &&
      i.owned,
  );
  if (skin) {
    await progress.equip('skin', skin.cosmetic.id);
    return;
  }
  await progress.equip('ship', ship.cosmetic.id);
  if (look.skin === BASE_SKIN) await progress.equip('skin', null);
}

/** Guarda la elección en este navegador; sin almacenamiento vale sólo para esta visita. */
export function rememberLook(look: ShipLook): void {
  try {
    const s = storage();
    s?.setItem(SHIP_STYLE_STORAGE_KEY, look.style);
    s?.setItem(SHIP_SKIN_STORAGE_KEY, look.skin);
  } catch {
    // Modo privado o almacenamiento bloqueado.
  }
}

/**
 * Si la URL trae `?estilo=`, lo pone al día sin recargar: si no, al recargar
 * ganaría el de la URL a lo recién elegido.
 */
export function syncStyleParam(style: string): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SHIP_STYLE_PARAM)) return;
  if (url.searchParams.get(SHIP_STYLE_PARAM) === style) return;
  url.searchParams.set(SHIP_STYLE_PARAM, style);
  window.history.replaceState(window.history.state, '', url.href);
}
