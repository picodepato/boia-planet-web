/**
 * Lo que devuelven y cómo fallan las RPC del plan 008 (supabase/migrations
 * 20261003*). `database.types.ts` da sus argumentos; las que devuelven JSON
 * salen ahí como `Json`, y su forma es la de estos tipos.
 *
 * Un rechazo llega como error de PostgREST con `code` P0001 (o 42501 si
 * falta cuenta o rol) y `message` igual a una de las claves de
 * `RPC_REJECTIONS`; el texto para personas va en `details`.
 */

export const RPC_REJECTIONS = [
  // Cuenta y rol
  'not_member',
  'forbidden',
  // Perfil
  'nickname_invalid',
  'nickname_taken',
  'privacy_required',
  'invalid_policy_version',
  'avatar_invalid',
  'invalid_input',
  // Filtro de texto (apodo y botellas)
  'text_link',
  'text_email',
  'text_phone',
  'text_offensive',
  // Puntos y monedas
  'unknown_action',
  'invalid_ref',
  'invalid_policy',
  'invalid_amount',
  'invalid_metadata',
  'limit_action',
  'limit_daily',
  // Cosméticos
  'unknown_cosmetic',
  'not_for_sale',
  'needs_ship',
  'insufficient_coins',
  'invalid_slot',
  'wrong_slot',
  'not_owned',
  // Sellos
  'unknown_event',
  'invalid_code',
  'outside_window',
  'invalid_window',
  // Carreras
  'unknown_circuit',
  'invalid_time',
  'too_fast',
  'too_slow',
  // Ranking del Cañón (plan 013 T155; los tiempos, too_fast y too_slow)
  'unknown_board',
  'invalid_score',
  'score_too_high',
  'invalid_medal',
  'invalid_difficulty',
  // Ranking del Castillo (T163)
  'unranked_game',
  'invalid_end',
  'invalid_life',
  // Descuentos
  'unknown_discount',
  'discount_not_found',
  'discount_used',
  'wrong_event',
  'discount_expired',
  // Copia y fusión
  'invalid_snapshot',
  'snapshot_too_large',
  'snapshot_conflict',
  'invalid_payload',
  'payload_too_large',
  // Botellas
  'carnet_required',
  'invalid_message',
  'invalid_position',
  // Admin
  'unknown_member',
  'reason_required',
  // Admin sobre datos reales (T94)
  'invalid_image',
  'unknown_bottle',
  'unknown_report',
  'unknown_time',
  'unknown_entry',
  'invalid_entry',
  // Números de socio y enlace de artistas (plan 016 T186)
  'invalid_number',
  'number_taken',
  'member_number_busy',
  'member_counter_missing',
  // Moderación con datos reales (plan 017 T191)
  'invalid_action',
  'invalid_status',
  'bottle_conflict',
  'invalid_board',
  // Acceso del Admin con el Carnet 000 y códigos de respaldo (plan 017 T193)
  'carnet_zero_reserved',
  'not_admin',
  'backup_code_invalid',
  // El enlace a la música de un Carnet de artista (plan 019 T217)
  'artist_required',
  'invalid_music',
  // Los comentarios de Las Calitas (plan 019 T222)
  'unknown_comment',
  'own_comment',
  // Como mucho 3 con acceso completo al Admin (plan 019 T223)
  'full_access_limit',
  // Moderación fina de un Carnet y su papelera (plan 020 T229)
  'unknown_answer',
  'unknown_trash',
  'answer_exists',
  'music_changed',
] as const;
export type RpcRejection = (typeof RPC_REJECTIONS)[number];

/**
 * Personas con acceso completo al Admin (rol admin u owner) como mucho
 * (plan 019 T223, decisión 17). Lo impone la base de datos
 * (`private.full_access_limit()` en 20261008100600_admin_limits_analytics.sql).
 */
export const FULL_ACCESS_LIMIT = 3;

/** admin_full_access */
export interface FullAccessResult {
  count: number;
  limit: number;
}

export function isRpcRejection(message: unknown): message is RpcRejection {
  return typeof message === 'string' && (RPC_REJECTIONS as readonly string[]).includes(message);
}

/** Política de un premio, como `RewardPolicy` de @boia/store. */
export type AwardPolicy = 'once' | 'daily' | 'season';

