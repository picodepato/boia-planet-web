'use client';

import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { requireAccount } from '../../account/gate';
import { useAccount } from '../../account/use-account';
import {
  CALITAS_ERROR_KEY,
  COMMENT_MAX,
  type CalitasComment,
  CalitasError,
  type CalitasErrorCode,
  type CalitasOrder,
  type CalitasStore,
  buildThreads,
  nextVote,
} from '../../calitas/model';
import { calitasStore } from '../../calitas/store';
import { t } from '../../i18n';
import { useRepoData } from '../repo';
import './calitas.css';

/**
 * Las Calitas (plan 019 T222, decisión 16): la ficha desplegada de la isla
 * de los comentarios. Se escribe arriba; cada comentario lleva su autor, su
 * fecha, sus votos (a favor / en contra, uno por persona; el mismo otra vez
 * lo quita) y «Responder» (un nivel). Antes de publicar pasa el filtro de
 * insultos; la base lo vuelve a pasar con cuentas.
 *
 * - Modo local: los de muestra y los tuyos (sólo los ves tú), firmados con el
 *   apodo de tu Carnet de este navegador si lo tienes.
 * - Con Supabase: los de todos; comentar y votar piden la cuenta con Carnet
 *   (`requireAccount('carnet')`), leer no.
 */

const errorText = (code: CalitasErrorCode) =>
  t(CALITAS_ERROR_KEY[code], code === 'length' ? { max: COMMENT_MAX } : undefined);

const codeOf = (e: unknown): CalitasErrorCode => (e instanceof CalitasError ? e.code : 'generic');

const DATE = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DATE.format(d);
}

function authorOf(c: CalitasComment): string {
  if (c.isMine)
    return c.author ? `${c.author} (${t('calitas.author.you')})` : t('calitas.author.you');
  return c.author ?? t('calitas.author.unknown');
}

