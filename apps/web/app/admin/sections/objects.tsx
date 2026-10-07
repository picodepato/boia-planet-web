'use client';

import {
  ACHIEVEMENT_TRIGGERS,
  type AchievementTrigger,
  type ObjectBehavior,
  type ObjectTemplate,
  type WorldObjectRecord,
} from '@boia/contracts';
import { BEHAVIOR_CATALOG, type BehaviorType } from '@boia/world';
import { type MouseEvent, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { TRIGGER_LABELS } from '../../../lib/admin/achievements';
import {
  ASSET_ACCEPT,
  ASSET_RULE_KEYS,
  type AssetReport,
  type AssetRule,
  checkAsset,
  prepareAsset,
} from '../../../lib/admin/asset-validation';
import {
  OBJECT_CATEGORIES,
  OBJECT_CATEGORY_LABELS,
  categoryLabel,
  OBJECT_STEPS,
  OBJECT_STEP_LABELS,
  type ObjectWizard,
  type StepEnv,
  type WizardAction,
  allTemplates,
  behaviorParamsProblem,
  freeId,
  isLibraryAsset,
  libraryAsset,
  objectBehaviors,
  startWizard,
  stepProblem,
  wizardReducer,
} from '../../../lib/admin/objects';
import { putLocalPhoto } from '../../../lib/admin/photo-store';
import { t } from '../../../lib/i18n';
import { PhotoImage } from '../../../lib/photo-image';
import { MAR_PATH } from '../../../lib/world-handoff';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import { DeleteButton, Field, SectionHead, StatusLine } from '../ui';

/**
 * Objetos nuevos del mundo sin código (plan 017 T190): las plantillas
 * (REQ-ADM-011), los objetos creados y el asistente de 10 pasos
 * (REQ-ADM-010), con la validación de assets de REQ-ADM-012.
 */

/** Comportamientos que se eligen en el paso 6; ticket, logro, premio y destino van en el 8. */
const STEP_BEHAVIORS: BehaviorType[] = [
  'collision',
  'proximity',
  'dialogue',
  'collectible',
  'content',
  'spawn',
  'decorative',
];

const RULE_LABELS: Record<AssetRule, string> = {
  format: t('admin.objects.asset.rule.format'),
  extension: t('admin.objects.asset.rule.extension'),
  weight: t('admin.objects.asset.rule.weight'),
  dimensions: t('admin.objects.asset.rule.dimensions'),
};

const TEXT_KEYS = ['kicker', 'body'] as const;
const TEXT_LABELS: Record<(typeof TEXT_KEYS)[number], string> = {
  kicker: t('admin.world.antetitulo'),
  body: t('admin.world.textoDelPanel'),
};

const num = (v: string): number | undefined => {
  const n = Number(v.replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

const behaviorLabel = (type: string) => BEHAVIOR_CATALOG[type as BehaviorType]?.label ?? type;

/** Un lugar libre del mar para empezar: junto a la salida. */
function startPoint(ctx: AdminContext) {
  const s = ctx.registry.map.spawn;
  return { x: Math.round(s.x - 600), y: Math.round(s.y - 1200) };
}

// ---------------------------------------------------------------------------
// Mapa para colocar

function PlacePicker({
  ctx,
  draft,
  objects,
  onPick,
}: {
  ctx: AdminContext;
  draft: WorldObjectRecord;
  objects: readonly WorldObjectRecord[];
  onPick: (p: { x: number; y: number }) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const map = ctx.registry.map;
  const b = map.bounds;
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  const r = w / 120;
  const pick = (e: MouseEvent<SVGSVGElement>) => {
    const svg = ref.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const at = p.matrixTransform(m.inverse());
    onPick({ x: Math.round(at.x), y: Math.round(at.y) });
  };
  return (
    <svg
      ref={ref}
      className="admin-map admin-map--pick"
      viewBox={`${b.left} ${b.top} ${w} ${h}`}
      role="img"
      aria-label={t('admin.objects.place.mapLabel')}
      data-testid="objeto-mapa"
      onClick={pick}
    >
      <rect x={b.left} y={b.top} width={w} height={h} fill="#1f7a9c" />
      {map.places.map((p) => (
        <circle
          key={p.id}
          cx={p.position.x}
          cy={p.position.y}
          r={p.category === 'isla' ? r * 2 : r * 0.8}
          fill={p.category === 'isla' ? '#e8b04a' : '#dfe7ee'}
          opacity={0.7}
        />
      ))}
      {objects
        .filter((o) => o.id !== draft.id)
        .map((o) => (
          <circle key={o.id} cx={o.x} cy={o.y} r={r} fill="#d45cc4" />
        ))}
      {Number.isFinite(draft.x) && Number.isFinite(draft.y) ? (
        <circle
          cx={draft.x}
          cy={draft.y}
          r={r * 2.4}
          fill="none"
          stroke="#fff"
          strokeWidth={r * 0.7}
          data-testid="objeto-mapa-marca"
        />
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pasos

type Dispatch = (a: WizardAction) => void;

function StepAdd({ w, dispatch, env }: { w: ObjectWizard; dispatch: Dispatch; env: StepEnv }) {
  const [idTouched, setIdTouched] = useState(false);
  return (
    <div className="admin-grid">
      <Field label={t('admin.objects.field.name')}>
        <input
          value={w.draft.name}
          data-testid="objeto-nombre"
          onChange={(e) =>
            dispatch({
              type: 'name',
              name: e.target.value,
              ...(idTouched ? {} : { id: freeId(e.target.value, env.usedIds) }),
            })
          }
        />
      </Field>
      <Field label={t('admin.objects.field.id')} hint={t('admin.objects.field.idHint')}>
        <input
          value={w.draft.id}
          data-testid="objeto-id"
          spellCheck={false}
          onChange={(e) => {
            setIdTouched(true);
            dispatch({ type: 'name', name: w.draft.name, id: e.target.value.trim() });
          }}
        />
      </Field>
    </div>
  );
}

function StepCategory({ w, dispatch }: { w: ObjectWizard; dispatch: Dispatch }) {
  return (
    <>
      <Field label={t('admin.objects.field.category')} hint={t('admin.objects.category.hint')}>
        <select
          value={w.draft.category}
          data-testid="objeto-categoria"
          onChange={(e) => dispatch({ type: 'category', category: e.target.value })}
        >
          <option value="">{t('admin.objects.category.choose')}</option>
          {OBJECT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {OBJECT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function AssetRules({ report }: { report: AssetReport }) {
  return (
    <ul className="admin-rules" data-testid="asset-reglas" data-ok={report.ok ? 'si' : 'no'}>
      {ASSET_RULE_KEYS.map((rule) => {
        const c = report.checks.find((x) => x.rule === rule)!;
        return (
          <li key={rule} data-testid={`asset-regla-${rule}`} data-ok={c.ok ? 'si' : 'no'}>
            <strong>{c.ok ? '✓' : '✗'}</strong> {RULE_LABELS[rule]}
            {c.ok ? '' : ` — ${c.why}`}
          </li>
        );
      })}
    </ul>
  );
}

function StepAsset({ w, dispatch }: { w: ObjectWizard; dispatch: Dispatch }) {
  const [report, setReport] = useState<AssetReport | null>(null);
  const { status, busy, run } = useRun();
  const asset = w.draft.asset;
  const library = isLibraryAsset(asset);
  const upload = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const r = checkAsset(file.name, bytes);
    setReport(r);
    if (!r.ok) throw new Error(t('admin.objects.asset.rejected'));
    const prepared = await prepareAsset({ name: file.name, bytes, blob: file }, putLocalPhoto);
    dispatch({ type: 'asset', asset: prepared });
  };
  const thumb = asset.variants.at(-1) ?? asset.original;
  return (
    <div className="admin-form">
      <label className="admin-check">
        <input
          type="radio"
          name="objeto-asset"
          checked={library}
          data-testid="objeto-asset-biblioteca"
          onChange={() => {
            setReport(null);
            dispatch({ type: 'asset', asset: libraryAsset(w.draft.category) });
          }}
        />
        {t('admin.objects.asset.library', {
          category: categoryLabel(w.draft.category),
        })}
      </label>
      <Field label={t('admin.objects.asset.upload')} hint={t('admin.objects.asset.uploadHint')}>
        <input
          type="file"
          accept={ASSET_ACCEPT}
          disabled={busy}
          data-testid="objeto-asset-archivo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void run(() => upload(file), t('admin.objects.asset.saved'));
          }}
        />
      </Field>
      {report ? <AssetRules report={report} /> : null}
      <StatusLine status={status} />
      {!library ? (
        <div className="admin-row" data-testid="objeto-asset-subido">
          {thumb?.width && thumb.height ? (
            <PhotoImage
              className="admin-asset-thumb"
              photo={{
                src: thumb.ref,
                alt: asset.fileName ?? '',
                width: thumb.width,
                height: thumb.height,
              }}
            />
          ) : null}
          <p className="admin-meta">
            {t('admin.objects.asset.summary', {
              name: asset.fileName ?? '—',
              variants: asset.variants.length,
            })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StepPlace({
  ctx,
  w,
  dispatch,
  objects,
}: {
  ctx: AdminContext;
  w: ObjectWizard;
  dispatch: Dispatch;
  objects: readonly WorldObjectRecord[];
}) {
  return (
    <div className="admin-world">
      <div className="admin-form">
        <p className="admin-lead">{t('admin.objects.place.lead')}</p>
        <div className="admin-grid">
          <Field label="x">
            <input
              inputMode="decimal"
              value={Number.isFinite(w.draft.x) ? String(w.draft.x) : ''}
              data-testid="objeto-x"
              onChange={(e) =>
                dispatch({ type: 'place', x: num(e.target.value) ?? NaN, y: w.draft.y })
              }
            />
          </Field>
          <Field label="y">
            <input
              inputMode="decimal"
              value={Number.isFinite(w.draft.y) ? String(w.draft.y) : ''}
              data-testid="objeto-y"
              onChange={(e) =>
                dispatch({ type: 'place', x: w.draft.x, y: num(e.target.value) ?? NaN })
              }
            />
          </Field>
        </div>
      </div>
      <PlacePicker
        ctx={ctx}
        draft={w.draft}
        objects={objects}
        onPick={(p) => dispatch({ type: 'place', ...p })}
      />
    </div>
  );
}

function StepGeometry({
  ctx,
  w,
  dispatch,
}: {
  ctx: AdminContext;
  w: ObjectWizard;
  dispatch: Dispatch;
}) {
  const d = w.draft;
  const zones = useMemo(
    () =>
      [...new Set(ctx.registry.map.places.map((p) => p.position.zone).filter(Boolean))] as string[],
    [ctx.registry],
  );
  const optional = (v: string) => (v.trim() === '' ? undefined : (num(v) ?? NaN));
  return (
    <div className="admin-grid">
      <Field label={t('admin.objects.field.hitbox')} hint={t('admin.objects.field.hitboxHint')}>
        <input
          inputMode="decimal"
          value={d.hitbox === undefined ? '' : String(d.hitbox)}
          data-testid="objeto-huella"
          onChange={(e) =>
            dispatch({ type: 'geometry', patch: { hitbox: optional(e.target.value) } })
          }
        />
      </Field>
      <Field label={t('admin.objects.field.hitboxKind')}>
        <select
          value={d.hitboxKind}
          data-testid="objeto-huella-tipo"
          onChange={(e) =>
            dispatch({
              type: 'geometry',
              patch: { hitboxKind: e.target.value as WorldObjectRecord['hitboxKind'] },
            })
          }
        >
          <option value="collision">{t('admin.objects.field.hitboxCollision')}</option>
          <option value="activation">{t('admin.objects.field.hitboxActivation')}</option>
        </select>
      </Field>
      <Field label={t('admin.objects.field.proximity')}>
        <input
          inputMode="decimal"
          value={d.proximityRadius === undefined ? '' : String(d.proximityRadius)}
          data-testid="objeto-proximidad"
          onChange={(e) =>
            dispatch({ type: 'geometry', patch: { proximityRadius: optional(e.target.value) } })
          }
        />
      </Field>
      <Field label={t('admin.objects.field.zone')}>
        <select
          value={d.zone ?? ''}
          data-testid="objeto-zona"
          onChange={(e) =>
            dispatch({ type: 'geometry', patch: { zone: e.target.value || undefined } })
          }
        >
          <option value="">{t('admin.objects.field.noZone')}</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('admin.objects.field.safeX')} hint={t('admin.objects.field.safeHint')}>
        <input
          inputMode="decimal"
          value={d.safePoint ? String(d.safePoint.x) : ''}
          data-testid="objeto-seguro-x"
          onChange={(e) => {
            const x = optional(e.target.value);
            dispatch({
              type: 'geometry',
              patch: { safePoint: x === undefined ? undefined : { x, y: d.safePoint?.y ?? d.y } },
            });
          }}
        />
      </Field>
      <Field label={t('admin.objects.field.safeY')}>
        <input
          inputMode="decimal"
          value={d.safePoint ? String(d.safePoint.y) : ''}
          data-testid="objeto-seguro-y"
          onChange={(e) => {
            const y = optional(e.target.value);
            dispatch({
              type: 'geometry',
              patch: { safePoint: y === undefined ? undefined : { x: d.safePoint?.x ?? d.x, y } },
            });
          }}
        />
      </Field>
    </div>
  );
}

function StepBehaviors({ w, dispatch }: { w: ObjectWizard; dispatch: Dispatch }) {
  const on = new Set(w.draft.behaviors.map((b) => b.type));
  const toggle = (type: BehaviorType, checked: boolean) => {
    const behaviors: ObjectBehavior[] = checked
      ? [...w.draft.behaviors, { type, params: {} }]
      : w.draft.behaviors.filter((b) => b.type !== type);
    dispatch({ type: 'behaviors', behaviors });
  };
  return (
    <ul className="admin-checks" data-testid="objeto-comportamientos">
      {STEP_BEHAVIORS.map((type) => (
        <li key={type}>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={on.has(type)}
              data-testid={`objeto-comp-${type}`}
              onChange={(e) => toggle(type, e.target.checked)}
            />
            <strong>{BEHAVIOR_CATALOG[type].label}</strong> · {BEHAVIOR_CATALOG[type].summary}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Los parámetros de un comportamiento, como JSON, con su error al momento. */
function ParamsEditor({
  behavior,
  index,
  dispatch,
}: {
  behavior: ObjectBehavior;
  index: number;
  dispatch: Dispatch;
}) {
  const [text, setText] = useState(JSON.stringify(behavior.params, null, 2));
  const [error, setError] = useState<string | null>(null);
  const why = error ?? behaviorParamsProblem(behavior);
  return (
    <Field label={behaviorLabel(behavior.type)} hint={why ?? t('admin.objects.params.ok')}>
      <textarea
        rows={4}
        value={text}
        spellCheck={false}
        data-testid={`objeto-params-${behavior.type}`}
        aria-invalid={why ? true : undefined}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed: unknown = JSON.parse(e.target.value || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              setError(t('admin.objects.params.notObject'));
              return;
            }
            setError(null);
            dispatch({ type: 'params', index, params: parsed as Record<string, unknown> });
          } catch {
            setError(t('admin.objects.params.notJson'));
          }
        }}
      />
    </Field>
  );
}

function StepParams({ w, dispatch }: { w: ObjectWizard; dispatch: Dispatch }) {
  return (
    <div className="admin-form">
      {w.draft.behaviors.map((b, i) => (
        <ParamsEditor key={`${b.type}-${i}`} behavior={b} index={i} dispatch={dispatch} />
      ))}
      <div className="admin-grid">
        {TEXT_KEYS.map((k) => (
          <Field key={k} label={TEXT_LABELS[k]}>
            <textarea
              rows={k === 'body' ? 3 : 1}
              value={w.draft.texts[k] ?? ''}
              data-testid={`objeto-texto-${k}`}
              onChange={(e) =>
                dispatch({ type: 'texts', texts: { ...w.draft.texts, [k]: e.target.value } })
              }
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function StepLinks({
  ctx,
  w,
  dispatch,
}: {
  ctx: AdminContext;
  w: ObjectWizard;
  dispatch: Dispatch;
}) {
  const events = useRead(ctx, (r) => r.content.events());
  const l = w.draft.links;
  const setLinks = (patch: Partial<WorldObjectRecord['links']>) => {
    const next: Record<string, unknown> = { ...l, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    dispatch({ type: 'links', links: next as WorldObjectRecord['links'] });
  };
  return (
    <div className="admin-grid">
      <Field label={t('admin.objects.links.event')} hint={t('admin.objects.links.eventHint')}>
        <select
          value={l.eventId ?? ''}
          data-testid="objeto-evento"
          onChange={(e) => setLinks({ eventId: e.target.value || undefined })}
        >
          <option value="">{t('admin.objects.links.none')}</option>
          {(events ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('admin.objects.links.achievement')}>
        <select
          value={l.achievementTrigger ?? ''}
          data-testid="objeto-logro"
          onChange={(e) => setLinks({ achievementTrigger: e.target.value || undefined })}
        >
          <option value="">{t('admin.objects.links.none')}</option>
          {ACHIEVEMENT_TRIGGERS.map((k) => (
            <option key={k} value={k}>
              {TRIGGER_LABELS[k as AchievementTrigger]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('admin.objects.links.reward')}>
        <select
          value={l.reward?.kind ?? ''}
          data-testid="objeto-premio-tipo"
          onChange={(e) =>
            setLinks({
              reward: e.target.value
                ? { kind: e.target.value as 'coins' | 'points', amount: l.reward?.amount ?? 5 }
                : undefined,
            })
          }
        >
          <option value="">{t('admin.objects.links.none')}</option>
          <option value="coins">{t('admin.objects.links.coins')}</option>
          <option value="points">{t('admin.objects.links.points')}</option>
        </select>
      </Field>
      {l.reward ? (
        <Field label={t('admin.objects.links.amount')}>
          <input
            inputMode="numeric"
            value={String(l.reward.amount)}
            data-testid="objeto-premio-cantidad"
            onChange={(e) =>
              setLinks({
                reward: { kind: l.reward!.kind, amount: Math.round(num(e.target.value) ?? 0) },
              })
            }
          />
        </Field>
      ) : null}
      <Field
        label={t('admin.objects.links.destinationX')}
        hint={t('admin.objects.links.destinationHint')}
      >
        <input
          inputMode="decimal"
          value={l.destination ? String(l.destination.x) : ''}
          data-testid="objeto-destino-x"
          onChange={(e) => {
            const x = num(e.target.value);
            setLinks({
              destination: x === undefined ? undefined : { x, y: l.destination?.y ?? w.draft.y },
            });
          }}
        />
      </Field>
      <Field label={t('admin.objects.links.destinationY')}>
        <input
          inputMode="decimal"
          value={l.destination ? String(l.destination.y) : ''}
          data-testid="objeto-destino-y"
          onChange={(e) => {
            const y = num(e.target.value);
            setLinks({
              destination: y === undefined ? undefined : { x: l.destination?.x ?? w.draft.x, y },
            });
          }}
        />
      </Field>
    </div>
  );
}

function StepPreview({ ctx, w }: { ctx: AdminContext; w: ObjectWizard }) {
  const [problem, setProblem] = useState<string | null | undefined>(undefined);
  const d = w.draft;
  useEffect(() => {
    let alive = true;
    setProblem(undefined);
    void ctx.actions.objectPreviewProblem(d).then((p) => alive && setProblem(p));
    return () => {
      alive = false;
    };
  }, [ctx.actions, d]);
  const behaviors = objectBehaviors(d);
  return (
    <div className="admin-form">
      <dl className="admin-summary" data-testid="objeto-resumen">
        <dt>{t('admin.objects.field.name')}</dt>
        <dd>
          {d.name} · {d.id}
        </dd>
        <dt>{t('admin.objects.field.category')}</dt>
        <dd>{categoryLabel(d.category)}</dd>
        <dt>{t('admin.objects.step.asset')}</dt>
        <dd>{d.asset.fileName ?? d.asset.ref}</dd>
        <dt>{t('admin.objects.step.place')}</dt>
        <dd>
          {d.x}, {d.y}
          {d.zone ? ` · ${d.zone}` : ''}
        </dd>
        <dt>{t('admin.objects.step.behaviors')}</dt>
        <dd data-testid="objeto-resumen-comportamientos">
          {behaviors.map((b) => behaviorLabel(b.type)).join(' · ')}
        </dd>
      </dl>
      {problem === undefined ? (
        <p className="admin-meta">{t('admin.objects.preview.checking')}</p>
      ) : problem ? (
        <p
          className="admin-status admin-status--error"
          role="alert"
          data-testid="objeto-previa"
          data-ok="no"
        >
          {problem}
        </p>
      ) : (
        <p
          className="admin-status admin-status--ok"
          role="status"
          data-testid="objeto-previa"
          data-ok="si"
        >
          {t('admin.objects.preview.ok')}
        </p>
      )}
    </div>
  );
}

function StepSave({
  ctx,
  w,
  onSaved,
}: {
  ctx: AdminContext;
  w: ObjectWizard;
  onSaved: (o: WorldObjectRecord) => void;
}) {
  const { status, busy, run } = useRun();
  const [templateName, setTemplateName] = useState(w.draft.name);
  const [published, setPublished] = useState<string | null>(null);
  return (
    <div className="admin-form">
      <p className="admin-lead">{t('admin.objects.save.lead')}</p>
      <div className="admin-row">
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid="objeto-guardar-borrador"
          onClick={() =>
            void run(async () => {
              onSaved(await ctx.actions.saveObject(w.draft, false));
              setPublished(null);
            }, t('admin.objects.save.draftOk'))
          }
        >
          {t('admin.objects.save.draft')}
        </button>
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          data-testid="objeto-publicar"
          onClick={() =>
            void run(async () => {
              const o = await ctx.actions.saveObject(w.draft, true);
              onSaved(o);
              setPublished(o.id);
            }, t('admin.objects.save.publishOk'))
          }
        >
          {t('admin.objects.save.publish')}
        </button>
      </div>
      <div className="admin-row admin-row--end">
        <Field label={t('admin.objects.save.templateName')}>
          <input
            value={templateName}
            data-testid="objeto-plantilla-nombre"
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </Field>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid="objeto-como-plantilla"
          onClick={() =>
            void run(
              () => ctx.actions.saveObjectAsTemplate(w.draft, templateName),
              t('admin.objects.save.templateOk'),
            )
          }
        >
          {t('admin.objects.save.asTemplate')}
        </button>
      </div>
      <StatusLine status={status} />
      {published ? (
        <a
          className="admin-link"
          href={`${MAR_PATH}?ir=${encodeURIComponent(published)}`}
          data-testid="objeto-ver-mar"
        >
          {t('admin.objects.save.seeAtSea')}
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// El asistente

function Wizard({
  ctx,
  initial,
  objects,
  onClose,
}: {
  ctx: AdminContext;
  initial: ObjectWizard;
  objects: readonly WorldObjectRecord[];
  onClose: () => void;
}) {
  const [w, dispatch] = useReducer(wizardReducer, initial);
  // Editando un objeto guardado (o ya guardado en este asistente), su id no cuenta como usado.
  const [editing, setEditing] = useState(
    initial.reached === OBJECT_STEPS.length - 1 ? initial.draft.id : undefined,
  );
  const [env, setEnv] = useState<StepEnv | null>(null);
  useEffect(() => {
    void ctx.actions.objectEnv(editing).then(setEnv);
  }, [ctx.actions, ctx.revision, editing]);
  const step = OBJECT_STEPS[w.step]!;
  const problem = env ? stepProblem(step, w.draft, env) : null;
  return (
    <section className="admin-card admin-wizard" data-testid="objeto-asistente" data-paso={step}>
      <div className="admin-row admin-row--between">
        <h3>
          {t('admin.objects.wizard.title', { n: w.step + 1, total: OBJECT_STEPS.length })} ·{' '}
          {OBJECT_STEP_LABELS[step]}
        </h3>
        <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>
          {t('admin.objects.wizard.close')}
        </button>
      </div>
      <ol className="admin-steps" aria-label={t('admin.objects.wizard.steps')}>
        {OBJECT_STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              className="admin-steps__step"
              aria-current={i === w.step ? 'step' : undefined}
              disabled={i > w.reached}
              data-testid={`objeto-paso-${i + 1}`}
              onClick={() => dispatch({ type: 'goto', step: i })}
            >
              {i + 1}. {OBJECT_STEP_LABELS[s]}
            </button>
          </li>
        ))}
      </ol>
      {env ? (
        <>
          {step === 'add' ? <StepAdd w={w} dispatch={dispatch} env={env} /> : null}
          {step === 'category' ? <StepCategory w={w} dispatch={dispatch} /> : null}
          {step === 'asset' ? <StepAsset w={w} dispatch={dispatch} /> : null}
          {step === 'place' ? (
            <StepPlace ctx={ctx} w={w} dispatch={dispatch} objects={objects} />
          ) : null}
          {step === 'geometry' ? <StepGeometry ctx={ctx} w={w} dispatch={dispatch} /> : null}
          {step === 'behaviors' ? <StepBehaviors w={w} dispatch={dispatch} /> : null}
          {step === 'params' ? <StepParams w={w} dispatch={dispatch} /> : null}
          {step === 'links' ? <StepLinks ctx={ctx} w={w} dispatch={dispatch} /> : null}
          {step === 'preview' ? <StepPreview ctx={ctx} w={w} /> : null}
          {step === 'save' ? <StepSave ctx={ctx} w={w} onSaved={(o) => setEditing(o.id)} /> : null}
        </>
      ) : (
        <p>{t('empty.loading')}</p>
      )}
      {problem ? (
        <p className="admin-status admin-status--error" data-testid="objeto-problema">
          {problem}
        </p>
      ) : null}
      <div className="admin-row">
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={w.step === 0}
          data-testid="objeto-atras"
          onClick={() => dispatch({ type: 'back' })}
        >
          {t('admin.objects.wizard.back')}
        </button>
        {w.step < OBJECT_STEPS.length - 1 ? (
          <button
            type="button"
            className="admin-button"
            disabled={!env || !!problem}
            data-testid="objeto-siguiente"
            onClick={() => env && dispatch({ type: 'next', env })}
          >
            {t('admin.objects.wizard.next')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// La sección

function TemplateCard({
  ctx,
  template,
  saved,
  onUse,
}: {
  ctx: AdminContext;
  template: ObjectTemplate;
  saved: boolean;
  onUse: () => void;
}) {
  const { status, busy, run } = useRun();
  return (
    <li className="admin-card" data-testid={`plantilla-${template.id}`}>
      <p>
        <strong>{template.name}</strong>{' '}
        <span className="admin-meta">
          {categoryLabel(template.spec.category)} ·{' '}
          {objectBehaviors(template.spec)
            .map((b) => behaviorLabel(b.type))
            .join(' · ')}
          {saved ? '' : ` · ${t('admin.objects.templates.builtin')}`}
        </span>
      </p>
      <div className="admin-row">
        <button
          type="button"
          className="admin-button"
          data-testid={`plantilla-usar-${template.id}`}
          onClick={onUse}
        >
          {t('admin.objects.templates.use')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid={`plantilla-duplicar-${template.id}`}
          onClick={() =>
            void run(
              () => ctx.actions.duplicateObjectTemplate(template.id),
              t('admin.objects.templates.duplicated'),
            )
          }
        >
          {t('admin.objects.templates.duplicate')}
        </button>
        {saved ? <DeleteButton ctx={ctx} area="objectTemplates" id={template.id} /> : null}
      </div>
      {status.kind !== 'idle' ? <StatusLine status={status} /> : null}
    </li>
  );
}

function ObjectRow({
  ctx,
  object,
  onEdit,
}: {
  ctx: AdminContext;
  object: WorldObjectRecord;
  onEdit: () => void;
}) {
  const { status, busy, run } = useRun();
  const published = object.status === 'published';
  return (
    <li className="admin-card" data-testid={`objeto-${object.id}`} data-estado={object.status}>
      <p>
        <strong>{object.name}</strong>{' '}
        <span className="admin-meta">
          {object.id} · {categoryLabel(object.category)} ·{' '}
          {published ? t('admin.objects.list.published') : t('admin.objects.list.draft')}
        </span>
      </p>
      <div className="admin-row">
        <button
          type="button"
          className="admin-button"
          data-testid={`objeto-editar-${object.id}`}
          onClick={onEdit}
        >
          {t('admin.objects.list.edit')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid={`objeto-estado-${object.id}`}
          onClick={() =>
            void run(
              () => ctx.actions.setObjectStatus(object.id, !published),
              published ? t('admin.objects.save.draftOk') : t('admin.objects.save.publishOk'),
            )
          }
        >
          {published ? t('admin.objects.list.unpublish') : t('admin.objects.save.publish')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy}
          data-testid={`objeto-duplicar-${object.id}`}
          onClick={() =>
            void run(
              () => ctx.actions.duplicateObject(object.id),
              t('admin.objects.list.duplicated'),
            )
          }
        >
          {t('admin.objects.templates.duplicate')}
        </button>
        {published ? (
          <a className="admin-link" href={`${MAR_PATH}?ir=${encodeURIComponent(object.id)}`}>
            {t('admin.objects.save.seeAtSea')}
          </a>
        ) : null}
        <DeleteButton ctx={ctx} area="worldObjects" id={object.id} />
      </div>
      {status.kind !== 'idle' ? <StatusLine status={status} /> : null}
    </li>
  );
}

/** Objetos (REQ-ADM-010 a REQ-ADM-012): plantillas, objetos creados y el asistente. */
export function ObjectsSection({ ctx }: { ctx: AdminContext }) {
  const objects = useRead(ctx, (r) => r.content.list('worldObjects'));
  const saved = useRead(ctx, (r) => r.content.list('objectTemplates'));
  const [wizard, setWizard] = useState<{ key: number; initial: ObjectWizard } | null>(null);
  const keyRef = useRef(0);
  if (!objects || !saved) return <p>{t('empty.loading')}</p>;
  const savedIds = new Set(saved.map((x) => x.id));
  const used = new Set([...ctx.registry.map.places.map((p) => p.id), ...objects.map((o) => o.id)]);
  const open = (initial: ObjectWizard) => {
    keyRef.current += 1;
    setWizard({ key: keyRef.current, initial });
  };
  const blank = (template?: ObjectTemplate) => {
    const name = template ? template.name : '';
    const base = { id: name ? freeId(name, used) : '', name, at: startPoint(ctx) };
    open(
      template
        ? startWizard({ kind: 'template', template, ...base })
        : startWizard({ kind: 'blank', ...base }),
    );
  };

  return (
    <section>
      <SectionHead title={t('admin.objects.title')} lead={t('admin.objects.lead')}>
        <button
          type="button"
          className="admin-button"
          data-testid="objeto-nuevo"
          onClick={() => blank()}
        >
          {t('admin.objects.newBlank')}
        </button>
      </SectionHead>
      {wizard ? (
        <Wizard
          key={wizard.key}
          ctx={ctx}
          initial={wizard.initial}
          objects={objects}
          onClose={() => setWizard(null)}
        />
      ) : null}
      <h3>{t('admin.objects.templates.title')}</h3>
      <ul className="admin-cards" data-testid="plantillas">
        {allTemplates(saved).map((tpl) => (
          <TemplateCard
            key={tpl.id}
            ctx={ctx}
            template={tpl}
            saved={savedIds.has(tpl.id)}
            onUse={() => blank(tpl)}
          />
        ))}
      </ul>
      <h3>{t('admin.objects.list.title')}</h3>
      {objects.length === 0 ? (
        <p className="admin-lead">{t('admin.objects.list.empty')}</p>
      ) : (
        <ul className="admin-cards" data-testid="objetos">
          {objects.map((o) => (
            <ObjectRow
              key={o.id}
              ctx={ctx}
              object={o}
              onEdit={() => open(startWizard({ kind: 'object', object: o }))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
