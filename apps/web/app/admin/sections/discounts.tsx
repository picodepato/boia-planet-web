'use client';

import {
  COMMON_DISCOUNT_CODE_MAX,
  type BoiaEvent,
  type Discount,
  discountStatus,
  withCommonCode,
} from '@boia/contracts';
import { useEffect, useState } from 'react';
import type { DiscountFormInput } from '../../../lib/admin/actions';
import { isoToLocal, localToIso } from '../../../lib/admin/dates';
import { discountHidingPlaces } from '../../../lib/admin/world';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import {
  Changed,
  DeleteButton,
  Field,
  ResetButton,
  SectionHead,
  StatusLine,
  TrashInline,
} from '../ui';
import { must, useAdminSupabase, useMaybeRealAdmin } from '../real/common';
import { t } from '../../../lib/i18n';

/** Valor del selector de destino: la tienda o un evento. */
const STORE = 'tienda';

const STATUS_LABEL = {
  active: 'vigente',
  upcoming: t('admin.discounts.todaviaNoVale'),
  expired: 'caducado',
};

interface Draft {
  code: string;
  label: string;
  /** `tienda` o el id del evento. */
  target: string;
  kind: 'percent' | 'amount';
  /** Porcentaje o euros, como se escribe. */
  value: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  hiddenAt: string;
  conditions: string;
  url: string;
}

function draftOf(d: Discount | null, events: readonly BoiaEvent[]): Draft {
  return {
    code: d?.code ?? '',
    label: d?.label ?? '',
    target: d ? (d.scope === 'store' ? STORE : (d.eventId ?? '')) : (events[0]?.id ?? STORE),
    kind: d?.kind ?? 'percent',
    value: d ? String(d.kind === 'amount' ? d.value / 100 : d.value) : '10',
    startsAt: isoToLocal(d?.startsAt),
    endsAt: isoToLocal(d?.endsAt),
    priority: String(d?.priority ?? 0),
    hiddenAt: d?.hiddenAt ?? '',
    conditions: d?.conditions ?? '',
    url: d?.url ?? '',
  };
}

/** El borrador del formulario, como lo guarda el Admin (`saveDiscount`). */
function inputOf(draft: Draft, base: Discount | null): DiscountFormInput {
  const value = Number(draft.value.replace(',', '.'));
  const store = draft.target === STORE;
  const startsAt = draft.startsAt ? localToIso(draft.startsAt) : null;
  const endsAt = draft.endsAt ? localToIso(draft.endsAt) : null;
  if (draft.startsAt && !startsAt) throw new Error('la fecha de inicio no es válida');
  if (draft.endsAt && !endsAt) throw new Error('la fecha de fin no es válida');
  return {
    ...(base ? { id: base.id, sample: base.sample } : {}),
    code: draft.code,
    label: draft.label,
    scope: store ? 'store' : 'event',
    ...(store || !draft.target ? {} : { eventId: draft.target }),
    kind: draft.kind,
    value: draft.kind === 'amount' ? Math.round(value * 100) : Math.round(value),
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
    priority: Math.round(Number(draft.priority) || 0),
    ...(draft.hiddenAt ? { hiddenAt: draft.hiddenAt } : {}),
    ...(draft.conditions.trim() ? { conditions: draft.conditions.trim() } : {}),
    ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
  };
}

