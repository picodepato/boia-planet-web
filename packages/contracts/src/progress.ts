/**
 * Vocabulario del progreso: los mismos enums que el esquema de T06
 * (`packages/db`, supabase/migrations). La capa local de la demo
 * (`@boia/store`) y la futura de Supabase hablan con estos nombres; una
 * prueba de `@boia/store` los compara con `Constants` de `@boia/db`.
 */

/** Tipos de transacción del libro (tabla `ledger_transactions`, REQ-ARQ-007). */
export const LEDGER_KINDS = [
  'world_reward',
  'achievement',
  'stamp',
  'cosmetic',
  'adjustment',
  'compensation',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/**
 * Condiciones de logro del enum `achievement_trigger` de supabase/migrations:
 * las de T06, las del catálogo aprobado de T36 y las del Cañón definitivo
 * (plan 013 T153: `play_minigame`, `defeat_boss`), que añade la migración
 * `20261005100000_canon_launch.sql` (escrita y probada, sin aplicar). Una
 * prueba de `@boia/store` las compara con `Constants` de `@boia/db`.
 */
export const ACHIEVEMENT_TRIGGERS_DB = [
  'visit_island',
  'find_buoy',
  'collect_objects',
  'complete_circuit',
  'time_played',
  'buy_ticket',
  'rescue_character',
  'deliver_character',
  'win_minigame',
  'complete_encounter',
  'read_bottle',
  'throw_bottle',
  'create_carnet',
  'answer_question',
  'visit_world',
  'play_minigame',
  'defeat_boss',
] as const;

/**
 * Condiciones que sólo existen en la demo del navegador, a la espera de su
 * migración en Supabase. Hoy, ninguna.
 */
export const ACHIEVEMENT_TRIGGERS_NEW = [] as const;

/** Catálogo de condiciones de logro (REQ-ADM-021). */
export const ACHIEVEMENT_TRIGGERS = [
  ...ACHIEVEMENT_TRIGGERS_DB,
  ...ACHIEVEMENT_TRIGGERS_NEW,
] as const;
export type AchievementTrigger = (typeof ACHIEVEMENT_TRIGGERS)[number];

/**
 * Estado de un logro para quien juega (D-22, punto 5): en curso → listo para
 * reclamar → reclamado. El premio sólo llega al reclamar.
 */
export const ACHIEVEMENT_STATES = ['in_progress', 'ready', 'claimed'] as const;
export type AchievementState = (typeof ACHIEVEMENT_STATES)[number];

/**
 * Tipo de premio de un logro (REQ-IDE-052): monedas (con los puntos, por
 * defecto), insignia del Carnet, barco de estilo o cosmético del barco.
 * Todos dan además sus puntos.
 */
export const ACHIEVEMENT_REWARD_KINDS = ['coins', 'badge', 'ship', 'cosmetic'] as const;
export type AchievementRewardKind = (typeof ACHIEVEMENT_REWARD_KINDS)[number];

export const ACHIEVEMENT_SCOPES = ['global', 'season'] as const;
export type AchievementScope = (typeof ACHIEVEMENT_SCOPES)[number];

/** active: visible · retired: la retira su autor · removed: moderación. */
export const BOTTLE_STATUSES = ['active', 'retired', 'removed'] as const;
export type BottleStatus = (typeof BOTTLE_STATUSES)[number];

export const PURCHASE_STATUSES = ['pending', 'confirmed', 'refunded', 'cancelled'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