/** award_points */
export type AwardResult =
  | {
      granted: true;
      tx_id: string;
      points: number;
      coins: number;
      season_id: string | null;
      /** Cosméticos que regaló (logro o misión). */
      cosmetics: string[];
    }
  | { granted: false; reason: 'duplicate'; tx_id: string };

/** buy_cosmetic */
export type BuyResult =
  | { granted: true; tx_id: string; coins: number; balance: number }
  | { granted: false; reason: 'duplicate' };

/** equip_cosmetic: ranura → cosmético (`mascot` desde `20261005100100_mascot_equip.sql`, T154). */
export type EquippedMap = Partial<
  Record<'flag' | 'accessory' | 'skin' | 'wake' | 'ship' | 'mascot', string>
>;

/** claim_stamp */
export type StampResult =
  | { granted: true; tx_id: string; event: string; points: number }
  | { granted: false; reason: 'already_stamped'; event: string };

/** staff_stamp: el lector de la puerta o el Admin a mano (plan 019 T218). */
export interface StaffStampResult {
  granted: boolean;
  reason?: 'already_stamped';
  tx_id?: string;
  /** Slug de la fiesta. */
  event: string;
  title: string;
  member: string;
  nickname: string;
  at: string;
  points: number;
}

/** submit_race_time */
export interface RaceTimeResult {
  best: boolean;
  best_ms: number;
  best_at: string;
  attempts: number;
  circuit: string;
  version: number;
}

/** find_discount */
export interface FindDiscountResult {
  first: boolean;
  discount: string;
  found_at: string;
  used_at: string | null;
}

/** use_discount */
export interface UseDiscountResult {
  used: true;
  discount: string;
  used_at: string;
}

/** save_snapshot */
export interface SnapshotResult {
  version: number;
  updated_at: string;
}

/**
 * save_profile, admin_set_artist, admin_set_member_number: la fila del Carnet
 * y los consentimientos vigentes.
 */
