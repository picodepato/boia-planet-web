'use client';

import type { BoiaRepository, CarnetView } from '@boia/store';
import { useRepoData } from '../repo';
import type { CarnetExtras } from './carnet-card';

/** Preferencia del invitado con el barco que lleva (la escribe /juego). */
export const SHIP_PREF = 'barco';

export interface ShipPref {
  style: string;
  skin: string;
  /** «Estilo · Skin», listo para enseñar. */
  label: string;
}

export function isShipPref(v: unknown): v is ShipPref {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as ShipPref).style === 'string' &&
    typeof (v as ShipPref).label === 'string'
  );
}

export interface CarnetData {
  carnet: CarnetView | null;
  extras: CarnetExtras;
}

async function readCarnet(repo: BoiaRepository, userId: string | null): Promise<CarnetData> {
  const carnet = userId ? await repo.carnet.get(userId) : await repo.carnet.mine();
  const cosmetics = await repo.content.list('cosmetics');
  const cosmeticNames = Object.fromEntries(cosmetics.map((c) => [c.id, c.name]));
  let shipLabel: string | null = null;
  if (carnet?.isMine) {
    const pref = await repo.progress.pref(SHIP_PREF);
    if (isShipPref(pref)) shipLabel = pref.label;
  }
  return { carnet, extras: { shipLabel, cosmeticNames } };
}

/** El Carnet de `userId` (o el propio con null), al día con cada cambio. */
export function useCarnet(userId: string | null) {
  return useRepoData((repo) => readCarnet(repo, userId), [userId]);
}
