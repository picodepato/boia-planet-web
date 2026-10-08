import { isStoreError, type BoiaRepository, type StaffStampSource } from '@boia/store';
import type { StaffStampResult } from '@boia/db/rpc';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { t } from '../../../lib/i18n';
import { parseCarnetQr } from '../../../lib/scanner/carnet-url';
import { realErrorText } from '../real/common';

/**
 * Lo que necesitan la puerta y «Sellar a mano» (plan 019 T218, decisión 11),
 * igual sin servidor (el repositorio de este navegador, D-20) que con cuentas
 * (`staff_stamp`, 20261008100300_door_stamps.sql).
 */
export interface DoorParty {
  /** Lo que se pasa al sellar: el id del evento en local, el slug con cuentas. */
  key: string;
  name: string;
  startsAt: string | null;
}

export interface DoorMember {
  userId: string;
  nickname: string;
  memberNumber: number | null;
}

export type DoorOutcome =
  | { kind: 'granted' | 'already'; nickname: string; party: string; at: string }
  /** Lo leído no es el QR de un Carnet de BOIA. */
  | { kind: 'notCarnet' }
  /** Ese Carnet no existe (o ya no). */
  | { kind: 'unknown' }
  | { kind: 'error'; message: string };

export interface DoorBackend {
  parties(): Promise<DoorParty[]>;
  /** Carnets por apodo (o nº de socio, con cuentas), para sellar a mano. */
  members(search: string): Promise<DoorMember[]>;
  stamp(
    userId: string,
    party: string,
    source: StaffStampSource,
    reason?: string,
  ): Promise<DoorOutcome>;
  /** Cuántos han entrado a la fiesta. */
  attendance(party: string): Promise<number>;
}

/** La fiesta que toca: la que está en marcha o la próxima; si no, la última. */
export function currentParty(parties: readonly DoorParty[], now = Date.now()): DoorParty | null {
  const dated = parties
    .filter((p) => p.startsAt)
    .map((p) => ({ p, at: new Date(p.startsAt!).getTime() }))
    .filter((x) => !Number.isNaN(x.at));
  // Una fiesta dura como mucho un día: hasta 24 h después de empezar, sigue tocando.
  const next = dated.filter((x) => x.at >= now - 24 * 3600_000).sort((a, b) => a.at - b.at)[0];
  if (next) return next.p;
  const last = dated.sort((a, b) => b.at - a.at)[0];
  return last?.p ?? parties[0] ?? null;
}

/** Lo que se lee en la puerta tras cada Carnet. */
export function outcomeText(outcome: DoorOutcome): string {
  switch (outcome.kind) {
    case 'granted':
      return t('puerta.result.granted', { nickname: outcome.nickname, party: outcome.party });
    case 'already':
      return t('puerta.result.already', { nickname: outcome.nickname, party: outcome.party });
    case 'notCarnet':
      return t('puerta.result.notCarnet');
    case 'unknown':
      return t('puerta.result.unknown');
    case 'error':
      return t('puerta.result.error', { message: outcome.message });
  }
}

/** Sella lo que dijo un QR (o lo que se pegó en la puerta). */
export async function stampFromQr(
  backend: DoorBackend,
  text: string,
  party: string,
): Promise<DoorOutcome> {
  const userId = parseCarnetQr(text);
  if (!userId) return { kind: 'notCarnet' };
  return backend.stamp(userId, party, 'door');
}

/** Sin servidor: el repositorio de este navegador (el Carnet de quien está aquí). */
export function localDoor(repo: BoiaRepository): DoorBackend {
  return {
    parties: async () =>
      (await repo.content.list('events'))
        .filter((e) => e.state !== 'draft' && e.state !== 'cancelled')
        .map((e) => ({ key: e.id, name: e.name, startsAt: e.startsAt })),
    members: async (search) => {
      const q = search.trim().toLowerCase();
      return (await repo.admin.carnets())
        .filter((c) => !c.carnet.isSample)
        .filter((c) => !q || c.carnet.nickname.toLowerCase().includes(q))
        .map((c) => ({ userId: c.userId, nickname: c.carnet.nickname, memberNumber: null }));
    },
    stamp: async (userId, party, source, reason) => {
      try {
        const r = await repo.admin.stampCarnet(userId, party, {
          source,
          ...(reason ? { reason } : {}),
        });
        return {
          kind: r.granted ? 'granted' : 'already',
          nickname: r.nickname,
          party: r.eventName,
          at: r.at,
        };
      } catch (e) {
        if (isStoreError(e, 'not_found') && !(e.message ?? '').startsWith('evento')) {
          return { kind: 'unknown' };
        }
        return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
      }
    },
    attendance: async (party) => (await repo.admin.attendance(party)).length,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Con cuentas: las fiestas y los socios de Supabase, `staff_stamp`. */
export function realDoor(sb: BoiaSupabase): DoorBackend {
  const ids = new Map<string, string>();
  return {
    parties: async () => {
      const { data, error } = await sb
        .from('events')
        .select('id, slug, title, starts_at, state, published_at')
        .is('archived_at', null)
        .not('published_at', 'is', null)
        .order('starts_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw new Error(realErrorText(error));
      return (data ?? [])
        .filter((e) => e.state !== 'draft' && e.state !== 'cancelled')
        .map((e) => {
          ids.set(e.slug, e.id);
          return { key: e.slug, name: e.title, startsAt: e.starts_at };
        });
    },
    members: async (search) => {
      const { data, error } = await sb.rpc('admin_list_members', {
        p_search: search.trim(),
        p_limit: 20,
        p_offset: 0,
      });
      if (error) throw new Error(realErrorText(error));
      return (data ?? [])
        .filter((m) => m.nickname)
        .map((m) => ({
          userId: m.user_id,
          nickname: m.nickname,
          memberNumber: m.member_number ?? null,
        }));
    },
    stamp: async (userId, party, source, reason) => {
      if (!UUID_RE.test(userId)) return { kind: 'unknown' };
      const { data, error } = await sb.rpc('staff_stamp', {
        p_member: userId,
        p_event: party,
        p_source: source,
        ...(reason ? { p_reason: reason } : {}),
      });
      if (error) {
        if (error.message === 'unknown_member') return { kind: 'unknown' };
        return { kind: 'error', message: realErrorText(error) };
      }
      const r = data as unknown as StaffStampResult;
      return {
        kind: r.granted ? 'granted' : 'already',
        nickname: r.nickname,
        party: r.title,
        at: r.at,
      };
    },
    attendance: async (party) => {
      const id = ids.get(party);
      if (!id) return 0;
      const { count, error } = await sb
        .from('event_attendance')
        .select('user_id', { count: 'exact', head: true })
        .eq('event_id', id);
      if (error) throw new Error(realErrorText(error));
      return count ?? 0;
    },
  };
}
