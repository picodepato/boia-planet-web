'use client';

import type { GuestListSignup } from '@boia/store';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { CarnetIcon } from '../carnet-icon';
import {
  GUEST_LIST_NAME_MAX,
  GUEST_LIST_NAME_MIN,
  normalizeListName,
  type GuestListApi,
  type GuestListStatus,
} from '../guestlist';
import { guestListClient } from '../guestlist/client';
import { gameRepository } from '../repo';
import { signupUrl } from '../scanner/carnet-url';
import { isSupabaseConfigured } from '../supabase/config';
import { TicketNoticeDialog } from '../ticketing/box-office';
import { QuickCarnet } from '../ticketing/checkout';
import { type ListEvent, listDoorPrice, listNotice, listPhase } from './model';
import { signupLine, tl } from './t';
import './lista.css';

/**
 * El diálogo de la lista de una fiesta (plan 034 T309), el mismo en la
 * landing, la ficha y /mar. Pide el estado (`status`) y el Carnet de quien
 * mira y enseña una cosa:
 * - sin Carnet: hace falta (en la landing, el alta rápida aquí mismo; en el
 *   mar, Mi Carnet del mundo con `onCreateCarnet`; con cuentas, /carnet) y
 *   vuelve a la lista;
 * - con Carnet: el nombre de lista (el apodo, se puede cambiar) y «Apuntarme»;
 * - ya apuntado: la fecha y el nombre, el aviso de la hora y «Borrarme de la
 *   lista» (con confirmación);
 * - «Lista completa» o «Lista cerrada», sin botones de apuntarse ni borrarse.
 * No hay contador público.
 */

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'closed'; mine: GuestListSignup | null }
  | { kind: 'full' }
  | { kind: 'carnet'; step: 'notice' | 'form' }
  | { kind: 'join'; name: string; busy: boolean; error: string | null; left: boolean }
  | { kind: 'mine'; signup: GuestListSignup; asking: boolean; busy: boolean; error: string | null };

/** El estado del diálogo a partir del de la lista y del Carnet (sin React; lo prueban las unitarias). */
export function stateFor(
  status: GuestListStatus,
  nickname: string | null,
  left = false,
): Exclude<State, { kind: 'loading' } | { kind: 'error' }> {
  switch (listPhase(status, nickname !== null)) {
    case 'closed':
      return { kind: 'closed', mine: status.mine };
    case 'mine':
      return { kind: 'mine', signup: status.mine!, asking: false, busy: false, error: null };
    case 'full':
      return { kind: 'full' };
    case 'carnet':
      return { kind: 'carnet', step: 'notice' };
    case 'join':
      return { kind: 'join', name: nickname ?? '', busy: false, error: null, left };
  }
}

