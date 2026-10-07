'use client';

import {
  CONTENT_AREAS,
  type ContentArea,
  TRASH_RETENTION_MAX_DAYS,
  TRASH_RETENTION_MIN_DAYS,
  type TrashItem,
} from '@boia/store';
import { useState } from 'react';
import { ADMIN_COPY } from '../../../lib/admin/copy';
import { itemName } from '../../../lib/admin/references';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import { Field, SectionHead, StatusLine } from '../ui';
import { t as msg } from '../../../lib/i18n';

/** Temporadas (REQ-ADM-032, D-20): cada mundo es una temporada; una activa. */
export function SeasonsSection({ ctx }: { ctx: AdminContext }) {
  const active = useRead(ctx, (r) => r.content.activeWorldId());
  const { status, busy, run } = useRun();
  if (active === undefined) return <p>{msg('empty.loading')}</p>;
  const current = active ?? ctx.registry.defaultId;
  return (
    <section>
      <SectionHead title={msg('admin.misc.temporadas')} lead={msg('admin.misc.cadaMundoEsUna')} />
      <fieldset className="admin-card">
        <legend>{msg('admin.misc.mundoActivo')}</legend>
        {ctx.registry.list().map((w) => (
          <label key={w.id} className="admin-check" data-testid={`temporada-${w.id}`}>
            <input
              type="radio"
              name="mundo-activo"
              checked={current === w.id}
              disabled={busy}
              onChange={() =>
                void run(
                  () => ctx.actions.setActiveWorld(w.id),
                  msg('admin.misc.temporadaActiva', { name: w.name }),
                )
              }
            />
            <span>
              <strong>{w.name}</strong>
              {w.tagline ? ` · ${w.tagline}` : ''} {msg('admin.misc.barco')} {w.shipStyle}
              {w.id === ctx.registry.defaultId ? msg('admin.misc.porDefecto') : ''}
            </span>
          </label>
        ))}
      </fieldset>
      <StatusLine status={status} />
    </section>
  );
}

