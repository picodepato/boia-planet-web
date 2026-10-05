import type { DefenseEnemyKind, DefenseTowerKind } from './config';
import type { DefensePath } from './path';

/**
 * El enganche de las torres (las islas construidas, decisiones 8 y 9 del
 * plan 014). La partida (`sim.ts`) lleva la lista de torres y, en cada paso
 * activo, para cada una pregunta a su tipo `targets` (a quién apunta ahora:
 * la vista lo pinta) y luego llama a `onTick` con esos blancos. Lo que hace
 * cada tipo (haz, bolas de nieve, fuego, mortero, granja, onda, francotirador)
 * lo rellena T159 en `DEFENSE_TOWER_HOOKS`; sin entrada, la torre no hace nada.
 * La partida corre igual con cero torres.
 */

/** Lo que la vista sabe de un enemigo en el camino. Se actualiza en su sitio. */
export interface DefenseEnemyView {
  readonly id: number;
  readonly kind: DefenseEnemyKind;
  readonly tier: 'common' | 'miniboss' | 'boss';
  /** Miniboss o boss. */
  readonly boss: boolean;
  readonly x: number;
  readonly y: number;
  /** rad: hacia dónde avanza. */
  readonly heading: number;
  /** u recorridas desde el vórtice. */
  readonly distance: number;
  /** 0…1 del camino. */
  readonly progress: number;
  /** u a un lado de la línea central (fijo para cada enemigo). */
  readonly laneOffset: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly radius: number;
  /** u/s por el camino. */
  readonly speed: number;
  /** s de aturdimiento que quedan (no avanza). */
  readonly stunS: number;
  /** s desde que salió del vórtice (la vista hace el efecto de salida). */
  readonly ageS: number;
  readonly dead: boolean;
}

/** El último disparo o efecto de una torre, para la vista (lo escribe T159). */
export interface TowerShotView {
  /** s de tiempo activo del disparo. */
  atS: number;
  /** A quién (ids de enemigo), si a alguien. */
  targetIds: readonly number[];
  /** Punto y radio del efecto, si lo tiene (estallido, onda). */
  x?: number;
  y?: number;
  radius?: number;
  /** rad del haz o del cono, si lo tiene. */
  angle?: number;
}

/** Una isla construida. `data` es libre para el tipo (enfriamientos, ángulo del haz…). */
export interface DefenseTowerState {
  readonly id: number;
  readonly kind: DefenseTowerKind;
  readonly x: number;
  readonly y: number;
  /** 1…3. */
  level: number;
  /** Monedas gastadas en ella (construir y mejorar): vender devuelve una parte. */
  spent: number;
  /** Los blancos de este paso (lo que devolvió `targets`). */
  targets: readonly DefenseEnemyView[];
  lastShot: TowerShotView | null;
  data: Record<string, number>;
}

/** De dónde sale un daño o unas monedas (la tarjeta final y las pruebas lo cuentan). */
export type DefenseSource = 'plane' | 'tower';

/** Lo que una torre puede leer y hacer en su paso. */
export interface DefenseTowerContext {
  /** s de tiempo activo. */
  readonly activeS: number;
  /** Los enemigos vivos, en orden de salida del vórtice. */
  readonly enemies: readonly DefenseEnemyView[];
  readonly path: DefensePath;
  /** El azar de la partida (determinista por semilla). */
  rng(): number;
  /** Los vivos con el borde a menos de `r` de (x, y). */
  enemiesInRange(x: number, y: number, r: number): DefenseEnemyView[];
  /** Quita aguante; true si lo mata (las monedas y los puntos van solos). */
  damageEnemy(
    enemy: DefenseEnemyView,
    amount: number,
    source: DefenseSource,
    towerId?: number,
  ): boolean;
  /** Lo deja quieto `seconds` s (no se suma: se queda el mayor). */
  stunEnemy(enemy: DefenseEnemyView, seconds: number): void;
  /** Monedas al monedero (la granja de Ibiza). */
  addCoins(amount: number, towerId?: number): void;
}

export interface DefenseTowerHooks {
  /** A quién apunta la torre ahora (en alcance, por su criterio). */
  targets(tower: DefenseTowerState, ctx: DefenseTowerContext): readonly DefenseEnemyView[];
  /** Un paso activo de la torre, con los blancos que dio `targets`. */
  onTick(tower: DefenseTowerState, ctx: DefenseTowerContext, dt: number): void;
}

/** Lo que hace cada tipo de isla. Vacío hasta T159. */
export const DEFENSE_TOWER_HOOKS: Partial<Record<DefenseTowerKind, DefenseTowerHooks>> = {};
