'use client';

import type { BoiaEvent, HomeBlock } from '@boia/contracts';
import { useState } from 'react';
import { HOME_CTA_KEYS, HOME_CTA_MAX } from '../../../lib/admin/actions';
import { ADMIN_PREVIEW_PATH } from '../../../lib/admin/copy';
import { isoToLocal, localToIso } from '../../../lib/admin/dates';
import { es } from '../../../lib/i18n/es';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import { Changed, DraftBar, Field, ResetButton, SectionHead, StatusLine } from '../ui';
import { t } from '../../../lib/i18n';

const BLOCK_LABELS: Record<HomeBlock['type'], string> = {
  hero: t('admin.home.portadaHero'),
  priority_event: t('admin.home.eventoPrioritario'),
  upcoming_events: t('island.upcoming.heading'),
  artists: t('admin.home.artistas'),
  // T65: la Filosofía se ve dentro del bloque Contacto; cada uno se edita aparte.
  philosophy: t('admin.home.filosofiaEnContacto'),
  photos: t('admin.home.fotos'),
  store: t('admin.home.tienda'),
  contact: t('admin.home.contactoConFilosofia'),
  footer: t('admin.home.pie'),
};

const CTA_DEFAULTS = { explore: es[HOME_CTA_KEYS.explore], tickets: es[HOME_CTA_KEYS.tickets] };
const SAVED_DRAFT = t('admin.home.guardadoEnElBorrador');

/** Marca de «en borrador, sin publicar». */
function InDraft({ on }: { on: boolean }) {
  return on ? (
    <span className="admin-badge admin-badge--draft" title={t('admin.home.cambiadoEnElBorrador')}>
      {t('admin.home.borrador')}
    </span>
  ) : null;
}

function Schedule({ ctx, block }: { ctx: AdminContext; block: HomeBlock }) {
  const [from, setFrom] = useState(isoToLocal(block.showFrom));
  const [until, setUntil] = useState(isoToLocal(block.showUntil));
  const { status, busy, run } = useRun();
  return (
    <details className="admin-details">
      <summary>{t('admin.home.programar')}</summary>
      <div className="admin-row">
        <Field label={t('admin.home.desde')}>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid={`bloque-desde-${block.id}`}
          />
        </Field>
        <Field label={t('admin.home.hasta')}>
          <input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            data-testid={`bloque-hasta-${block.id}`}
          />
        </Field>
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                ctx.actions.scheduleBlock(
                  block.id,
                  from ? localToIso(from) : null,
                  until ? localToIso(until) : null,
                ),
              SAVED_DRAFT,
            )
          }
        >
          {t('admin.home.guardarProgramacion')}
        </button>
      </div>
      <StatusLine status={status} />
    </details>
  );
}

/** Titular, subtítulo y los dos botones de la portada (REQ-ADM-017). */
function HeroTexts({
  ctx,
  block,
  texts,
}: {
  ctx: AdminContext;
  block: Extract<HomeBlock, { type: 'hero' }>;
  texts: Record<string, string>;
}) {
  const [title, setTitle] = useState(block.title);
  const [positioning, setPositioning] = useState(block.positioning);
  const [explore, setExplore] = useState(texts[HOME_CTA_KEYS.explore] ?? CTA_DEFAULTS.explore);
  const [tickets, setTickets] = useState(texts[HOME_CTA_KEYS.tickets] ?? CTA_DEFAULTS.tickets);
  const { status, busy, run } = useRun();
  return (
    <details className="admin-details" data-testid="portada">
      <summary>{t('admin.home.titularSubtituloYBotones')}</summary>
      <Field label={t('admin.home.titular')}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="portada-titular"
        />
      </Field>
      <Field label={t('admin.home.subtitulo')}>
        <input value={positioning} onChange={(e) => setPositioning(e.target.value)} />
      </Field>
      <div className="admin-grid">
        <Field
          label={t('admin.home.botonExplorar')}
          hint={t('admin.home.hastaCaracteresVacio', {
            HOME_CTA_MAX,
            explore: CTA_DEFAULTS.explore,
          })}
        >
          <input
            value={explore}
            maxLength={HOME_CTA_MAX}
            onChange={(e) => setExplore(e.target.value)}
            data-testid="cta-explorar"
          />
        </Field>
        <Field
          label={t('admin.home.botonTickets')}
          hint={t('admin.home.hastaCaracteresVacio2', {
            HOME_CTA_MAX,
            tickets: CTA_DEFAULTS.tickets,
          })}
        >
          <input
            value={tickets}
            maxLength={HOME_CTA_MAX}
            onChange={(e) => setTickets(e.target.value)}
            data-testid="cta-tickets"
          />
        </Field>
      </div>
      <button
        type="button"
        className="admin-button"
        disabled={busy}
        data-testid="portada-guardar"
        onClick={() =>
          void run(async () => {
            await ctx.actions.setHeroTexts(title, positioning);
            await ctx.actions.setHomeCtas({ explore, tickets }, CTA_DEFAULTS);
          }, SAVED_DRAFT)
        }
      >
        {t('admin.home.guardarEnElBorrador')}
      </button>
      <StatusLine status={status} />
    </details>
  );
}

