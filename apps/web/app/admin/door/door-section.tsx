'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { canManage } from '../../../lib/account/admin-auth';
import { t } from '../../../lib/i18n';
import { SectionHead, StatusLine } from '../ui';
import { type AdminContext, useRun } from '../use-admin';
import { useMaybeRealAdmin, when } from '../real/common';
import { useDoorSupabase } from './use-door';
import {
  type DoorBackend,
  type DoorMember,
  type DoorParty,
  currentParty,
  localDoor,
  outcomeText,
  realDoor,
} from './backend';
import { SignupQr } from './signup-qr';
import './door.css';

/**
 * «Puerta y sellos» del Admin (plan 019 T218, decisión 11): el QR de alta
 * para enseñar en la puerta, la entrada al lector de la puerta
 * (/admin/puerta) y «Sellar a mano» un Carnet cualquiera, con motivo. Sin
 * Supabase va sobre los Carnets de este navegador; con cuentas, sobre los
 * socios reales (`staff_stamp`; a mano pide el rol admin).
 */
export function DoorSection({ ctx }: { ctx: AdminContext }) {
  const real = useMaybeRealAdmin();
  const sb = useDoorSupabase(!!real);
  const backend = useMemo<DoorBackend | null>(() => {
    if (!real) return localDoor(ctx.repo);
    return sb ? realDoor(sb) : null;
  }, [real, sb, ctx.repo]);
  return (
    <section data-testid="puerta-seccion">
      <SectionHead title={t('puerta.section.title')} lead={t('puerta.section.lead')} />

      <div className="admin-card">
        <h3>{t('puerta.signup.title')}</h3>
        <p className="admin-meta">{t('puerta.signup.hint')}</p>
        <SignupQr />
      </div>

      <div className="admin-card">
        <h3>{t('puerta.section.scannerTitle')}</h3>
        <p className="admin-meta">{t('puerta.section.scannerHint')}</p>
        <Link
          className="admin-button"
          href="/admin/puerta"
          prefetch={false}
          data-testid="admin-puerta-abrir"
        >
          {t('puerta.section.openScanner')}
        </Link>
      </div>

      <div className="admin-card">
        <h3>{t('puerta.manual.title')}</h3>
        {real && !canManage(real.role) ? (
          <p className="admin-lead" data-testid="admin-real-editor">
            {t('admin.real.editorOnly')}
          </p>
        ) : backend ? (
          <ManualStamp backend={backend} revision={ctx.revision} />
        ) : (
          <p>{t('empty.loading')}</p>
        )}
      </div>
    </section>
  );
}

function ManualStamp({ backend, revision }: { backend: DoorBackend; revision: number }) {
  const [parties, setParties] = useState<DoorParty[] | null>(null);
  const [party, setParty] = useState('');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<DoorMember[] | null>(null);
  const [member, setMember] = useState('');
  const [reason, setReason] = useState('');
  const { status, busy, run } = useRun();

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

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      void backend.members(search).then(
        (list) => {
          if (!alive) return;
          setMembers(list);
          setMember((m) => (list.some((x) => x.userId === m) ? m : (list[0]?.userId ?? '')));
        },
        () => alive && setMembers([]),
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [backend, search, revision]);

  const stamp = () =>
    void run(async () => {
      const r = await backend.stamp(member, party, 'manual', reason.trim());
      if (r.kind === 'granted') {
        setReason('');
        return;
      }
      throw new Error(r.kind === 'error' ? r.message : outcomeText(r));
    }, t('puerta.manual.done'));

  return (
    <div data-testid="sellar-a-mano">
      <p className="admin-meta">{t('puerta.manual.hint')}</p>
      <div className="admin-grid">
        <label className="admin-field">
          <span className="admin-field__label">{t('puerta.party')}</span>
          <select
            value={party}
            onChange={(e) => setParty(e.target.value)}
            disabled={!parties}
            data-testid="sellar-fiesta"
          >
            {(parties ?? []).map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
                {p.startsAt ? ` · ${when(p.startsAt)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span className="admin-field__label">{t('puerta.manual.search')}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="sellar-buscar"
          />
        </label>
        <label className="admin-field">
          <span className="admin-field__label">{t('puerta.manual.member')}</span>
          <select
            value={member}
            onChange={(e) => setMember(e.target.value)}
            disabled={!members || members.length === 0}
            data-testid="sellar-socio"
          >
            {(members ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.memberNumber !== null
                  ? t('puerta.manual.memberNumber', { nickname: m.nickname, n: m.memberNumber })
                  : m.nickname}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.reason')}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('puerta.manual.reasonHint')}
            data-testid="sellar-motivo"
          />
        </label>
      </div>
      {members && members.length === 0 ? (
        <p className="admin-meta" data-testid="sellar-vacio">
          {t('puerta.manual.none')}
        </p>
      ) : null}
      <div className="admin-row">
        <button
          type="button"
          className="admin-button"
          disabled={busy || !party || !member || reason.trim().length < 3}
          data-testid="sellar-poner"
          onClick={stamp}
        >
          {t('puerta.manual.stamp')}
        </button>
      </div>
      <StatusLine status={status} />
    </div>
  );
}
