'use client';

import { useEffect, useId, useState } from 'react';
import { type MessageKey, t } from '../i18n';
import {
  type PickableProfile,
  claimedProfileIds,
  requestErrorKey,
  requestProfile,
  unclaimedProfiles,
} from './artist-request';
import { accountClient } from './session';

/**
 * «¿Eres uno de estos artistas?» (plan 031 T297): sale en la hoja de acceso
 * justo después de crear el Carnet con el enlace general de artistas. Las
 * fichas de /artistas sin reclamar, con búsqueda por nombre, y «No, soy
 * nuevo». Elegir una deja una SOLICITUD que revisa BOIA: nunca une.
 *
 * Se carga a demanda desde la hoja (`sign-in-sheet.tsx`): no pesa en nada
 * más.
 */

export type PickerView =
  | { kind: 'loading' }
  | {
      kind: 'choose';
      query: string;
      /** Las que casan con la búsqueda. */
      profiles: readonly PickableProfile[];
      /** Cuántas hay sin reclamar (sin buscar). */
      total: number;
      busy: boolean;
      error: MessageKey | null;
    }
  | { kind: 'sent'; name: string };

/** La vista, sin efectos (se prueba sola). */
export function ArtistPickerView({
  view,
  onQuery,
  onPick,
  onNew,
  onDone,
}: {
  view: PickerView;
  onQuery?: (q: string) => void;
  onPick?: (p: PickableProfile) => void;
  onNew?: () => void;
  onDone?: () => void;
}) {
  const id = useId();
  if (view.kind === 'loading') {
    return (
      <div data-testid="artista-selector" data-estado="loading">
        <p className="acceso-help">{t('carnet.request.loading')}</p>
      </div>
    );
  }
  if (view.kind === 'sent') {
    return (
      <div data-testid="artista-selector" data-estado="sent">
        <p className="acceso-welcome" role="status" data-testid="artista-solicitud-enviada">
          {t('carnet.request.sent', { name: view.name })}
        </p>
        <button
          type="button"
          className="acceso-primary"
          data-testid="artista-selector-seguir"
          onClick={onDone}
        >
          {t('auth.continue')}
        </button>
      </div>
    );
  }
  return (
    <div data-testid="artista-selector" data-estado="choose">
      <h3 className="acceso-label">{t('carnet.request.title')}</h3>
      {view.total === 0 ? (
        <p className="acceso-help" data-testid="artista-selector-vacio">
          {t('carnet.request.none')}
        </p>
      ) : (
        <>
          <p className="acceso-help">{t('carnet.request.lead')}</p>
          <label className="acceso-label" htmlFor={`${id}-buscar`}>
            {t('carnet.request.search')}
          </label>
          <input
            id={`${id}-buscar`}
            className="acceso-input"
            type="search"
            value={view.query}
            autoComplete="off"
            data-testid="artista-selector-buscar"
            onChange={(e) => onQuery?.(e.target.value)}
          />
          {view.profiles.length === 0 ? (
            <p className="acceso-help" data-testid="artista-selector-sin-resultados">
              {t('carnet.request.noMatch')}
            </p>
          ) : (
            <ul className="acceso-picker" aria-label={t('carnet.request.title')}>
              {view.profiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="acceso-ghost"
                    disabled={view.busy}
                    data-testid={`artista-selector-${p.id}`}
                    onClick={() => onPick?.(p)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="acceso-help">{t('carnet.request.review')}</p>
        </>
      )}
      {view.error ? (
        <p className="acceso-error" role="alert" data-testid="artista-selector-error">
          {t(view.error)}
        </p>
      ) : null}
      <button
        type="button"
        className="acceso-primary"
        disabled={view.busy}
        data-testid="artista-selector-nuevo"
        onClick={onNew}
      >
        {view.total === 0 ? t('auth.continue') : t('carnet.request.new')}
      </button>
    </div>
  );
}

/** Las fichas publicadas de /artistas (las del repositorio, como la lista). */
async function contentProfiles(): Promise<PickableProfile[]> {
  const { gameRepository } = await import('../repo');
  const home = await gameRepository().content.home();
  return home.artists.map((a) => ({ id: a.id, name: a.name }));
}

/**
 * El selector con sus datos: las fichas del contenido menos las ya unidas a
 * un Carnet. `onDone` cierra (tras «No, soy nuevo» o tras pedir una).
 */
export function ArtistPicker({ onDone }: { onDone: () => void }) {
  const [data, setData] = useState<{
    all: PickableProfile[];
    claimed: Set<string>;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const sb = await accountClient();
      const [all, claimed] = await Promise.all([
        contentProfiles().catch(() => [] as PickableProfile[]),
        sb ? claimedProfileIds(sb) : Promise.resolve(new Set<string>()),
      ]);
      if (alive) setData({ all, claimed });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pick = (p: PickableProfile) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void (async () => {
      const sb = await accountClient();
      const o = sb ? await requestProfile(sb, p) : ({ kind: 'offline' } as const);
      setBusy(false);
      if (o.kind === 'sent') setSent(o.request.profile_name);
      else if (o.kind === 'offline') setError('carnet.request.offline');
      else {
        setError(requestErrorKey(o.reason));
        // Si otro la ha reclamado entretanto, deja de ofrecerse.
        if (o.reason === 'profile_claimed') {
          setData((d) => (d ? { ...d, claimed: new Set([...d.claimed, p.id]) } : d));
        }
      }
    })();
  };

  let view: PickerView;
  if (sent !== null) view = { kind: 'sent', name: sent };
  else if (!data) view = { kind: 'loading' };
  else
    view = {
      kind: 'choose',
      query,
      profiles: unclaimedProfiles(data.all, data.claimed, query),
      total: unclaimedProfiles(data.all, data.claimed).length,
      busy,
      error,
    };
  return (
    <ArtistPickerView view={view} onQuery={setQuery} onPick={pick} onNew={onDone} onDone={onDone} />
  );
}
