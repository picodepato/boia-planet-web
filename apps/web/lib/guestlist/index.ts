/**
 * La lista de una fiesta (plan 034 T308): el cliente que usan la web y /mar
 * (T309) y el Admin y la puerta (T310). Igual sin servidor (la demo, D-20:
 * `createLocalGuestList` de @boia/store sobre el repositorio de este
 * navegador) que con cuentas (las RPC de 20261021200100_guest_lists.sql).
 *
 * API (`GuestListApi`, tipos en @boia/store/guestlist.ts). `event` es el slug
 * de la fiesta (en el contenido, slug e id coinciden):
 *
 * - `status(event)` → `GuestListStatus`: enabled, cap, closesAt, open,
 *   pastClosing, closed (no va en lista, interruptor cerrado o pasada la
 *   hora), full y `mine` (la inscripción propia o null). Sin contador: no hay
 *   contador público. Lo puede pedir cualquiera, también sin cuenta.
 * - `join(event, listName?)` → `{kind:'created'|'existing', signup}` o
 *   `{kind:'rejected', reason}`. Sin nombre, el apodo del Carnet. Si ya
 *   estaba, `existing` con la inscripción de antes (fecha y nombre), sin
 *   tocarla. Rechazos: `not_member` / `carnet_required` (a entrar o sacarse
 *   el Carnet), `not_enabled`, `closed`, `full`, `invalid_name` (2 a 30),
 *   `unknown_event`.
 * - `leave(event)` → `{kind:'removed'|'not_signed_up'}` o `rejected`
 *   (`closed` con el interruptor cerrado o pasada la hora). Libera el sitio.
 * - `mine(event)` → la inscripción propia o null.
 * - `admin.status(event)` → el estado con `count` (cuántos apuntados).
 * - `admin.list(event)` → filas `{userId, listName, nickname, email,
 *   createdAt, attended, attendedAt}` por orden de llegada; `attended`: la
 *   leyeron en la puerta de esa fiesta. Email null en la demo.
 * - `admin.remove(event, userId, reason?)` → `{removed}` (también cerrada).
 * - `admin.updateSettings(event, {enabled, cap, closesAt, open})` → el estado
 *   con `count`. `closesAt` ISO o null (sin hora de cierre).
 * - `door(event, userId)` → `{enabled, onList, listName, createdAt,
 *   closesAt, pastClosing}`: la puerta no bloquea nada, sólo lo dice.
 *
 * Las del socio no lanzan por una regla (devuelven `rejected`); las del
 * Admin y la puerta lanzan `GuestListError` (`forbidden` sin rol, etc.).
 * Con cuentas, el Admin pide rol admin con segundo factor; la puerta, editor.
 */
import {
  createLocalGuestList,
  GuestListError,
  type BoiaRepository,
  type GuestListAdminRow,
  type GuestListApi,
  type GuestListRejection,
  type GuestListSettings,
  type GuestListStatus,
} from '@boia/store';
import type {
  GuestListDoorResult,
  GuestListJoinResult as RpcJoin,
  GuestListRemoveResult,
  GuestListStatusResult,
} from '@boia/db/rpc';
import type { BoiaSupabase } from '../supabase/browser';

export {
  GUEST_LIST_NAME_MAX,
  GUEST_LIST_NAME_MIN,
  GuestListError,
  normalizeListName,
} from '@boia/store';
export type {
  GuestListAdminRow,
  GuestListApi,
  GuestListDoorView,
  GuestListJoinResult,
  GuestListLeaveResult,
  GuestListRejection,
  GuestListSettings,
  GuestListSignup,
  GuestListStatus,
} from '@boia/store';

/** La demo: el repositorio de este navegador (`guestRepository()` / `gameRepository()`). */
export function localGuestList(repo: BoiaRepository): GuestListApi {
  return createLocalGuestList({ repo });
}

interface PgErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

const MEMBER_REJECTIONS: Readonly<Record<string, GuestListRejection>> = {
  not_member: 'not_member',
  carnet_required: 'carnet_required',
  unknown_event: 'unknown_event',
  not_enabled: 'not_enabled',
  closed: 'closed',
  full: 'full',
  invalid_input: 'invalid_name',
};

/**
 * El rechazo de una RPC del socio. Sin sesión, PostgREST no deja ni llamar
 * (42501, «permission denied»): es `not_member`. null si no es una regla
 * (red, etc.): entonces se lanza.
 */
export function memberRejection(error: PgErrorLike): GuestListRejection | null {
  const known = MEMBER_REJECTIONS[error.message ?? ''];
  if (known) return known;
  if (error.code === '42501') return 'not_member';
  return null;
}