/** Usuarios de administración (REQ-ADM-002 a REQ-ADM-004): sólo lectura en la demo. */
export function UsersSection() {
  return (
    <section>
      <SectionHead
        title={msg('admin.misc.usuariosDeAdministracion')}
        lead={msg('admin.misc.soloLecturaEnLa')}
      />
      <table className="admin-table" data-testid="usuarios">
        <thead>
          <tr>
            <th>{msg('admin.misc.rol')}</th>
            <th>{msg('admin.misc.puede')}</th>
            <th>{msg('admin.misc.cuentas')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{msg('admin.misc.propietario')}</td>
            <td>{msg('admin.misc.todoPermisosEIntegraciones')}</td>
            <td>{msg('admin.misc.alvaroPendiente')}</td>
          </tr>
          <tr>
            <td>{msg('admin.misc.administrador')}</td>
            <td>{msg('admin.misc.todoMenosTransferirLa')}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>{msg('admin.misc.editor')}</td>
            <td>{msg('admin.misc.editaBorradoresNoPublica')}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>{msg('admin.misc.estaDemo')}</td>
            <td>{msg('admin.misc.todoSinLoginSolo')}</td>
            <td>{msg('admin.misc.adminDemo')}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/** Integraciones: sólo lectura en la demo. */
export function IntegrationsSection() {
  const rows: [string, string][] = [
    [msg('admin.misc.ticketera'), msg('admin.misc.sandboxDePruebaComprar')],
    [msg('admin.misc.datos'), msg('admin.misc.enEsteNavegadorRepositorio')],
    [msg('admin.misc.correo'), msg('admin.misc.sinCorreoEnLa')],
    [msg('admin.misc.analitica'), msg('admin.misc.eventosDelEmbudoEn')],
  ];
  return (
    <section>
      <SectionHead
        title={msg('admin.misc.integraciones')}
        lead={msg('admin.misc.soloLecturaEnLa2')}
      />
      <table className="admin-table" data-testid="integraciones">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const AREA_LABELS: Partial<Record<string, string>> = {
  events: msg('admin.misc.eventos'),
  homeBlocks: msg('admin.misc.paginaPrincipal'),
  artists: msg('admin.misc.artistas'),
  albums: msg('admin.misc.albumes'),
  photos: msg('admin.misc.fotos'),
  promotions: msg('admin.misc.promociones'),
  discounts: msg('admin.misc.descuentos'),
  achievements: msg('admin.misc.logros'),
  cosmetics: msg('admin.misc.cosmeticos'),
  ranks: msg('admin.misc.rangos'),
  worldObjects: msg('admin.objects.area.objects'),
  objectTemplates: msg('admin.objects.area.templates'),
  places: msg('admin.misc.mundoMapa'),
  skins: msg('admin.misc.mundoPieles'),
  texts: msg('admin.misc.textos'),
  activeWorld: msg('admin.misc.temporada'),
  bottles: msg('admin.misc.moderacion'),
  ledger: msg('admin.misc.recompensasYSellos'),
  purchases: msg('admin.misc.compras'),
  music: msg('admin.misc.musica'),
  settings: msg('admin.misc.ajustes'),
  publish: msg('admin.misc.publicacion'),
  missionDestinations: msg('admin.misc.destinoDeLaFiestera'),
  missions: msg('admin.misc.partidasMigracion'),
  carnets: msg('admin.misc.moderacionDeCarnets'),
};

/**
 * Papelera (REQ-ADM-030): lo borrado de todas las áreas, recuperable hasta
 * que pasa el plazo; purgar es irreversible y pide escribir otra vez el
 * nombre (en la demo no hay login con el que reautenticarse).
 */
export function TrashSection({ ctx }: { ctx: AdminContext }) {
  const trash = useRead(ctx, (r) => r.admin.trash());
  const settings = useRead(ctx, (r) => r.admin.settings());
  const [days, setDays] = useState<string | null>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);
  const [typed, setTyped] = useState('');
  const { status, busy, run } = useRun();
  if (!trash || !settings) return <p>{msg('empty.loading')}</p>;
  const expired = trash.filter((t) => t.expired).length;
  const day = (iso: string) => new Date(iso).toLocaleDateString('es-ES');
  return (
    <section>
      <SectionHead title={msg('admin.misc.papelera')} lead={msg('admin.misc.loBorradoSePuede')} />
      <form
        className="admin-card admin-row admin-row--end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () => ctx.actions.setTrashRetention(Number(days ?? settings.trashRetentionDays)),
            msg('admin.misc.plazoGuardado'),
          );
        }}
      >
        <Field
          label={msg('admin.misc.plazoDeLaPapelera')}
          hint={msg('admin.misc.deAPendienteDe', {
            TRASH_RETENTION_MIN_DAYS,
            TRASH_RETENTION_MAX_DAYS,
          })}
        >
          <input
            inputMode="numeric"
            value={days ?? String(settings.trashRetentionDays)}
            onChange={(e) => setDays(e.target.value)}
            data-testid="papelera-plazo"
          />
        </Field>
        <button
          type="submit"
          className="admin-button"
          disabled={busy}
          data-testid="papelera-plazo-guardar"
        >
          {msg('admin.misc.guardarPlazo')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy || expired === 0}
          onClick={() => {
            if (
              !window.confirm(`¿Purgar ${expired} elemento(s) caducado(s)? No se puede deshacer.`)
            )
              return;
            void run(() => ctx.actions.purgeExpired(), msg('admin.misc.caducadosPurgados'));
          }}
        >
          {msg('admin.misc.purgarLoCaducado', { expired })}
        </button>
      </form>
      <StatusLine status={status} />
      {purging ? (
        <div className="admin-card admin-delete__panel" role="group" data-testid="purgar-panel">
          <p>
            {msg('admin.misc.vasAPurgar')}{' '}
            <strong>«{itemName(purging.area, purging.value)}»</strong> (
            {AREA_LABELS[purging.area] ?? purging.area}).{' '}
            <strong>{msg('admin.misc.noSePuedeDeshacer')}</strong>
          </p>
          <Field
            label={msg('admin.misc.paraConfirmarOtraVez', {
              itemName: itemName(purging.area, purging.value),
            })}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              data-testid="purgar-nombre"
            />
          </Field>
          <div className="admin-row">
            <button
              type="button"
              className="admin-button admin-button--danger"
              disabled={busy || typed.trim() !== itemName(purging.area, purging.value)}
              data-testid="purgar-confirmar"
              onClick={() =>
                void run(async () => {
                  await ctx.actions.purgeItem(purging.area, purging.id, typed);
                  setPurging(null);
                }, msg('admin.misc.purgadoParaSiempre'))
              }
            >
              {msg('admin.misc.purgarParaSiempre')}
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => setPurging(null)}
            >
              {msg('carnet.cancel')}
            </button>
          </div>
        </div>
      ) : null}
      <ul className="admin-list" data-testid="papelera">
        {trash.map((t) => (
          <li
            key={`${t.area}/${t.id}`}
            className="admin-card admin-row admin-row--between"
            data-testid={`papelera-${t.area}-${t.id}`}
          >
            <span>
              <strong>{itemName(t.area, t.value)}</strong> · {AREA_LABELS[t.area] ?? t.area}{' '}
              {msg('admin.misc.borradoEl')} {day(t.deletedAt)} ·{' '}
              {t.expired
                ? msg('admin.misc.plazoCumplidoSePurga')
                : msg('admin.misc.sePurgaEl', { day: day(t.expiresAt) })}
            </span>
            <span className="admin-row">
              <button
                type="button"
                className="admin-button admin-button--ghost"
                disabled={busy}
                data-testid={`papelera-recuperar-${t.id}`}
                onClick={() =>
                  void run(() => ctx.repo.admin.restore(t.area, t.id), msg('admin.misc.recuperado'))
                }
              >
                {msg('admin.misc.recuperar')}
              </button>
              <button
                type="button"
                className="admin-button admin-button--danger"
                disabled={busy}
                data-testid={`papelera-purgar-${t.id}`}
                onClick={() => {
                  setTyped('');
                  setPurging(t);
                }}
              >
                {msg('admin.misc.purgar')}
              </button>
            </span>
          </li>
        ))}
        {trash.length === 0 ? (
          <li className="admin-meta">{msg('admin.misc.laPapeleraEstaVacia')}</li>
        ) : null}
      </ul>
    </section>
  );
}

