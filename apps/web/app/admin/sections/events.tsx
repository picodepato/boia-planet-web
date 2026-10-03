'use client';

import {
  EVENT_FORMATS,
  EVENT_FORMAT_LABELS,
  EVENT_STATES,
  type BoiaEvent,
  type EventFormat,
  type EventState,
  type EventStateSource,
  effectiveEvents,
  eventState,
} from '@boia/contracts';
import { useState } from 'react';
import type { EventInput } from '../../../lib/admin/actions';
import { ADMIN_COPY } from '../../../lib/admin/copy';
import { DEFAULT_TIME_ZONE, isoToLocal, localToIso } from '../../../lib/admin/dates';
import { eventIslands, islandEvent, islandMemories } from '../../../lib/admin/world';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import {
  Changed,
  DeleteButton,
  DraftBar,
  Field,
  ResetButton,
  SectionHead,
  StatusLine,
  TrashInline,
} from '../ui';
import { t } from '../../../lib/i18n';

export const STATE_LABELS: Record<EventState, string> = {
  draft: t('admin.events.borrador'),
  coming_soon: t('admin.events.proximamente'),
  on_sale: t('admin.events.aLaVenta'),
  sold_out: t('admin.events.agotado'),
  postponed: t('admin.events.pospuesto'),
  cancelled: t('admin.events.cancelado'),
  finished: t('admin.events.finalizado'),
};

const SANDBOX_TICKETS = 'https://example.com/boia-sandbox/tickets';

export const SOURCE_LABELS: Record<EventStateSource, string> = {
  dates: t('admin.events.porFechas'),
  manual: t('admin.events.aMano'),
};

interface Draft {
  id?: string;
  slug?: string;
  name: string;
  format: EventFormat;
  series: string;
  startsAt: string;
  endsAt: string;
  saleOpensAt: string;
  placeLabel: string;
  state: EventState;
  stateSource: EventStateSource;
  stateNote: string;
  description: string;
  /** Una actividad por línea. */
  activities: string;
  posterUrl: string;
  /** Imagen del sello en el Carnet (T94); en la demo, una ruta o URL. */
  stampImageUrl: string;
  /** Precio en euros, como se escribe («12,50»). */
  price: string;
  priceSample: boolean;
  ticketUrl: string;
  islandId: string;
  artistIds: string[];
  sample?: boolean;
}

const EMPTY: Draft = {
  name: '',
  format: 'all_day',
  series: '',
  startsAt: '',
  endsAt: '',
  saleOpensAt: '',
  placeLabel: t('admin.events.alicante'),
  state: 'draft',
  stateSource: 'dates',
  stateNote: '',
  description: '',
  activities: '',
  posterUrl: '',
  stampImageUrl: '',
  price: '',
  priceSample: true,
  ticketUrl: '',
  islandId: '',
  artistIds: [],
};

const euros = (cents: number | undefined) =>
  cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');

/** «12,50» → 1250. null si no es un importe. */
export function centsOf(price: string): number | null {
  const m = price
    .trim()
    .replace(',', '.')
    .match(/^\d+(\.\d{1,2})?$/);
  return m ? Math.round(Number(m[0]) * 100) : null;
}

function draftOf(e: BoiaEvent): Draft {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    format: e.format,
    series: e.series ?? '',
    startsAt: isoToLocal(e.startsAt, e.timeZone),
    endsAt: isoToLocal(e.endsAt, e.timeZone),
    saleOpensAt: isoToLocal(e.saleOpensAt, e.timeZone),
    placeLabel: e.placeLabel,
    state: e.state,
    stateSource: e.stateSource,
    stateNote: e.stateNote ?? '',
    description: e.description,
    activities: e.activities.join('\n'),
    posterUrl: e.posterUrl ?? '',
    stampImageUrl: e.stampImageUrl ?? '',
    price: euros(e.priceCents),
    priceSample: e.priceSample,
    ticketUrl: e.ticketUrl ?? '',
    islandId: e.islandId ?? '',
    artistIds: e.artistIds,
    sample: e.sample,
  };
}

