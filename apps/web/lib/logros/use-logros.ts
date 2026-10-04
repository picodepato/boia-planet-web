'use client';

import type { AchievementProgress, BoiaRepository, ShipUnlock } from '@boia/store';
import { useEffect, useRef, useState } from 'react';
import {
  type AchievementFacts,
  achievementFacts,
  reconcileAchievementEvidence,
} from '../mundo/achievements';
import { useRepoData } from '../mundo/repo';
import { capturePlayerRepository } from '../repo';
import { type CosmeticNames, readyCount } from './model';
import { t as msg } from '../i18n';

/**
 * Lo que el panel de logros lee del repositorio (T37), y se vuelve a leer con
 * cada cambio (también de otra pestaña): el catálogo con su estado, lo
 * contado para el progreso, los saldos, el rango y los nombres de los
 * cosméticos que se ganan.
 */
export interface LogrosData {
  list: AchievementProgress[];
  facts: AchievementFacts;
  balances: { points: number; coins: number };
  rank: string | null;
  names: CosmeticNames;
}

export async function readLogros(r: BoiaRepository): Promise<LogrosData> {
  r = await capturePlayerRepository(r);
  await reconcileAchievementEvidence(r);
  const [list, balances, facts, ranks, cosmetics] = await Promise.all([
    r.progress.achievements(),
    r.progress.balances(),
    achievementFacts(r.progress),
    r.content.list('ranks'),
    r.content.list('cosmetics'),
  ]);
  const rank =
    [...ranks]
      .filter((k) => k.minPoints <= balances.points)
      .sort((a, b) => b.minPoints - a.minPoints)[0] ?? null;
  return {
    list,
    facts,
    balances: { points: balances.points, coins: balances.coins },
    rank: rank?.name ?? null,
    names: Object.fromEntries(cosmetics.map((c) => [c.id, c.name])),
  };
}

export function useLogros() {
  return useRepoData(readLogros);
}

/** Cuántos logros esperan a que se reclamen (el número del icono), 0 mientras carga. */
export function useReadyCount(): number {
  const { data } = useRepoData((r) => r.progress.achievements());
  return data ? readyCount(data) : 0;
}

/** Un barco bloqueable, con el título del logro que lo da (textos de la tienda). */
export interface ShipLock extends ShipUnlock {
  achievementTitle: string | null;
}

/** El texto de un barco bloqueado. muestra */
export function lockedShipText(
  lock: Pick<ShipLock, 'achievementTitle' | 'achievementId' | 'priceCoins'> &
    Partial<Pick<ShipLock, 'unlockMission'>>,
): string {
  if (lock.unlockMission) return msg('shop.lockedMission');
  if (lock.achievementTitle)
    return msg('shop.lockedAchievement', { achievement: lock.achievementTitle });
  if (lock.achievementId) return msg('logros.useLogros.seGanaConUn');
  if (lock.priceCoins !== null)
    return msg('logros.useLogros.enLaTienda', { priceCoins: lock.priceCoins });
  return msg('logros.useLogros.bloqueado');
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Un número que sube contando hasta `value` (saldos al reclamar). La primera
 * vez y con movimiento reducido, sin animación.
 */
export function useCountUp(value: number, ms = 900, from?: number): number {
  const [shown, setShown] = useState(from ?? value);
  const current = useRef(from ?? value);
  useEffect(() => {
    const start = current.current;
    if (start === value || reducedMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - (1 - k) ** 3;
      const v = Math.round(start + (value - start) * eased);
      current.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