/** El error de una RPC del Admin o de la puerta. */
export function adminError(error: PgErrorLike): GuestListError {
  const m = error.message ?? '';
  if (m === 'forbidden' || error.code === '42501') return new GuestListError('forbidden', m);
  if (m === 'unknown_event') return new GuestListError('unknown_event', m);
  if (m === 'invalid_input') return new GuestListError('invalid_input', error.details ?? m);
  return new GuestListError('unknown', error.details || m || 'error');
}

/** De la RPC (snake_case) a `GuestListStatus`. */
export function statusFromRpc(r: GuestListStatusResult): GuestListStatus {
  const out: GuestListStatus = {
    event: r.event,
    enabled: r.enabled,
    cap: r.cap,
    closesAt: r.closes_at,
    open: r.open,
    pastClosing: r.past_closing,
    closed: r.closed,
    full: r.full,
    mine: r.mine ? { listName: r.mine.list_name, createdAt: r.mine.created_at } : null,
  };
  if (typeof r.count === 'number') out.count = r.count;
  return out;
}

/** Con cuentas: las RPC de la lista con la sesión de este navegador. */
export function supabaseGuestList(sb: BoiaSupabase): GuestListApi {
  const unexpected = (e: PgErrorLike) => new Error(e.details || e.message || 'error');

  const status = async (event: string) => {
    const { data, error } = await sb.rpc('guest_list_status', { p_event: event });
    if (error) {
      if (error.message === 'unknown_event') {
        return statusFromRpc({
          event,
          enabled: false,
          cap: null,
          closes_at: null,
          open: false,
          past_closing: false,
          closed: true,
          full: false,
          mine: null,
        });
      }
      throw unexpected(error);
    }
    return statusFromRpc(data as unknown as GuestListStatusResult);
  };

  const api: GuestListApi = {
    status,
    async join(event, listName) {
      const name = listName?.trim();
      const { data, error } = await sb.rpc('guest_list_join', {
        p_event: event,
        ...(name ? { p_name: name } : {}),
      });
      if (error) {
        const reason = memberRejection(error);
        if (reason) return { kind: 'rejected', reason };
        throw unexpected(error);
      }
      const r = data as unknown as RpcJoin;
      return {
        kind: r.created ? 'created' : 'existing',
        signup: { listName: r.list_name, createdAt: r.created_at },
      };
    },
    async leave(event) {
      const { data, error } = await sb.rpc('guest_list_leave', { p_event: event });
      if (error) {
        const reason = memberRejection(error);
        if (reason) return { kind: 'rejected', reason };
        throw unexpected(error);
      }
      return {
        kind: (data as unknown as GuestListRemoveResult).removed ? 'removed' : 'not_signed_up',
      };
    },
    async mine(event) {
      return (await status(event)).mine;
    },
    admin: {
      async status(event) {
        const { data, error } = await sb.rpc('admin_guest_list_status', { p_event: event });
        if (error) throw adminError(error);
        return statusFromRpc(data as unknown as GuestListStatusResult);
      },
      async list(event): Promise<GuestListAdminRow[]> {
        const { data, error } = await sb.rpc('admin_guest_list', { p_event: event });
        if (error) throw adminError(error);
        return (data ?? []).map((r) => ({
          userId: r.user_id,
          listName: r.list_name,
          nickname: r.nickname ?? null,
          email: r.email ?? null,
          createdAt: r.created_at,
          attended: r.attended,
          attendedAt: r.attended_at ?? null,
        }));
      },
      async remove(event, userId, reason) {
        const { data, error } = await sb.rpc('admin_guest_list_remove', {
          p_event: event,
          p_member: userId,
          ...(reason?.trim() ? { p_reason: reason.trim() } : {}),
        });
        if (error) throw adminError(error);
        return { removed: (data as unknown as GuestListRemoveResult).removed };
      },
      async updateSettings(event, s: GuestListSettings) {
        const { data, error } = await sb.rpc('admin_guest_list_settings', {
          p_event: event,
          p_enabled: s.enabled,
          p_cap: s.cap,
          // null: sin hora de cierre (los tipos generados no lo dicen).
          p_closes_at: s.closesAt as string,
          p_open: s.open,
        });
        if (error) throw adminError(error);
        return statusFromRpc(data as unknown as GuestListStatusResult);
      },
    },
    async door(event, userId) {
      const { data, error } = await sb.rpc('guest_list_door', {
        p_member: userId,
        p_event: event,
      });
      if (error) throw adminError(error);
      const r = data as unknown as GuestListDoorResult;
      return {
        enabled: r.enabled,
        onList: r.on_list,
        listName: r.list_name,
        createdAt: r.created_at,
        closesAt: r.closes_at,
        pastClosing: r.past_closing,
      };
    },
  };
  return api;
}
