'use client';

import type { Artist } from '@boia/contracts';
import type { ArtistLinkInfo, ArtistLinkRotation } from '@boia/db/rpc';
import { useCallback, useEffect, useState } from 'react';
import { artistLinkHref } from '../../../lib/account/artist-link';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { SectionHead, StatusLine } from '../ui';
import { type AdminContext, useRead, useRun } from '../use-admin';
import { ArtistClaimsPanel } from './artist-claims';
import { NeedsAdmin, download, must, useAdminSupabase, when } from './common';
import { type MemberRow, newsCsv } from './csv';

const PAGE = 50;

/** Las fichas de /artistas y qué Carnet tiene cada una (plan 031 T295). */
export interface ArtistProfiles {
  /** Las fichas del contenido, de la A a la Z. */
  all: readonly Artist[];
  /** Carnet → ficha unida. */
  joins: ReadonlyMap<string, string>;
}

/** Carnet → ficha, de los Carnets unidos (columna pública, como el resto del Carnet). */
async function readJoins(sb: BoiaSupabase): Promise<Map<string, string>> {
  const { data, error } = await sb
    .from('carnets')
    .select('user_id, artist_profile_id')
    .not('artist_profile_id', 'is', null)
    .limit(1000);
  // Una base sin la migración 20261015100200: nadie está unido.
  if (error || !data) return new Map();
  return new Map(
    data.flatMap((r) => (r.artist_profile_id ? [[r.user_id, r.artist_profile_id] as const] : [])),
  );
}

/**
 * «Unir a un perfil de artista» / «Deshacer unión» (plan 031 T295, la vía 3):
 * el Admin une un Carnet a una ficha sin reclamar; en /artistas sale una vez.
 */
export function ArtistJoin({
  sb,
  m,
  profiles,
  onChanged,
}: {
  sb: BoiaSupabase;
  m: MemberRow;
  profiles: ArtistProfiles;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState('');
  const { status, busy, run } = useRun();
  if (!m.nickname) return null;
  const joinedTo = profiles.joins.get(m.user_id) ?? null;
  const taken = new Set(profiles.joins.values());
  const free = profiles.all.filter((a) => !taken.has(a.id));
  const nameOf = (id: string) => profiles.all.find((a) => a.id === id)?.name ?? id;
  return (
    <div className="admin-row admin-row--end" data-testid={`socio-union-${m.user_id}`}>
      {joinedTo ? (
        <>
          <p className="admin-meta" data-testid={`socio-unido-${m.user_id}`}>
            {t('admin.real.socios.joinedTo', { name: nameOf(joinedTo) })}
          </p>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid={`socio-deshacer-union-${m.user_id}`}
            onClick={() =>
              void run(async () => {
                await must(
                  sb.rpc('admin_unjoin_artist_profile', {
                    p_user: m.user_id,
                    p_reason: t('admin.real.socios.unjoinReason'),
                  }),
                );
                onChanged();
              }, t('admin.real.socios.unjoined'))
            }
          >
            {t('admin.real.socios.unjoin')}
          </button>
        </>
      ) : open ? (
        <form
          className="admin-row admin-row--end"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await must(
                sb.rpc('admin_join_artist_profile', {
                  p_user: m.user_id,
                  p_profile: pick,
                  p_reason: t('admin.real.socios.joinReason'),
                }),
              );
              setOpen(false);
              onChanged();
            }, t('admin.real.socios.joined'));
          }}
        >
          {free.length === 0 ? (
            <p className="admin-meta">{t('admin.real.socios.joinNone')}</p>
          ) : (
            <label className="admin-field">
              <span className="admin-field__label">{t('admin.real.socios.joinLabel')}</span>
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                data-testid={`socio-union-perfil-${m.user_id}`}
              >
                <option value="">{t('admin.real.socios.joinPick')}</option>
                {free.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="admin-meta">{t('admin.real.socios.joinHint')}</p>
          <button
            type="submit"
            className="admin-button"
            disabled={busy || !pick}
            data-testid={`socio-union-guardar-${m.user_id}`}
          >
            {t('admin.real.socios.joinSave')}
          </button>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={() => setOpen(false)}
          >
            {t('carnet.cancel')}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid={`socio-unir-${m.user_id}`}
          onClick={() => {
            setOpen(true);
            setPick('');
          }}
        >
          {t('admin.real.socios.join')}
        </button>
      )}
      <StatusLine status={status} />
    </div>
  );
}

