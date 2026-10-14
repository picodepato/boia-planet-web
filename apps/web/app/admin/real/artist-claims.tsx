'use client';

import type { Artist } from '@boia/contracts';
import type { ArtistClaimLinkCreated, ArtistClaimLinkRow } from '@boia/db/rpc';
import { useEffect, useState } from 'react';
import { claimLinkHref, whatsappHref } from '../../../lib/account/artist-claim';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { must, when } from './common';

/**
 * «Perfiles de artista» en Socios (plan 031 T296, la vía 1): por cada ficha
 * de /artistas, si está sin reclamar, con un enlace enviado (y cuándo) o
 * reclamada por un Carnet (su apodo); y, si no está reclamada, «Crear enlace
 * para reclamar». El enlace se ve una vez, con el botón de copiar y el texto
 * listo para WhatsApp; el servidor sólo guarda el hash del código.
 */

export type ClaimStatus =
  | { kind: 'claimed'; nickname: string }
  | { kind: 'sent'; at: string; expiresAt: string }
  | { kind: 'unclaimed'; expiredAt: string | null };

/** El estado de una ficha: reclamada > enlace vigente > sin reclamar. */
export function claimStatus(
  profileId: string,
  claimedBy: ReadonlyMap<string, string>,
  links: readonly ArtistClaimLinkRow[],
  now: number = Date.now(),
): ClaimStatus {
  const nickname = claimedBy.get(profileId);
  if (nickname !== undefined) return { kind: 'claimed', nickname };
  const link = links.find((l) => l.profile_id === profileId);
  if (link && !link.spent_at && Date.parse(link.expires_at) > now) {
    return { kind: 'sent', at: link.created_at, expiresAt: link.expires_at };
  }
  // Un enlace gastado de una ficha que ya no está unida (el Admin deshizo la
  // unión) no cuenta: está sin reclamar.
  const expired = link && !link.spent_at ? link.created_at : null;
  return { kind: 'unclaimed', expiredAt: expired };
}

export function claimStatusText(s: ClaimStatus): string {
  switch (s.kind) {
    case 'claimed':
      return t('admin.real.claims.claimedBy', { nickname: s.nickname });
    case 'sent':
      return t('admin.real.claims.sent', { date: when(s.at), expires: when(s.expiresAt) });
    case 'unclaimed':
      return s.expiredAt
        ? t('admin.real.claims.expired', { date: when(s.expiredAt) })
        : t('admin.real.claims.unclaimed');
  }
}

/** Una ficha: su estado, el botón y, recién creado, el enlace (una vez). */
export function ArtistClaimRow({
  artist,
  status,
  fresh,
  busy,
  onCreate,
}: {
  artist: Pick<Artist, 'id' | 'name'>;
  status: ClaimStatus;
  /** El enlace recién creado (sólo ahora se ve). */
  fresh: string | null;
  busy: boolean;
  onCreate: () => void;
}) {
  const copier = useRun();
  const message = fresh ? t('admin.real.claims.whatsapp', { name: artist.name, url: fresh }) : '';
  return (
    <li className="admin-card" data-testid={`perfil-${artist.id}`} data-estado={status.kind}>
      <div className="admin-row admin-row--between">
        <p>
          <strong>{artist.name}</strong>
        </p>
        <p className="admin-meta" data-testid={`perfil-estado-${artist.id}`}>
          {claimStatusText(status)}
        </p>
      </div>
      {status.kind === 'claimed' ? null : (
        <div className="admin-row">
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid={`perfil-crear-enlace-${artist.id}`}
            onClick={onCreate}
          >
            {status.kind === 'sent'
              ? t('admin.real.claims.recreate')
              : t('admin.real.claims.create')}
          </button>
        </div>
      )}
      {fresh ? (
        <div className="admin-row admin-row--end" data-testid={`perfil-enlace-${artist.id}`}>
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.artistLink.copyNow')}</span>
            <input readOnly value={fresh} data-testid="perfil-enlace-url" />
          </label>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={() =>
              void copier.run(
                () => navigator.clipboard.writeText(fresh),
                t('admin.real.artistLink.copied'),
              )
            }
          >
            {t('admin.real.artistLink.copy')}
          </button>
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.claims.whatsappLabel')}</span>
            <textarea readOnly rows={4} value={message} data-testid="perfil-enlace-whatsapp" />
          </label>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={() =>
              void copier.run(
                () => navigator.clipboard.writeText(message),
                t('admin.real.artistLink.copied'),
              )
            }
          >
            {t('admin.real.claims.copyText')}
          </button>
          <a
            className="admin-button admin-button--ghost"
            href={whatsappHref(message)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('admin.real.claims.openWhatsapp')}
          </a>
        </div>
      ) : null}
      <StatusLine status={copier.status} />
    </li>
  );
}

/** Ficha → apodo del Carnet que la reclamó. */
async function readClaimedBy(sb: BoiaSupabase): Promise<Map<string, string>> {
  const { data, error } = await sb
    .from('carnets')
    .select('nickname, artist_profile_id')
    .not('artist_profile_id', 'is', null)
    .limit(1000);
  if (error || !data) return new Map();
  return new Map(
    data.flatMap((r) => (r.artist_profile_id ? [[r.artist_profile_id, r.nickname] as const] : [])),
  );
}

export function ArtistClaimsPanel({
  sb,
  artists,
  revision,
}: {
  sb: BoiaSupabase;
  artists: readonly Artist[];
  /** Sube cuando Socios cambia algo (unir, deshacer): se vuelve a leer. */
  revision: number;
}) {
  const [claimedBy, setClaimedBy] = useState<ReadonlyMap<string, string>>(new Map());
  const [links, setLinks] = useState<readonly ArtistClaimLinkRow[]>([]);
  const [fresh, setFresh] = useState<{ id: string; url: string } | null>(null);
  const [mine, setMine] = useState(0);
  const { status, busy, run } = useRun();

  useEffect(() => {
    let alive = true;
    void readClaimedBy(sb).then((m) => alive && setClaimedBy(m));
    void must(sb.rpc('admin_artist_claim_links')).then(
      (d) => alive && setLinks((d as unknown as ArtistClaimLinkRow[]) ?? []),
      // Una base sin la migración 20261015100300: ningún enlace.
      () => alive && setLinks([]),
    );
    return () => {
      alive = false;
    };
  }, [sb, revision, mine]);

  const create = (a: Artist) =>
    void run(async () => {
      const res = (await must(
        sb.rpc('admin_create_artist_claim_link', {
          p_profile: a.id,
          p_name: a.name,
          p_reason: t('admin.real.claims.reason'),
        }),
      )) as unknown as ArtistClaimLinkCreated;
      setFresh({ id: a.id, url: claimLinkHref(res.code, window.location.origin) });
      setMine((n) => n + 1);
    }, t('admin.real.claims.created'));

  return (
    <div className="admin-card" data-testid="perfiles-artista">
      <h3>{t('admin.real.claims.title')}</h3>
      <p className="admin-meta">{t('admin.real.claims.lead')}</p>
      <StatusLine status={status} />
      {artists.length === 0 ? (
        <p className="admin-meta">{t('admin.real.claims.empty')}</p>
      ) : (
        <ul className="admin-list">
          {artists.map((a) => (
            <ArtistClaimRow
              key={a.id}
              artist={a}
              status={claimStatus(a.id, claimedBy, links)}
              fresh={fresh?.id === a.id ? fresh.url : null}
              busy={busy}
              onCreate={() => create(a)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
