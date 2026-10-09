'use client';

import { NICKNAME_MAX, NICKNAME_MIN } from '@boia/contracts';
import type { PurchaseSource } from '@boia/contracts/analytics';
import { isStoreError } from '@boia/store';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { formatEventDate } from '../i18n/web';
import { draftFrom, saveCarnet } from '../mundo/carnet/carnet-editor';
import { gameRepository } from '../repo';
import { signupUrl } from '../scanner/carnet-url';
import { isSupabaseConfigured } from '../supabase/config';
import type {
  CheckoutEvent,
  CheckoutSession,
  PurchaseOutcome,
  TicketingAdapter,
} from './adapter';
import './checkout.css';
import './checkout-form.css';
import { CHECKOUT_COPY as C } from './copy';
import { DiscountBanner } from './discount-banner';
import { ticketing } from './index';
import { bannerInfo, formatEuros } from './pricing';
import { CarnetRequiredError } from './sandbox';

type State =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string; event: CheckoutEvent | null }
  /**
   * Sin Carnet no se compra (plan 019, decisión 1): `notice` dice que hace
   * falta y ofrece crearlo; `form`, el alta rápida aquí mismo (la landing).
   */
  | { kind: 'carnet'; step: 'notice' | 'form'; event: CheckoutEvent | null }
  | {
      kind: 'ready';
      session: CheckoutSession;
      busy: boolean;
      error: string | null;
    }
  | { kind: 'done'; session: CheckoutSession; outcome: PurchaseOutcome };

export type CarnetLink = { href: string } | { onOpen: () => void };

/**
 * Checkout de la compra de prueba (D-20, REQ-COM-035): el mismo en la landing,
 * el panel de Tickets y las islas de evento. Rotulado como prueba, con el
 * evento, el precio `muestra` y el descuento encontrado si vale. Al confirmar,
 * el adaptador añade el sello al Carnet (una vez por id de compra) y concede
 * el logro de la entrada; el resultado es el aviso.
 *
 * Es un <dialog> modal: Escape o tocar fuera lo cierran sin tocar lo de
 * debajo (el panel de Tickets o el mar).
 */
