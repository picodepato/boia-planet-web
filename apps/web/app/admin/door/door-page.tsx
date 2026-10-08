'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../../lib/i18n';
import { gameRepository } from '../../../lib/repo';
import { decodeFrame } from '../../../lib/scanner/decode';
import { type RealAdmin, when } from '../real/common';
import { useDoorSupabase } from './use-door';
import {
  type DoorBackend,
  type DoorOutcome,
  type DoorParty,
  currentParty,
  localDoor,
  outcomeText,
  realDoor,
  stampFromQr,
} from './backend';
import { DoorCamera } from './door-camera';
import { SignupQr } from './signup-qr';
import './door.css';

/**
 * /admin/puerta (plan 019 T218, decisión 11): el lector de la puerta para el
 * equipo, en el móvil. Se elige la fiesta, se abre la cámara y cada Carnet
 * que se le enseña (su QR) queda apuntado como asistencia y con el sello de
 * la fiesta. Debajo, por si la cámara no puede: pegar el enlace del Carnet o
 * leer una foto del QR. Y el QR de alta, para quien aún no tiene Carnet.
 *
 * Sin Supabase sella los Carnets de este navegador (la demo, D-20); con
 * cuentas, `staff_stamp` con la sesión del Admin (editor o más, con el
 * segundo paso). El camino de siempre (el socio escanea el QR de la fiesta)
 * sigue igual.
 */
export function DoorPage({ real, onSignOut }: { real?: RealAdmin; onSignOut?: () => void }) {
  const sb = useDoorSupabase(!!real);
  const backend = useMemo<DoorBackend | null>(() => {
    if (!real) return localDoor(gameRepository());
    return sb ? realDoor(sb) : null;
  }, [real, sb]);
  const [parties, setParties] = useState<DoorParty[] | null>(null);
  const [party, setParty] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [camera, setCamera] = useState(false);
  const [result, setResult] = useState<DoorOutcome | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend) return;
    let alive = true;
    backend.parties().then(
      (list) => {
        if (!alive) return;
        setParties(list);
        setParty((p) => p || currentParty(list)?.key || '');
      },
      (e: unknown) => alive && setLoadError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [backend]);

  const refreshCount = useCallback(async () => {
    if (!backend || !party) return;
    setCount(await backend.attendance(party).catch(() => null));
  }, [backend, party]);
  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  const handle = useCallback(
    async (text: string) => {
      if (!backend || !party) return;
      setBusy(true);
      try {
        const outcome = await stampFromQr(backend, text, party);
        setResult(outcome);
        await refreshCount();
      } finally {
        setBusy(false);
      }
    },
    [backend, party, refreshCount],
  );

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
    void handle(text).then(() => setTyped(''));
  };

  const readPhoto = async (file: File) => {
    const text = await qrFromImage(file);
    if (text) await handle(text);
    else setResult({ kind: 'notCarnet' });
  };

  const name = parties?.find((p) => p.key === party)?.name ?? '';

  return (
    <div className="admin puerta" data-testid="puerta" data-admin={real ? 'real' : 'demo'}>
      <header className="puerta-top">
        <h1>{t('puerta.title')}</h1>
        <nav className="puerta-top__links">
          <Link href="/admin#puerta" prefetch={false} data-testid="puerta-volver">
            {t('puerta.back')}
          </Link>
          {onSignOut ? (
            <button type="button" className="admin-link" onClick={onSignOut}>
              {t('admin.real.signOut')}
            </button>
          ) : null}
        </nav>
      </header>
      <main className="puerta-main">
        {real ? null : (
          <p className="puerta-nota" role="note" data-testid="puerta-aviso-local">
            {t('puerta.localNote')}
          </p>
        )}
        {loadError ? (
          <p className="admin-status admin-status--error" role="alert">
            {loadError}
          </p>
        ) : null}
        <label className="admin-field">
          <span className="admin-field__label">{t('puerta.party')}</span>
          <select
            value={party}
            disabled={!parties}
            onChange={(e) => {
              setParty(e.target.value);
              setResult(null);
            }}
            data-testid="puerta-fiesta"
          >
            {(parties ?? []).map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
                {p.startsAt ? ` · ${when(p.startsAt)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="puerta-cuenta" data-testid="puerta-cuenta" data-n={count ?? ''}>
          {count === null ? ' ' : t('puerta.count', { n: count, party: name })}
        </p>

        {camera ? (
          <>
            <DoorCamera onText={handle} />
            <button
              type="button"
              className="admin-button admin-button--ghost puerta-ancho"
              data-testid="puerta-cerrar-camara"
              onClick={() => setCamera(false)}
            >
              {t('puerta.closeCamera')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="admin-button puerta-ancho"
            disabled={!party}
            data-testid="puerta-abrir-camara"
            onClick={() => setCamera(true)}
          >
            {t('puerta.openCamera')}
          </button>
        )}

        <Result outcome={result} busy={busy} />

        <form className="puerta-manual" onSubmit={submitTyped}>
          <label className="admin-field">
            <span className="admin-field__label">{t('puerta.typed')}</span>
            <input
              value={typed}
              inputMode="url"
              autoComplete="off"
              placeholder="https://…/carnet/…"
              onChange={(e) => setTyped(e.target.value)}
              data-testid="puerta-enlace"
            />
          </label>
          <button
            type="submit"
            className="admin-button admin-button--ghost"
            disabled={busy || !party || !typed.trim()}
            data-testid="puerta-enlace-sellar"
          >
            {t('puerta.typedStamp')}
          </button>
        </form>
        <label className="admin-field">
          <span className="admin-field__label">{t('puerta.photo')}</span>
          <input
            type="file"
            accept="image/*"
            disabled={busy || !party}
            data-testid="puerta-foto"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void readPhoto(file);
            }}
          />
        </label>

        <section className="puerta-alta-bloque" aria-label={t('puerta.signup.title')}>
          <h2>{t('puerta.signup.title')}</h2>
          <p className="admin-meta">{t('puerta.signup.doorHint')}</p>
          <SignupQr compact />
        </section>
      </main>
    </div>
  );
}

function Result({ outcome, busy }: { outcome: DoorOutcome | null; busy: boolean }) {
  if (busy && !outcome) {
    return (
      <p className="puerta-resultado" role="status">
        {t('puerta.stamping')}
      </p>
    );
  }
  if (!outcome) return <p className="puerta-resultado is-vacio" role="status" />;
  const text = outcomeText(outcome);
  return (
    <p
      className={`puerta-resultado is-${outcome.kind}`}
      role={outcome.kind === 'granted' || outcome.kind === 'already' ? 'status' : 'alert'}
      data-testid="puerta-resultado"
      data-resultado={outcome.kind}
    >
      {text}
    </p>
  );
}

/** El texto del QR de una foto (la cámara del móvil o una captura). */
async function qrFromImage(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return await decodeFrame({ data: img.data, width: img.width, height: img.height });
  } catch {
    return null;
  }
}
