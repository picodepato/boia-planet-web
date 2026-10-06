'use client';

import { type Balances, type BoiaRepository, type ShopItem, isStoreError } from '@boia/store';
import { type ReactNode, useState } from 'react';
import { requireAccount } from '../account/gate';
import { useRepoData } from '../mundo/repo';
import type { ShipCatalog } from './catalog';
import { WAKE_TINTS, hexOf } from './dressing';
import { MascotIcon } from './mascot-icon';
import {
  type AchievementTitles,
  BASE_SKIN,
  type ShipLook,
  type ShopRows,
  type ShopShipRow,
  type ShopSkinRow,
  confirmText,
  shopRows,
  unlockText,
} from './shop-model';
import './shop.css';
import { t as msg } from '../i18n';

/**
 * ⛵ La tienda «Barco» (T40, REQ-IDE-030/031, D-23 punto 1, O5), la misma en
 * el Menú de a bordo del 2D y en el selector de barco de /mar: cada barco
 * con su precio o su condición («te faltan N monedas/puntos»), comprar con
 * confirmación, equipar, lo propio marcado; las skins del barco que se lleva,
 * la estela y la mascota de cubierta (T154). Sólo cambia cómo se
 * ve el barco.
 */

export interface ShopData {
  items: ShopItem[];
  balances: Pick<Balances, 'points' | 'coins'>;
  titles: AchievementTitles;
}

export async function readShop(r: BoiaRepository): Promise<ShopData> {
  const [items, balances, achievements] = await Promise.all([
    r.progress.shop(),
    r.progress.balances(),
    r.progress.achievements(),
  ]);
  return {
    items,
    balances: { points: balances.points, coins: balances.coins },
    titles: Object.fromEntries(
      achievements.map((a) => [a.definition.id, a.hidden ? null : a.definition.title]),
    ),
  };
}

export const SHOP_COPY = {
  intro: msg('barco.shop.barcosSkinsEstelaY'),
  noArt: msg('barco.shop.elBarcoDeMuestra'),
  loading: msg('barco.shop.cargandoLaTienda'),
  buy: msg('barco.shop.comprar'),
  cancel: msg('carnet.cancel'),
  bought: msg('barco.shop.yaEsTuyoEquipalo'),
  noCoins: msg('barco.shop.noTeLleganLas'),
  failed: msg('barco.shop.noSePudoComprar'),
  firstShip: msg('barco.shop.primeroElBarco'),
  plainWake: msg('barco.shop.espumaBlanca'),
  noMascot: msg('barco.shop.sinMascota'),
  mascotNote: msg('barco.shop.mascotaNota'),
} as const;

/** Ranuras que se eligen de una lista (con «ninguna»). */
export type ListSlot = 'wake' | 'mascot';
const LIST_PREFIX: Record<ListSlot, string> = {
  wake: 'barco-estela',
  mascot: 'barco-mascota',
};

export interface ShopHandlers {
  equipShip: (row: ShopShipRow) => void;
  equipSkin: (row: ShopShipRow, skin: ShopSkinRow) => void;
  equipSlot: (slot: ListSlot, item: ShopItem | null) => void;
  ask: (item: ShopItem) => void;
  confirm: () => void;
  cancel: () => void;
}