/** Fecha opcional del formulario → ISO con zona, o undefined; lanza si está mal escrita. */
function optionalIso(local: string, what: string): string | undefined {
  if (!local) return undefined;
  const iso = localToIso(local, DEFAULT_TIME_ZONE);
  if (!iso) throw new Error(`${what}: fecha no válida`);
  return iso;
}

function EventForm({
  ctx,
  initial,
  onDone,
}: {
  ctx: AdminContext;
  initial: Draft;
  onDone: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const artists = useRead(ctx, (r) => r.content.list('artists'));
  const { status, busy, run } = useRun();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const islands = eventIslands(ctx.registry.map);
  const worldName = (id: string) =>
    ctx.registry.get(ctx.registry.defaultId).places.find((p) => p.id === id)?.name ?? id;

  /** «Guardar y publicar» (se ve ya) o «Guardar borrador» (se ve al publicar, REQ-ADM-015). */
  const save = (mode: 'publish' | 'draft' = 'publish') =>
    run(
      async () => {
        const startsAt = localToIso(d.startsAt, DEFAULT_TIME_ZONE);
        if (!startsAt) throw new Error('falta la fecha y hora del evento');
        const endsAt = optionalIso(d.endsAt, 'fin');
        const saleOpensAt = optionalIso(d.saleOpensAt, t('admin.events.aperturaDeLaVenta'));
        const priceCents = d.price.trim() ? centsOf(d.price) : undefined;
        if (priceCents === null)
          throw new Error('precio: escribe un importe en euros, p. ej. 12,50');
        // Con apertura de venta y estado por fechas, se guarda «a la venta»: las
        // fechas enseñan «próximamente» hasta que abre (REQ-COM-004).
        const state =
          d.stateSource === 'dates' && saleOpensAt && d.state === 'coming_soon'
            ? 'on_sale'
            : d.state;
        const series = d.series.trim();
        const input: EventInput = {
          ...(d.id ? { id: d.id } : {}),
          ...(d.slug ? { slug: d.slug } : {}),
          name: d.name,
          format: d.format,
          startsAt,
          timeZone: DEFAULT_TIME_ZONE,
          placeLabel: d.placeLabel,
          state,
          stateSource: d.stateSource,
          description: d.description,
          artistIds: d.artistIds,
          activities: d.activities
            .split('\n')
            .map((a) => a.trim())
            .filter(Boolean),
          priceSample: d.priceSample,
          ...(series ? { series } : {}),
          ...(endsAt ? { endsAt } : {}),
          ...(saleOpensAt ? { saleOpensAt } : {}),
          ...(priceCents !== undefined ? { priceCents } : {}),
          ...(d.posterUrl.trim() ? { posterUrl: d.posterUrl.trim() } : {}),
          ...(d.stampImageUrl.trim() ? { stampImageUrl: d.stampImageUrl.trim() } : {}),
          ...(d.stateNote ? { stateNote: d.stateNote } : {}),
          ...(d.ticketUrl ? { ticketUrl: d.ticketUrl } : {}),
          ...(d.islandId ? { islandId: d.islandId } : {}),
          ...(d.sample !== undefined ? { sample: d.sample } : {}),
        };
        const why = d.id ? t('admin.events.editarEvento') : t('admin.events.nuevoEvento');
        if (mode === 'draft') await ctx.actions.saveEventDraft(input, why);
        else await ctx.actions.saveEvent(input, why);
        onDone();
      },
      mode === 'draft'
        ? t('admin.events.guardadoEnElBorrador')
        : t('admin.events.eventoGuardadoYPublicado'),
    );

  return (
    <form
      className="admin-card admin-form"
      data-testid="evento-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3>
        {d.id ? t('admin.events.editar', { name: initial.name }) : t('admin.events.nuevoEvento2')}
      </h3>
      <div className="admin-grid">
        <Field label={t('admin.events.nombre')}>
          <input
            required
            value={d.name}
            onChange={(e) => set('name', e.target.value)}
            data-testid="evento-nombre"
          />
        </Field>
        <Field label={t('admin.events.formato')} hint={t('admin.events.unSateliteSinIsla')}>
          <select
            value={d.format}
            onChange={(e) => set('format', e.target.value as EventFormat)}
            data-testid="evento-formato"
          >
            {EVENT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {EVENT_FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.events.serie')} hint={t('admin.events.claveEnMinusculasBoia')}>
          <input
            value={d.series}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            onChange={(e) => set('series', e.target.value)}
            data-testid="evento-serie"
          />
        </Field>
        <Field label={t('admin.events.fechaYHoraAlicante')}>
          <input
            type="datetime-local"
            required
            value={d.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
            data-testid="evento-fecha"
          />
        </Field>
        <Field label={t('admin.events.finOpcional')} hint={t('admin.events.sinFin12H')}>
          <input
            type="datetime-local"
            value={d.endsAt}
            onChange={(e) => set('endsAt', e.target.value)}
            data-testid="evento-fin"
          />
        </Field>
        <Field
          label={t('admin.events.aperturaDeLaVenta2')}
          hint={t('admin.events.antesProximamente')}
        >
          <input
            type="datetime-local"
            value={d.saleOpensAt}
            onChange={(e) => set('saleOpensAt', e.target.value)}
            data-testid="evento-apertura"
          />
        </Field>
        <Field label={t('admin.events.lugarPublico')} hint={t('admin.events.nuncaLaDireccionDe')}>
          <input
            required
            value={d.placeLabel}
            onChange={(e) => set('placeLabel', e.target.value)}
          />
        </Field>
        <Field label={t('admin.events.estado')}>
          <select
            value={d.state}
            onChange={(e) => set('state', e.target.value as EventState)}
            data-testid="evento-estado"
          >
            {EVENT_STATES.map((s) => (
              <option key={s} value={s}>
                {STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('admin.events.cambioDeEstado')}
          hint={t('admin.events.porFechasProximamenteA')}
        >
          <select
            value={d.stateSource}
            onChange={(e) => set('stateSource', e.target.value as EventStateSource)}
            data-testid="evento-origen-estado"
          >
            {(['dates', 'manual'] as const).map((src) => (
              <option key={src} value={src}>
                {SOURCE_LABELS[src]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('admin.events.notaDelEstado')}
          hint={t('admin.events.paraPospuestoOCancelado')}
        >
          <input value={d.stateNote} onChange={(e) => set('stateNote', e.target.value)} />
        </Field>
        <Field label={t('admin.events.islaDelEvento')} hint={ADMIN_COPY.islandKeepsMemories}>
          <select
            value={d.islandId}
            onChange={(e) => set('islandId', e.target.value)}
            data-testid="evento-isla"
          >
            <option value="">{t('admin.events.sinIsla')}</option>
            {islands.map((p) => (
              <option key={p.id} value={p.id}>
                {worldName(p.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.events.precio')} hint={t('admin.events.precioDeLaCompra')}>
          <input
            inputMode="decimal"
            value={d.price}
            placeholder="20,00"
            onChange={(e) => set('price', e.target.value)}
            data-testid="evento-precio"
          />
        </Field>
        <Field label={t('admin.events.precioDeMuestra')}>
          <input
            type="checkbox"
            checked={d.priceSample}
            onChange={(e) => set('priceSample', e.target.checked)}
          />
        </Field>
        <Field label={t('admin.events.cartelUrl')} hint={t('admin.events.vacioCartelProximamente')}>
          <input
            value={d.posterUrl}
            placeholder="https://… o /…"
            onChange={(e) => set('posterUrl', e.target.value)}
            data-testid="evento-cartel"
          />
        </Field>
        <Field label={t('admin.events.selloUrl')} hint={t('admin.events.selloUrlHint')}>
          <input
            value={d.stampImageUrl}
            placeholder="https://… o /…"
            onChange={(e) => set('stampImageUrl', e.target.value)}
            data-testid="evento-sello-imagen"
          />
        </Field>
        <Field
          label={t('admin.events.enlaceDeEntradas')}
          hint={t('admin.events.sandboxHastaQueHaya')}
        >
          <input
            type="url"
            value={d.ticketUrl}
            placeholder={`${SANDBOX_TICKETS}/…`}
            onChange={(e) => set('ticketUrl', e.target.value)}
            data-testid="evento-tickets"
          />
        </Field>
      </div>
      <Field label={t('admin.events.descripcion')}>
        <textarea
          rows={3}
          value={d.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </Field>
      <Field label={t('admin.events.actividades')} hint={t('admin.events.unaPorLinea')}>
        <textarea
          rows={3}
          value={d.activities}
          onChange={(e) => set('activities', e.target.value)}
          data-testid="evento-actividades"
        />
      </Field>
      <details className="admin-details">
        <summary>{t('admin.events.cartelArtistas', { length: d.artistIds.length })}</summary>
        <ul className="admin-checklist">
          {(artists ?? []).map((a) => (
            <li key={a.id}>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={d.artistIds.includes(a.id)}
                  onChange={(e) =>
                    set(
                      'artistIds',
                      e.target.checked
                        ? [...d.artistIds, a.id]
                        : d.artistIds.filter((x) => x !== a.id),
                    )
                  }
                />
                {a.name}
              </label>
            </li>
          ))}
        </ul>
      </details>
      <div className="admin-row">
        <button type="submit" className="admin-button" disabled={busy} data-testid="evento-guardar">
          {t('admin.events.guardarYPublicar')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid="evento-borrador"
          onClick={() => void save('draft')}
        >
          {t('admin.events.guardarBorrador')}
        </button>
        <button type="button" className="admin-button admin-button--ghost" onClick={onDone}>
          {t('carnet.cancel')}
        </button>
        {!d.id && !d.ticketUrl && d.name ? (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={() =>
              set(
                'ticketUrl',
                `${SANDBOX_TICKETS}/${encodeURIComponent(d.name.toLowerCase().replace(/\s+/g, '-'))}`,
              )
            }
          >
            {t('admin.events.usarEnlaceSandbox')}
          </button>
        ) : null}
      </div>
      <StatusLine status={status} />
    </form>
  );
}

/** Eventos (REQ-ADM-018): crear, duplicar, editar, estados a mano, isla, papelera. */
export function EventsSection({ ctx }: { ctx: AdminContext }) {
  // Lo que se edita es el borrador (lo publicado con los cambios sin publicar encima).
  const events = useRead(ctx, (r) => r.admin.draftList('events'));
  const changed = useRead(ctx, (r) => r.admin.overridden('events'));
  const pending = useRead(ctx, (r) => r.admin.pendingDrafts());
  const [editing, setEditing] = useState<Draft | null>(null);
  const { status, busy, run } = useRun();
  if (!events) return <p>{t('empty.loading')}</p>;
  const changedSet = new Set(changed ?? []);
  const drafts = new Map(
    (pending ?? []).flatMap((c) => (c.area === 'events' && c.id ? [[c.id, c.isNew]] : [])),
  );
  const now = new Date();
  const worldPlaces = ctx.registry.get(ctx.registry.defaultId).places;
  const current = effectiveEvents(events, now);
  const islandName = (id: string | undefined) =>
    id ? (worldPlaces.find((p) => p.id === id)?.name ?? id) : '—';

  return (
    <section>
      <SectionHead title={t('admin.events.eventos')} lead={t('admin.events.cadaEventoTieneUno')}>
        <button
          type="button"
          className="admin-button"
          data-testid="evento-nuevo"
          onClick={() => setEditing({ ...EMPTY })}
        >
          {t('admin.events.nuevoEvento2')}
        </button>
        <ResetButton ctx={ctx} areas={['events']} />
      </SectionHead>
      <DraftBar ctx={ctx} />
      {editing ? (
        <EventForm
          key={editing.id ?? 'nuevo'}
          ctx={ctx}
          initial={editing}
          onDone={() => setEditing(null)}
        />
      ) : null}
      <ul className="admin-list" data-testid="eventos">
        {events.map((e) => (
          <li key={e.id} className="admin-card" data-testid={`evento-${e.id}`}>
            <div className="admin-row admin-row--between">
              <div>
                <strong>{e.name}</strong> <Changed on={changedSet.has(e.id)} />
                {drafts.has(e.id) ? (
                  <span
                    className="admin-badge admin-badge--draft"
                    data-testid={`evento-en-borrador-${e.id}`}
                    title={t('admin.events.conCambiosSinPublicar')}
                  >
                    {drafts.get(e.id)
                      ? t('admin.events.borradorSinPublicar')
                      : t('admin.events.cambiosEnBorrador')}
                  </span>
                ) : null}
                <p className="admin-meta">
                  {t('admin.events.isla', {
                    v1: isoToLocal(e.startsAt, e.timeZone).replace('T', ' '),
                    placeLabel: e.placeLabel,
                    v3: ' ',
                    islandName: islandName(e.islandId),
                    v5: EVENT_FORMAT_LABELS[e.format],
                    v6: e.sample ? t('admin.events.muestra') : '',
                  })}
                </p>
                <p className="admin-meta" data-testid={`evento-ahora-${e.id}`}>
                  {t('admin.events.ahora', {
                    v1: STATE_LABELS[eventState(e, now)],
                    v2: SOURCE_LABELS[e.stateSource].toLowerCase(),
                  })}
                </p>
              </div>
              <label className="admin-field admin-field--inline">
                <span className="admin-field__label">{t('admin.events.estado')}</span>
                <select
                  value={e.state}
                  disabled={busy}
                  data-testid={`evento-estado-${e.id}`}
                  onChange={(ev) => {
                    // Cambiarlo aquí es corregirlo a mano: las fechas ya no lo tocan (REQ-COM-004).
                    // Se publica ya; si tiene borrador, el borrador lo recoge también.
                    const state = ev.target.value as EventState;
                    void run(() => ctx.actions.setEventStateManual(e.id, state));
                  }}
                >
                  {EVENT_STATES.map((s) => (
                    <option key={s} value={s}>
                      {STATE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-row">
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={() => setEditing(draftOf(e))}
                data-testid={`evento-editar-${e.id}`}
              >
                {t('admin.events.editar2')}
              </button>
              <button
                type="button"
                className="admin-button admin-button--ghost"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => ctx.actions.duplicateEvent(e.id),
                    t('admin.events.duplicadoComoBorrador'),
                  )
                }
              >
                {t('admin.events.duplicar')}
              </button>
              {drafts.has(e.id) && !drafts.get(e.id) ? (
                <button
                  type="button"
                  className="admin-button admin-button--ghost"
                  disabled={busy}
                  data-testid={`evento-descartar-${e.id}`}
                  onClick={() =>
                    void run(
                      () => ctx.actions.discardDrafts({ area: 'events', id: e.id }),
                      t('admin.events.borradorDescartadoQuedaLo'),
                    )
                  }
                >
                  {t('admin.events.descartarBorrador')}
                </button>
              ) : null}
              <DeleteButton
                ctx={ctx}
                area="events"
                id={e.id}
                label={
                  drafts.get(e.id)
                    ? t('admin.events.borrarBorrador')
                    : t('admin.events.aLaPapelera')
                }
              />
            </div>
          </li>
        ))}
      </ul>
      <TrashInline ctx={ctx} area="events" />
      <StatusLine status={status} />
      <h3>{t('admin.events.islasYEventos')}</h3>
      <p className="admin-lead">{ADMIN_COPY.islandKeepsMemories}</p>
      <ul className="admin-list" data-testid="islas-eventos">
        {eventIslands(ctx.registry.map).map((p) => {
          const opens = islandEvent(p.id, current, now);
          const memories = islandMemories(p.id, current, now);
          return (
            <li key={p.id} className="admin-card" data-testid={`isla-${p.id}`}>
              <strong>{islandName(p.id)}</strong>
              <p className="admin-meta">
                {t('admin.events.abreAhora', {
                  v1: opens ? opens.name : t('admin.events.suPanelDeIsla'),
                })}
              </p>
              <p className="admin-meta">
                {t('admin.events.recuerdos', {
                  v1: ' ',
                  v2: memories.length
                    ? memories.map((m) => m.name).join(' · ')
                    : t('admin.events.ningunoTodavia'),
                })}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
