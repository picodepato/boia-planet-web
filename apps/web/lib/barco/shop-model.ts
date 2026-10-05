import type { ShopItem } from '@boia/store';
import { SKIN_LABELS, type ShipCatalog, variantFilter } from './catalog';
import { t } from '../i18n';

/**
 * La tienda «Barco» sin React (T40, D-23 punto 1, O5): de lo que devuelve
 * `progress.shop()` y el catálogo del arte sale cada fila tal como se pinta,
 * igual en el 2D y en /mar, y el aspecto que lleva el barco al entrar.
 * Textos `muestra`.
 */

/** Estilo y skin del barco (T11, T12). */
export interface ShipLook {
  style: string;
  skin: string;
}

export const BASE_SKIN = 'base';

/** Estilo de un cosmético `ship` (su `assetKey`). */
export const styleOf = (i: Pick<ShopItem, 'cosmetic'>): string =>
  i.cosmetic.assetKey ?? i.cosmetic.id;

export interface ShopSkinRow {
  skin: string;
  label: string;
  preview: string | null;
  /** null: la skin base, que va con el barco. */
  item: ShopItem | null;
  owned: boolean;
}

export interface ShopShipRow {
  style: string;
  name: string;
  description: string | null;
  preview: string | null;
  item: ShopItem;
  skins: ShopSkinRow[];
  /** Filtro CSS de las miniaturas de una variante sin arte propio (T59). */
  filter?: string;
}

export interface ShopRows {
  ships: ShopShipRow[];
  wakes: ShopItem[];
  /** Mascotas de cubierta (T154): las que se tienen o se pueden ganar. */
  mascots: ShopItem[];
}

/**
 * Filas de la tienda: los barcos que tienen arte (en el orden del catálogo,
 * el del registro B01…B08), cada uno con su base y las skins que se venden y
 * tienen arte; y las estelas y mascotas. Un estilo del arte sin cosmético (el
 * «muestra» de antes de T17) no se ofrece.
 */
export function shopRows(catalog: ShipCatalog | null, items: readonly ShopItem[]): ShopRows {
  const ships: ShopShipRow[] = [];
  for (const style of catalog?.styles ?? []) {
    const item = items.find((i) => i.cosmetic.slot === 'ship' && styleOf(i) === style.id);
    if (!item) continue;
    const skins: ShopSkinRow[] = style.skins.flatMap((k): ShopSkinRow[] => {
      if (k.id === BASE_SKIN)
        return [{ skin: k.id, label: k.label, preview: k.preview, item: null, owned: item.owned }];
      const sold = items.find(
        (i) =>
          i.cosmetic.slot === 'skin' &&
          i.forShip === item.cosmetic.id &&
          i.cosmetic.assetKey === k.id,
      );
      return sold
        ? [{ skin: k.id, label: k.label, preview: k.preview, item: sold, owned: sold.owned }]
        : [];
    });
    const filter = variantFilter(style);
    ships.push({
      style: style.id,
      name: item.cosmetic.name,
      description: style.description,
      preview: style.skins[0]?.preview ?? null,
      item,
      skins,
      ...(filter ? { filter } : {}),
    });
  }
  const active = (slot: string) =>
    items.filter((i) => i.cosmetic.slot === slot && (i.cosmetic.active || i.owned));
  return { ships, wakes: active('wake'), mascots: active('mascot') };
}

/** Títulos de los logros por id; null si es oculto y no se ha completado. */
export type AchievementTitles = Readonly<Record<string, string | null>>;

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

/**
 * Lo que se dice de un cosmético: «Equipado», «Tuyo», su precio con «te
 * faltan N monedas», el umbral con «te faltan N puntos» o el logro que lo da.
 */
export function unlockText(item: ShopItem, titles: AchievementTitles = {}): string {
  if (item.owned) {
    if (item.equipped) return t('barco.shopModel.equipado');
    return item.unlock.kind === 'base' ? t('barco.shopModel.deSerie') : t('barco.shopModel.tuyo');
  }
  const u = item.unlock;
  switch (u.kind) {
    case 'coins':
      return item.missing > 0
        ? t('barco.shopModel.teFaltan', { price: u.price, n: n(item.missing, 'moneda', 'monedas') })
        : `${u.price} 🪙`;
    case 'points':
      return t('barco.shopModel.conPuntosTeFaltan', {
        points: u.points,
        n: n(item.missing, 'punto', 'puntos'),
      });
    case 'mission':
      return t('shop.lockedMission');
    case 'achievement': {
      const title = titles[u.achievementId];
      return title
        ? t('shop.lockedAchievement', { achievement: title })
        : t('barco.shopModel.seGanaConUn');
    }
    default:
      return t('barco.shopModel.noDisponible');
  }
}

/** La pregunta de la confirmación de compra. muestra */
export function confirmText(item: ShopItem, coins: number): string {
  const price = item.unlock.kind === 'coins' ? item.unlock.price : 0;
  return t('barco.shopModel.comprarPorTeQuedaran', {
    name: item.cosmetic.name,
    price,
    v3: coins - price,
  });
}

/**
 * El aspecto que lleva el barco al entrar. Manda, por orden: `?estilo=` en la
 * URL, lo equipado en el repositorio, lo último elegido en este navegador
 * antes de T40 y, si no, el barco del mundo. Un estilo o una skin que no se
 * tiene no se pone: se pasa al siguiente (el del mundo siempre vale).
 */
export function resolveLook(opts: {
  urlStyle: string | null;
  equipped: Readonly<Record<string, string>>;
  legacy: { style: string | null; skin: string | null };
  items: readonly ShopItem[];
  world: { style: string; skin?: string | undefined };
}): ShipLook & { source: 'url' | 'equipped' | 'legacy' | 'world' } {
  const ships = opts.items.filter((i) => i.cosmetic.slot === 'ship');
  const ownedShip = (style: string | null) =>
    style ? ships.find((i) => styleOf(i) === style && i.owned) : undefined;
  const equippedShip = ships.find((i) => i.cosmetic.id === opts.equipped.ship && i.owned);
  let style = opts.world.style;
  let source: 'url' | 'equipped' | 'legacy' | 'world' = 'world';
  if (ownedShip(opts.urlStyle)) {
    style = opts.urlStyle!;
    source = 'url';
  } else if (equippedShip) {
    style = styleOf(equippedShip);
    source = 'equipped';
  } else if (ownedShip(opts.legacy.style)) {
    style = opts.legacy.style!;
    source = 'legacy';
  }
  const shipId = ships.find((i) => styleOf(i) === style)?.cosmetic.id;
  const ownedSkin = (skin: string | null | undefined) =>
    skin
      ? opts.items.find(
          (i) =>
            i.cosmetic.slot === 'skin' &&
            i.owned &&
            i.forShip === shipId &&
            i.cosmetic.assetKey === skin,
        )
      : undefined;
  const eqSkin = opts.items.find(
    (i) => i.cosmetic.id === opts.equipped.skin && i.owned && i.forShip === shipId,
  );
  const skin =
    eqSkin?.cosmetic.assetKey ??
    ownedSkin(opts.legacy.skin)?.cosmetic.assetKey ??
    (source === 'world' && opts.world.skin ? opts.world.skin : BASE_SKIN);
  return { style, skin, source };
}

/** El nombre de la skin para el Carnet y las etiquetas. */
export const skinLabel = (skin: string): string => SKIN_LABELS[skin] ?? skin;