function DiscountFields({
  ctx,
  draft,
  set,
  events,
  prefix,
}: {
  ctx: AdminContext;
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  events: readonly BoiaEvent[];
  prefix: string;
}) {
  const places = discountHidingPlaces(ctx.registry.map);
  return (
    <div className="admin-grid">
      <Field label={t('admin.discounts.codigo')} hint={t('admin.discounts.enMayusculasComoSe')}>
        <input
          value={draft.code}
          onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          data-testid={`${prefix}-codigo`}
        />
      </Field>
      <Field label={t('admin.discounts.textoDeLaTarjeta')}>
        <input
          value={draft.label}
          onChange={(e) => set({ label: e.target.value })}
          data-testid={`${prefix}-texto`}
        />
      </Field>
      <Field label={t('admin.discounts.para')} hint={t('admin.discounts.unEventoLlevaIr')}>
        <select
          value={draft.target}
          onChange={(e) => set({ target: e.target.value })}
          data-testid={`${prefix}-destino`}
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {t('admin.discounts.entradas', { name: e.name })}
            </option>
          ))}
          <option value={STORE}>{t('admin.discounts.tienda')}</option>
        </select>
      </Field>
      <Field label={t('admin.discounts.tipo')}>
        <select
          value={draft.kind}
          onChange={(e) => set({ kind: e.target.value as Draft['kind'] })}
          data-testid={`${prefix}-tipo`}
        >
          <option value="percent">{t('admin.discounts.porcentaje')}</option>
          <option value="amount">{t('admin.discounts.importe')}</option>
        </select>
      </Field>
      <Field
        label={
          draft.kind === 'percent' ? t('admin.discounts.porcentaje2') : t('admin.discounts.euros')
        }
      >
        <input
          inputMode="decimal"
          value={draft.value}
          onChange={(e) => set({ value: e.target.value })}
          data-testid={`${prefix}-valor`}
        />
      </Field>
      <Field label={t('admin.discounts.prioridad')} hint={t('admin.discounts.siValenVariosEn')}>
        <input
          type="number"
          min={0}
          max={100}
          value={draft.priority}
          onChange={(e) => set({ priority: e.target.value })}
          data-testid={`${prefix}-prioridad`}
        />
      </Field>
      <Field label={t('admin.discounts.desdeOpcional')}>
        <input
          type="datetime-local"
          value={draft.startsAt}
          onChange={(e) => set({ startsAt: e.target.value })}
        />
      </Field>
      <Field label={t('admin.discounts.hastaOpcional')}>
        <input
          type="datetime-local"
          value={draft.endsAt}
          onChange={(e) => set({ endsAt: e.target.value })}
          data-testid={`${prefix}-hasta`}
        />
      </Field>
      <Field
        label={t('admin.discounts.escondidoEn')}
        hint={t('admin.discounts.dondeLoEncuentraQuien')}
      >
        <select
          value={draft.hiddenAt}
          onChange={(e) => set({ hiddenAt: e.target.value })}
          data-testid={`${prefix}-escondite`}
        >
          <option value="">{t('admin.discounts.dondeDigaElMapa')}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('admin.discounts.condicionesOpcional')}>
        <input value={draft.conditions} onChange={(e) => set({ conditions: e.target.value })} />
      </Field>
      {draft.target === STORE ? (
        <Field label={t('admin.discounts.enlaceDeLaTienda')} hint={t('admin.discounts.sinElElDe')}>
          <input type="url" value={draft.url} onChange={(e) => set({ url: e.target.value })} />
        </Field>
      ) : null}
    </div>
  );
}

function DiscountRow({
  ctx,
  discount,
  events,
  changed,
  common,
}: {
  ctx: AdminContext;
  discount: Discount;
  events: readonly BoiaEvent[];
  changed: boolean;
  /** El código común de la ticketera, si lo hay (plan 019 T215). */
  common?: string | undefined;
}) {
  const [draft, setDraft] = useState(() => draftOf(discount, events));
  const shown = withCommonCode(discount, common).code;
  const { status, busy, run } = useRun();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const state = discountStatus(discount, new Date());
  const target =
    discount.scope === 'store'
      ? 'tienda'
      : (events.find((e) => e.id === discount.eventId)?.name ??
        t('admin.discounts.cualquierEvento'));
  return (
    <li className="admin-card" data-testid={`descuento-${discount.id}`} data-estado={state}>
      <p className="admin-meta">
        <strong data-testid={`descuento-codigo-${discount.id}`}>{shown}</strong>
        {shown !== discount.code ? (
          <span data-testid={`descuento-propio-${discount.id}`}>
            {' '}
            {t('admin.discounts.common.own', { code: discount.code })}
          </span>
        ) : null}{' '}
        · {target} · {STATUS_LABEL[state]}{' '}
        {t('admin.discounts.prioridad2')} {discount.priority}
        {discount.hiddenAt
          ? t('admin.discounts.escondidoEn2', { hiddenAt: discount.hiddenAt })
          : ''}
        {discount.sample ? t('admin.discounts.muestra') : ''} <Changed on={changed} />
      </p>
      <DiscountFields
        ctx={ctx}
        draft={draft}
        set={set}
        events={events}
        prefix={`descuento-${discount.id}`}
      />
      <div className="admin-row">
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          onClick={() =>
            void run(() =>
              ctx.actions.saveDiscount(
                inputOf(draft, discount),
                t('admin.discounts.editarDescuento'),
              ),
            )
          }
        >
          {t('admin.discounts.guardar')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy || state === 'expired'}
          data-testid={`descuento-${discount.id}-caducar`}
          onClick={() =>
            void run(async () => {
              const next = await ctx.actions.expireDiscount(discount.id);
              setDraft(draftOf(next, events));
            }, t('admin.discounts.caducadoQuienLoTenga'))
          }
        >
          {t('admin.discounts.caducarYa')}
        </button>
        <DeleteButton ctx={ctx} area="discounts" id={discount.id} />
      </div>
      <StatusLine status={status} />
    </li>
  );
}

/**
 * Descuentos (T43, REQ-COM-020, REQ-COM-036): crear, editar, caducar y
 * esconder códigos, ligados a un evento o a la tienda y con prioridad. Pasa
 * por los cambios del Admin de la demo (en este navegador) y queda en la
 * auditoría. Los códigos son inventados (`muestra`) hasta que Álvaro dé los
 * reales (P16).
 */