/** La tienda pintada (sin repositorio): lo usa `BarcoShop` y se prueba sola. */
export function BarcoShopView({
  rows,
  data,
  current,
  pending = false,
  asking = null,
  busy = false,
  message = null,
  on,
}: {
  rows: ShopRows;
  data: ShopData;
  current: ShipLook | null;
  pending?: boolean;
  asking?: ShopItem | null;
  busy?: boolean;
  message?: string | null;
  on: ShopHandlers;
}) {
  const { coins, points } = data.balances;
  const shown =
    rows.ships.find((r) => r.style === current?.style) ??
    rows.ships.find((r) => r.item.equipped) ??
    rows.ships.find((r) => r.item.owned) ??
    rows.ships[0];
  const skin = current?.skin ?? BASE_SKIN;
  const text = (i: ShopItem) => unlockText(i, data.titles);
  const buyButton = (i: ShopItem, testId: string, label = SHOP_COPY.buy) =>
    !i.owned && i.unlock.kind === 'coins' ? (
      <button
        type="button"
        className="tienda-comprar"
        data-testid={testId}
        disabled={!i.canBuy || busy}
        onClick={() => on.ask(i)}
      >
        {label} · {i.unlock.price} 🪙
      </button>
    ) : null;

  return (
    <div className="tienda" data-testid="barco" aria-busy={pending || busy}>
      <p className="tienda-intro">{SHOP_COPY.intro}</p>
      <p className="tienda-saldo" data-testid="barco-saldo" data-coins={coins} data-points={points}>
        {msg('barco.shop.tienes')} <strong>🪙 {coins}</strong> {msg('barco.shop.monedas')}{' '}
        <strong>★ {points}</strong> {msg('barco.shop.puntos')}
      </p>
      {message ? (
        <p className="tienda-mensaje" role="status" data-testid="barco-mensaje">
          {message}
        </p>
      ) : null}

      <h3 id="tienda-barcos">{msg('barco.shop.barcos')}</h3>
      <ul className="tienda-barcos" role="radiogroup" aria-labelledby="tienda-barcos">
        {rows.ships.map((row) => {
          const i = row.item;
          const isOn = row.style === current?.style;
          const why = text(i);
          return (
            <li
              key={row.style}
              className={`tienda-barco${isOn ? ' is-active' : ''}${i.owned ? '' : ' is-locked'}`}
              data-testid={`barco-item-${row.style}`}
              data-estado={isOn ? 'equipado' : i.owned ? 'tuyo' : 'bloqueado'}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isOn}
                aria-disabled={i.owned ? undefined : 'true'}
                aria-label={i.owned ? undefined : `${row.name}: bloqueado. ${why}`}
                className="tienda-opcion"
                data-testid={`barco-estilo-${row.style}`}
                data-bloqueado={i.owned ? undefined : 'si'}
                title={i.owned ? undefined : why}
                onClick={() => (i.owned ? on.equipShip(row) : undefined)}
              >
                {row.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arte servido desde art/ (D-16)
                  <img
                    src={row.preview}
                    alt=""
                    width={72}
                    height={72}
                    loading="lazy"
                    style={row.filter ? { filter: row.filter } : undefined}
                  />
                ) : null}
                <span className="tienda-nombre">
                  {i.owned ? null : <span aria-hidden="true">🔒 </span>}
                  {row.name}
                </span>
                <span
                  className={`tienda-estado${i.owned ? ' is-owned' : ''}`}
                  data-testid={i.owned ? `barco-estado-${row.style}` : `barco-candado-${row.style}`}
                >
                  {isOn ? msg('barco.shop.equipado') : why}
                </span>
              </button>
              {buyButton(i, `barco-comprar-${row.style}`)}
            </li>
          );
        })}
      </ul>
      {shown?.description ? (
        <p className="tienda-descripcion" data-testid="barco-descripcion">
          <strong>{shown.name}.</strong> {shown.description}
        </p>
      ) : null}

      {shown ? (
        <>
          <h3 id="tienda-skins">{msg('barco.shop.skins', { name: shown.name })}</h3>
          <ul className="tienda-skins" role="radiogroup" aria-labelledby="tienda-skins">
            {shown.skins.map((k) => {
              const checked = shown.style === current?.style && k.skin === skin;
              const status = checked
                ? msg('barco.shop.equipada')
                : k.item
                  ? !shown.item.owned && !k.owned
                    ? SHOP_COPY.firstShip
                    : text(k.item)
                  : shown.item.owned
                    ? msg('barco.shop.deSerie')
                    : SHOP_COPY.firstShip;
              return (
                <li key={k.skin} className="tienda-skin" data-testid={`barco-skin-item-${k.skin}`}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-disabled={k.owned ? undefined : 'true'}
                    className={`tienda-opcion${checked ? ' is-active' : ''}${k.owned ? '' : ' is-locked'}`}
                    data-testid={`barco-skin-${k.skin}`}
                    data-bloqueado={k.owned ? undefined : 'si'}
                    onClick={() => (k.owned ? on.equipSkin(shown, k) : undefined)}
                  >
                    {k.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- arte servido desde art/ (D-16)
                      <img
                        src={k.preview}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        style={shown.filter ? { filter: shown.filter } : undefined}
                      />
                    ) : null}
                    <span className="tienda-nombre">{k.label}</span>
                    <span className="tienda-estado">{status}</span>
                  </button>
                  {k.item && shown.item.owned
                    ? buyButton(k.item, `barco-comprar-skin-${k.skin}`)
                    : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <CosmeticList
        title={msg('barco.shop.estela')}
        slot="wake"
        none={SHOP_COPY.plainWake}
        items={rows.wakes}
        swatch={(id) => {
          const t = WAKE_TINTS[id];
          return t !== undefined ? hexOf(t) : null;
        }}
        text={text}
        on={on}
        buy={buyButton}
      />
      <CosmeticList
        title={msg('barco.shop.mascota')}
        slot="mascot"
        none={SHOP_COPY.noMascot}
        note={SHOP_COPY.mascotNote}
        items={rows.mascots}
        swatch={() => null}
        icon={(id) => <MascotIcon id={id} />}
        text={text}
        on={on}
        buy={buyButton}
      />

      {asking ? (
        <div
          className="tienda-confirmar"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="tienda-confirmar-texto"
          data-testid="barco-confirmar"
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            on.cancel();
          }}
        >
          <p id="tienda-confirmar-texto">{confirmText(asking, coins)}</p>
          <div className="tienda-confirmar-botones">
            <button
              type="button"
              className="tienda-comprar"
              data-testid="barco-confirmar-si"
              disabled={busy}
              // El foco va aquí al abrirse: Intro compra, Escape cancela.
              autoFocus
              onClick={on.confirm}
            >
              {SHOP_COPY.buy}
            </button>
            <button
              type="button"
              className="tienda-cancelar"
              data-testid="barco-confirmar-no"
              onClick={on.cancel}
            >
              {SHOP_COPY.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CosmeticList({
  title,
  slot,
  none,
  note,
  items,
  swatch,
  icon,
  text,
  on,
  buy,
}: {
  title: string;
  slot: ListSlot;
  none: string;
  /** Una línea bajo el título (la mascota: dónde va y que no ayuda a jugar). */
  note?: string;
  items: ShopItem[];
  swatch: (id: string) => string | null;
  /** En vez de la muestra de color, un dibujo (la mascota). */
  icon?: (id: string) => ReactNode;
  text: (i: ShopItem) => string;
  on: ShopHandlers;
  buy: (i: ShopItem, testId: string) => ReactNode;
}) {
  if (items.length === 0) return null;
  const prefix = LIST_PREFIX[slot];
  const noneOn = !items.some((i) => i.equipped);
  return (
    <>
      <h3 id={`tienda-${slot}`}>{title}</h3>
      {note ? <p className="tienda-nota">{note}</p> : null}
      <ul className="tienda-cosmeticos" role="radiogroup" aria-labelledby={`tienda-${slot}`}>
        <li>
          <button
            type="button"
            role="radio"
            aria-checked={noneOn}
            className={`tienda-opcion tienda-fila${noneOn ? ' is-active' : ''}`}
            data-testid={`${prefix}-ninguna`}
            onClick={() => on.equipSlot(slot, null)}
          >
            {icon ? (
              <span className="tienda-icono" aria-hidden="true" />
            ) : (
              <span className="tienda-muestra" aria-hidden="true" />
            )}
            <span className="tienda-nombre">{none}</span>
          </button>
        </li>
        {items.map((i) => {
          const bg = swatch(i.cosmetic.id);
          return (
            <li key={i.cosmetic.id}>
              <button
                type="button"
                role="radio"
                aria-checked={i.equipped}
                aria-disabled={i.owned ? undefined : 'true'}
                className={`tienda-opcion tienda-fila${i.equipped ? ' is-active' : ''}${i.owned ? '' : ' is-locked'}`}
                data-testid={`${prefix}-${i.cosmetic.id}`}
                data-bloqueado={i.owned ? undefined : 'si'}
                onClick={() => (i.owned ? on.equipSlot(slot, i) : undefined)}
              >
                {icon ? (
                  <span className="tienda-icono" aria-hidden="true">
                    {icon(i.cosmetic.id)}
                  </span>
                ) : (
                  <span
                    className="tienda-muestra"
                    aria-hidden="true"
                    style={bg ? { background: bg } : undefined}
                  />
                )}
                <span className="tienda-nombre">
                  {i.owned ? null : <span aria-hidden="true">🔒 </span>}
                  {i.cosmetic.name}
                </span>
                <span className="tienda-estado">{text(i)}</span>
              </button>
              {buy(i, `barco-comprar-${i.cosmetic.id}`)}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * La tienda con el repositorio: lee y vuelve a leer con cada cambio (también
 * de otra pestaña). Equipar un barco o una skin lo guarda y avisa a la vista
 * con `onEquip` para que lo ponga en el agua; estela y mascota las pinta la
 * vista al ver cambiar lo equipado.
 */
export function BarcoShop({
  catalog,
  current,
  pending = false,
  onEquip,
}: {
  catalog: ShipCatalog | null;
  current: ShipLook | null;
  pending?: boolean;
  onEquip: (look: ShipLook) => void;
}) {
  const { data, repo } = useRepoData(readShop);
  const [asking, setAsking] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!catalog || catalog.styles.length === 0) {
    return <p className="juego-muted">{SHOP_COPY.noArt}</p>;
  }
  if (!data || !repo) {
    return (
      <p className="juego-muted" aria-busy="true" data-testid="barco">
        {SHOP_COPY.loading}
      </p>
    );
  }
  const rows = shopRows(catalog, data.items);
  const fail = (err: unknown) => console.warn('[boia] tienda del barco', err);

  const on: ShopHandlers = {
    equipShip: (row) => {
      setMessage(null);
      void (async () => {
        const eq = await repo.progress.equip('ship', row.item.cosmetic.id);
        const kept = row.skins.find((k) => k.item && k.item.cosmetic.id === eq.skin);
        onEquip({ style: row.style, skin: kept?.skin ?? BASE_SKIN });
      })().catch(fail);
    },
    equipSkin: (row, k) => {
      setMessage(null);
      void (async () => {
        if (k.item) await repo.progress.equip('skin', k.item.cosmetic.id);
        else {
          await repo.progress.equip('ship', row.item.cosmetic.id);
          await repo.progress.equip('skin', null);
        }
        onEquip({ style: row.style, skin: k.skin });
      })().catch(fail);
    },
    equipSlot: (slot, item) => {
      setMessage(null);
      void repo.progress.equip(slot, item?.cosmetic.id ?? null).catch(fail);
    },
    ask: (item) => {
      setMessage(null);
      setAsking(item);
    },
    cancel: () => setAsking(null),
    confirm: () => {
      const item = asking;
      if (!item || busy) return;
      setBusy(true);
      // Comprar se guarda en la cuenta (plan 008, decisión 1): pide el email
      // si no hay sesión; en modo local pasa al momento. Cancelar no compra.
      requireAccount('skin')
        .then(async (ok) => {
          if (!ok) return;
          await repo.progress.buyCosmetic(item.cosmetic.id);
          setMessage(SHOP_COPY.bought);
        })
        .catch((err: unknown) => {
          setMessage(
            isStoreError(err, 'insufficient_coins') ? SHOP_COPY.noCoins : SHOP_COPY.failed,
          );
          fail(err);
        })
        .finally(() => {
          setBusy(false);
          setAsking(null);
        });
    },
  };

  return (
    <BarcoShopView
      rows={rows}
      data={data}
      current={current}
      pending={pending}
      asking={asking}
      busy={busy}
      message={message}
      on={on}
    />
  );
}
