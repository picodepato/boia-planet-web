'use client';

import {
  CARNET_ANSWER_MAX,
  type CarnetQuestion,
  NICKNAME_MAX,
  NICKNAME_MIN,
  charLength,
} from '@boia/contracts';
import { type BoiaRepository, type CarnetView, isStoreError } from '@boia/store';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { requireAccount } from '../../account/gate';
import { clearArtistCode, pendingArtistCode } from '../../account/artist-link';
import { accountSnapshot } from '../../account/session';
import { emitCarnetReward, emitSignal } from '../achievements';
import { Avatar, DEFAULT_AVATAR, NEUTRAL_AVATARS, shrinkPhoto } from './avatar';
import { t } from '../../i18n';

/**
 * Alta rápida y edición del Carnet (REQ-IDE-010, REQ-IDE-013, REQ-IDE-014):
 * apodo, avatar neutro o foto del dispositivo y las 5 preguntas de §44.1,
 * textuales y opcionales. Antes de crear se dice qué será público. Sin
 * email: en la demo el Carnet es del invitado de este navegador (D-20).
 */

/**
 * En la versión de prueba nada se comparte (REQ-IDE-051, D-20): se dice en
 * pantalla. muestra
 */
export const LOCAL_ONLY_NOTICE = t('juego.carnetEditor.versionDePruebaTodo');

/** Qué será público (REQ-IDE-013) cuando haya servidor. muestra */
export const PUBLIC_FIELDS_NOTICE = t('juego.carnetEditor.cuandoBoiaPlanetAbra');

