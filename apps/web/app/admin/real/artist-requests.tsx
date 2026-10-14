'use client';

import type { AdminArtistClaimRequest } from '@boia/db/rpc';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { adminClient } from '../../../lib/account/admin-auth';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { SectionHead, StatusLine } from '../ui';
import { type AdminContext, useRun } from '../use-admin';
import { NeedsAdmin, must, useAdminSupabase, when } from './common';

/**
 * «Solicitudes de artistas» (plan 031 T297, la vía 2): quien creó su Carnet
 * con el enlace general y eligió su ficha en «¿Eres uno de estos artistas?».
 * Por cada solicitud pendiente: apodo, email, la ficha elegida y la fecha.
 * «Aprobar» une el Carnet a la ficha (la unión de T295, auditoría
 * `claim_request_approved`); «Rechazar» la cierra y el Carnet sigue siendo
 * de artista. El número de pendientes sale en el menú del Admin.
 */

// ---------------------------------------------------------------------------
// El número del menú: un almacén pequeño que la sección actualiza al decidir.

let count = 0;
const listeners = new Set<() => void>();

function setCount(n: number): void {
  if (n === count) return;
  count = n;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Lee las pendientes; una base sin la migración 20261015100400 da ninguna. */
async function readRequests(sb: BoiaSupabase): Promise<AdminArtistClaimRequest[]> {
  const rows = ((await must(sb.rpc('admin_artist_claim_requests'))) ??
    []) as unknown as AdminArtistClaimRequest[];
  setCount(rows.length);
  return rows;
}

/**
 * Cuántas solicitudes esperan (para el menú). `enabled`: sólo con cuentas y
 * rol admin; si no, 0 sin preguntar.
 */
export function useArtistRequestCount(enabled: boolean): number {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void adminClient()
      .then((sb) => (alive && sb ? readRequests(sb) : undefined))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled]);
  const n = useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
  return enabled ? n : 0;
}

/** El número del menú (nada con 0). */
export function RequestCountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="admin-badge"
      aria-label={t('admin.real.requests.badge', { n })}
      data-testid="admin-nav-solicitudes-numero"
    >
      {n}
    </span>
  );
}

// ---------------------------------------------------------------------------
// La lista

/** Una solicitud pendiente, con «Aprobar» y «Rechazar». */
export function ArtistRequestRow({
  request: r,
  busy,
  onApprove,
  onReject,
}: {
  request: AdminArtistClaimRequest;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <li className="admin-card" data-testid={`solicitud-${r.id}`}>
      <div className="admin-row admin-row--between">
        <p>
          <strong data-testid="solicitud-apodo">{r.nickname}</strong>{' '}
          <span className="admin-meta" data-testid="solicitud-email">
            {r.email ?? '—'}
          </span>
        </p>
        <p className="admin-meta" data-testid="solicitud-fecha">
          {when(r.created_at)}
        </p>
      </div>
      <p data-testid="solicitud-perfil">
        {t('admin.real.requests.profile', { name: r.profile_name })}
      </p>
      <div className="admin-row">
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          data-testid={`solicitud-aprobar-${r.id}`}
          onClick={onApprove}
        >
          {t('admin.real.requests.approve')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid={`solicitud-rechazar-${r.id}`}
          onClick={onReject}
        >
          {t('admin.real.requests.reject')}
        </button>
      </div>
    </li>
  );
}

/** La lista, sin efectos (se prueba sola). */
export function ArtistRequestList({
  requests,
  busy,
  onDecide,
}: {
  requests: readonly AdminArtistClaimRequest[] | null;
  busy: boolean;
  onDecide: (r: AdminArtistClaimRequest, approve: boolean) => void;
}) {
  if (!requests) return <p>{t('empty.loading')}</p>;
  if (requests.length === 0) {
    return (
      <p className="admin-meta" data-testid="solicitudes-vacio">
        {t('admin.real.requests.empty')}
      </p>
    );
  }
  return (
    <ul className="admin-list" data-testid="solicitudes-lista">
      {requests.map((r) => (
        <ArtistRequestRow
          key={r.id}
          request={r}
          busy={busy}
          onApprove={() => onDecide(r, true)}
          onReject={() => onDecide(r, false)}
        />
      ))}
    </ul>
  );
}

export function ArtistRequestsSection(_props: { ctx: AdminContext }) {
  const sb = useAdminSupabase();
  const [requests, setRequests] = useState<AdminArtistClaimRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { status, busy, run } = useRun();

  const load = useCallback(async () => {
    if (!sb) return;
    try {
      setRequests(await readRequests(sb));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRequests([]);
    }
  }, [sb]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = (r: AdminArtistClaimRequest, approve: boolean) =>
    void run(
      async () => {
        if (!sb) return;
        try {
          await must(
            sb.rpc('admin_decide_artist_claim_request', {
              p_request: r.id,
              p_approve: approve,
              p_reason: approve
                ? t('admin.real.requests.approveReason')
                : t('admin.real.requests.rejectReason'),
            }),
          );
        } finally {
          // Cerrada o no, la lista se vuelve a leer (otra vía pudo cerrarla).
          await load();
        }
      },
      approve
        ? t('admin.real.requests.approved', { nickname: r.nickname, name: r.profile_name })
        : t('admin.real.requests.rejected', { nickname: r.nickname }),
    );

  return (
    <section data-testid="solicitudes-artistas">
      <SectionHead title={t('admin.real.requests.title')} lead={t('admin.real.requests.lead')} />
      <NeedsAdmin>
        <StatusLine status={status} />
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {error}
          </p>
        ) : null}
        <ArtistRequestList requests={sb ? requests : null} busy={busy} onDecide={decide} />
      </NeedsAdmin>
    </section>
  );
}
