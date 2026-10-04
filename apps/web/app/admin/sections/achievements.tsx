'use client';

import {
  ACHIEVEMENT_SCOPES,
  ACHIEVEMENT_TRIGGERS,
  type AchievementScope,
  type AchievementTrigger,
} from '@boia/contracts';
import type { AchievementDefinition, Cosmetic, Rank } from '@boia/store';
import { useState } from 'react';
import {
  type TriggerChoices,
  MINIGAMES,
  TRIGGER_LABELS,
  TRIGGER_PARAMS,
  paramsFromForm,
} from '../../../lib/admin/achievements';
import { ACHIEVEMENT_ICONS, type AchievementInput } from '../../../lib/admin/actions';
import { DEFAULT_TIME_ZONE, isoToLocal, localToIso } from '../../../lib/admin/dates';
import { circuitIds } from '../../../lib/admin/validate';
import { EMPTY_WORLD_CONTENT, composeLiveWorld } from '../../../lib/admin/world';
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
import { t as msg } from '../../../lib/i18n';

const int = (s: string) => {
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

const SCOPE_LABELS: Record<AchievementScope, string> = {
  global: msg('admin.achievements.globalTodosLosMundos'),
  season: msg('admin.achievements.deUnaTemporadaUn'),
};

/** Lo que se escribe en el formulario de un logro (todo texto). */
interface Form {
  id?: string;
  title: string;
  description: string;
  trigger: AchievementTrigger;
  params: Record<string, string>;
  points: string;
  coins: string;
  iconKey: string;
  cosmeticKey: string;
  scope: AchievementScope;
  seasonId: string;
  startsAt: string;
  endsAt: string;
  secret: boolean;
  active: boolean;
  /** Lo que el formulario no toca y se conserva (insignia, muestra). */
  keep: Partial<AchievementDefinition>;
}

const EMPTY: Form = {
  title: '',
  description: '',
  trigger: 'visit_island',
  params: { count: '3' },
  points: '10',
  coins: '5',
  iconKey: '',
  cosmeticKey: '',
  scope: 'global',
  seasonId: '',
  startsAt: '',
  endsAt: '',
  secret: false,
  active: true,
  keep: {},
};

function formOf(a: AchievementDefinition): Form {
  return {
    id: a.id,
    title: a.title,
    description: a.description ?? '',
    trigger: a.trigger,
    params: Object.fromEntries(
      Object.entries(a.triggerParams ?? {}).map(([k, v]) => [k, v === null ? '' : String(v)]),
    ),
    points: String(a.points),
    coins: String(a.coins),
    iconKey: a.iconKey ?? '',
    cosmeticKey: a.cosmeticKey ?? '',
    scope: a.scope,
    seasonId: a.seasonId ?? '',
    startsAt: isoToLocal(a.startsAt),
    endsAt: isoToLocal(a.endsAt),
    secret: a.secret,
    active: a.active,
    keep: {
      ...(a.badgeKey ? { badgeKey: a.badgeKey } : {}),
      sample: a.sample,
    },
  };
}

/** La condición en castellano: «Visitar islas · count 3». */
function conditionText(a: AchievementDefinition): string {
  const params = Object.entries(a.triggerParams ?? {})
    .map(([k, v]) => `${k} ${String(v)}`)
    .join(', ');
  return `${TRIGGER_LABELS[a.trigger]}${params ? ` (${params})` : ''}`;
}

function AchievementForm({
  ctx,
  initial,
  cosmetics,
  onDone,
}: {
  ctx: AdminContext;
  initial: Form;
  cosmetics: readonly Cosmetic[];
  onDone: () => void;
}) {
  const [f, setF] = useState<Form>(initial);
  const { status, busy, run } = useRun();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const world = composeLiveWorld(ctx.registry, ctx.registry.defaultId, EMPTY_WORLD_CONTENT).config;
  const choices: TriggerChoices = {
    circuits: circuitIds(world),
    games: MINIGAMES,
    worlds: ctx.registry.playableIds(),
  };
  const original = initial.id ? initial : null;
  const conditionChanged =
    original !== null &&
    (original.trigger !== f.trigger ||
      JSON.stringify(paramsFromForm(original.trigger, original.params)) !==
        JSON.stringify(paramsFromForm(f.trigger, f.params)));

  const save = () =>
    run(
      async () => {
        const points = int(f.points);
        const coins = int(f.coins);
        if (points === null || coins === null) throw new Error('puntos y monedas son enteros ≥ 0');
        const startsAt = f.startsAt ? localToIso(f.startsAt, DEFAULT_TIME_ZONE) : undefined;
        const endsAt = f.endsAt ? localToIso(f.endsAt, DEFAULT_TIME_ZONE) : undefined;
        if (f.startsAt && !startsAt) throw new Error('inicio: fecha no válida');
        if (f.endsAt && !endsAt) throw new Error('fin: fecha no válida');
        const input: AchievementInput = {
          ...f.keep,
          ...(f.id ? { id: f.id } : {}),
          title: f.title,
          trigger: f.trigger,
          triggerParams: paramsFromForm(f.trigger, f.params),
          points,
          coins,
          scope: f.scope,
          secret: f.secret,
          active: f.active,
          ...(f.description.trim() ? { description: f.description.trim() } : {}),
          ...(f.iconKey ? { iconKey: f.iconKey } : {}),
          ...(f.cosmeticKey ? { cosmeticKey: f.cosmeticKey } : {}),
          ...(f.scope === 'season' && f.seasonId ? { seasonId: f.seasonId } : {}),
          ...(startsAt ? { startsAt } : {}),
          ...(endsAt ? { endsAt } : {}),
        };
        const saved = await ctx.actions.saveAchievement(
          input,
          f.id ? msg('admin.achievements.editarLogro') : msg('admin.achievements.nuevoLogro'),
        );
        onDone();
        return saved;
      },
      conditionChanged
        ? msg('admin.achievements.guardadoComoVersionNueva')
        : msg('admin.achievements.logroGuardado'),
    );

  return (
    <form
      className="admin-card admin-form"
      data-testid="logro-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3>
        {f.id
          ? msg('admin.achievements.editar', { title: initial.title })
          : msg('admin.achievements.nuevoLogro2')}
      </h3>
      <div className="admin-grid">
        <Field label={msg('admin.achievements.titulo')}>
          <input
            required
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            data-testid="logro-titulo"
          />
        </Field>
        <Field
          label={msg('admin.achievements.condicion')}
          hint={msg('admin.achievements.delCatalogoSinLogica')}
        >
          <select
            value={f.trigger}
            onChange={(e) => {
              const trigger = e.target.value as AchievementTrigger;
              setF((x) => ({ ...x, trigger, params: {} }));
            }}
            data-testid="logro-condicion"
          >
            {ACHIEVEMENT_TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        {TRIGGER_PARAMS[f.trigger].map((p) => (
          <Field
            key={p.key}
            label={p.label}
            hint={
              p.kind === 'int'
                ? msg('admin.achievements.deA', { min: p.min, max: p.max })
                : undefined
            }
          >
            {p.kind === 'choice' ? (
              <select
                value={f.params[p.key] ?? ''}
                onChange={(e) => set('params', { ...f.params, [p.key]: e.target.value })}
                data-testid={`logro-param-${p.key}`}
              >
                <option value="">
                  {p.optional
                    ? msg('admin.achievements.cualquiera')
                    : msg('admin.achievements.elige')}
                </option>
                {choices[p.source].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                inputMode={p.kind === 'int' ? 'numeric' : 'text'}
                value={f.params[p.key] ?? ''}
                onChange={(e) => set('params', { ...f.params, [p.key]: e.target.value })}
                data-testid={`logro-param-${p.key}`}
              />
            )}
          </Field>
        ))}
        <Field label={msg('admin.achievements.puntos')}>
          <input
            inputMode="numeric"
            value={f.points}
            onChange={(e) => set('points', e.target.value)}
            data-testid="logro-puntos"
          />
        </Field>
        <Field label={msg('admin.achievements.monedas')}>
          <input
            inputMode="numeric"
            value={f.coins}
            onChange={(e) => set('coins', e.target.value)}
            data-testid="logro-monedas"
          />
        </Field>
        <Field label={msg('admin.achievements.icono')}>
          <select
            value={f.iconKey}
            onChange={(e) => set('iconKey', e.target.value)}
            data-testid="logro-icono"
          >
            <option value="">{msg('admin.achievements.sinIcono')}</option>
            {ACHIEVEMENT_ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>
        <Field label={msg('admin.achievements.premioCosmeticoOBarco')}>
          <select value={f.cosmeticKey} onChange={(e) => set('cosmeticKey', e.target.value)}>
            <option value="">{msg('admin.achievements.soloPuntosYMonedas')}</option>
            {cosmetics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.slot})
              </option>
            ))}
          </select>
        </Field>
        <Field label={msg('admin.achievements.ambito')}>
          <select
            value={f.scope}
            onChange={(e) => set('scope', e.target.value as AchievementScope)}
            data-testid="logro-ambito"
          >
            {ACHIEVEMENT_SCOPES.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        {f.scope === 'season' ? (
          <Field label={msg('admin.achievements.temporada')}>
            <select
              value={f.seasonId}
              onChange={(e) => set('seasonId', e.target.value)}
              data-testid="logro-temporada"
            >
              <option value="">{msg('admin.achievements.eligeUnMundo')}</option>
              {ctx.registry.list().map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={msg('admin.achievements.desdeOpcional')}>
          <input
            type="datetime-local"
            value={f.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
            data-testid="logro-desde"
          />
        </Field>
        <Field label={msg('admin.achievements.hastaOpcional')}>
          <input
            type="datetime-local"
            value={f.endsAt}
            onChange={(e) => set('endsAt', e.target.value)}
            data-testid="logro-hasta"
          />
        </Field>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          {msg('admin.achievements.activoDesactivarSoloEvita')}
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={f.secret}
            onChange={(e) => set('secret', e.target.checked)}
          />
          {msg('admin.achievements.secretoHastaConseguirlo')}
        </label>
      </div>
      <Field label={msg('admin.achievements.descripcion')}>
        <input value={f.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      {conditionChanged ? (
        <p className="admin-meta" data-testid="logro-version-aviso">
          {msg('admin.achievements.cambiasLaCondicionSe')}
        </p>
      ) : null}
      <div className="admin-row">
        <button type="submit" className="admin-button" disabled={busy} data-testid="logro-guardar">
          {msg('admin.achievements.guardarLogro')}
        </button>
        <button type="button" className="admin-button admin-button--ghost" onClick={onDone}>
          {msg('carnet.cancel')}
        </button>
      </div>
      <StatusLine status={status} />
    </form>
  );
}

function AchievementRow({
  ctx,
  a,
  changed,
  onEdit,
}: {
  ctx: AdminContext;
  a: AchievementDefinition;
  changed: boolean;
  onEdit: () => void;
}) {
  const { status, busy, run } = useRun();
  return (
    <li className="admin-card" data-testid={`logro-${a.id}`}>
      <div className="admin-row admin-row--between">
        <div>
          <strong>{a.title}</strong> <Changed on={changed} />
          <p className="admin-meta">
            {msg('admin.achievements.v', {
              id: a.id,
              version: a.version,
              conditionText: conditionText(a),
            })}
          </p>
          <p className="admin-meta">
            {msg('admin.achievements.puntosMonedas', {
              points: a.points,
              coins: a.coins,
              v3: a.cosmeticKey
                ? msg('admin.achievements.premio', { cosmeticKey: a.cosmeticKey })
                : '',
              v4: a.iconKey ? msg('admin.achievements.icono2', { iconKey: a.iconKey }) : '',
              v5: ' ',
              v6: a.scope === 'season' ? `temporada ${a.seasonId ?? '?'}` : 'global',
              v7: a.startsAt
                ? msg('admin.achievements.desde', { v1: isoToLocal(a.startsAt).replace('T', ' ') })
                : '',
              v8: a.endsAt
                ? msg('admin.achievements.hasta', { v1: isoToLocal(a.endsAt).replace('T', ' ') })
                : '',
              v9: a.secret ? msg('admin.achievements.secreto') : '',
              v10: a.active ? '' : msg('admin.achievements.desactivado'),
            })}
          </p>
        </div>
        <span className="admin-row">
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={onEdit}
            data-testid={`logro-editar-${a.id}`}
          >
            {msg('admin.achievements.editar2')}
          </button>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid={`logro-duplicar-${a.id}`}
            onClick={() =>
              void run(
                () => ctx.actions.duplicateAchievement(a.id),
                msg('admin.achievements.duplicadoDesactivadoHastaRevisarlo'),
              )
            }
          >
            {msg('admin.achievements.duplicar')}
          </button>
          <DeleteButton ctx={ctx} area="achievements" id={a.id} />
        </span>
      </div>
      <StatusLine status={status} />
    </li>
  );
}

function CosmeticRow({ ctx, c, changed }: { ctx: AdminContext; c: Cosmetic; changed: boolean }) {
  const [name, setName] = useState(c.name);
  const [price, setPrice] = useState(c.priceCoins === null ? '' : String(c.priceCoins));
  const [active, setActive] = useState(c.active);
  const { status, busy, run } = useRun();
  return (
    <li className="admin-card" data-testid={`cosmetico-${c.id}`}>
      <p className="admin-meta">
        {c.id} {msg('admin.achievements.ranura')} {c.slot} <Changed on={changed} />
      </p>
      <div className="admin-grid">
        <Field label={msg('admin.achievements.nombre')}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label={msg('admin.achievements.precioEnMonedas')}
          hint={msg('admin.achievements.vacioSoloConUn')}
        >
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid={`cosmetico-precio-${c.id}`}
          />
        </Field>
        <label className="admin-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {msg('admin.achievements.activo')}
        </label>
      </div>
      <button
        type="button"
        className="admin-button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const p = price.trim() === '' ? null : int(price);
            if (price.trim() !== '' && p === null) throw new Error('el precio es un entero ≥ 0');
            await ctx.repo.admin.upsert(
              'cosmetics',
              { ...c, name, priceCoins: p, active },
              { reason: 'cosmético' },
            );
          })
        }
      >
        {msg('admin.achievements.guardar')}
      </button>
      <StatusLine status={status} />
    </li>
  );
}

function RankRow({ ctx, r, changed }: { ctx: AdminContext; r: Rank; changed: boolean }) {
  const [name, setName] = useState(r.name);
  const [min, setMin] = useState(String(r.minPoints));
  const { status, busy, run } = useRun();
  return (
    <li className="admin-card" data-testid={`rango-${r.id}`}>
      <div className="admin-row admin-row--end">
        <Field label={msg('admin.achievements.rango')}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={msg('admin.achievements.desdePuntos')}>
          <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
        </Field>
        <Changed on={changed} />
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const m = int(min);
              if (m === null) throw new Error('el umbral es un entero ≥ 0');
              await ctx.repo.admin.upsert(
                'ranks',
                { ...r, name, minPoints: m },
                { reason: 'rango' },
              );
            })
          }
        >
          {msg('admin.achievements.guardar')}
        </button>
      </div>
      <StatusLine status={status} />
    </li>
  );
}