export function CarnetForm({
  questions,
  initial,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
  onPhoto,
}: {
  questions: readonly CarnetQuestion[];
  initial: CarnetDraft;
  busy?: boolean;
  error?: string | null;
  onSubmit: (draft: CarnetDraft) => void;
  onCancel?: (() => void) | undefined;
  onPhoto?: ((file: File) => Promise<string>) | undefined;
}) {
  const [draft, setDraft] = useState(initial);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const id = useId();
  const set = (patch: Partial<CarnetDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const creating = initial.isNew;
  // Tras abrir el enlace de artistas (T186); se lee en el cliente.
  const [artistLink, setArtistLink] = useState(false);
  useEffect(() => setArtistLink(pendingArtistCode() !== null), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(draft);
  };

  return (
    <form className="carnet-form" data-testid="carnet-form" onSubmit={submit}>
      {creating ? (
        <p className="carnet-notice">
          {PUBLIC_FIELDS_NOTICE} {LOCAL_ONLY_NOTICE}
        </p>
      ) : null}
      {creating && artistLink ? (
        <p className="carnet-notice" data-testid="carnet-aviso-artista">
          {t('carnet.artistLink.notice')}
        </p>
      ) : null}
      <label className="juego-field">
        <span>{t('juego.carnetEditor.apodo')}</span>
        <input
          name="apodo"
          data-testid="carnet-apodo-input"
          value={draft.nickname}
          minLength={NICKNAME_MIN}
          maxLength={NICKNAME_MAX}
          required
          autoComplete="nickname"
          onChange={(e) => set({ nickname: e.target.value })}
        />
        <small className="juego-muted">
          {t('juego.carnetEditor.deACaracteresEs', { NICKNAME_MIN, NICKNAME_MAX })}
        </small>
      </label>

      <fieldset className="juego-field">
        <legend>{t('carnet.field.photo')}</legend>
        <div
          className="carnet-avatar-pick"
          role="radiogroup"
          aria-label={t('juego.carnetEditor.avatarNeutro')}
        >
          {NEUTRAL_AVATARS.map((a) => {
            const checked = !draft.avatarImage && draft.avatarKey === a.key;
            return (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={a.label}
                title={a.label}
                className={checked ? 'is-active' : undefined}
                onClick={() => set({ avatarKey: a.key, avatarImage: null })}
              >
                <Avatar avatarKey={a.key} image={null} size={40} name={a.label} />
              </button>
            );
          })}
        </div>
        {onPhoto ? (
          <div className="carnet-photo">
            {draft.avatarImage ? (
              <>
                <Avatar avatarKey={null} image={draft.avatarImage} size={48} name="tu foto" />
                <button
                  type="button"
                  className="juego-link"
                  onClick={() => set({ avatarImage: null })}
                >
                  {t('carnet.field.photo.remove')}
                </button>
              </>
            ) : null}
            <label className="juego-link" htmlFor={`${id}-foto`}>
              {draft.avatarImage
                ? t('carnet.field.photo.change')
                : t('juego.carnetEditor.subirUnaFotoDel')}
            </label>
            <input
              id={`${id}-foto`}
              type="file"
              accept="image/*"
              className="carnet-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setPhotoError(null);
                onPhoto(file).then(
                  (url) => set({ avatarImage: url }),
                  () => setPhotoError(t('carnet.error.photo')),
                );
              }}
            />
            {photoError ? <p className="carnet-error">{photoError}</p> : null}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="juego-field">
        <legend>{t('carnet.questions.heading')}</legend>
        <p className="juego-muted">{t('juego.carnetEditor.contestaLasQueQuieras')}</p>
        {questions.map((q) => (
          <label key={q.id} className="carnet-q">
            <span>{q.prompt}</span>
            <textarea
              data-testid={`carnet-pregunta-${q.id}`}
              value={draft.answers[q.id] ?? ''}
              maxLength={CARNET_ANSWER_MAX}
              rows={2}
              onChange={(e) => set({ answers: { ...draft.answers, [q.id]: e.target.value } })}
            />
          </label>
        ))}
      </fieldset>

      {error ? (
        <p className="carnet-error" role="alert" data-testid="carnet-error">
          {error}
        </p>
      ) : null}
      <div className="carnet-actions">
        <button type="submit" className="juego-button" disabled={busy} data-testid="carnet-guardar">
          {creating ? t('carnet.create') : t('juego.carnetEditor.guardar')}
        </button>
        {onCancel ? (
          <button type="button" className="juego-button is-quiet" onClick={onCancel}>
            {t('carnet.cancel')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

export interface CarnetDraft {
  isNew: boolean;
  nickname: string;
  avatarKey: string | null;
  avatarImage: string | null;
  answers: Record<string, string>;
}

export function draftFrom(carnet: CarnetView | null): CarnetDraft {
  if (!carnet) {
    return {
      isNew: true,
      nickname: '',
      avatarKey: DEFAULT_AVATAR.key,
      avatarImage: null,
      answers: {},
    };
  }
  return {
    isNew: false,
    nickname: carnet.nickname,
    avatarKey: carnet.avatarKey,
    avatarImage: carnet.avatarImage,
    answers: Object.fromEntries(carnet.answers.map((a) => [a.questionId, a.answer])),
  };
}

/** Registration may create the account's identity card while its questionnaire waits.
 * Keep existing answers and photo unless this fresh draft actually supplies a change.
 */
export function continueCarnetDraft(current: CarnetView, draft: CarnetDraft): CarnetDraft {
  const base = draftFrom(current);
  return {
    ...base,
    answers: { ...base.answers, ...draft.answers },
    ...(draft.avatarImage || draft.avatarKey !== DEFAULT_AVATAR.key
      ? { avatarKey: draft.avatarKey, avatarImage: draft.avatarImage }
      : {}),
  };
}

/** Texto para la interfaz de un error del repositorio al guardar el Carnet. muestra */
export function carnetErrorText(e: unknown): string {
  if (isStoreError(e, 'conflict')) {
    return /apodo/.test((e as Error).message)
      ? t('carnet.error.nicknameTaken')
      : t('juego.carnetEditor.yaTienesUnCarnet');
  }
  if (isStoreError(e, 'invalid'))
    return t('juego.carnetEditor.revisaEsto', { message: (e as Error).message });
  return t('carnet.error.save');
}

/** Guarda el borrador: crea o actualiza y contesta las preguntas que cambiaron. */
export async function saveCarnet(
  repo: BoiaRepository,
  before: CarnetView | null,
  draft: CarnetDraft,
  questions: readonly CarnetQuestion[],
  canSave: () => boolean = () => true,
): Promise<CarnetView> {
  const check = () => {
    if (!canSave()) throw new Error('Carnet save cancelled');
  };
  check();
  const nickname = draft.nickname.trim();
  if (charLength(nickname) < NICKNAME_MIN) {
    throw Object.assign(new Error(`apodo: entre ${NICKNAME_MIN} y ${NICKNAME_MAX} caracteres`), {
      code: 'invalid',
    });
  }
  let view: CarnetView;
  if (!before) {
    check();
    view = await repo.carnet.create({
      nickname,
      avatarKey: draft.avatarKey,
      avatarImage: draft.avatarImage,
      // El enlace de artistas (T186): en modo local marca este Carnet (demo).
      artistCode: pendingArtistCode(),
    });
    clearArtistCode();
  } else if (
    nickname !== before.nickname ||
    draft.avatarKey !== before.avatarKey ||
    draft.avatarImage !== before.avatarImage
  ) {
    check();
    view = await repo.carnet.update({
      nickname,
      avatarKey: draft.avatarKey,
      avatarImage: draft.avatarImage,
    });
  } else {
    view = before;
  }
  const old = Object.fromEntries((before?.answers ?? []).map((a) => [a.questionId, a.answer]));
  for (const q of questions) {
    const next = (draft.answers[q.id] ?? '').trim();
    if (next === (old[q.id] ?? '')) continue;
    check();
    view = await repo.carnet.answer(q.id, next || null);
  }
  // Logros del Carnet (T36): tener Carnet (su premio llega ya, decisión
  // 2026-10-02) y las preguntas contestadas.
  check();
  await emitCarnetReward(repo);
  if (view.answers.length > 0) {
    void emitSignal(repo, {
      trigger: 'answer_question',
      questionIds: view.answers.map((a) => a.questionId),
    });
  }
  return view;
}

/** Resume a questionnaire after the account gate switched its stable repository. */
export async function saveCarnetContinuation(
  repo: BoiaRepository,
  before: CarnetView | null,
  draft: CarnetDraft,
  questions: readonly CarnetQuestion[],
  isActive: () => boolean = () => true,
  expectedOwner: string | null = accountSnapshot().userId,
): Promise<CarnetView | undefined> {
  const account = accountSnapshot();
  if (!isActive() || account.userId !== expectedOwner) return;
  const current = await repo.carnet.mine();
  const owner = (await repo.identity.current())?.id;
  const canSave = () => isActive() && accountSnapshot().userId === expectedOwner;
  if (!canSave() || (account.userId && owner !== account.userId)) return;
  const switched = draft.isNew || before?.userId !== current?.userId;
  const toSave =
    switched && current
      ? continueCarnetDraft(current, draft)
      : !before && account.profile
        ? { ...draft, nickname: account.profile.nickname }
        : draft;
  const view = await saveCarnet(repo, current, toSave, questions, canSave);
  return canSave() ? view : undefined;
}

/** Formulario conectado al repositorio. */
export function CarnetEditor({
  repo,
  questions,
  before,
  onDone,
  onCancel,
}: {
  repo: BoiaRepository;
  questions: readonly CarnetQuestion[];
  before: CarnetView | null;
  onDone: (view: CarnetView) => void;
  onCancel?: () => void;
}) {
  const originOwner = useRef(accountSnapshot().userId);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <CarnetForm
      questions={questions}
      initial={draftFrom(before)}
      busy={busy}
      error={error}
      onCancel={
        onCancel
          ? () => {
              alive.current = false;
              onCancel();
            }
          : undefined
      }
      onPhoto={shrinkPhoto}
      onSubmit={(draft) => {
        // Only the account gate may move an offered guest draft to a member.
        if (accountSnapshot().userId !== originOwner.current) return;
        setBusy(true);
        setError(null);
        // Guardar el Carnet pide la cuenta (plan 008, T89, decisión 1); en
        // modo local pasa al momento. Un Carnet nuevo lleva el apodo que se
        // eligió para la cuenta. Un apodo corto se dice antes de pedirla.
        const tooShort = charLength(draft.nickname.trim()) < NICKNAME_MIN;
        (tooShort
          ? Promise.resolve(true)
          : requireAccount('carnet', {
              prefill: {
                nickname: draft.nickname.trim(),
                avatarKey: draft.avatarKey,
                avatarImage: draft.avatarImage,
              },
            })
        )
          .then(async (ok) => {
            if (!ok || !alive.current) return;
            if (originOwner.current && accountSnapshot().userId !== originOwner.current) return;
            // Bind the retained draft to the member authorized by this gate, including retries.
            originOwner.current ??= accountSnapshot().userId;
            const view = await saveCarnetContinuation(
              repo,
              before,
              draft,
              questions,
              () => alive.current,
              originOwner.current ?? accountSnapshot().userId,
            );
            if (view) onDone(view);
          })
          .then(undefined, (e: unknown) => {
            if (!alive.current) return;
            const invalidLocal = (e as { code?: string }).code === 'invalid';
            setError(
              invalidLocal
                ? t('juego.carnetEditor.revisaEsto', { message: (e as Error).message })
                : carnetErrorText(e),
            );
          })
          .finally(() => {
            if (alive.current) setBusy(false);
          });
      }}
    />
  );
}