function MemberCard({
  sb,
  m,
  profiles,
  onChanged,
}: {
  sb: BoiaSupabase;
  m: MemberRow;
  profiles: ArtistProfiles;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [renumber, setRenumber] = useState(false);
  const [number, setNumber] = useState('');
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const { status, busy, run } = useRun();
  const confirmWith = m.nickname ?? m.email;
  return (
    <li
      className="admin-card"
      data-testid={`socio-${m.user_id}`}
      data-artista={m.is_artist ? 'si' : 'no'}
    >
      <div className="admin-row admin-row--between">
        <div>
          <p>
            <strong>{m.nickname ?? t('admin.real.socios.noCarnet')}</strong>
            {m.member_number ? t('admin.real.numeroSocio', { n: m.member_number }) : ''}
            {m.is_artist ? (
              <span className="admin-badge" data-testid={`socio-es-artista-${m.user_id}`}>
                {t('admin.real.socios.artistBadge')}
              </span>
            ) : null}
          </p>
          <p className="admin-meta">
            {m.email} · {t('admin.real.socios.signedUp', { date: when(m.signed_up_at) })}
          </p>
          <p className="admin-meta" data-testid={`socio-noticias-${m.user_id}`}>
            {m.news
              ? t('admin.real.socios.newsYes', {
                  date: when(m.news_at),
                  version: m.news_version ?? '—',
                })
              : t('admin.real.socios.newsNo')}
            {' · '}
            {m.privacy_version
              ? t('admin.real.socios.privacy', {
                  version: m.privacy_version,
                  date: when(m.privacy_at),
                })
              : t('admin.real.socios.noPrivacy')}
          </p>
        </div>
        <div className="admin-row">
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy || !m.nickname}
            data-testid={`socio-artista-${m.user_id}`}
            onClick={() =>
              void run(
                async () => {
                  await must(
                    sb.rpc('admin_set_artist', {
                      p_user: m.user_id,
                      p_is_artist: !m.is_artist,
                      p_reason: m.is_artist
                        ? t('admin.real.socios.reasonUnartist')
                        : t('admin.real.socios.reasonArtist'),
                    }),
                  );
                  onChanged();
                },
                m.is_artist ? t('admin.real.socios.unmarked') : t('admin.real.socios.marked'),
              )
            }
          >
            {m.is_artist ? t('admin.real.socios.unmarkArtist') : t('admin.real.socios.markArtist')}
          </button>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy || !m.nickname}
            data-testid={`socio-numero-${m.user_id}`}
            onClick={() => {
              setRenumber((v) => !v);
              setNumber(m.member_number ? String(m.member_number) : '');
            }}
          >
            {t('admin.real.socios.number')}
          </button>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid={`socio-borrar-${m.user_id}`}
            onClick={() => {
              setDeleting((v) => !v);
              setTyped('');
            }}
          >
            {t('admin.real.socios.delete')}
          </button>
        </div>
      </div>
      <ArtistJoin sb={sb} m={m} profiles={profiles} onChanged={onChanged} />
      {renumber ? (
        <form
          className="admin-row admin-row--end"
          data-testid="socio-numero-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await must(
                sb.rpc('admin_set_member_number', {
                  p_user: m.user_id,
                  p_number: Number(number),
                  p_reason: t('admin.real.socios.numberReason'),
                }),
              );
              setRenumber(false);
              onChanged();
            }, t('admin.real.socios.numberSaved'));
          }}
        >
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.socios.numberLabel')}</span>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              data-testid="socio-numero-input"
            />
          </label>
          <button
            type="submit"
            className="admin-button"
            disabled={busy || !/^[1-9][0-9]{0,7}$/.test(number.trim())}
            data-testid="socio-numero-guardar"
          >
            {t('admin.real.socios.numberSave')}
          </button>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={() => setRenumber(false)}
          >
            {t('carnet.cancel')}
          </button>
        </form>
      ) : null}
      {deleting ? (
        <div
          className="admin-card admin-delete__panel"
          role="group"
          data-testid="socio-borrar-panel"
        >
          <p>{t('admin.real.socios.deleteWarning', { who: confirmWith })}</p>
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.reason')}</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="socio-borrar-motivo"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field__label">
              {t('admin.ui.paraConfirmarEscribe', { name: confirmWith })}
            </span>
            <input
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              data-testid="socio-borrar-nombre"
            />
          </label>
          <div className="admin-row">
            <button
              type="button"
              className="admin-button admin-button--danger"
              disabled={busy || typed.trim() !== confirmWith || reason.trim().length < 3}
              data-testid="socio-borrar-confirmar"
              onClick={() =>
                void run(async () => {
                  await must(
                    sb.rpc('admin_delete_member', { p_user: m.user_id, p_reason: reason.trim() }),
                  );
                  setDeleting(false);
                  onChanged();
                }, t('admin.real.socios.deleted'))
              }
            >
              {t('admin.ui.borrar')}
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => setDeleting(false)}
            >
              {t('carnet.cancel')}
            </button>
          </div>
        </div>
      ) : null}
      <StatusLine status={status} />
    </li>
  );
}