export function SandboxCheckout({
  eventId,
  onClose,
  onConfirmed,
  carnet,
  adapter,
  source,
  className,
  onCreateCarnet,
}: {
  eventId: string;
  onClose: () => void;
  onConfirmed?: (outcome: PurchaseOutcome, session: CheckoutSession) => void;
  carnet: CarnetLink;
  adapter?: TicketingAdapter;
  /** `world`: se compra dentro del mar 3D (T58); la analítica de la compra lo dice. */
  source?: PurchaseSource;
  /** Otra clase junto a `checkout` (en el mar, la hoja de abajo del HUD, T58). */
  className?: string;
  /**
   * «Crear Carnet» del aviso «Necesitas el Carnet BOIA» (plan 019, decisión
   * 1). En el mar abre Mi Carnet dentro del mundo y, al crearlo, vuelve a esta
   * compra; sin él (la landing), el alta rápida se hace aquí mismo y la compra
   * sigue.
   */
  onCreateCarnet?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Se vuelve a preparar la compra al crear el Carnet aquí.
  const [attempt, setAttempt] = useState(0);
  const confirming = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Escape: sólo cierra este diálogo (no el panel de Tickets de debajo ni el barco).
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog?.addEventListener('keydown', onKey);
    dialog?.addEventListener('cancel', onCancel);
    return () => {
      dialog?.removeEventListener('keydown', onKey);
      dialog?.removeEventListener('cancel', onCancel);
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (adapter ?? ticketing())
      .start(eventId, source ? { source } : undefined)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setState({ kind: 'ready', session: r.session, busy: false, error: null });
        else if (r.reason === 'carnet_required')
          setState({ kind: 'carnet', step: 'notice', event: r.event });
        else
          setState({
            kind: 'unavailable',
            message: r.reason === 'not_found' ? C.notFound : C.notOnSale,
            event: r.event,
          });
      })
      .catch((err: unknown) => {
        console.warn('[boia] compra de prueba', err);
        if (alive) setState({ kind: 'unavailable', message: C.loadFailed, event: null });
      });
    return () => {
      alive = false;
    };
  }, [eventId, adapter, source, attempt]);

  const confirm = async () => {
    if (state.kind !== 'ready' || confirming.current) return;
    const a = adapter ?? ticketing();
    if (!a.confirm) return;
    confirming.current = true;
    const { session } = state;
    setState({ ...state, busy: true, error: null });
    try {
      const outcome = await a.confirm(session);
      setState({ kind: 'done', session, outcome });
      onConfirmed?.(outcome, session);
    } catch (err: unknown) {
      if (err instanceof CarnetRequiredError) {
        setState({ kind: 'carnet', step: 'notice', event: session.event });
        return;
      }
      console.warn('[boia] compra de prueba', err);
      setState({ ...state, busy: false, error: C.failed });
    } finally {
      confirming.current = false;
    }
  };

  // Al pasar del aviso del Carnet a la compra (o volver), el botón que se
  // pulsó desaparece: el foco va al botón principal para que siga dentro del
  // diálogo (Escape cierra sólo esto, no el panel de debajo).
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current || (state.kind !== 'ready' && state.kind !== 'carnet')) return;
    const target =
      ref.current?.querySelector<HTMLElement>('.checkout__carnet-form input') ??
      ref.current?.querySelector<HTMLElement>('.checkout__confirm');
    if (!target) return;
    refocus.current = false;
    target.focus();
  }, [state]);

  const setCarnetStep = (step: 'notice' | 'form') => {
    refocus.current = true;
    if (state.kind === 'carnet') setState({ ...state, step });
  };
  const createCarnet = () => {
    if (onCreateCarnet) onCreateCarnet();
    // Con cuentas, el Carnet empieza por el email y su código (plan 019 T218,
    // decisión 11): el alta de /carnet, que lleva la hoja de acceso.
    else if (isSupabaseConfigured()) window.location.assign(signupUrl(window.location.origin));
    else setCarnetStep('form');
  };

  const event =
    state.kind === 'ready' || state.kind === 'done'
      ? state.session.event
      : state.kind === 'unavailable' || state.kind === 'carnet'
        ? state.event
        : null;

  return (
    <dialog
      ref={ref}
      className={className ? `checkout ${className}` : 'checkout'}
      data-testid="checkout"
      aria-labelledby="checkout-title"
      onClick={(e) => {
        // Toque en el fondo (fuera de la hoja): cierra.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="checkout__sheet">
        <p className="checkout__badge" data-testid="checkout-prueba">
          {C.kicker}
        </p>
        <h2 id="checkout-title" className="checkout__title">
          {C.title}
        </h2>
        {event ? (
          <div className="checkout__event">
            <p className="checkout__event-name" data-testid="checkout-evento">
              {event.name}
            </p>
            <p className="checkout__event-meta">
              {event.format} · {formatEventDate(event.startsAt, event.timeZone)} ·{' '}
              {event.placeAnnounced === false ? (
                <span data-testid="checkout-lugar-falta">{C.placeSoon}</span>
              ) : (
                event.placeLabel
              )}
            </p>
          </div>
        ) : null}

        {state.kind === 'loading' ? <p className="checkout__muted">{C.loading}</p> : null}

        {state.kind === 'unavailable' ? (
          <p className="checkout__message" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.kind === 'carnet' && state.step === 'notice' ? <CarnetRequired /> : null}

        {state.kind === 'carnet' && state.step === 'form' ? (
          <QuickCarnet
            onCreated={() => {
              refocus.current = true;
              setState({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
            onBack={() => setCarnetStep('notice')}
          />
        ) : null}

        {state.kind === 'ready' && state.session.quote.discount ? (
          <DiscountBanner info={bannerInfo(state.session.quote.discount)} />
        ) : null}

        {state.kind === 'ready' ? <QuoteTable session={state.session} /> : null}

        {state.kind === 'done' ? (
          <div className="checkout__result" data-testid="checkout-resultado" role="status">
            <p className="checkout__result-title">
              <span aria-hidden="true">✺ </span>
              {C.stamp[state.outcome.stamp]}
            </p>
            {state.outcome.achievement?.granted ? (
              <p data-testid="checkout-logro">{C.achievement(state.outcome.achievement.title)}</p>
            ) : null}
          </div>
        ) : null}

        <p className="checkout__notice" data-testid="checkout-aviso">
          {C.testNotice}
        </p>

        {state.kind === 'ready' && state.error ? (
          <p className="checkout__message" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="checkout__actions">
          {state.kind === 'carnet' && state.step === 'notice' ? (
            <button
              type="button"
              className="checkout__confirm"
              data-testid="checkout-crear-carnet"
              onClick={createCarnet}
            >
              {C.carnet.create}
            </button>
          ) : null}
          {state.kind === 'ready' ? (
            <button
              type="button"
              className="checkout__confirm"
              data-testid="checkout-confirmar"
              disabled={state.busy}
              onClick={() => void confirm()}
            >
              {state.busy ? C.confirming : C.confirm}
            </button>
          ) : null}
          {state.kind === 'done' ? (
            'href' in carnet ? (
              <a className="checkout__confirm" href={carnet.href} data-testid="checkout-carnet">
                {C.seeCarnet}
              </a>
            ) : (
              <button
                type="button"
                className="checkout__confirm"
                data-testid="checkout-carnet"
                onClick={carnet.onOpen}
              >
                {C.seeCarnet}
              </button>
            )
          ) : null}
          <button
            type="button"
            className="checkout__secondary"
            data-testid="checkout-cerrar"
            onClick={onClose}
          >
            {state.kind === 'done' ? C.close : C.cancel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** «Para comprar entradas necesitas el Carnet BOIA» (plan 019, decisión 1). */
function CarnetRequired() {
  return (
    <div className="checkout__offer" role="status" data-testid="checkout-carnet-requerido">
      <p className="checkout__offer-title">
        <span aria-hidden="true">🪪 </span>
        {C.carnet.requiredTitle}
      </p>
      <p>{C.carnet.requiredBody}</p>
    </div>
  );
}

/**
 * Alta rápida del Carnet dentro de la compra (T66, la landing): sólo el
 * apodo, con el avatar por defecto; el resto se completa luego en Mi Carnet.
 * Crea el mismo Carnet que el editor (con su logro) y la compra se vuelve a
 * preparar.
 */
function QuickCarnet({ onCreated, onBack }: { onCreated: () => void; onBack: () => void }) {
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    saveCarnet(gameRepository(), null, { ...draftFrom(null), nickname }, []).then(
      onCreated,
      (err: unknown) => {
        setError(isStoreError(err, 'conflict') ? C.carnet.nicknameTaken : C.carnet.failed);
        setBusy(false);
      },
    );
  };
  return (
    <form className="checkout__carnet-form" data-testid="checkout-carnet-form" onSubmit={submit}>
      <label>
        <span>{C.carnet.nickname}</span>
        <input
          name="apodo"
          data-testid="checkout-carnet-apodo"
          value={nickname}
          minLength={NICKNAME_MIN}
          maxLength={NICKNAME_MAX}
          required
          autoComplete="nickname"
          onChange={(e) => setNickname(e.target.value)}
        />
      </label>
      <p className="checkout__muted">{C.carnet.nicknameHint(NICKNAME_MIN, NICKNAME_MAX)}</p>
      {error ? (
        <p className="checkout__message" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="checkout__confirm"
        data-testid="checkout-carnet-guardar"
        disabled={busy}
      >
        {busy ? C.carnet.creating : C.carnet.createAndBack}
      </button>
      <button type="button" className="checkout__secondary" onClick={onBack}>
        {C.carnet.back}
      </button>
    </form>
  );
}

function QuoteTable({ session }: { session: CheckoutSession }) {
  const { quote } = session;
  return (
    <>
      <dl className="checkout__quote">
        <div>
          <dt>{C.ticketLine}</dt>
          <dd>{formatEuros(quote.unitCents * quote.quantity)}</dd>
        </div>
        {quote.discount ? (
          <div
            data-testid="checkout-descuento"
            data-discount-id={quote.discount.id}
            data-kind={quote.discount.kind}
          >
            <dt>
              {C.discountLine(quote.discount.code)}
              <span className="checkout__muted"> · {quote.discount.label}</span>
            </dt>
            <dd>−{formatEuros(quote.discount.cents)}</dd>
          </div>
        ) : null}
        <div className="checkout__total">
          <dt>{C.total}</dt>
          <dd data-testid="checkout-total">{formatEuros(quote.totalCents)}</dd>
        </div>
      </dl>
      {quote.discount ? null : (
        <p className="checkout__muted" data-testid="checkout-sin-descuento">
          {C.noDiscount}
        </p>
      )}
    </>
  );
}