export function DiscountsSection({ ctx }: { ctx: AdminContext }) {
  const discounts = useRead(ctx, (r) => r.content.list('discounts'));
  const events = useRead(ctx, (r) => r.content.events());
  const settings = useRead(ctx, (r) => r.admin.settings());
  const changed = useRead(ctx, (r) => r.admin.overridden('discounts'));
  const [draft, setDraft] = useState<Draft | null>(null);
  const { status, busy, run } = useRun();
  if (!discounts || !events || !settings) return <p>{t('empty.loading')}</p>;
  const common = settings.commonDiscountCode;
  const listed = events.filter((e) => e.state !== 'draft');
  const form = draft ?? draftOf(null, listed);
  const changedSet = new Set(changed ?? []);
  return (
    <section>
      <SectionHead
        title={t('admin.discounts.descuentos')}
        lead={t('admin.discounts.codigosSeEscondenEn', { length: discounts.length })}
      >
        <ResetButton ctx={ctx} areas={['discounts']} />
      </SectionHead>
      <CommonCodeCard key={common ?? ''} ctx={ctx} current={common} />
      <form
        className="admin-card admin-form"
        data-testid="descuento-nuevo"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await ctx.actions.saveDiscount(
              inputOf(form, null),
              t('admin.discounts.nuevoDescuento'),
            );
            setDraft(null);
          }, t('admin.discounts.descuentoCreado'));
        }}
      >
        <h3>{t('admin.discounts.nuevoDescuento2')}</h3>
        <DiscountFields
          ctx={ctx}
          draft={form}
          set={(patch) => setDraft({ ...form, ...patch })}
          events={listed}
          prefix="descuento-nuevo"
        />
        <button
          type="submit"
          className="admin-button"
          disabled={busy}
          data-testid="descuento-nuevo-crear"
        >
          {t('admin.discounts.crear')}
        </button>
        <StatusLine status={status} />
      </form>
      <TrashInline ctx={ctx} area="discounts" />
      <ul className="admin-list" data-testid="descuentos-admin">
        {discounts.map((d) => (
          <DiscountRow
            key={JSON.stringify(d)}
            ctx={ctx}
            discount={d}
            events={listed}
            changed={changedSet.has(d.id)}
            common={common}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * El código común de la ticketera (plan 019 T215, decisión 7): fijado, todos
 * los descuentos de entradas enseñan ese código a la vez (por si la ticketera
 * cambia el oficial); vacío, cada uno el suyo. Los de la tienda no cambian.
 */
function CommonCodeCard({ ctx, current: local }: { ctx: AdminContext; current: string | undefined }) {
  // Con cuentas, el código común es el de la base de datos (`ticketing_settings`,
  // plan 019 T223): el que reciben quienes encontraron un descuento.
  const real = useMaybeRealAdmin();
  const sb = useAdminSupabase();
  const [remote, setRemote] = useState<string | null | undefined>(undefined);
  const current = real ? (remote ?? undefined) : local;
  const [code, setCode] = useState(current ?? '');
  const { status, busy, run } = useRun();
  useEffect(() => {
    if (!real || !sb) return;
    let alive = true;
    must(sb.from('ticketing_settings').select('common_discount_code').maybeSingle()).then(
      (r) => {
        if (!alive) return;
        setRemote(r?.common_discount_code ?? null);
        setCode(r?.common_discount_code ?? '');
      },
      (err: unknown) => console.warn('[boia] admin: código común', err),
    );
    return () => {
      alive = false;
    };
  }, [real, sb]);
  const save = (value: string) =>
    run(
      async () => {
        if (real) {
          if (!sb) throw new Error(t('admin.real.error.network'));
          await must(
            sb.rpc('admin_set_common_discount_code', {
              p_code: value,
              p_reason: t('admin.discounts.common.reason'),
            }),
          );
          setRemote(value.trim().toUpperCase() || null);
        }
        await ctx.actions.setCommonDiscountCode(value);
      },
      value.trim() ? t('admin.discounts.common.saved') : t('admin.discounts.common.cleared'),
    );
  return (
    <form
      className="admin-card admin-form"
      data-testid="descuento-comun"
      onSubmit={(e) => {
        e.preventDefault();
        void save(code);
      }}
    >
      <h3>{t('admin.discounts.common.title')}</h3>
      <Field label={t('admin.discounts.common.label')} hint={t('admin.discounts.common.hint')}>
        <input
          value={code}
          maxLength={COMMON_DISCOUNT_CODE_MAX}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          data-testid="descuento-comun-codigo"
        />
      </Field>
      <p className="admin-meta" data-testid="descuento-comun-estado">
        {current
          ? t('admin.discounts.common.active', { code: current })
          : t('admin.discounts.common.inactive')}
      </p>
      <div className="admin-row">
        <button
          type="submit"
          className="admin-button"
          disabled={busy}
          data-testid="descuento-comun-guardar"
        >
          {t('admin.discounts.common.save')}
        </button>
        {current ? (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid="descuento-comun-quitar"
            onClick={() => {
              setCode('');
              void save('');
            }}
          >
            {t('admin.discounts.common.clear')}
          </button>
        ) : null}
      </div>
      <StatusLine status={status} />
    </form>
  );
}
