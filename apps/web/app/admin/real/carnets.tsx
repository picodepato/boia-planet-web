'use client';

import { musicLinkFrom } from '@boia/contracts';
import type {
  AdminCarnetContent,
  AdminCarnetPage,
  AdminCarnetRow,
  CarnetModerationTrashItem,
} from '@boia/db/rpc';
import { useCallback, useEffect, useState } from 'react';
import {
  CARNET_ACTION_LABEL,
  carnetActions,
  carnetBadges,
  needsReason,
} from '../../../lib/admin/moderation';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { MusicEditor } from '../sections/moderation';
import { SectionHead, StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { NeedsAdmin, must, useAdminSupabase } from './common';

const PAGE = 50;

/**
 * Las respuestas y el enlace a la música de un Carnet con cuentas (plan 020
 * T229): retirar una sola respuesta, cambiar o quitar el enlace de un
 * artista. Se carga al abrirlo; todo va a la papelera de moderación.
 */
function CarnetContent({
  sb,
  userId,
  reason,
  onChanged,
}: {
  sb: BoiaSupabase;
  userId: string;
  reason: string;
  onChanged: () => void;
}) {
  const [content, setContent] = useState<AdminCarnetContent | null>(null);
  const [revision, setRevision] = useState(0);
  const { status, busy, run } = useRun();
  useEffect(() => {
    let alive = true;
    void must(sb.rpc('admin_carnet_content', { p_user: userId })).then(
      (c) => alive && setContent(c as unknown as AdminCarnetContent),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [sb, userId, revision]);
  const changed = () => {
    setRevision((r) => r + 1);
    onChanged();
  };
  const short = reason.trim().length < 3;
  if (!content) return <p>{t('empty.loading')}</p>;
  return (
    <>
      {content.answers.length === 0 ? (
        <p className="admin-meta">{t('admin.moderation.answers.none')}</p>
      ) : (
        <ul className="admin-list">
          {content.answers.map((a) => (
            <li key={a.question_id} className="admin-row admin-row--between">
              <span>
                <span className="admin-meta">{a.prompt}</span>
                <br />
                {a.answer}
              </span>
              <button
                type="button"
                className="admin-button admin-button--ghost"
                disabled={busy || short}
                data-testid={`carnet-real-retirar-respuesta-${userId}-${a.question_id}`}
                onClick={() =>
                  void run(async () => {
                    await must(
                      sb.rpc('admin_remove_carnet_answer', {
                        p_user: userId,
                        p_question: a.question_id,
                        p_reason: reason.trim(),
                      }),
                    );
                    changed();
                  }, t('admin.moderation.answers.removed'))
                }
              >
                {t('admin.moderation.answers.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {content.is_artist ? (
        <MusicEditor
          key={content.music?.url ?? ''}
          testId={`carnet-real-${userId}`}
          current={content.music?.url ?? null}
          busy={busy || short}
          onSave={(url) =>
            void run(async () => {
              const link = musicLinkFrom(url);
              if (link === 'invalid') throw new Error(t('admin.moderation.music.invalid'));
              await must(
                sb.rpc('admin_set_carnet_music', {
                  p_user: userId,
                  ...(link ? { p_platform: link.platform, p_url: link.url } : {}),
                  p_reason: reason.trim(),
                }),
              );
              changed();
            }, t('admin.moderation.music.saved'))
          }
        />
      ) : null}
      <StatusLine status={status} />
    </>
  );
}

/** El enlace de un cambio de la papelera, en palabras. */
function linkText(v: { url?: string } | null): string {
  return v?.url ?? t('admin.moderation.trash.noLink');
}

/**
 * La papelera de moderación con cuentas (plan 020 T229): respuestas
 * retiradas y enlaces a la música cambiados, 30 días; «Deshacer» los devuelve.
 */
function ModerationTrash({
  sb,
  revision,
  onChanged,
}: {
  sb: BoiaSupabase;
  revision: number;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<CarnetModerationTrashItem[] | null>(null);
  const { status, busy, run } = useRun();
  const day = (iso: string) => new Date(iso).toLocaleString('es-ES');
  useEffect(() => {
    let alive = true;
    void must(sb.rpc('admin_list_moderation_trash', {})).then(
      (list) => alive && setItems(list as unknown as CarnetModerationTrashItem[]),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [sb, revision]);
  return (
    <div data-testid="papelera-moderacion">
      <h3>{t('admin.moderation.trash.heading')}</h3>
      <p className="admin-meta">{t('admin.moderation.trash.lead')}</p>
      <StatusLine status={status} />
      <ul className="admin-list">
        {(items ?? []).map((it) => (
          <li
            key={it.id}
            className="admin-card admin-row admin-row--between"
            data-testid={`papelera-moderacion-${it.kind}-${it.user_id}`}
          >
            <span>
              {it.kind === 'answer'
                ? t('admin.moderation.trash.answer', {
                    nickname: it.nickname,
                    prompt: it.prompt ?? it.question_id ?? '',
                    answer: it.before?.answer ?? '',
                  })
                : t('admin.moderation.trash.music', {
                    nickname: it.nickname,
                    before: linkText(it.before),
                    after: linkText(it.after),
                  })}{' '}
              {t('admin.gestion.trash.when', {
                day: day(it.created_at),
                until: day(it.expires_at),
              })}
              {it.reason ? ` · ${it.reason}` : ''}
            </span>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await must(sb.rpc('admin_undo_carnet_moderation', { p_id: it.id }));
                  onChanged();
                }, t('admin.gestion.trash.undone'))
              }
            >
              {t('admin.gestion.trash.undo')}
            </button>
          </li>
        ))}
        {items && items.length === 0 ? (
          <li className="admin-meta">{t('admin.moderation.trash.none')}</li>
        ) : null}
      </ul>
    </div>
  );
}

function CarnetCard({
  sb,
  row,
  onChanged,
}: {
  sb: BoiaSupabase;
  row: AdminCarnetRow;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState('');
  const { status, busy, run } = useRun();
  const badges = carnetBadges({
    hidden: !!row.hidden_at,
    nickname: row.nickname_moderated,
    avatar: row.avatar_moderated,
  });
  return (
    <li
      className="admin-card"
      data-testid={`carnet-real-${row.user_id}`}
      data-oculto={row.hidden_at ? 'si' : 'no'}
      data-apodo={row.nickname_moderated ? 'retirado' : 'visible'}
      data-foto={row.avatar_moderated ? 'retirada' : 'visible'}
    >
      <div className="admin-row admin-row--between">
        <div>
          <p>
            <strong>{row.nickname}</strong>
            {row.member_number
              ? ` · ${t('admin.moderation.carnets.number', { n: row.member_number })}`
              : ''}
            {badges.map((k) => (
              <span key={k} className="admin-badge">
                {t(k)}
              </span>
            ))}
          </p>
          {row.original_nickname ? (
            <p className="admin-meta">
              {t('admin.moderation.carnets.original', { nickname: row.original_nickname })}
            </p>
          ) : null}
        </div>
        <a className="admin-link" href={`/carnet/${row.user_id}`}>
          {t('admin.moderation.carnets.view')}
        </a>
      </div>
      <div className="admin-row admin-row--end">
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.reason')}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid={`carnet-real-motivo-${row.user_id}`}
          />
        </label>
        {carnetActions(row).map((action) => (
          <button
            key={action}
            type="button"
            className={needsReason(action) ? 'admin-button admin-button--danger' : 'admin-button'}
            disabled={busy || (needsReason(action) && reason.trim().length < 3)}
            data-testid={`carnet-real-${action}-${row.user_id}`}
            onClick={() =>
              void run(async () => {
                await must(
                  sb.rpc('admin_moderate_carnet', {
                    p_user: row.user_id,
                    p_action: action,
                    p_reason: reason.trim(),
                  }),
                );
                onChanged();
              }, t('admin.moderation.carnets.done'))
            }
          >
            {t(CARNET_ACTION_LABEL[action])}
          </button>
        ))}
      </div>
      <details className="admin-details" data-testid={`carnet-real-contenido-${row.user_id}`}>
        <summary>{t('admin.moderation.content.show')}</summary>
        <CarnetContent sb={sb} userId={row.user_id} reason={reason} onChanged={onChanged} />
      </details>
      <StatusLine status={status} />
    </li>
  );
}

/**
 * Carnets con datos reales (plan 017 T191, REQ-ADM-031): buscar un Carnet,
 * ocultarlo o mostrarlo, retirar o devolver su apodo y su foto.
 */
export function RealCarnets() {
  const sb = useAdminSupabase();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [onlyModerated, setOnlyModerated] = useState(false);
  const [page, setPage] = useState<AdminCarnetPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const load = useCallback(
    async (offset: number): Promise<AdminCarnetPage> => {
      if (!sb) return { total: 0, rows: [] };
      return (await must(
        sb.rpc('admin_list_carnets', {
          p_search: applied,
          p_moderated_only: onlyModerated,
          p_limit: PAGE,
          p_offset: offset,
        }),
      )) as unknown as AdminCarnetPage;
    },
    [sb, applied, onlyModerated],
  );

  useEffect(() => {
    let alive = true;
    load(0).then(
      (p) => {
        if (!alive) return;
        setPage(p);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [load, revision]);

  return (
    <section data-testid="carnets-reales">
      <SectionHead
        title={t('admin.moderation.carnets.allHeading')}
        lead={t('admin.moderation.carnets.allLead')}
      />
      <NeedsAdmin>
        <form
          className="admin-row admin-row--end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(search.trim());
          }}
        >
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.moderation.carnets.search')}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="carnets-reales-buscar"
            />
          </label>
          <button
            type="submit"
            className="admin-button admin-button--ghost"
            data-testid="carnets-reales-buscar-ok"
          >
            {t('admin.real.search')}
          </button>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={onlyModerated}
              onChange={(e) => setOnlyModerated(e.target.checked)}
              data-testid="carnets-reales-moderados"
            />
            {t('admin.moderation.carnets.moderatedOnly')}
          </label>
        </form>
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {!page || !sb ? (
          <p>{t('empty.loading')}</p>
        ) : (
          <>
            <p className="admin-meta">
              {t('admin.real.rankings.count', { shown: page.rows.length, total: page.total })}
            </p>
            <ul className="admin-list">
              {page.rows.map((row) => (
                <CarnetCard
                  key={`${row.user_id}|${row.hidden_at}|${row.nickname_moderated}|${row.avatar_moderated}`}
                  sb={sb}
                  row={row}
                  onChanged={() => setRevision((r) => r + 1)}
                />
              ))}
              {page.rows.length === 0 ? (
                <li className="admin-meta">{t('admin.moderation.carnets.none')}</li>
              ) : null}
            </ul>
            {page.rows.length < page.total ? (
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={() =>
                  void load(page.rows.length).then(
                    (more) =>
                      setPage((cur) => {
                        const seen = new Set((cur?.rows ?? []).map((r) => r.user_id));
                        return {
                          total: more.total,
                          rows: [
                            ...(cur?.rows ?? []),
                            ...more.rows.filter((r) => !seen.has(r.user_id)),
                          ],
                        };
                      }),
                    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
                  )
                }
              >
                {t('ranking.more')}
              </button>
            ) : null}
            <ModerationTrash
              sb={sb}
              revision={revision}
              onChanged={() => setRevision((r) => r + 1)}
            />
          </>
        )}
      </NeedsAdmin>
    </section>
  );
}
