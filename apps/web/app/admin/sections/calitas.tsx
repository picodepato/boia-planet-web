'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CALITAS_ERROR_KEY,
  type CalitasComment,
  CalitasError,
  type CalitasModeration,
} from '../../../lib/calitas/model';
import { createSharedModeration } from '../../../lib/calitas/shared';
import { localCalitasModeration } from '../../../lib/calitas/store';
import { t } from '../../../lib/i18n';
import { NeedsAdmin, realErrorText, useAdminSupabase, when } from '../real/common';
import { StatusLine } from '../ui';
import { useRun } from '../use-admin';

/**
 * La moderación de Las Calitas (plan 019 T222, decisión 17: el Admin modera
 * todo): todos los comentarios, también los ocultos, con su autor, su fecha
 * y sus votos; ocultar (con motivo) y mostrar. Lo oculto desaparece de la
 * isla al momento, y sus respuestas con él. En la demo, los de muestra y los
 * de este navegador; con cuentas, los de todos (`admin_calitas_list`,
 * `admin_moderate_comment`).
 */

function CommentRow({
  c,
  moderation,
  describe,
  onChanged,
}: {
  c: CalitasComment;
  moderation: CalitasModeration;
  describe: (e: unknown) => string;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState(c.hidden?.reason ?? '');
  const { status, busy, run } = useRun();
  const act = (action: 'hide' | 'show') =>
    void run(
      async () => {
        if (action === 'hide' && reason.trim().length < 3) {
          throw new Error(t('admin.calitas.reasonRequired'));
        }
        try {
          await moderation.moderate(c.id, action, reason);
        } catch (e) {
          throw new Error(describe(e));
        }
        onChanged();
      },
      t(action === 'hide' ? 'admin.calitas.hideDone' : 'admin.calitas.showDone'),
    );
  return (
    <li
      className="admin-card"
      data-testid={`calitas-mod-${c.id}`}
      data-oculto={c.hidden ? 'si' : 'no'}
    >
      <p>
        {c.parentId ? <span className="admin-badge">{t('admin.calitas.reply')}</span> : null}
        {c.hidden ? <span className="admin-badge">{t('admin.calitas.hidden')}</span> : null}«
        {c.body}»
      </p>
      <p className="admin-meta">
        {t('admin.calitas.meta', {
          author: c.author ?? t('admin.moderation.sinApodo'),
          date: when(c.createdAt),
          score: c.score,
        })}
        {c.isSample ? t('admin.moderation.muestra') : ''}
        {c.hidden?.reason ? ` · ${t('admin.calitas.hiddenWhy', { reason: c.hidden.reason })}` : ''}
      </p>
      <div className="admin-row admin-row--end">
        {c.hidden ? (
          <button
            type="button"
            className="admin-button"
            disabled={busy}
            data-testid={`calitas-mod-mostrar-${c.id}`}
            onClick={() => act('show')}
          >
            {t('admin.calitas.show')}
          </button>
        ) : (
          <>
            <label className="admin-field">
              <span className="admin-field__label">{t('admin.calitas.reason')}</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid={`calitas-mod-motivo-${c.id}`}
              />
            </label>
            <button
              type="button"
              className="admin-button admin-button--danger"
              disabled={busy}
              data-testid={`calitas-mod-ocultar-${c.id}`}
              onClick={() => act('hide')}
            >
              {t('admin.calitas.hide')}
            </button>
          </>
        )}
      </div>
      <StatusLine status={status} />
    </li>
  );
}

function CalitasList({
  moderation,
  describe,
  local,
}: {
  moderation: CalitasModeration;
  describe: (e: unknown) => string;
  local: boolean;
}) {
  const [list, setList] = useState<CalitasComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyHidden, setOnlyHidden] = useState(false);
  const reload = useCallback(() => {
    moderation.list().then(
      (l) => {
        setList(l);
        setError(null);
      },
      (e: unknown) => setError(describe(e)),
    );
  }, [moderation, describe]);
  useEffect(reload, [reload]);
  const shown = (list ?? []).filter((c) => !onlyHidden || c.hidden);
  return (
    <div data-testid="calitas-moderacion">
      <h3>{t('admin.calitas.heading')}</h3>
      <p className="admin-lead">
        {t('admin.calitas.lead')} {local ? t('admin.calitas.localLead') : ''}
      </p>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={onlyHidden}
          onChange={(e) => setOnlyHidden(e.target.checked)}
        />
        {t('admin.calitas.onlyHidden')}
      </label>
      {error ? (
        <p className="admin-status admin-status--error" role="alert">
          {error}
        </p>
      ) : list === null ? (
        <p>{t('empty.loading')}</p>
      ) : (
        <ul className="admin-list">
          {shown.map((c) => (
            <CommentRow
              key={`${c.id}|${c.hidden ? 'h' : 'v'}`}
              c={c}
              moderation={moderation}
              describe={describe}
              onChanged={reload}
            />
          ))}
          {shown.length === 0 ? <li className="admin-meta">{t('admin.calitas.empty')}</li> : null}
        </ul>
      )}
    </div>
  );
}

const describeLocal = (e: unknown): string =>
  e instanceof CalitasError
    ? t(CALITAS_ERROR_KEY[e.code])
    : e instanceof Error
      ? e.message
      : String(e);

/** En el Admin de la demo: los de muestra y los de este navegador. */
export function LocalCalitasModeration() {
  const [moderation] = useState(() => localCalitasModeration());
  return <CalitasList moderation={moderation} describe={describeLocal} local />;
}

/** Con cuentas: los de todos, con el cliente del Admin (rol admin). */
export function RealCalitasModeration() {
  const sb = useAdminSupabase();
  const moderation = useMemo(() => (sb ? createSharedModeration(sb) : null), [sb]);
  return (
    <NeedsAdmin>
      {moderation ? (
        <CalitasList moderation={moderation} describe={realErrorText} local={false} />
      ) : (
        <p>{t('empty.loading')}</p>
      )}
    </NeedsAdmin>
  );
}