export interface ProfileResult {
  user_id: string;
  nickname: string;
  avatar_key: string | null;
  avatar_image: string | null;
  member_number: number;
  member_since: string;
  is_artist: boolean;
  news: boolean;
  privacy_version: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

/** Entrada de merge_guest (todas las claves son opcionales). */
export interface MergePayload {
  rewards?: Array<{
    action: string;
    ref: string;
    points?: number;
    coins?: number;
    policy?: AwardPolicy;
    /** Cuándo ocurrió (ISO); cuenta para el tope de ese día. */
    at?: string;
    metadata?: Record<string, unknown>;
  }>;
  /** Cosméticos comprados con monedas, en orden. */
  cosmetics?: string[];
  equipped?: EquippedMap;
  times?: Array<{ circuit: string; version: number; ms: number; at?: string }>;
  discounts?: Array<{ id: string; found_at?: string; used?: boolean; event?: string | null }>;
  /** El resto del documento: sólo se guarda si la cuenta no tiene copia. */
  snapshot?: Record<string, unknown>;
}

/** Salida de merge_guest. */
export interface MergeResult {
  rewards: { granted: number; duplicate: number };
  cosmetics: { granted: number; duplicate: number };
  times: { accepted: number };
  discounts: { found: number; used: number };
  equipped: EquippedMap;
  snapshot: 'saved' | 'kept' | 'none';
  rejected: Array<{
    kind: 'reward' | 'discount' | 'cosmetic' | 'equip' | 'time' | 'snapshot';
    ref: string | null;
    reason: string;
  }>;
}

/** Una fila de ranking_points, ranking_season o ranking_race. */
export interface RankingRow {
  /** Puesto con empates compartidos (1, 2, 2, 4…). */
  position: number;
  user_id: string;
  nickname: string;
  member_number: number;
  is_artist: boolean;
  /** Puntos, milisegundos en ranking_race o la puntuación en ranking_canon. */
  value: number;
  /** Sólo en ranking_race y ranking_canon. */
  best_at?: string;
  is_mine: boolean;
}

export interface RankingPage {
  total: number;
  limit: number;
  offset: number;
  rows: RankingRow[];
  /** La fila de quien llama aunque quede fuera de la página; null si no está. */
  mine: RankingRow | null;
  /** ranking_points: null; ranking_season: la temporada. */
  season_id?: string | null;
  /** ranking_race */
  circuit?: string;
  /** ranking_race y ranking_canon */
  version?: number;
  /** ranking_canon (plan 013 T155) */
  boss?: string;
  /** ranking_castle (T163) */
  run_min?: number;
  difficulty?: string;
}

/** submit_canon_score (plan 013 T155) */
export interface CanonScoreResult {
  best: boolean;
  best_score: number;
  best_at: string;
  attempts: number;
  boss: string;
  version: number;
}

/** submit_castle_score (T163) */
export interface CastleScoreResult {
  best: boolean;
  best_score: number;
  best_at: string;
  attempts: number;
  run_min: number;
  difficulty: string;
  version: number;
}

/** admin_rotate_artist_link (T186): el código nuevo se ve sólo aquí; se guarda con hash. */
export interface ArtistLinkRotation {
  code: string;
  rotated_at: string;
}

/** admin_artist_link_info (T186) */
export interface ArtistLinkInfo {
  active: boolean;
  rotated_at: string | null;
}

/** admin_set_stamp_code */
export interface StampCodeResult {
  event: string;
  code: string;
  valid_from: string;
  valid_until: string;
}

/** admin_set_stamp_image */
export interface StampImageResult {
  event: string;
  stamp_image_url: string | null;
}

/** admin_remove_bottle */
export interface RemoveBottleResult {
  bottle: string;
  status: 'removed';
  resolved_reports: number;
}

/** admin_void_race_time */
export interface VoidTimeResult {
  user_id: string;
  circuit: string;
  version: number;
  best_ms: number;
  voided: true;
}

/** admin_void_points */
export type VoidPointsResult =
  | { tx_id: string; voided: true; points_delta: number; coins_delta: number }
  | { tx_id: null; voided: false; reason: 'already_voided' };

/** Una fila de admin_list_carnets (plan 017 T191). */
export interface AdminCarnetRow {
  user_id: string;
  /** El apodo que se ve ahora (el de la moderación si se retiró). */
  nickname: string;
  member_number: number | null;
  member_since: string;
  is_artist: boolean;
  hidden_at: string | null;
  nickname_moderated: boolean;
  avatar_moderated: boolean;
  has_avatar: boolean;
  /** El apodo retirado, para devolverlo; null si no hay. */
  original_nickname: string | null;
  has_original_avatar: boolean;
}

/** admin_list_carnets */
export interface AdminCarnetPage {
  total: number;
  rows: AdminCarnetRow[];
}

/** admin_moderate_carnet */
export interface ModerateCarnetResult {
  user_id: string;
  hidden: boolean;
  nickname: string;
  nickname_moderated: boolean;
  avatar_moderated: boolean;
}

/** Una respuesta de un Carnet, tal como la ve la moderación (admin_carnet_content, plan 020 T229). */
export interface AdminCarnetAnswer {
  question_id: string;
  prompt: string;
  answer: string;
  updated_at: string;
}

/** admin_carnet_content: lo que se modera fino de un Carnet (plan 020 T229). */
export interface AdminCarnetContent {
  user_id: string;
  is_artist: boolean;
  music: { platform: string; url: string } | null;
  answers: AdminCarnetAnswer[];
}

/**
 * Una fila de admin_list_moderation_trash (plan 020 T229): una respuesta
 * retirada (`answer`) o un enlace a la música cambiado o quitado (`music`),
 * que se deshace con admin_undo_carnet_moderation hasta `expires_at`.
 */
export interface CarnetModerationTrashItem {
  id: string;
  user_id: string;
  nickname: string;
  kind: 'answer' | 'music';
  question_id: string | null;
  prompt: string | null;
  /** answer: `{answer, question_version, created_at}`; music: `{platform, url}` o null. */
  before: { answer?: string; platform?: string; url?: string } | null;
  after: { platform: string; url: string } | null;
  reason: string | null;
  created_at: string;
  expires_at: string;
}

/** Los rankings que el Admin puede anular y devolver (admin_void_score, admin_restore_score). */
export type ScoreBoard = 'race' | 'canon' | 'castle';

/** Una fila de admin_list_voided. `key`: el circuito, el boss o «<minutos>:<dificultad>». */
export interface VoidedEntry {
  board: ScoreBoard;
  user_id: string;
  nickname: string | null;
  key: string;
  version: number;
  value: number;
  voided_at: string;
  void_reason: string | null;
}

/** admin_generate_backup_codes (plan 017 T193): se enseñan una vez. */
export interface BackupCodesResult {
  codes: string[];
  created_at: string;
}

/** admin_use_backup_code (plan 017 T193): los que quedan sin usar. */
export interface BackupCodeUse {
  left: number;
}
