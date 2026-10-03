'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { requireAccount } from '../../lib/account/gate';
import { useAccount } from '../../lib/account/use-account';
import { t } from '../../lib/i18n';
import { cardViewOf } from '../../lib/mundo/carnet/carnet-card';
import {
  type ClaimOutcome,
  type StampEvent,
  claimStamp,
  fallbackEvent,
  stampEvent,
} from '../../lib/mundo/carnet/claim';
import { eventMeta, outcomeCopy } from '../../lib/mundo/carnet/claim-copy';
import { IdCard } from '../../lib/mundo/carnet/id-card';
import { useCarnet } from '../../lib/mundo/carnet/use-carnet';
import { refreshMemberAccount } from '../../lib/repo';
import { type SelloCode, selloFromParams } from '../../lib/scanner/sello-url';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { MAR_PATH } from '../../lib/world-handoff';
import '../../lib/mundo/carnet/carnet.css';
import './sello.css';

/**
 * /sello (plan 008, T91; T87, marco 11): lo que abre la cámara del móvil al
 * leer el QR de la fiesta. Una página ligera en el lenguaje de la landing (no
 * el mar 3D: tiene que cargar rápido en una sala oscura con poca red).
 *
 * - Lee `e` y `c`, quita `c` de la barra (`history.replaceState`) para que
 *   un enlace copiado no lleve el código, y lo guarda en memoria.
 * - Comprobando → (sin cuenta: la hoja de acceso con el motivo `stamp`; al
 *   terminar, el sello se reclama solo) → sellado (el reverso con el sello
 *   cayendo y los puntos) o el error (fuera de hora, ya lo tienes, no vale,
 *   sin red).
 * - Modo local: el sello necesita la versión con cuentas.
 */

type State =
  | { name: 'checking' }
  | { name: 'guest' }
  | { name: 'done'; outcome: Extract<ClaimOutcome, { kind: 'granted' }> }
  | { name: 'error'; outcome: ClaimOutcome };

function readSello(): SelloCode | null {
  const params = new URLSearchParams(window.location.search);
  const sello = selloFromParams(params);
  if (params.has('c')) {
    params.delete('c');
    const q = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`,
    );
  }
  return sello;
}

export function SelloPage() {
  const [state, setState] = useState<State>({ name: 'checking' });
  const [event, setEvent] = useState<StampEvent | null>(null);
  const sello = useRef<SelloCode | null>(null);
  const running = useRef(false);
  const account = useAccount();

  const run = async () => {
    const s = sello.current;
    if (!s || running.current) return;
    running.current = true;
    setState({ name: 'checking' });
    try {
      const outcome = await claimStamp(s);
      if (outcome.kind === 'granted') setState({ name: 'done', outcome });
      else if (outcome.kind === 'cancelled') setState({ name: 'guest' });
      else setState({ name: 'error', outcome });
    } finally {
      running.current = false;
    }
  };

  useEffect(() => {
    const s = readSello();
    sello.current = s;
    if (!isSupabaseConfigured()) {
      setState({ name: 'error', outcome: { kind: 'local' } });
      return;
    }
    if (!s) {
      setState({ name: 'error', outcome: { kind: 'invalid', event: null } });
      return;
    }
    let live = true;
    void stampEvent(s.event).then((e) => {
      if (live) setEvent(e ?? fallbackEvent(s.event));
    });
    void run();
    return () => {
      live = false;
    };
    // Una vez, al abrir.
  }, []);

  // Mientras la hoja de acceso está abierta, el panel del invitado detrás.
  const waitingForAccount =
    state.name === 'checking' && (account.status === 'guest' || account.status === 'incomplete');
  const shown: State = waitingForAccount ? { name: 'guest' } : state;
  const headEvent =
    event ??
    (state.name === 'done' || state.name === 'error'
      ? 'event' in state.outcome && state.outcome.event
        ? state.outcome.event
        : null
      : null);

  return (
    <main className="sello-page" data-testid="sello-pagina" data-estado={shown.name}>
      <header className="carnet-page-head">
        <Link href="/" className="carnet-page-wm" aria-label="BOIA.PLANET" />
      </header>
      <div className="sello-inner">
        <p className="sello-label">{t('sello.label')}</p>
        <h1 data-testid="sello-fiesta">{headEvent?.name ?? ' '}</h1>
        {headEvent ? <p className="sello-meta">{eventMeta(headEvent)}</p> : null}

        {shown.name === 'checking' ? (
          <div className="sello-panel is-center" role="status">
            <span className="sello-spinner" aria-hidden="true" />
            <p>{t('sello.checking')}</p>
          </div>
        ) : null}

        {shown.name === 'guest' ? (
          <div className="sello-panel" data-testid="sello-invitado">
            <p className="sello-why">
              <span aria-hidden="true">✺</span> {t('sello.guest')}
            </p>
            {state.name === 'guest' ? (
              <button
                type="button"
                className="idc-btn sello-wide"
                data-testid="sello-entrar"
                onClick={() => {
                  void requireAccount('stamp', { event: headEvent?.name }).then((ok) => {
                    if (ok) void run();
                  });
                }}
              >
                {t('sello.signIn')}
              </button>
            ) : null}
          </div>
        ) : null}

        {shown.name === 'done' ? <Stamped outcome={shown.outcome} /> : null}

        {shown.name === 'error' ? <SelloError outcome={shown.outcome} /> : null}
      </div>
    </main>
  );
}

function Stamped({ outcome }: { outcome: Extract<ClaimOutcome, { kind: 'granted' }> }) {
  const { data } = useCarnet(null);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const card = data?.carnet ? cardViewOf(data.carnet, data.extras, origin) : null;
  const landed = !!card?.stamps.some((s) => s.eventId === outcome.event.slug);
  // Si la copia de la cuenta se leyó antes del sello, se vuelve a leer.
  const tries = useRef(0);
  useEffect(() => {
    if (landed || data === undefined || tries.current >= 10) return;
    const timer = setTimeout(() => {
      tries.current += 1;
      void refreshMemberAccount();
    }, 1500);
    return () => clearTimeout(timer);
  }, [landed, data]);
  return (
    <div className="sello-done" data-testid="sello-hecho">
      {card && landed ? (
        <div className="sello-card is-on-dark">
          <IdCard card={card} initialFace="back" fresh={outcome.event.slug} />
        </div>
      ) : (
        <div className="sello-panel is-center" role="status">
          <span className="sello-spinner" aria-hidden="true" />
        </div>
      )}
      <p className="sello-ok" role="status" data-testid="sello-aviso">
        {t('sello.done', { points: outcome.points })}
      </p>
      <Link className="idc-btn sello-wide" href="/carnet" data-testid="sello-ver-carnet">
        {t('sello.toCarnet')}
      </Link>
      <Link className="idc-btn is-ghost sello-wide" href={MAR_PATH}>
        {t('sello.toSea')}
      </Link>
    </div>
  );
}

function SelloError({ outcome }: { outcome: ClaimOutcome }) {
  const copy = outcomeCopy(outcome);
  return (
    <div className="sello-panel" role="alert" data-testid="sello-error" data-motivo={outcome.kind}>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <Link className="idc-btn is-ghost sello-wide" href="/">
        {t('sello.toHome')}
      </Link>
    </div>
  );
}