/**
 * El enlace de artistas (plan 016 T186): cuándo se cambió por última vez y
 * el botón para crear uno nuevo. El código se ve una sola vez, al crearlo
 * (el servidor sólo guarda su hash).
 */
function ArtistLinkPanel({ sb }: { sb: BoiaSupabase }) {
  const [info, setInfo] = useState<ArtistLinkInfo | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revision, setRevision] = useState(0);
  const { status, busy, run } = useRun();
  const copier = useRun();

  useEffect(() => {
    let alive = true;
    void must(sb.rpc('admin_artist_link_info')).then(
      (d) => alive && setInfo(d as unknown as ArtistLinkInfo),
      () => alive && setInfo({ active: false, rotated_at: null }),
    );
    return () => {
      alive = false;
    };
  }, [sb, revision]);

  const rotate = () =>
    void run(async () => {
      const res = (await must(
        sb.rpc('admin_rotate_artist_link', { p_reason: t('admin.real.artistLink.reason') }),
      )) as unknown as ArtistLinkRotation;
      setFresh(artistLinkHref(res.code, window.location.origin));
      setConfirming(false);
      setRevision((r) => r + 1);
    }, t('admin.real.artistLink.created'));

  return (
    <div className="admin-card" data-testid="enlace-artistas">
      <h3>{t('admin.real.artistLink.title')}</h3>
      <p className="admin-meta">{t('admin.real.artistLink.lead')}</p>
      <p className="admin-meta" data-testid="enlace-artistas-estado">
        {info === null
          ? t('empty.loading')
          : info.active
            ? t('admin.real.artistLink.since', { date: when(info.rotated_at) })
            : t('admin.real.artistLink.none')}
      </p>
      {fresh ? (
        <div className="admin-row admin-row--end">
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.artistLink.copyNow')}</span>
            <input readOnly value={fresh} data-testid="enlace-artistas-url" />
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
        </div>
      ) : null}
      <div className="admin-row">
        {info?.active && !confirming ? (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid="enlace-artistas-cambiar"
            onClick={() => setConfirming(true)}
          >
            {t('admin.real.artistLink.rotate')}
          </button>
        ) : (
          <button
            type="button"
            className={info?.active ? 'admin-button admin-button--danger' : 'admin-button'}
            disabled={busy || info === null}
            data-testid="enlace-artistas-crear"
            onClick={rotate}
          >
            {info?.active ? t('admin.real.artistLink.confirm') : t('admin.real.artistLink.create')}
          </button>
        )}
        {confirming ? (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={() => setConfirming(false)}
          >
            {t('carnet.cancel')}
          </button>
        ) : null}
      </div>
      <StatusLine status={copier.status.kind === 'idle' ? status : copier.status} />
    </div>
  );
}

/**
 * Socios y emails (T94, decisiones 3 y 11): la lista, el CSV de noticias,
 * artista, unir a su ficha de artista (plan 031 T295) y borrar.
 */
