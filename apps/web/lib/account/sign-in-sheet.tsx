'use client';

import { NICKNAME_MAX, NICKNAME_MIN, charLength } from '@boia/contracts';
import {
  Fragment,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { type MessageKey, t } from '../i18n';
import { isSupabaseConfigured } from '../supabase/config';
import './account.css';
import {
  ACCOUNT_NOTICE_MS,
  NICKNAME_CHECK_DELAY_MS,
  OTP_LENGTH,
  RESEND_COOLDOWN_S,
} from './config';
import {
  type AuthProblem,
  type NicknameVerdict,
  authProblem,
  looksLikeEmail,
  nicknameVerdict,
  rpcReason,
} from './errors';
import { trapTab } from './focus';
import { accountLayer } from './layer';
import {
  type AccountPrefill,
  type GateRequest,
  gateSnapshot,
  registerGateHost,
  settleGate,
  subscribeGate,
} from './gate';
import { guestMergePayload, guestPrefill } from './guest';
import { type MergeSummary, isEmptyPayload, isEmptySummary, mergeSummary } from './merge';
import {
  accountSnapshot,
  createProfile,
  mergeGuest,
  nicknameStatus,
  refreshAccount,
  sendCode,
  verifyCode,
} from './session';
import {
  type AccountNotice,
  clearAccountNotice,
  showAccountNotice,
  useAccount,
  useAccountNotice,
} from './use-account';

/**
 * La hoja de acceso (plan 008, T89; diseño aprobado de T87, marcos 12 y 13):
 * una sola hoja para todo lo que guarda. Paso 1, el email; paso 2, el código
 * de 6 cifras en la misma hoja (sin enlace mágico, decisión 2); sólo para
 * cuentas sin Carnet, paso 3: apodo único con filtro, la política
 * obligatoria y las noticias aparte, opcionales y sin marcar (decisiones 3 y
 * 5). Al entrar, lo del invitado pasa a la cuenta (decisión 4).
 *
 * `<AccountGate />` va una vez en cada página que guarda (/mar, /carnet): es
 * quien abre la hoja cuando alguien llama a `requireAccount` y enseña los
 * avisos de la cuenta. En modo local no pinta nada.
 */
export function AccountGate() {
  return isSupabaseConfigured() ? <GateHost /> : null;
}

function GateHost() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return registerGateHost();
  }, []);
  // Empieza a escuchar la sesión.
  useAccount();
  const request = useSyncExternalStore(subscribeGate, gateSnapshot, () => null);
  const notice = useAccountNotice();
  if (!mounted) return null;
  return createPortal(
    <>
      {/* Claves distintas: los ids de la hoja y del aviso empiezan los dos en 1. */}
      {request ? <SignInSheet key={`hoja-${request.id}`} request={request} /> : null}
      {notice ? <NoticeToast key={`aviso-${notice.id}`} notice={notice} /> : null}
    </>,
    accountLayer(),
  );
}

