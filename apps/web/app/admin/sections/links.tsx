'use client';

import type { ExternalLink } from '@boia/contracts';
import { useState } from 'react';
import { LINKS_MAX, type LinkRow, linksView } from '../../../lib/admin/links';
import { MERCHANDISE_CONTACT } from '../../../lib/merchandise/catalog';
import { t } from '../../../lib/i18n';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import { DraftBar, Field, SectionHead, StatusLine } from '../ui';

const SAVED = t('admin.links.saved');

/** Filas editables de etiqueta + dirección, con añadir y quitar. */
function LinkRows({
  prefix,
  rows,
  onChange,
}: {
  prefix: string;
  rows: LinkRow[];
  onChange: (rows: LinkRow[]) => void;
}) {
  const set = (i: number, patch: Partial<LinkRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      <ol className="admin-list" data-testid={`${prefix}-filas`}>
        {rows.map((r, i) => (
          <li
            key={i}
            className="admin-row"
            role="group"
            aria-label={t('admin.links.row', { n: i + 1 })}
          >
            <Field label={t('admin.links.label')}>
              <input
                value={r.label}
                onChange={(e) => set(i, { label: e.target.value })}
                data-testid={`${prefix}-etiqueta-${i}`}
              />
            </Field>
            <Field label={t('admin.links.url')}>
              <input
                type="url"
                inputMode="url"
                value={r.url}
                onChange={(e) => set(i, { url: e.target.value })}
                data-testid={`${prefix}-url-${i}`}
              />
            </Field>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              aria-label={t('admin.links.remove', { label: r.label || String(i + 1) })}
              data-testid={`${prefix}-quitar-${i}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="admin-button admin-button--ghost"
        disabled={rows.length >= LINKS_MAX}
        data-testid={`${prefix}-anadir`}
        onClick={() => onChange([...rows, { label: '', url: '' }])}
      >
        {t('admin.links.add')}
      </button>
    </>
  );
}

const rowsOf = (links: readonly ExternalLink[]): LinkRow[] =>
  links.map((l) => ({ label: l.label, url: l.url }));

function StoreForm({
  ctx,
  contact,
  custom,
}: {
  ctx: AdminContext;
  contact: { handle: string; url: string };
  custom: boolean;
}) {
  const [handle, setHandle] = useState(custom ? contact.handle : '');
  const [url, setUrl] = useState(custom ? contact.url : '');
  const { status, busy, run } = useRun();
  return (
    <section className="admin-card" data-testid="enlaces-tienda" aria-labelledby="admin-h-l-store">
      <h3 id="admin-h-l-store">
        {t('admin.links.store')}{' '}
        {custom ? null : <span className="admin-badge">{t('admin.links.store.default')}</span>}
      </h3>
      <p className="admin-meta">
        {t('admin.links.store.hint', { handle: MERCHANDISE_CONTACT.handle })}
      </p>
      <div className="admin-row">
        <Field label={t('admin.links.store.handle')}>
          <input
            value={handle}
            placeholder={contact.handle}
            onChange={(e) => setHandle(e.target.value)}
            data-testid="tienda-usuario"
          />
        </Field>
        <Field label={t('admin.links.store.url')}>
          <input
            type="url"
            inputMode="url"
            value={url}
            placeholder={contact.url}
            onChange={(e) => setUrl(e.target.value)}
            data-testid="tienda-url"
          />
        </Field>
      </div>
      <button
        type="button"
        className="admin-button"
        disabled={busy}
        data-testid="tienda-guardar"
        onClick={() => void run(() => ctx.actions.setStoreContact(handle, url), SAVED)}
      >
        {t('admin.links.save')}
      </button>
      <StatusLine status={status} />
    </section>
  );
}

function ContactForm({
  ctx,
  email: savedEmail,
  links,
}: {
  ctx: AdminContext;
  email: string;
  links: readonly ExternalLink[];
}) {
  const [email, setEmail] = useState(savedEmail);
  const [rows, setRows] = useState(() => rowsOf(links));
  const { status, busy, run } = useRun();
  return (
    <section
      className="admin-card"
      data-testid="enlaces-contacto"
      aria-labelledby="admin-h-l-contact"
    >
      <h3 id="admin-h-l-contact">{t('admin.links.contact')}</h3>
      <Field label={t('admin.links.contact.email')} hint={t('admin.links.contact.email.hint')}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="contacto-correo"
        />
      </Field>
      <LinkRows prefix="contacto" rows={rows} onChange={setRows} />
      <button
        type="button"
        className="admin-button"
        disabled={busy}
        data-testid="contacto-guardar"
        onClick={() => void run(() => ctx.actions.setContactLinks(email, rows), SAVED)}
      >
        {t('admin.links.save')}
      </button>
      <StatusLine status={status} />
    </section>
  );
}

function FooterForm({ ctx, links }: { ctx: AdminContext; links: readonly ExternalLink[] }) {
  const [rows, setRows] = useState(() => rowsOf(links));
  const { status, busy, run } = useRun();
  return (
    <section className="admin-card" data-testid="enlaces-pie" aria-labelledby="admin-h-l-footer">
      <h3 id="admin-h-l-footer">{t('admin.links.footer')}</h3>
      <p className="admin-meta">{t('admin.links.footer.hint')}</p>
      <LinkRows prefix="pie" rows={rows} onChange={setRows} />
      <button
        type="button"
        className="admin-button"
        disabled={busy}
        data-testid="pie-guardar"
        onClick={() => void run(() => ctx.actions.setFooterLinks(rows), SAVED)}
      >
        {t('admin.links.save')}
      </button>
      <StatusLine status={status} />
    </section>
  );
}

/**
 * Enlaces de la tienda, el contacto y el pie sin código (plan 017 T192,
 * plan 007 propuesta, decisión 5). Va al borrador de la página principal,
 * como el resto de la home (REQ-ADM-015): se ve al «Publicar».
 */
export function LinksSection({ ctx }: { ctx: AdminContext }) {
  const blocks = useRead(ctx, (r) => r.admin.draftList('homeBlocks'));
  if (!blocks) return <p>{t('empty.loading')}</p>;
  const view = linksView(blocks);
  // Sin volver a montar al guardar: cada formulario ya tiene lo guardado y su estado.
  return (
    <section aria-label={t('admin.links.nav')}>
      <SectionHead title={t('admin.links.title')} lead={t('admin.links.lead')} />
      <DraftBar ctx={ctx} />
      {view.store ? (
        <StoreForm ctx={ctx} contact={view.store.contact} custom={view.store.custom} />
      ) : null}
      {view.contact ? (
        <ContactForm ctx={ctx} email={view.contact.email} links={view.contact.links} />
      ) : null}
      {view.footer ? <FooterForm ctx={ctx} links={view.footer.links} /> : null}
    </section>
  );
}