/** Los comentarios de la isla, que se vuelven a leer cuando algo cambia. */
function useComments(store: CalitasStore) {
  const [list, setList] = useState<CalitasComment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(() => {
    store.list().then(
      (l) => {
        setList(l);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [store]);
  useEffect(() => {
    reload();
    return store.subscribe(reload);
  }, [store, reload]);
  return { list, failed, reload };
}

/** Escribir un comentario o una respuesta, con su contador y su error. */
function Composer({
  label,
  submit,
  publish,
  testId,
  autoFocus = false,
  onCancel,
  onPost,
}: {
  label: string;
  submit: string;
  publish: (body: string) => Promise<void>;
  testId: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  onPost?: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CalitasErrorCode | null>(null);
  const [done, setDone] = useState(false);
  const length = [...text].length;
  const send = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    publish(text)
      .then(() => {
        setText('');
        setDone(true);
        onPost?.();
      })
      .catch((err: unknown) => setError(codeOf(err)))
      .finally(() => setBusy(false));
  };
  return (
    <form className="calitas-form" onSubmit={send} data-testid={testId}>
      <label className="calitas-form__label">
        <span>{label}</span>
        <textarea
          value={text}
          rows={2}
          maxLength={COMMENT_MAX * 2}
          placeholder={t('calitas.form.placeholder')}
          autoFocus={autoFocus}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
            setDone(false);
          }}
          data-testid={`${testId}-texto`}
          aria-invalid={error ? true : undefined}
        />
      </label>
      <div className="calitas-form__row">
        <small
          className={length > COMMENT_MAX ? 'calitas-form__count is-over' : 'calitas-form__count'}
        >
          {t('calitas.form.count', { n: length, max: COMMENT_MAX })}
        </small>
        {onCancel ? (
          <button type="button" className="mar-btn" onClick={onCancel}>
            {t('calitas.reply.cancel')}
          </button>
        ) : null}
        <button
          type="submit"
          className="mar-btn mar-btn--primary"
          disabled={busy || text.trim().length === 0}
          data-testid={`${testId}-publicar`}
        >
          {submit}
        </button>
      </div>
      {error ? (
        <p
          className="calitas-error"
          role="alert"
          data-testid={`${testId}-error`}
          data-error={error}
        >
          {errorText(error)}
        </p>
      ) : done ? (
        <p className="calitas-note" role="status">
          {t('calitas.posted')}
        </p>
      ) : null}
    </form>
  );
}

/** Un comentario: autor, fecha, texto y sus votos. */
function Comment({
  c,
  onVote,
  busy,
  children,
}: {
  c: CalitasComment;
  onVote: (c: CalitasComment, pressed: 1 | -1) => void;
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <article
      className={c.parentId ? 'calitas-comment is-reply' : 'calitas-comment'}
      data-testid={`calitas-comentario-${c.id}`}
      data-puntos={c.score}
      data-voto={c.myVote}
      data-mio={c.isMine ? 'si' : 'no'}
    >
      <p className="calitas-comment__meta">
        <strong>{authorOf(c)}</strong> · <time dateTime={c.createdAt}>{when(c.createdAt)}</time>
        {c.isSample ? ` · ${t('calitas.author.sample')}` : ''}
      </p>
      <p className="calitas-comment__body">{c.body}</p>
      <div className="calitas-comment__actions">
        <div
          className="calitas-votes"
          role="group"
          aria-label={t('calitas.vote.score', { n: c.score })}
        >
          <button
            type="button"
            className="calitas-vote"
            aria-pressed={c.myVote === 1}
            aria-label={t('calitas.vote.up')}
            title={t('calitas.vote.up')}
            disabled={busy || c.isMine}
            onClick={() => onVote(c, 1)}
            data-testid={`calitas-arriba-${c.id}`}
          >
            ▲
          </button>
          <span className="calitas-score" data-testid={`calitas-puntos-${c.id}`}>
            {c.score}
          </span>
          <button
            type="button"
            className="calitas-vote"
            aria-pressed={c.myVote === -1}
            aria-label={t('calitas.vote.down')}
            title={t('calitas.vote.down')}
            disabled={busy || c.isMine}
            onClick={() => onVote(c, -1)}
            data-testid={`calitas-abajo-${c.id}`}
          >
            ▼
          </button>
        </div>
        {children}
      </div>
    </article>
  );
}

export function CalitasPanel({ store: given }: { store?: CalitasStore } = {}) {
  const [store] = useState(() => given ?? calitasStore());
  const { list, failed, reload } = useComments(store);
  const account = useAccount();
  const { data: carnet } = useRepoData((r) => r.carnet.mine());
  const [order, setOrder] = useState<CalitasOrder>('recent');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<CalitasErrorCode | null>(null);
  /** Con cuentas, escribir y votar piden la cuenta con Carnet. */
  const needsAccount = store.shared && account.status !== 'member';

  const ensureAccount = async () => (needsAccount ? requireAccount('carnet') : true);

  const publish = async (body: string, parentId: string | null) => {
    if (!(await ensureAccount())) throw new CalitasError('account');
    await store.post(body, parentId, store.shared ? null : (carnet?.nickname ?? null));
    reload();
  };

  const vote = (c: CalitasComment, pressed: 1 | -1) => {
    setVoting(true);
    setVoteError(null);
    void ensureAccount()
      .then((ok) => {
        if (!ok) throw new CalitasError('account');
        return store.vote(c.id, nextVote(c.myVote, pressed));
      })
      .then(reload)
      .catch((err: unknown) => setVoteError(codeOf(err)))
      .finally(() => setVoting(false));
  };

  const threads = list ? buildThreads(list, order) : [];
  return (
    <div className="calitas" data-testid="calitas" data-modo={store.shared ? 'cuentas' : 'local'}>
      <p className="calitas-note">
        {store.shared ? t('calitas.sharedNote') : t('calitas.localNote')}
      </p>
      {needsAccount && account.status !== 'loading' ? (
        <div className="calitas-account" data-testid="calitas-sin-carnet">
          <p>{t('calitas.needAccount')}</p>
          <button
            type="button"
            className="mar-btn mar-btn--primary"
            onClick={() => void requireAccount('carnet')}
          >
            {t('calitas.signIn')}
          </button>
        </div>
      ) : (
        <Composer
          label={t('calitas.form.label')}
          submit={t('calitas.form.publish')}
          publish={(body) => publish(body, null)}
          testId="calitas-nuevo"
        />
      )}
      <div className="calitas-order" role="group" aria-label={t('calitas.order.label')}>
        {(['recent', 'top'] as const).map((o) => (
          <button
            key={o}
            type="button"
            className={order === o ? 'calitas-tab is-active' : 'calitas-tab'}
            aria-pressed={order === o}
            onClick={() => setOrder(o)}
            data-testid={`calitas-orden-${o}`}
          >
            {t(o === 'recent' ? 'calitas.order.recent' : 'calitas.order.top')}
          </button>
        ))}
      </div>
      {voteError ? (
        <p className="calitas-error" role="alert" data-testid="calitas-voto-error">
          {errorText(voteError)}
        </p>
      ) : null}
      {failed ? (
        <p className="calitas-error" role="alert">
          {t('calitas.error.generic')}
        </p>
      ) : list === null ? (
        <p className="calitas-note">{t('empty.loading')}</p>
      ) : threads.length === 0 ? (
        <p className="calitas-note" data-testid="calitas-vacio">
          {t('calitas.empty')}
        </p>
      ) : (
        <ol className="calitas-list" aria-label={t('calitas.list')} data-testid="calitas-lista">
          {threads.map(({ comment, replies }) => (
            <li key={comment.id}>
              <Comment c={comment} onVote={vote} busy={voting}>
                {needsAccount ? null : (
                  <button
                    type="button"
                    className="calitas-reply"
                    aria-expanded={replyTo === comment.id}
                    onClick={() => setReplyTo((r) => (r === comment.id ? null : comment.id))}
                    data-testid={`calitas-responder-${comment.id}`}
                  >
                    {t('calitas.reply')}
                  </button>
                )}
              </Comment>
              {replies.length || replyTo === comment.id ? (
                <ol className="calitas-replies" aria-label={t('calitas.replies')}>
                  {replies.map((r) => (
                    <li key={r.id}>
                      <Comment c={r} onVote={vote} busy={voting} />
                    </li>
                  ))}
                  {replyTo === comment.id ? (
                    <li>
                      <Composer
                        label={t('calitas.reply.label', { author: authorOf(comment) })}
                        submit={t('calitas.reply.publish')}
                        publish={(body) => publish(body, comment.id)}
                        testId={`calitas-respuesta-${comment.id}`}
                        autoFocus
                        onCancel={() => setReplyTo(null)}
                        onPost={() => setReplyTo(null)}
                      />
                    </li>
                  ) : null}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