function NoticeToast({ notice }: { notice: AccountNotice }) {
  useEffect(() => {
    const id = setTimeout(() => clearAccountNotice(notice.id), ACCOUNT_NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice.id]);
  return (
    <p className="cuenta-aviso" role="status" data-testid="cuenta-aviso">
      {t(notice.key, notice.vars)}
    </p>
  );
}

// ---------------------------------------------------------------------------

type Step = 'email' | 'code' | 'nickname' | 'welcome';

const TITLE: Record<GateRequest['reason'], MessageKey> = {
  carnet: 'auth.title.carnet',
  skin: 'auth.title.skin',
  stamp: 'auth.title.stamp',
  ranking: 'auth.title.ranking',
};

const WHY_ICON: Record<GateRequest['reason'], string> = {
  carnet: '🪪',
  skin: '⛵',
  stamp: '✺',
  ranking: '🏆',
};

const PROBLEM_TEXT: Record<AuthProblem, MessageKey> = {
  wrong: 'auth.code.wrong',
  expired: 'auth.code.expired',
  tooMany: 'auth.code.tooMany',
  invalidEmail: 'auth.email.invalid',
  network: 'auth.error.network',
  unknown: 'auth.error.unknown',
};

const VERDICT_TEXT: Record<Exclude<NicknameVerdict, 'free'>, MessageKey> = {
  taken: 'auth.new.nicknameTaken',
  blocked: 'auth.new.nicknameBlocked',
  invalid: 'auth.new.nicknameHelp',
};

const AVATAR_KEY = /^[a-z0-9]+([-_:./][a-z0-9]+)*$/;

function whyText(request: GateRequest): string {
  switch (request.reason) {
    case 'carnet':
      return t('auth.why.carnet');
    case 'skin':
      return t('auth.why.skin');
    case 'stamp':
      return request.event ? t('auth.why.stamp', { event: request.event }) : t('auth.why.stampAny');
    case 'ranking':
      return t('auth.why.ranking');
  }
}

function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** «120 puntos, 3 logros y tu barco». */
export function mergedItems(s: MergeSummary): string {
  const items = [
    ...(s.points > 0
      ? [s.points === 1 ? t('auth.merged.onePoint') : t('auth.merged.points', { n: s.points })]
      : []),
    ...(s.achievements > 0
      ? [
          s.achievements === 1
            ? t('auth.merged.oneAchievement')
            : t('auth.merged.achievements', { n: s.achievements }),
        ]
      : []),
    ...(s.ship ? [t('auth.merged.ship')] : []),
    ...(s.times > 0 ? [t('auth.merged.times')] : []),
  ];
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${t('auth.merged.and')} ${items[items.length - 1]}`;
}

/** Un texto del catálogo con un trozo de interfaz en el sitio de `{name}`. */
function slotted(key: MessageKey, name: string, node: ReactNode): ReactNode[] {
  const marker = '\u0000';
  return t(key, { [name]: marker })
    .split(marker)
    .flatMap((part, i) => (i === 0 ? [part] : [<Fragment key={i}>{node}</Fragment>, part]));
}

export function memberNumberText(n: number): string {
  return String(n).padStart(4, '0');
}

function SignInSheet({ request }: { request: GateRequest }) {
  const id = useId();
  const sheet = useRef<HTMLElement>(null);
  const firstField = useRef<HTMLInputElement | HTMLButtonElement | null>(null);
  const [step, setStep] = useState<Step>(() =>
    accountSnapshot().status === 'incomplete' ? 'nickname' : 'email',
  );
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [info, setInfo] = useState<MessageKey | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [prefill, setPrefill] = useState<AccountPrefill>(request.prefill ?? {});
  const [nickname, setNickname] = useState(request.prefill?.nickname ?? '');
  const [verdict, setVerdict] = useState<NicknameVerdict | 'checking' | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [news, setNews] = useState(false);
  const [summary, setSummary] = useState<MergeSummary | null>(null);
  const [memberNumber, setMemberNumber] = useState<number | null>(null);

  // El foco vuelve a donde estaba al cerrar.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  // El apodo del Carnet de este navegador, si quien llama no dio otro.
  useEffect(() => {
    if (request.prefill?.nickname) return;
    let alive = true;
    void guestPrefill().then(
      (p) => {
        if (!alive) return;
        setPrefill((old) => ({ ...p, ...old }));
        if (p.nickname) setNickname((n) => n || p.nickname || '');
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [request.prefill?.nickname]);

  useEffect(() => {
    firstField.current?.focus({ preventScroll: true });
  }, [step]);

  // La cuenta atrás del reenvío (no se anuncia cada segundo).
  const left = sentAt === null ? 0 : Math.ceil((sentAt + RESEND_COOLDOWN_S * 1000 - now) / 1000);
  useEffect(() => {
    if (step !== 'code' || left <= 0) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [step, left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // El apodo se comprueba al dejar de escribir.
  const trimmed = nickname.trim();
  useEffect(() => {
    if (step !== 'nickname') return;
    const len = charLength(trimmed);
    if (len === 0) {
      setVerdict(null);
      return;
    }
    if (len < NICKNAME_MIN || len > NICKNAME_MAX) {
      setVerdict('invalid');
      return;
    }
    setVerdict('checking');
    let alive = true;
    const timer = setTimeout(() => {
      nicknameStatus(trimmed).then(
        (status) => alive && setVerdict(nicknameVerdict(status)),
        () => alive && setVerdict(null),
      );
    }, NICKNAME_CHECK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [trimmed, step]);

  const cancel = () => settleGate(false);

  async function requestCode(next: Step = 'code'): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      const at = Date.now();
      setSentAt(at);
      setNow(at);
      setStep(next);
      return true;
    } catch (e) {
      const p = authProblem(e);
      setError(
        p === 'invalidEmail' || p === 'tooMany' || p === 'network'
          ? PROBLEM_TEXT[p]
          : 'auth.email.sendError',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!looksLikeEmail(email)) {
      setError('auth.email.invalid');
      return;
    }
    setCode('');
    setInfo(null);
    await requestCode();
  }

  async function afterVerify() {
    let merged: MergeSummary | null = null;
    try {
      const payload = await guestMergePayload();
      if (!isEmptyPayload(payload)) merged = mergeSummary(payload, await mergeGuest(payload));
    } catch (e) {
      console.warn('[boia] no se pudo pasar lo del invitado a la cuenta', e);
    }
    const account = await refreshAccount();
    if (account.status === 'member' && account.profile) {
      showAccountNotice('auth.signedIn', { nickname: account.profile.nickname });
      settleGate(true);
      return;
    }
    setSummary(merged);
    setStep('nickname');
  }

  async function verify(token: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await verifyCode(email, token);
    } catch (e) {
      const p = authProblem(e, sentAt);
      setCode('');
      setBusy(false);
      if (p === 'expired') {
        setError('auth.code.expired');
        if (left <= 0) {
          try {
            await sendCode(email);
            const at = Date.now();
            setSentAt(at);
            setNow(at);
          } catch {
            // se queda el aviso; puede reenviar a mano
          }
        }
      } else {
        setError(PROBLEM_TEXT[p === 'invalidEmail' ? 'unknown' : p]);
      }
      return;
    }
    try {
      await afterVerify();
    } catch (e) {
      console.warn('[boia] no se pudo leer la cuenta', e);
      setError('auth.error.unknown');
    } finally {
      setBusy(false);
    }
  }

  function onCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === OTP_LENGTH) void verify(digits);
  }

  async function resend() {
    setInfo(null);
    if (await requestCode('code')) {
      setCode('');
      setInfo('auth.code.resent');
    }
  }

  const nicknameFree = verdict === 'free';
  const canCreate = nicknameFree && privacy && !busy;

  async function submitNickname(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      const status = nicknameVerdict(await nicknameStatus(trimmed));
      if (status !== 'free') {
        setVerdict(status);
        return;
      }
      const avatarKey =
        prefill.avatarKey && AVATAR_KEY.test(prefill.avatarKey) ? prefill.avatarKey : null;
      const avatarImage = prefill.avatarImage?.startsWith('data:image/')
        ? prefill.avatarImage
        : null;
      const profile = await createProfile({ nickname: trimmed, avatarKey, avatarImage, news });
      setMemberNumber(profile.member_number);
      setStep('welcome');
    } catch (err) {
      const reason = rpcReason(err);
      const v = nicknameVerdict(reason);
      if (v && v !== 'free') setVerdict(v);
      else if (reason === 'privacy_required') setError('auth.new.missingPrivacy');
      else setError('auth.error.unknown');
    } finally {
      setBusy(false);
    }
  }

  const isNew = step === 'nickname' || step === 'welcome';
  const total = isNew ? 3 : 2;
  const current = step === 'email' ? 1 : step === 'code' ? 2 : 3;
  const title = isNew ? t('auth.new.title') : t(TITLE[request.reason]);
  const errId = `${id}-error`;

  let body: ReactNode;
  if (step === 'email') {
    body = (
      <form onSubmit={submitEmail} noValidate data-testid="acceso-email">
        <p className="acceso-why" data-testid="acceso-por-que">
          <span aria-hidden="true">{WHY_ICON[request.reason]}</span>
          <span>{whyText(request)}</span>
        </p>
        <label className="acceso-label" htmlFor={`${id}-email`}>
          {t('auth.email.label')}
        </label>
        <input
          ref={(el) => {
            firstField.current = el;
          }}
          id={`${id}-email`}
          className="acceso-input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('auth.email.placeholder')}
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : `${id}-email-help`}
          data-testid="acceso-email-input"
          onChange={(e) => setEmail(e.target.value)}
        />
        {error ? (
          <p id={errId} className="acceso-error" role="alert" data-testid="acceso-error">
            {t(error)}
          </p>
        ) : (
          <p id={`${id}-email-help`} className="acceso-help">
            {t('auth.email.help')}
          </p>
        )}
        <button
          type="submit"
          className="acceso-primary"
          disabled={busy}
          data-testid="acceso-enviar"
        >
          {busy ? t('auth.email.sending') : t('auth.email.send')}
        </button>
        <button
          type="button"
          className="acceso-link"
          onClick={cancel}
          data-testid="acceso-ahora-no"
        >
          {t('auth.notNow')}
        </button>
        <p className="acceso-foot">{t('auth.email.private')}</p>
      </form>
    );
  } else if (step === 'code') {
    const ready = left <= 0;
    body = (
      <div data-testid="acceso-codigo">
        <p className="acceso-text">
          {slotted('auth.code.sentTo', 'email', <strong>{email.trim()}</strong>)}{' '}
          <button
            type="button"
            className="acceso-inline"
            data-testid="acceso-cambiar"
            onClick={() => {
              setError(null);
              setInfo(null);
              setStep('email');
            }}
          >
            {t('auth.code.change')}
          </button>
        </p>
        <label className="acceso-label" htmlFor={`${id}-code`}>
          {t('auth.code.label')}
        </label>
        <div className={`acceso-otp${error ? ' is-error' : ''}`}>
          {Array.from({ length: OTP_LENGTH }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`acceso-otp__box${i === code.length ? ' is-current' : ''}`}
            >
              {code[i] ?? ''}
            </span>
          ))}
          <input
            ref={(el) => {
              firstField.current = el;
            }}
            id={`${id}-code`}
            className="acceso-otp__input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={OTP_LENGTH}
            value={code}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : `${id}-code-help`}
            data-testid="acceso-codigo-input"
            onChange={(e) => onCode(e.target.value)}
          />
        </div>
        {error ? (
          <p id={errId} className="acceso-error" role="alert" data-testid="acceso-error">
            {t(error)}
          </p>
        ) : (
          <p id={`${id}-code-help`} className="acceso-help">
            {busy ? t('auth.code.checking') : t('auth.code.help')}
          </p>
        )}
        {info ? (
          <p className="acceso-help" role="status">
            {t(info)}
          </p>
        ) : null}
        {ready ? (
          <button
            type="button"
            className="acceso-ghost"
            disabled={busy}
            data-testid="acceso-reenviar"
            onClick={() => void resend()}
          >
            {t('auth.code.resend')}
          </button>
        ) : (
          <p className="acceso-help" aria-hidden="true" data-testid="acceso-reenviar-en">
            {t('auth.code.resendIn', { time: clock(left) })}
          </p>
        )}
        <p className="acceso-sr" role="status">
          {ready && sentAt !== null ? t('auth.code.resendReady') : ''}
        </p>
      </div>
    );
  } else if (step === 'nickname') {
    const verdictText =
      verdict === 'taken' || verdict === 'blocked' ? t(VERDICT_TEXT[verdict]) : null;
    const missing = !privacy
      ? t('auth.new.missingPrivacy')
      : !nicknameFree
        ? t('auth.new.missingNickname')
        : null;
    body = (
      <form onSubmit={submitNickname} noValidate data-testid="acceso-cuenta-nueva">
        <p className="acceso-text">{t('auth.new.lead')}</p>
        <label className="acceso-label" htmlFor={`${id}-nick`}>
          {t('auth.new.nickname')}
        </label>
        <input
          ref={(el) => {
            firstField.current = el;
          }}
          id={`${id}-nick`}
          className={`acceso-input${verdictText ? ' is-error' : ''}`}
          name="apodo"
          autoComplete="nickname"
          maxLength={NICKNAME_MAX}
          value={nickname}
          aria-invalid={verdictText ? true : undefined}
          aria-describedby={`${id}-nick-state ${id}-nick-help`}
          data-testid="acceso-apodo"
          onChange={(e) => setNickname(e.target.value)}
        />
        <p id={`${id}-nick-state`} className="acceso-nick-state" aria-live="polite">
          {verdict === 'free' ? (
            <span className="acceso-ok" data-testid="acceso-apodo-libre">
              ✓ {t('auth.new.nicknameFree')}
            </span>
          ) : verdict === 'checking' ? (
            <span className="acceso-help">{t('auth.new.nicknameChecking')}</span>
          ) : verdictText ? (
            <span className="acceso-error" data-testid="acceso-apodo-error">
              {verdictText}
            </span>
          ) : null}
        </p>
        <p id={`${id}-nick-help`} className="acceso-help">
          {t('auth.new.nicknameHelp')}
        </p>
        <label className="acceso-check">
          <input
            type="checkbox"
            checked={privacy}
            required
            data-testid="acceso-privacidad"
            onChange={(e) => setPrivacy(e.target.checked)}
          />
          <span>
            {slotted(
              'auth.new.privacy',
              'link',
              <a href="/legal/privacidad" target="_blank" rel="noopener">
                {t('auth.new.privacyLink')}
              </a>,
            )}
          </span>
        </label>
        <label className="acceso-check">
          <input
            type="checkbox"
            checked={news}
            data-testid="acceso-noticias"
            onChange={(e) => setNews(e.target.checked)}
          />
          <span>{t('auth.new.news')}</span>
        </label>
        <button
          type="submit"
          className="acceso-primary"
          disabled={!canCreate}
          aria-describedby={missing ? `${id}-missing` : undefined}
          data-testid="acceso-crear"
        >
          {busy ? t('auth.new.creating') : t('auth.new.create')}
        </button>
        {missing ? (
          <p id={`${id}-missing`} className="acceso-help" data-testid="acceso-falta">
            {missing}
          </p>
        ) : null}
        {error ? (
          <p className="acceso-error" role="alert" data-testid="acceso-error">
            {t(error)}
          </p>
        ) : null}
      </form>
    );
  } else {
    body = (
      <div data-testid="acceso-bienvenida">
        <div className="acceso-welcome" role="status">
          <span aria-hidden="true">🎉</span>
          <p>
            <strong data-testid="acceso-numero">
              {t('auth.welcome', { number: memberNumberText(memberNumber ?? 0) })}
            </strong>
            {summary && !isEmptySummary(summary) ? (
              <>
                {' '}
                <span data-testid="acceso-fusion">
                  {t('auth.merged', { items: mergedItems(summary) })}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <button
          ref={(el) => {
            firstField.current = el;
          }}
          type="button"
          className="acceso-primary"
          data-testid="acceso-seguir"
          onClick={() => settleGate(true)}
        >
          {t('auth.continue')}
        </button>
      </div>
    );
  }

  return (
    <div className="acceso">
      <section
        ref={sheet}
        className="acceso__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        data-testid="acceso"
        data-paso={step}
        data-motivo={request.reason}
        onKeyDown={(e) => {
          // Las teclas no llegan al barco ni cierran la hoja de debajo.
          e.stopPropagation();
          if (e.key === 'Escape') cancel();
          trapTab(e, sheet.current);
        }}
      >
        <header className="acceso__head">
          {step !== 'welcome' ? (
            <button
              type="button"
              className="acceso__back"
              data-testid="acceso-volver"
              onClick={cancel}
            >
              <span aria-hidden="true">‹</span> {t('auth.back')}
            </button>
          ) : null}
          <button
            type="button"
            className="acceso__x"
            aria-label={t('auth.close')}
            data-testid="acceso-cerrar"
            onClick={step === 'welcome' ? () => settleGate(true) : cancel}
          >
            ×
          </button>
          <h2 id={`${id}-title`} className="acceso__title">
            {title}
          </h2>
          <ol className="acceso__steps" aria-label={t('auth.steps', { n: current, total })}>
            {Array.from({ length: total }, (_, i) => (
              <li key={i} className={i < current ? 'is-done' : undefined} />
            ))}
          </ol>
        </header>
        <div className="acceso__body">{body}</div>
      </section>
    </div>
  );
}
