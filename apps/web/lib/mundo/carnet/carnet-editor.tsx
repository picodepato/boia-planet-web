'use client';

import {
  CARNET_ANSWER_MAX,
  type CarnetQuestion,
  NICKNAME_MAX,
  NICKNAME_MIN,
  charLength,
} from '@boia/contracts';
import { type BoiaRepository, type CarnetView, isStoreError } from '@boia/store';
import { type FormEvent, useId, useState } from 'react';
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
): Promise<CarnetView> {
  const nickname = draft.nickname.trim();
  if (charLength(nickname) < NICKNAME_MIN) {
    throw Object.assign(new Error(`apodo: entre ${NICKNAME_MIN} y ${NICKNAME_MAX} caracteres`), {
      code: 'invalid',
    });
  }
  let view: CarnetView;
  if (!before) {
    view = await repo.carnet.create({
      nickname,
      avatarKey: draft.avatarKey,
      avatarImage: draft.avatarImage,
    });
  } else if (
    nickname !== before.nickname ||
    draft.avatarKey !== before.avatarKey ||
    draft.avatarImage !== before.avatarImage
  ) {
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
    view = await repo.carnet.answer(q.id, next || null);
  }
  // Logros del Carnet (T36): tener Carnet (su premio llega ya, decisión
  // 2026-10-02) y las preguntas contestadas.
  await emitCarnetReward(repo);
  if (view.answers.length > 0) {
    void emitSignal(repo, {
      trigger: 'answer_question',
      questionIds: view.answers.map((a) => a.questionId),
    });
  }
  return view;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <CarnetForm
      questions={questions}
      initial={draftFrom(before)}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onPhoto={shrinkPhoto}
      onSubmit={(draft) => {
        setBusy(true);
        setError(null);
        saveCarnet(repo, before, draft, questions)
          .then(onDone, (e: unknown) => {
            const invalidLocal = (e as { code?: string }).code === 'invalid';
            setError(
              invalidLocal
                ? t('juego.carnetEditor.revisaEsto', { message: (e as Error).message })
                : carnetErrorText(e),
            );
          })
          .finally(() => setBusy(false));
      }}
    />
  );
}
