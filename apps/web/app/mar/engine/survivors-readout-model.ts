import type { EnemyId } from '@boia/engine/survivors';

export const DAMAGE_WINDOW_S = 0.16;
export const DAMAGE_LIFE_S = 0.85;

export interface DamageHit {
  readonly id: number;
  readonly kind: 'enemy' | 'boss';
  readonly enemy?: EnemyId;
  readonly damage: number;
  readonly x: number;
  readonly y: number;
}

export interface DamageNumber extends DamageHit {
  readonly serial: number;
  readonly bornS: number;
}

interface Pending {
  hit: DamageHit;
  startS: number;
}

/** Fixed short windows, bounded pending and visible counts; clock is simulation active time. */
export class DamageNumbers {
  private readonly pending = new Map<string, Pending>();
  private readonly visible: DamageNumber[] = [];
  private serial = 0;

  constructor(readonly cap: number) {}

  add(hit: DamageHit, nowS: number): void {
    if (!(hit.damage > 0) || !Number.isFinite(hit.damage) || this.cap <= 0) return;
    this.read(nowS);
    const key = `${hit.kind}:${hit.id}`;
    const prev = this.pending.get(key);
    if (prev) {
      prev.hit = { ...hit, damage: prev.hit.damage + hit.damage };
      return;
    }
    // Keep windows long enough to finish even under sustained AoE/flame traffic.
    if (this.pending.size >= this.cap) return;
    this.pending.set(key, { hit: { ...hit }, startS: nowS });
  }

  read(nowS: number): readonly DamageNumber[] {
    for (const [key, p] of this.pending) {
      if (nowS + 1e-9 < p.startS + DAMAGE_WINDOW_S) continue;
      this.visible.push({ ...p.hit, serial: ++this.serial, bornS: p.startS + DAMAGE_WINDOW_S });
      this.pending.delete(key);
    }
    let n = 0;
    for (const v of this.visible) if (nowS - v.bornS < DAMAGE_LIFE_S) this.visible[n++] = v;
    this.visible.length = n;
    if (n > this.cap) this.visible.splice(0, n - this.cap);
    return this.visible;
  }

  clear(): void {
    this.pending.clear();
    this.visible.length = 0;
  }
}

export function damageRise(ageS: number, reduced: boolean): number {
  return reduced ? 0 : Math.max(0, Math.min(1, ageS / DAMAGE_LIFE_S)) * 22;
}