/**
 * Logros y cosméticos (REQ-ADM-021, REQ-ADM-022, REQ-ADM-008): crear,
 * duplicar, editar y borrar logros con condición del catálogo, icono, ámbito
 * y fechas (cambiar la condición es una versión nueva); precios de
 * cosméticos y umbrales de rango.
 */
export function AchievementsSection({ ctx }: { ctx: AdminContext }) {
  const achievements = useRead(ctx, (r) => r.content.list('achievements'));
  const cosmetics = useRead(ctx, (r) => r.content.list('cosmetics'));
  const ranks = useRead(ctx, (r) => r.content.list('ranks'));
  const changedA = useRead(ctx, (r) => r.admin.overridden('achievements'));
  const changedC = useRead(ctx, (r) => r.admin.overridden('cosmetics'));
  const changedR = useRead(ctx, (r) => r.admin.overridden('ranks'));
  const [editing, setEditing] = useState<Form | null>(null);
  if (!achievements || !cosmetics || !ranks) return <p>{msg('empty.loading')}</p>;
  const key = (x: object) => JSON.stringify(x);
  return (
    <section>
      <SectionHead
        title={msg('admin.achievements.logrosYCosmeticos')}
        lead={msg('admin.achievements.lasCondicionesSonDel')}
      >
        <button
          type="button"
          className="admin-button"
          data-testid="logro-nuevo"
          onClick={() => setEditing({ ...EMPTY })}
        >
          {msg('admin.achievements.nuevoLogro2')}
        </button>
        <ResetButton ctx={ctx} areas={['achievements', 'cosmetics', 'ranks']} />
      </SectionHead>
      {editing ? (
        <AchievementForm
          key={editing.id ?? 'nuevo'}
          ctx={ctx}
          initial={editing}
          cosmetics={cosmetics}
          onDone={() => setEditing(null)}
        />
      ) : null}
      <h3>{msg('admin.achievements.logros')}</h3>
      <TrashInline ctx={ctx} area="achievements" />
      <ul className="admin-list" data-testid="logros-admin">
        {achievements.map((a) => (
          <AchievementRow
            key={key(a)}
            ctx={ctx}
            a={a}
            changed={(changedA ?? []).includes(a.id)}
            onEdit={() => setEditing(formOf(a))}
          />
        ))}
      </ul>
      <h3>{msg('admin.achievements.cosmeticosDelBarco')}</h3>
      <ul className="admin-list">
        {cosmetics.map((c) => (
          <CosmeticRow key={key(c)} ctx={ctx} c={c} changed={(changedC ?? []).includes(c.id)} />
        ))}
      </ul>
      <h3>{msg('admin.achievements.rangos')}</h3>
      <ul className="admin-list">
        {ranks.map((r) => (
          <RankRow key={key(r)} ctx={ctx} r={r} changed={(changedR ?? []).includes(r.id)} />
        ))}
      </ul>
    </section>
  );
}
