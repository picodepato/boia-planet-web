'use client';

import type { BoiaRepository } from '@boia/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserStorage, doorLinkUrl } from '../../../lib/door-links';
import { t } from '../../../lib/i18n';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { when } from '../real/common';
import { type DoorBackend, type DoorParty, currentParty } from './backend';
import { type DoorLinkLive, type DoorLinksAdmin, localLinksAdmin, realLinksAdmin } from './links';

/**
 * «Enlace de la puerta» en «Puerta y sellos» (plan 034 T307): un enlace
 * secreto por fiesta que abre el lector sin cuenta. Se crea, se copia (sólo
 * al crearlo: la base guarda su hash) y se revoca; crear otro revoca el
 * anterior. No caduca: deja de valer al revocarlo o al archivar o cancelar la
 * fiesta.
 */
export function DoorLinks({
  backend,
  real,
  sb,
  repo,
}: {
  backend: DoorBackend;
  real: boolean;
  sb: BoiaSupabase | null;
  repo: BoiaRepository;
}) {
  const admin = useMemo<DoorLinksAdmin | null>(() => {
    if (!real) return localLinksAdmin(repo, browserStorage());
    return sb ? realLinksAdmin(sb) : null;
  }, [real, sb, repo]);
  const [parties, setParties] = useState<DoorParty[] | null>(null);
  const [party, setParty] = useState('');
  const [live, setLive] = useState<DoorLinkLive[] | null>(null);
  const [fresh, setFresh] = useState<{ party: string; url: string } | null>(null);
  const { status, busy, run } = useRun();
  const copier = useRun();

  useEffect(() => {
    let alive = true;
    void backend.parties().then((list) => {
      if (!alive) return;
      setParties(list);
      setParty((p) => p || currentParty(list)?.key || '');
    });
    return () => {
      alive = false;
    };
  }, [backend]);

  const refresh = useCallback(async () => {
    if (!admin) return;
    setLive(await admin.list());
  }, [admin]);
  useEffect(() => {
    void refresh().catch(() => setLive([]));
  }, [refresh]);

  const hasLive = live?.some((l) => l.party === party) ?? false;

  const create = () =>
    void run(async () => {
      if (!admin) return;
      const token = await admin.create(party);
      setFresh({ party, url: doorLinkUrl(window.location.origin, token) });
      await refresh();
    }, t('puerta.links.created'));

  const revoke = (target: string) =>
    void run(async () => {
      if (!admin) return;
      await admin.revoke(target);
      setFresh((f) => (f?.party === target ? null : f));
      await refresh();
    }, t('puerta.links.revoked'));

  return (
    <div data-testid="puerta-enlaces-gestion">
      <div className="admin-row">
        <label className="admin-field">
          <span className="admin-field__label">{t('puerta.party')}</span>
          <select
            value={party}
            disabled={!parties}
            onChange={(e) => setParty(e.target.value)}
            data-testid="puerta-enlace-fiesta-elegir"
          >
            {(parties ?? []).map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
                {p.startsAt ? ` · ${when(p.startsAt)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-button"
          disabled={busy || !admin || !party}
          data-testid="puerta-enlace-crear"
          onClick={create}
        >
          {hasLive ? t('puerta.links.recreate') : t('puerta.links.create')}
        </button>
      </div>

      {fresh ? (
        <div className="admin-row admin-row--end" data-testid="puerta-enlace-nuevo">
          <label className="admin-field">
            <span className="admin-field__label">{t('puerta.links.copyNow')}</span>
            <input readOnly value={fresh.url} data-testid="puerta-enlace-url" />
          </label>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            data-testid="puerta-enlace-copiar"
            onClick={() =>
              void copier.run(
                () => navigator.clipboard.writeText(fresh.url),
                t('puerta.links.copied'),
              )
            }
          >
            {t('puerta.links.copy')}
          </button>
          <StatusLine status={copier.status} />
        </div>
      ) : null}

      {live && live.length > 0 ? (
        <ul className="admin-list" data-testid="puerta-enlaces-vivos">
          {live.map((l) => (
            <li key={l.party} data-testid={`puerta-enlace-vivo-${l.party}`}>
              <span>{t('puerta.links.live', { party: l.title, date: when(l.createdAt) })}</span>{' '}
              <button
                type="button"
                className="admin-button admin-button--ghost"
                disabled={busy}
                data-testid={`puerta-enlace-revocar-${l.party}`}
                onClick={() => revoke(l.party)}
              >
                {t('puerta.links.revoke')}
              </button>
            </li>
          ))}
        </ul>
      ) : live ? (
        <p className="admin-meta" data-testid="puerta-enlaces-ninguno">
          {t('puerta.links.none')}
        </p>
      ) : null}
      <StatusLine status={status} />
    </div>
  );
}