/** Auditoría local (REQ-ADM-007) y volver a la muestra (REQ-ADM-039). */
export function AuditSection({ ctx }: { ctx: AdminContext }) {
  const audit = useRead(ctx, (r) => r.admin.audit({ limit: 200 }));
  const [area, setArea] = useState<ContentArea | ''>('');
  const { status, busy, run } = useRun();
  return (
    <section>
      <SectionHead
        title={msg('admin.misc.auditoriaYMuestra')}
        lead={msg('admin.misc.cadaCambioDeEste')}
      />
      <div className="admin-card admin-row admin-row--end">
        <label className="admin-field">
          <span className="admin-field__label">{msg('admin.misc.area')}</span>
          <select value={area} onChange={(e) => setArea(e.target.value as ContentArea | '')}>
            <option value="">{msg('admin.misc.eligeUnArea')}</option>
            {CONTENT_AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy || !area}
          onClick={() =>
            area && void run(() => ctx.actions.reset(area), msg('admin.misc.areaVueltaALa'))
          }
        >
          {ADMIN_COPY.resetArea}
        </button>
        <button
          type="button"
          className="admin-button admin-button--danger"
          disabled={busy}
          data-testid="reset-todo"
          onClick={() => {
            if (!window.confirm(ADMIN_COPY.confirmResetAll)) return;
            void run(() => ctx.actions.reset('all'), msg('admin.misc.todoVuelveALos'));
          }}
        >
          {ADMIN_COPY.resetAll}
        </button>
      </div>
      <StatusLine status={status} />
      <ol className="admin-audit" data-testid="auditoria">
        {(audit ?? []).map((e) => (
          <li key={e.id}>
            <time dateTime={e.at}>{new Date(e.at).toLocaleString('es-ES')}</time> ·{' '}
            <strong>{AREA_LABELS[e.area] ?? e.area}</strong> · {e.action}
            {e.targetId ? ` · ${e.targetId}` : ''}
            {e.reason ? ` · ${e.reason}` : ''} · {e.actor}
          </li>
        ))}
        {audit && audit.length === 0 ? (
          <li className="admin-meta">{msg('admin.misc.sinCambiosTodavia')}</li>
        ) : null}
      </ol>
    </section>
  );
}
