'use client';

import type { MissionImpact } from '@boia/store';
import { useEffect, useState } from 'react';
import {
  composeLiveWorld,
  destinationPlaces,
  liveMap,
  mapMissionDestination,
  mapMissions,
} from '../../../lib/admin/world';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import { Field, ResetButton, SectionHead, StatusLine } from '../ui';
import { t } from '../../../lib/i18n';

/** Valor del selector para «el del mapa». */
const MAP_DEFAULT = '';

/**
 * Destino de la Boia Fiestera (REQ-AVE-010, REQ-AVE-011): por mundo, a qué
 * isla van las partidas nuevas. El destino se guarda por id de lugar; antes de
 * guardar se ve cuántas partidas empezadas hay en ese mundo (las terminadas
 * nunca cambian) y, si se quiere, se migran también, con motivo y auditoría.
 * En la versión de prueba las partidas son las de este navegador (D-20).
 */
export function MissionSection({ ctx }: { ctx: AdminContext }) {
  const worlds = ctx.registry.list();
  const [worldId, setWorldId] = useState(ctx.registry.defaultId);
  const content = useRead(ctx, async (r) => ({
    places: await r.content.places(),
    skins: await r.content.skins(),
    events: await r.content.events(),
    destinations: await r.content.missionDestinations(),
  }));
  const missions = mapMissions(ctx.registry.map);
  const missionId = missions[0]?.missionId ?? null;
  const current = (missionId && content?.destinations[worldId]?.[missionId]) || MAP_DEFAULT;
  const [choice, setChoice] = useState<string>(MAP_DEFAULT);
  const [migrate, setMigrate] = useState(false);
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState<MissionImpact | null>(null);
  const { status, busy, run } = useRun();

  // Al cambiar de mundo (o al guardar), el selector vuelve a lo guardado.
  useEffect(() => {
    setChoice(current);
    setMigrate(false);
  }, [current, worldId]);

  // Vista previa: cuántas partidas tocaría este destino en este mundo.
  useEffect(() => {
    if (!missionId) return;
    let alive = true;
    ctx.actions
      .missionDestinationPreview(worldId, missionId, choice || null)
      .then((i) => alive && setImpact(i))
      .catch((err: unknown) => console.warn('[boia] admin: vista previa', err));
    return () => {
      alive = false;
    };
  }, [ctx.actions, ctx.revision, worldId, missionId, choice]);

  if (!content) return <p>{t('empty.loading')}</p>;
  if (!missionId) return <p>{t('admin.mission.elMapaNoTiene')}</p>;

  const live = {
    places: content.places,
    skins: content.skins,
    events: content.events,
    missionDestinations: content.destinations,
  };
  const map = liveMap(ctx.registry, live);
  const mapDefault = mapMissionDestination(map, missionId);
  let names = new Map<string, string>();
  try {
    const world = composeLiveWorld(ctx.registry, worldId, live).config;
    names = new Map(world.objects.map((o) => [o.identity.id, o.identity.name]));
  } catch {
    // Un mundo que no compone: se ven los nombres comunes.
  }
  const nameOf = (id: string) => names.get(id) ?? map.places.find((p) => p.id === id)?.name ?? id;
  const options = destinationPlaces(map);
  const target = choice || mapDefault?.id || null;

  return (
    <section data-testid="admin-mision">
      <SectionHead
        title={t('admin.mission.destinoDeLaFiestera')}
        lead={t('admin.mission.aQueIslaLleva')}
      >
        <ResetButton ctx={ctx} areas={['missionDestinations']} />
      </SectionHead>
      <div className="admin-row">
        <Field label={t('admin.mission.mundo')}>
          <select
            value={worldId}
            data-testid="mision-mundo"
            onChange={(e) => setWorldId(e.target.value)}
          >
            {worlds.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('admin.mission.destinoDeLasPartidas')}
          hint={t('admin.mission.soloIslasActivasVisibles')}
        >
          <select
            value={choice}
            data-testid="mision-destino"
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value={MAP_DEFAULT}>
              {t('admin.mission.elDelMapa', {
                v1: mapDefault ? ` (${nameOf(mapDefault.id)})` : '',
              })}
            </option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {nameOf(p.id)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="admin-meta" data-testid="mision-actual">
        {t('admin.mission.ahoraEn')} {worlds.find((w) => w.id === worldId)?.name ?? worldId}:{' '}
        <strong>
          {current
            ? nameOf(current)
            : t('admin.mission.elDelMapa2', { nameOf: nameOf(mapDefault?.id ?? '') })}
        </strong>
      </p>
      {impact ? (
        <div className="admin-card" data-testid="mision-impacto">
          <p>
            <strong data-testid="mision-empezadas">{impact.started}</strong>{' '}
            {impact.started === 1
              ? t('admin.mission.partidaEmpezada')
              : t('admin.mission.partidasEmpezadas')}{' '}
            {t('admin.mission.enEsteMundo')}
            {impact.started > 0 && target
              ? ` ${t(impact.affected === 1 ? 'admin.mission.vaAOtra' : 'admin.mission.vanAOtra', { n: impact.affected, name: nameOf(target) })}`
              : ''}
            ; {impact.completed}{' '}
            {t(impact.completed === 1 ? 'admin.mission.terminada' : 'admin.mission.terminadas')}
            {t('admin.mission.queNoCambian')}
          </p>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={migrate}
              disabled={!choice || impact.affected === 0}
              data-testid="mision-migrar"
              onChange={(e) => setMigrate(e.target.checked)}
            />
            {t('admin.mission.migrarTambienLasPartidas')}
          </label>
          {migrate ? (
            <Field label={t('admin.mission.motivoDeLaMigracion')}>
              <input
                value={reason}
                data-testid="mision-motivo"
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
      <div className="admin-row admin-row--end">
        <button
          type="button"
          className="admin-button"
          disabled={busy || (choice === current && !migrate)}
          data-testid="mision-guardar"
          onClick={() =>
            void run(
              () =>
                ctx.actions.setMissionDestination(worldId, missionId, choice || null, {
                  migrate,
                  reason,
                }),
              migrate
                ? t('admin.mission.destinoGuardadoYPartidas')
                : t('admin.mission.destinoGuardadoParaLas'),
            )
          }
        >
          {t('admin.mission.guardarDestino')}
        </button>
      </div>
      <StatusLine status={status} />
    </section>
  );
}
