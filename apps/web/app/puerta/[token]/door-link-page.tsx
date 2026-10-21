'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserStorage, cleanDoorToken } from '../../../lib/door-links';
import { t } from '../../../lib/i18n';
import { gameRepository } from '../../../lib/repo';
import { browserSupabase } from '../../../lib/supabase/browser';
import type { DoorOutcome } from '../../admin/door/backend';
import { DoorPhoto, DoorScanner } from '../../admin/door/door-scanner';
import {
  type LinkDoor,
  linkStampFromQr,
  localLinkDoor,
  realLinkDoor,
} from '../../admin/door/links';
import '../../admin/door/door.css';

type LinkState =
  | { kind: 'checking' }
  | { kind: 'invalid' }
  | { kind: 'offline' }
  | { kind: 'ready'; title: string };

/**
 * /puerta/<código> (plan 034 T307): el lector de la puerta de una fiesta para
 * quien tenga el enlace, sin cuenta. Sólo escanear (la cámara o una foto del
 * QR): nada de sellar por apodo ni de datos del socio más allá del apodo y
 * el resultado, como el lector del equipo. Si el enlace se revoca o la
 * fiesta se cierra, deja de valer al momento.
 */
export function DoorLinkPage({ token: raw, real }: { token: string; real: boolean }) {
  const token = cleanDoorToken(raw);
  const door = useMemo<LinkDoor | null>(() => {
    if (!token) return null;
    if (!real) return localLinkDoor(gameRepository(), browserStorage(), token);
    const sb = browserSupabase();
    return sb ? realLinkDoor(sb, token) : null;
  }, [token, real]);
  const [state, setState] = useState<LinkState>({ kind: 'checking' });
  const [result, setResult] = useState<DoorOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!door) {
      setState({ kind: 'invalid' });
      return;
    }
    let alive = true;
    door.title().then(
      (title) => alive && setState(title ? { kind: 'ready', title } : { kind: 'invalid' }),
      () => alive && setState({ kind: 'offline' }),
    );
    return () => {
      alive = false;
    };
  }, [door]);

  const handle = useCallback(
    async (text: string) => {
      if (!door) return;
      setBusy(true);
      try {
        const outcome = await linkStampFromQr(door, text);
        setResult(outcome);
        if (outcome.kind === 'linkGone') setState({ kind: 'invalid' });
      } finally {
        setBusy(false);
      }
    },
    [door],
  );

  return (
    <div className="admin puerta" data-testid="puerta-enlace-pagina" data-estado={state.kind}>
      <header className="puerta-top">
        <h1>{t('puerta.link.title')}</h1>
      </header>
      <main className="puerta-main">
        {state.kind === 'checking' ? <p role="status">{t('puerta.link.checking')}</p> : null}
        {state.kind === 'offline' ? <p role="alert">{t('puerta.link.offline')}</p> : null}
        {state.kind === 'invalid' ? (
          <p className="puerta-nota" role="alert" data-testid="puerta-enlace-no-vale">
            {t('puerta.link.invalid')}
          </p>
        ) : null}
        {state.kind === 'ready' ? (
          <>
            {real ? null : (
              <p className="puerta-nota" role="note" data-testid="puerta-aviso-local">
                {t('puerta.link.localNote')}
              </p>
            )}
            <p className="puerta-cuenta" data-testid="puerta-enlace-fiesta">
              {state.title}
            </p>
            <p className="admin-meta">{t('puerta.link.hint')}</p>
            <DoorScanner onText={handle} outcome={result} busy={busy} photoOnly />
            <DoorPhoto
              onText={handle}
              onNoQr={() => setResult({ kind: 'notCarnet' })}
              disabled={busy}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