/** Párrafos y verbos de la Filosofía, que se ven en la landing dentro de Contacto. */
function PhilosophyTexts({
  ctx,
  block,
}: {
  ctx: AdminContext;
  block: Extract<HomeBlock, { type: 'philosophy' }>;
}) {
  const [paragraphs, setParagraphs] = useState(block.paragraphs.join('\n\n'));
  const [verbs, setVerbs] = useState(block.verbs);
  const { status, busy, run } = useRun();
  const setVerb = (i: number, patch: Partial<(typeof verbs)[number]>) =>
    setVerbs(verbs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <details className="admin-details" data-testid="filosofia">
      <summary>{t('admin.home.filosofiaTextos')}</summary>
      <Field label={t('admin.home.filosofiaParrafos')}>
        <textarea
          rows={6}
          value={paragraphs}
          onChange={(e) => setParagraphs(e.target.value)}
          data-testid="filosofia-parrafos"
        />
      </Field>
      <p className="admin-meta">{t('admin.home.filosofiaVerbos')}</p>
      {verbs.map((v, i) => (
        <div className="admin-grid" key={i}>
          <Field label={t('admin.home.filosofiaVerbo', { n: i + 1 })}>
            <input
              value={v.verb}
              onChange={(e) => setVerb(i, { verb: e.target.value })}
              data-testid={`filosofia-verbo-${i}`}
            />
          </Field>
          <Field label={t('admin.home.filosofiaFrase', { n: i + 1 })}>
            <input
              value={v.text}
              onChange={(e) => setVerb(i, { text: e.target.value })}
              data-testid={`filosofia-frase-${i}`}
            />
          </Field>
        </div>
      ))}
      <button
        type="button"
        className="admin-button"
        disabled={busy}
        data-testid="filosofia-guardar"
        onClick={() =>
          void run(() => ctx.actions.setPhilosophy(paragraphs.split(/\n\s*\n/), verbs), SAVED_DRAFT)
        }
      >
        {t('admin.home.filosofiaGuardar')}
      </button>
      <StatusLine status={status} />
    </details>
  );
}

/** Eventos que no salen en «Próximos eventos» (REQ-ADM-017): excluir no borra. */
function Exclusions({
  ctx,
  block,
  events,
}: {
  ctx: AdminContext;
  block: Extract<HomeBlock, { type: 'upcoming_events' }>;
  events: readonly BoiaEvent[];
}) {
  const { status, busy, run } = useRun();
  const excluded = new Set(block.excludeEventIds);
  return (
    <details className="admin-details" data-testid="excluir-eventos">
      <summary>{t('admin.home.excluirEventos', { size: excluded.size })}</summary>
      <ul className="admin-checklist">
        {events.map((e) => (
          <li key={e.id}>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={excluded.has(e.id)}
                disabled={busy}
                data-testid={`excluir-${e.id}`}
                onChange={(ev) => {
                  const next = ev.target.checked
                    ? [...excluded, e.id]
                    : [...excluded].filter((x) => x !== e.id);
                  void run(() => ctx.actions.setExcludedEvents(next), SAVED_DRAFT);
                }}
              />
              {e.name}
            </label>
          </li>
        ))}
      </ul>
      <StatusLine status={status} />
    </details>
  );
}

