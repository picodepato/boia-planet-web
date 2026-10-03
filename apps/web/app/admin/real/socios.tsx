'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { SectionHead, StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { NeedsAdmin, download, must, useAdminSupabase, when } from './common';
import { type MemberRow, newsCsv } from './csv';

const PAGE = 50;

function MemberCard({
  sb,
  m,
  onChanged,
}: {
  sb: BoiaSupabase;
  m: MemberRow;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
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
            {m.member_number ? ` · nº ${m.member_number}` : ''}
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

/** Socios y emails (T94, decisiones 3 y 11): la lista, el CSV de noticias, artista y borrar. */
export function SociosSection() {
  const sb = useAdminSupabase();
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
                  key={`${m.user_id}|${m.is_artist}`}
                  sb={sb}
                  m={m}
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