export function SociosSection({ ctx }: { ctx: AdminContext }) {
  const sb = useAdminSupabase();
  const contentArtists = useRead(ctx, (r) => r.content.list('artists'));
  const [joins, setJoins] = useState<ReadonlyMap<string, string>>(new Map());
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [newsOnly, setNewsOnly] = useState(false);
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const exporter = useRun();

  const page = useCallback(
    async (offset: number): Promise<{ rows: MemberRow[]; total: number | null }> => {
      if (!sb) return { rows: [], total: null };
      const data = (await must(
        sb.rpc('admin_list_members', {
          p_search: applied,
          p_news_only: newsOnly,
          p_limit: PAGE,
          p_offset: offset,
        }),
      )) as MemberRow[];
      // `total` viene en cada fila; una página vacía no lo sabe.
      return { rows: data, total: data[0] ? Number(data[0].total) : offset === 0 ? 0 : null };
    },
    [sb, applied, newsOnly],
  );

  useEffect(() => {
    let alive = true;
    page(0).then(
      (r) => {
        if (!alive) return;
        setRows(r.rows);
        setTotal(r.total ?? 0);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [page, revision]);

  useEffect(() => {
    if (!sb) return;
    let alive = true;
    void readJoins(sb).then((j) => alive && setJoins(j));
    return () => {
      alive = false;
    };
  }, [sb, revision]);

  const profiles: ArtistProfiles = {
    all: [...(contentArtists ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    joins,
  };

  const exportCsv = () =>
    void exporter.run(async () => {
      if (!sb) return;
      const all: MemberRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const chunk = (await must(
          sb.rpc('admin_list_members', { p_news_only: true, p_limit: 1000, p_offset: offset }),
        )) as MemberRow[];
        all.push(...chunk);
        if (chunk.length < 1000) break;
      }
      const day = new Date().toISOString().slice(0, 10);
      download(
        new Blob([newsCsv(all)], { type: 'text/csv;charset=utf-8' }),
        `boia-socios-noticias-${day}.csv`,
      );
    }, t('admin.real.socios.csvReady'));

  return (
    <section data-testid="socios">
      <SectionHead title={t('admin.real.socios.title')} lead={t('admin.real.socios.lead')}>
        <button
          type="button"
          className="admin-button"
          disabled={exporter.busy || !sb}
          onClick={exportCsv}
          data-testid="socios-csv"
        >
          {t('admin.real.socios.csv')}
        </button>
      </SectionHead>
      <NeedsAdmin>
        {sb ? <ArtistLinkPanel sb={sb} /> : null}
        {sb ? <ArtistClaimsPanel sb={sb} artists={profiles.all} revision={revision} /> : null}
        <StatusLine status={exporter.status} />
        <form
          className="admin-row admin-row--end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(search.trim());
          }}
        >
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.socios.search')}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="socios-buscar"
            />
          </label>
          <button
            type="submit"
            className="admin-button admin-button--ghost"
            data-testid="socios-buscar-ok"
          >
            {t('admin.real.search')}
          </button>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={newsOnly}
              onChange={(e) => setNewsOnly(e.target.checked)}
              data-testid="socios-solo-noticias"
            />
            {t('admin.real.socios.newsOnly')}
          </label>
        </form>
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {!rows || !sb ? (
          <p>{t('empty.loading')}</p>
        ) : (
          <>
            <p className="admin-meta" data-testid="socios-total">
              {t('admin.real.socios.count', { shown: rows.length, total })}
            </p>
            <ul className="admin-list" data-testid="socios-lista">
              {rows.map((m) => (
                <MemberCard
                  key={`${m.user_id}|${m.is_artist}|${m.member_number}`}
                  sb={sb}
                  m={m}
                  profiles={profiles}
                  onChanged={() => setRevision((r) => r + 1)}
                />
              ))}
              {rows.length === 0 ? <li className="admin-meta">{t('admin.real.empty')}</li> : null}
            </ul>
            {rows.length < total ? (
              <button
                type="button"
                className="admin-button admin-button--ghost"
                data-testid="socios-mas"
                onClick={() =>
                  void page(rows.length).then(
                    (more) => {
                      if (more.total !== null) setTotal(more.total);
                      setRows((cur) => {
                        const seen = new Set((cur ?? []).map((r) => r.user_id));
                        return [...(cur ?? []), ...more.rows.filter((r) => !seen.has(r.user_id))];
                      });
                    },
                    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
                  )
                }
              >
                {t('ranking.more')}
              </button>
            ) : null}
          </>
        )}
      </NeedsAdmin>
    </section>
  );
}