/** Vista previa del borrador de la home en móvil o escritorio (REQ-ADM-015, REQ-ADM-017). */
function Preview({ revision }: { revision: number }) {
  const [mode, setMode] = useState<'movil' | 'escritorio' | null>(null);
  const size = mode === 'movil' ? { w: 390, h: 760 } : { w: 1280, h: 800 };
  const scale = mode === 'movil' ? 0.8 : 0.45;
  return (
    <div className="admin-preview">
      <div className="admin-row">
        <button
          type="button"
          className="admin-button admin-button--ghost"
          aria-pressed={mode === 'movil'}
          data-testid="vista-movil"
          onClick={() => setMode(mode === 'movil' ? null : 'movil')}
        >
          {t('admin.home.vistaPreviaMovil')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          aria-pressed={mode === 'escritorio'}
          data-testid="vista-escritorio"
          onClick={() => setMode(mode === 'escritorio' ? null : 'escritorio')}
        >
          {t('admin.home.vistaPreviaEscritorio')}
        </button>
      </div>
      {mode ? (
        <div
          className="admin-preview__frame"
          style={{ width: size.w * scale, height: size.h * scale }}
        >
          <iframe
            key={`${mode}-${revision}`}
            title={t('admin.home.vistaPrevia', { mode })}
            src={ADMIN_PREVIEW_PATH}
            width={size.w}
            height={size.h}
            style={{ transform: `scale(${scale})` }}
            data-testid="vista-previa"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Página principal (REQ-ADM-015, REQ-ADM-017): orden, mostrar u ocultar,
 * programar, portada y botones, evento prioritario y eventos excluidos. Todo
 * va al borrador: se ve en la vista previa y, en la web, al «Publicar».
 */
export function HomeSection({ ctx }: { ctx: AdminContext }) {
  const blocks = useRead(ctx, (r) => r.admin.draftList('homeBlocks'));
  const events = useRead(ctx, (r) => r.admin.draftList('events'));
  const texts = useRead(ctx, (r) => r.admin.draftTexts());
  const changed = useRead(ctx, (r) => r.admin.overridden('homeBlocks'));
  const pending = useRead(ctx, (r) => r.admin.pendingDrafts());
  const { status, busy, run } = useRun();
  if (!blocks || !events || !texts) return <p>{t('empty.loading')}</p>;
  const priority = blocks.find((b) => b.type === 'priority_event');
  const changedSet = new Set(changed ?? []);
  const drafted = new Set(
    (pending ?? []).filter((c) => c.area === 'homeBlocks' && c.id).map((c) => c.id),
  );
  const listed = events.filter((e) => e.state !== 'draft');

  return (
    <section aria-labelledby="admin-h-home">
      <SectionHead
        title={t('admin.home.paginaPrincipal')}
        lead={t('admin.home.ordenaMuestraUOculta')}
      >
        <ResetButton ctx={ctx} areas={['homeBlocks']} />
      </SectionHead>
      <DraftBar ctx={ctx} />
      <h3 id="admin-h-home" className="visually-hidden">
        {t('admin.home.bloques')}
      </h3>
      <ol className="admin-list" data-testid="bloques">
        {blocks.map((b, i) => (
          <li key={b.id} className="admin-card" data-testid={`bloque-${b.id}`}>
            <div className="admin-row admin-row--between">
              <strong>
                {i + 1}. {BLOCK_LABELS[b.type]} <Changed on={changedSet.has(b.id)} />{' '}
                <InDraft on={drafted.has(b.id)} />
              </strong>
              <span className="admin-row">
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={b.visible}
                    disabled={busy}
                    data-testid={`bloque-visible-${b.id}`}
                    onChange={(e) =>
                      void run(
                        () => ctx.actions.setBlockVisible(b.id, e.target.checked),
                        SAVED_DRAFT,
                      )
                    }
                  />
                  {t('admin.home.visible')}
                </label>
                <button
                  type="button"
                  className="admin-icon"
                  aria-label={t('admin.home.subir', { v1: BLOCK_LABELS[b.type] })}
                  disabled={busy || i === 0}
                  data-testid={`bloque-subir-${b.id}`}
                  onClick={() => void run(() => ctx.actions.moveBlock(b.id, -1), SAVED_DRAFT)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="admin-icon"
                  aria-label={t('admin.home.bajar', { v1: BLOCK_LABELS[b.type] })}
                  disabled={busy || i === blocks.length - 1}
                  data-testid={`bloque-bajar-${b.id}`}
                  onClick={() => void run(() => ctx.actions.moveBlock(b.id, 1), SAVED_DRAFT)}
                >
                  ↓
                </button>
              </span>
            </div>
            {b.showFrom || b.showUntil ? (
              <p className="admin-meta">
                {t('admin.home.programado', {
                  v1: b.showFrom ? `desde ${isoToLocal(b.showFrom).replace('T', ' ')}` : '',
                  v2: ' ',
                  v3: b.showUntil ? `hasta ${isoToLocal(b.showUntil).replace('T', ' ')}` : '',
                })}
              </p>
            ) : null}
            {b.type === 'priority_event' ? (
              <Field label={t('admin.home.eventoPrioritario')} hint={t('admin.home.siDejaDeEstar')}>
                <select
                  value={priority?.type === 'priority_event' ? (priority.eventId ?? '') : ''}
                  disabled={busy}
                  data-testid="evento-prioritario"
                  onChange={(e) =>
                    void run(
                      () => ctx.actions.setPriorityEvent(e.target.value || null),
                      SAVED_DRAFT,
                    )
                  }
                >
                  <option value="">{t('admin.home.elProximoALa')}</option>
                  {listed.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {b.type === 'hero' ? (
              <HeroTexts
                // Sin volver a montar al guardar: el formulario ya tiene lo guardado y su estado.
                key={b.id}
                ctx={ctx}
                block={b}
                texts={texts}
              />
            ) : null}
            {b.type === 'philosophy' ? <PhilosophyTexts key={b.id} ctx={ctx} block={b} /> : null}
            {b.type === 'upcoming_events' ? (
              <Exclusions ctx={ctx} block={b} events={listed} />
            ) : null}
            <Schedule key={`${b.showFrom}|${b.showUntil}`} ctx={ctx} block={b} />
          </li>
        ))}
      </ol>
      <StatusLine status={status} />
      <h3>{t('admin.home.vistaPreviaDelBorrador')}</h3>
      <Preview revision={ctx.revision} />
    </section>
  );
}