export function GuestListDialog({
  event,
  onClose,
  className,
  onCreateCarnet,
  client,
}: {
  event: ListEvent;
  onClose: () => void;
  /** Otra clase junto a `checkout` (en el mar, `checkout--mar`). */
  className?: string;
  /**
   * Sin Carnet, «Sacarme el Carnet» en el mar: Mi Carnet del mundo, que
   * vuelve aquí al crearlo. Sin él (la landing), el alta rápida aquí mismo.
   */
  onCreateCarnet?: () => void;
  /** Para las pruebas; por defecto, `guestListClient()`. */
  client?: GuestListApi | null;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Se vuelve a mirar la lista tras crear el Carnet o borrarse.
  const [attempt, setAttempt] = useState(0);
  const [left, setLeft] = useState(false);
  const [closesAt, setClosesAt] = useState(event.guestList?.closesAt ?? null);
  // Uno por diálogo (el de la demo o el de las RPC).
  const [api] = useState(() => (client === undefined ? guestListClient() : client));

  useEffect(() => {
    let alive = true;
    if (!api) {
      setState({ kind: 'error' });
      return;
    }
    Promise.all([api.status(event.slug), gameRepository().carnet.mine()])
      .then(([status, carnet]) => {
        if (!alive) return;
        setClosesAt(status.closesAt);
        setState(stateFor(status, carnet?.nickname ?? null, left));
      })
      .catch((err: unknown) => {
        console.warn('[boia] la lista', err);
        if (alive) setState({ kind: 'error' });
      });
    return () => {
      alive = false;
    };
    // `left` sólo cambia junto a `attempt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, event.slug, attempt]);

  const reload = (afterLeaving = false) => {
    setLeft(afterLeaving);
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (state.kind !== 'join' || state.busy || !api) return;
    // El nombre lo vuelven a mirar la demo y la base: aquí sólo se avisa antes.
    if (!normalizeListName(state.name, '')) {
      setState({ ...state, error: invalidName() });
      return;
    }
    setState({ ...state, busy: true, error: null });
    api.join(event.slug, state.name).then(
      (r) => {
        if (r.kind !== 'rejected') {
          setState({ kind: 'mine', signup: r.signup, asking: false, busy: false, error: null });
          return;
        }
        if (r.reason === 'invalid_name') setState({ ...state, busy: false, error: invalidName() });
        else if (r.reason === 'not_member' || r.reason === 'carnet_required')
          setState({ kind: 'carnet', step: 'notice' });
        else if (r.reason === 'full') setState({ kind: 'full' });
        else if (r.reason === 'closed' || r.reason === 'not_enabled')
          setState({ kind: 'closed', mine: null });
        else setState({ ...state, busy: false, error: tl('lista.failed') });
      },
      (err: unknown) => {
        console.warn('[boia] apuntarse en la lista', err);
        setState({ ...state, busy: false, error: tl('lista.failed') });
      },
    );
  };

  const leave = () => {
    if (state.kind !== 'mine' || state.busy || !api) return;
    setState({ ...state, busy: true, error: null });
    api.leave(event.slug).then(
      (r) => {
        if (r.kind === 'rejected') {
          if (r.reason === 'closed' || r.reason === 'not_enabled')
            setState({ kind: 'closed', mine: state.signup });
          else setState({ ...state, busy: false, asking: false, error: tl('lista.failed') });
          return;
        }
        reload(true);
      },
      (err: unknown) => {
        console.warn('[boia] borrarse de la lista', err);
        setState({ ...state, busy: false, asking: false, error: tl('lista.failed') });
      },
    );
  };

  const createCarnet = () => {
    if (onCreateCarnet) onCreateCarnet();
    // Con cuentas, el Carnet empieza por el email y su código: el alta de /carnet.
    else if (isSupabaseConfigured()) window.location.assign(signupUrl(window.location.origin));
    else setState({ kind: 'carnet', step: 'form' });
  };

  const notice = listNotice(closesAt, event.timeZone);
  const door = listDoorPrice(event);

  let body: ReactNode = null;
  let actions: ReactNode = null;
  switch (state.kind) {
    case 'loading':
      body = <p className="checkout__muted">{tl('lista.loading')}</p>;
      break;
    case 'error':
      body = (
        <p className="checkout__message" role="alert">
          {tl('lista.error')}
        </p>
      );
      break;
    case 'closed':
      body = (
        <div role="status" data-testid="lista-cerrada">
          <p className="checkout__offer-title">{tl('lista.closed')}</p>
          {state.mine ? (
            <p data-testid="lista-mia">{signupLine(state.mine, event.timeZone)}</p>
          ) : (
            <p>{tl('lista.closed.body')}</p>
          )}
        </div>
      );
      break;
    case 'full':
      body = (
        <div role="status" data-testid="lista-completa">
          <p className="checkout__offer-title">{tl('lista.full')}</p>
          <p>{tl('lista.full.body')}</p>
        </div>
      );
      break;
    case 'carnet':
      if (state.step === 'form') {
        body = (
          <QuickCarnet
            submitLabel={tl('lista.carnet.createAndBack')}
            onCreated={() => reload()}
            onBack={() => setState({ kind: 'carnet', step: 'notice' })}
          />
        );
      } else {
        body = (
          <div className="checkout__offer" role="status" data-testid="lista-carnet">
            <p className="checkout__offer-title">
              <CarnetIcon /> {tl('lista.carnet.title')}
            </p>
            <p>{tl('lista.carnet.body')}</p>
          </div>
        );
        actions = (
          <button
            type="button"
            className="checkout__confirm"
            data-testid="lista-crear-carnet"
            onClick={createCarnet}
          >
            {tl('lista.carnet.create')}
          </button>
        );
      }
      break;
    case 'join':
      body = (
        <form id="lista-form" className="checkout__carnet-form" onSubmit={join}>
          {state.left ? (
            <p role="status" data-testid="lista-borrado">
              {tl('lista.left')}
            </p>
          ) : null}
          <label>
            <span>{tl('lista.name.label')}</span>
            <input
              name="lista-nombre"
              data-testid="lista-nombre"
              value={state.name}
              maxLength={GUEST_LIST_NAME_MAX}
              autoComplete="nickname"
              onChange={(e) => setState({ ...state, name: e.target.value, error: null })}
            />
          </label>
          <p className="checkout__muted">
            {tl('lista.name.hint', { min: GUEST_LIST_NAME_MIN, max: GUEST_LIST_NAME_MAX })}
          </p>
          {state.error ? (
            <p className="checkout__message" role="alert" data-testid="lista-error">
              {state.error}
            </p>
          ) : null}
        </form>
      );
      actions = (
        <button
          type="submit"
          form="lista-form"
          className="checkout__confirm"
          data-testid="lista-confirmar"
          disabled={state.busy}
        >
          {state.busy ? tl('lista.confirming') : tl('lista.confirm')}
        </button>
      );
      break;
    case 'mine':
      body = (
        <div role="status" data-testid="lista-apuntado">
          <p className="checkout__offer-title">{tl('lista.mine.title')}</p>
          <p data-testid="lista-mia">{signupLine(state.signup, event.timeZone)}</p>
          {state.asking ? (
            <p className="lista__ask" data-testid="lista-borrar-pregunta">
              {tl('lista.leave.ask')}
            </p>
          ) : null}
          {state.error ? (
            <p className="checkout__message" role="alert" data-testid="lista-error">
              {state.error}
            </p>
          ) : null}
        </div>
      );
      actions = state.asking ? (
        <>
          <button
            type="button"
            className="checkout__confirm"
            data-testid="lista-borrar-si"
            disabled={state.busy}
            onClick={leave}
          >
            {state.busy ? tl('lista.leaving') : tl('lista.leave.yes')}
          </button>
          <button
            type="button"
            className="checkout__secondary"
            data-testid="lista-borrar-no"
            disabled={state.busy}
            onClick={() => setState({ ...state, asking: false })}
          >
            {tl('lista.leave.no')}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="checkout__secondary"
          data-testid="lista-borrar"
          onClick={() => setState({ ...state, asking: true, error: null })}
        >
          {tl('lista.leave')}
        </button>
      );
      break;
  }

  return (
    <TicketNoticeDialog
      title={event.name}
      onClose={onClose}
      className={className ? `lista ${className}` : 'lista'}
      testId="lista"
      closeLabel={tl('lista.close')}
      actions={actions}
    >
      <div data-estado={state.kind} data-testid="lista-cuerpo">
        {body}
        {door || notice ? (
          <div className="lista__door">
            {door ? (
              <p className="lista__price" data-testid="lista-precio">
                <strong>{door}</strong>
              </p>
            ) : null}
            {notice ? (
              <p className="lista__notice" data-testid="lista-aviso">
                {notice}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </TicketNoticeDialog>
  );
}

function invalidName(): string {
  return tl('lista.name.invalid', { min: GUEST_LIST_NAME_MIN, max: GUEST_LIST_NAME_MAX });
}
