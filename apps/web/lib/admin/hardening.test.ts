import { ACHIEVEMENT_TRIGGERS } from '@boia/contracts';
import {
  MemoryStorage,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_ARTISTS,
  SAMPLE_EVENTS,
  TRASH_RETENTION_MAX_DAYS,
  createLocalRepository,
  type JsonValue,
} from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import { resolveHome } from '../landing/resolve';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { AdminError, HOME_CTA_KEYS, createAdminActions } from './actions';
import { MINIGAMES, TRIGGER_PARAMS, triggerParamsProblem } from './achievements';
import { itemName } from './references';
import { PARAM_RANGES, circuitIds } from './validate';
import { EMPTY_WORLD_CONTENT, composeLiveWorld, eventIslands } from './world';

/**
 * Endurecimiento del Admin (T48): borrar pide el nombre exacto y enseña el
 * impacto (REQ-ADM-029), la papelera tiene plazo y la purga otra
 * confirmación (REQ-ADM-030), la home y los eventos van en borrador hasta
 * «Publicar» (REQ-ADM-015, REQ-ADM-017), los logros se crean, duplican y
 * versionan (REQ-ADM-021, REQ-ADM-022), los parámetros tienen rango y las
 * misiones y circuitos se validan (REQ-ADM-013, REQ-ADM-014) y la música se
 * sube con su licencia (REQ-ADM-020). Todo sobre el repositorio local de
 * verdad; los datos salen de la muestra y del mapa compartido.
 */

const NOW = '2026-09-29T10:00:00Z';
const registry = WORLD_REGISTRY;
const map = registry.map;
const now = () => new Date(NOW);

function setup() {
  const repo = createLocalRepository({ storage: new MemoryStorage(), now, watch: false });
  const actions = createAdminActions({ repo, registry, now });
  return { repo, actions };
}

async function reason(p: Promise<unknown>): Promise<string> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(Error);
  return (err as Error).message;
}

const heroOf = (view: ReturnType<typeof resolveHome>) => view.main.find((b) => b.type === 'hero');
const upcomingIds = (view: ReturnType<typeof resolveHome>) =>
  view.main.flatMap((b) => (b.type === 'upcoming_events' ? b.events.map((e) => e.id) : []));

describe('borrar: impacto y nombre exacto (REQ-ADM-029)', () => {
  // Un artista que está en el cartel de algún evento de la muestra.
  const artist = SAMPLE_ARTISTS.find((a) =>
    SAMPLE_EVENTS.some((e) => e.artistIds?.includes(a.id)),
  )!;
  const event = SAMPLE_EVENTS.find((e) => e.artistIds?.includes(artist.id))!;

  it('enseña lo que lo nombra antes de borrar', async () => {
    const { actions } = setup();
    const impact = await actions.impact('artists', artist.id);
    expect(impact.name).toBe(artist.name);
    expect(impact.references).toContainEqual({
      where: 'Eventos',
      what: `está en el cartel de «${event.name}»`,
    });
  });

  it('borrar exige escribir el nombre exacto', async () => {
    const { repo, actions } = setup();
    for (const typed of ['', artist.name.toUpperCase(), `${artist.name}x`, artist.id]) {
      if (typed === artist.name) continue;
      expect(await reason(actions.trashItem('artists', artist.id, typed))).toMatch(/nombre exacto/);
    }
    expect(await repo.admin.trash()).toEqual([]);
    expect(await repo.content.get('artists', artist.id)).not.toBeNull();
    await actions.trashItem('artists', artist.id, `  ${artist.name} `);
    expect((await repo.admin.trash()).map((t) => t.id)).toEqual([artist.id]);
    expect(await repo.content.get('artists', artist.id)).toBeNull();
  });

  it('purgar pide otra vez el nombre y no se deshace', async () => {
    const { repo, actions } = setup();
    await actions.trashItem('artists', artist.id, artist.name);
    expect(await reason(actions.purgeItem('artists', artist.id, 'otro'))).toMatch(/nombre exacto/);
    expect(await repo.admin.trash()).toHaveLength(1);
    await actions.purgeItem('artists', artist.id, artist.name);
    expect(await repo.admin.trash()).toEqual([]);
    await expect(repo.admin.restore('artists', artist.id)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('el plazo de la papelera tiene rango', async () => {
    const { repo, actions } = setup();
    expect(await reason(actions.setTrashRetention(0))).toMatch(/plazo/);
    expect(await reason(actions.setTrashRetention(TRASH_RETENTION_MAX_DAYS + 1))).toMatch(/plazo/);
    await actions.setTrashRetention(14);
    expect((await repo.admin.settings()).trashRetentionDays).toBe(14);
  });

  it('el nombre que se escribe es el que se enseña', () => {
    expect(itemName('events', event)).toBe(event.name);
    expect(itemName('discounts', { id: 'x', code: 'BOIA10', label: 'Diez' })).toBe('BOIA10');
    expect(itemName('achievements', { id: 'x', title: 'Faro' })).toBe('Faro');
  });
});

describe('borrador y «Publicar» (REQ-ADM-015, REQ-ADM-017)', () => {
  it('la muestra se puede publicar sin problemas', async () => {
    const { actions } = setup();
    expect(await actions.publishProblems()).toEqual([]);
  });

  it('un borrador no se ve en la landing hasta publicarlo', async () => {
    const { repo, actions } = setup();
    const hero = SAMPLE_CONTENT.blocks.find((b) => b.type === 'hero')!;
    const island = eventIslands(map)[0]!;
    const onSale = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
    await actions.setHeroTexts('Titular en borrador', 'Subtítulo en borrador');
    await actions.setHomeCtas(
      { explore: 'Zarpa ya' },
      { explore: es['hero.explore'], tickets: es['hero.tickets'] },
    );
    await actions.saveEventDraft({
      ...onSale,
      id: undefined,
      slug: undefined,
      name: 'Noche en borrador',
      startsAt: '2026-10-10T20:00:00+02:00',
      islandId: island.id,
    } as never);
    const landing = resolveHome(await repo.content.home(), now());
    expect(heroOf(landing)).toMatchObject({ title: hero.type === 'hero' ? hero.title : '' });
    expect(upcomingIds(landing)).not.toContain('ev-noche-en-borrador');
    expect((await repo.content.texts())[HOME_CTA_KEYS.explore]).toBeUndefined();
    expect(await repo.content.get('events', 'ev-noche-en-borrador')).toBeNull();
    // La vista previa sí lo enseña.
    const preview = resolveHome(await repo.admin.draftHome(), now());
    expect(heroOf(preview)).toMatchObject({ title: 'Titular en borrador' });
    expect(upcomingIds(preview)).toContain('ev-noche-en-borrador');

    const { revision } = await actions.publish();
    expect(revision).toBe(1);
    const after = resolveHome(await repo.content.home(), now());
    expect(heroOf(after)).toMatchObject({ title: 'Titular en borrador' });
    expect(upcomingIds(after)).toContain('ev-noche-en-borrador');
    expect((await repo.content.texts())[HOME_CTA_KEYS.explore]).toBe('Zarpa ya');
  });

  it('la Filosofía se edita en el borrador y se ve en la landing al publicar', async () => {
    const { repo, actions } = setup();
    const philosophyOf = (home: Awaited<ReturnType<typeof repo.content.home>>) => {
      const contact = resolveHome(home, now()).main.find((b) => b.type === 'contact');
      return contact && 'philosophy' in contact ? contact.philosophy : undefined;
    };
    await actions.setPhilosophy(
      ['Un párrafo nuevo.', ' '],
      [{ verb: 'Bailar', text: 'Sin parar.' }],
    );
    expect(philosophyOf(await repo.content.home())?.paragraphs).not.toContain('Un párrafo nuevo.');
    await actions.publish();
    expect(philosophyOf(await repo.content.home())).toMatchObject({
      paragraphs: ['Un párrafo nuevo.'],
      verbs: [{ verb: 'Bailar', text: 'Sin parar.' }],
    });
    await expect(actions.setPhilosophy([], [])).rejects.toBeInstanceOf(AdminError);
    await expect(actions.setPhilosophy(['x'], [{ verb: 'Solo', text: '' }])).rejects.toBeInstanceOf(
      AdminError,
    );
  });

  it('excluir un evento de «Próximos eventos» no lo borra', async () => {
    const { repo, actions } = setup();
    const before = upcomingIds(resolveHome(await repo.content.home(), now()));
    const target = before[0]!;
    await actions.setExcludedEvents([target]);
    await actions.publish();
    const after = upcomingIds(resolveHome(await repo.content.home(), now()));
    expect(after).not.toContain(target);
    expect(await repo.content.get('events', target)).not.toBeNull();
  });

  it('no se publica con una referencia rota, y se dice por qué', async () => {
    const { repo, actions } = setup();
    const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
    await actions.setPriorityEvent(event.id);
    await actions.trashItem('events', event.id, event.name);
    expect(await actions.publishProblems()).toContainEqual(
      `Página principal: el evento prioritario «${event.id}» no existe`,
    );
    expect(await reason(actions.publish())).toMatch(/no se publica.*evento prioritario/);
    expect((await repo.admin.pendingDrafts()).length).toBeGreaterThan(0);
  });

  it('una home sin portada visible no se publica', async () => {
    const { actions } = setup();
    const hero = SAMPLE_CONTENT.blocks.find((b) => b.type === 'hero')!;
    await actions.setBlockVisible(hero.id, false);
    expect(await reason(actions.publish())).toMatch(/portada/);
  });

  it('sin cambios no hay nada que publicar', async () => {
    const { actions } = setup();
    expect(await reason(actions.publish())).toMatch(/no hay cambios/);
  });
});

describe('rangos, misiones y circuitos (REQ-ADM-013, REQ-ADM-014)', () => {
  const swirl = map.places.find((p) => p.params && 'swirl' in p.params)!;
  const destination = map.places.find((p) => p.params?.missionDestination)!;
  const start = map.places.find((p) =>
    p.behaviors.some((b) => b.type === 'checkpoint' && b.params.order === 0),
  )!;

  it('un parámetro fuera de rango se rechaza con su motivo y no guarda nada', async () => {
    const { repo, actions } = setup();
    const r = PARAM_RANGES['swirl.strength']!;
    const msg = await reason(
      actions.editPlace(swirl.id, { params: { swirl: { strength: r.max + 1, pull: 0 } } }),
    );
    expect(msg).toContain(`${r.label} fuera de rango`);
    expect(msg).toContain(swirl.name);
    expect(await reason(actions.editPlace(swirl.id, { params: { proximityRadius: -5 } }))).toMatch(
      /radio de proximidad fuera de rango/,
    );
    expect(await repo.content.places()).toEqual({});
    // Dentro de rango, sí.
    await actions.editPlace(swirl.id, { params: { swirl: { strength: r.max, pull: 0 } } });
    expect(Object.keys(await repo.content.places())).toEqual([swirl.id]);
  });

  it('una misión sin destino no se guarda', async () => {
    const { actions } = setup();
    const mission = String(destination.params!.missionDestination);
    expect(await reason(actions.editPlace(destination.id, { enabled: false }))).toContain(
      `la misión «${mission}»`,
    );
  });

  it('un circuito sin salida no se guarda', async () => {
    const { actions } = setup();
    expect(await reason(actions.editPlace(start.id, { enabled: false }))).toMatch(
      /circuito .* no tendría salida/,
    );
  });
});

describe('logros: crear, duplicar y versionar (REQ-ADM-021, REQ-ADM-022)', () => {
  const choices = {
    circuits: circuitIds(
      composeLiveWorld(registry, registry.defaultId, EMPTY_WORLD_CONTENT).config,
    ),
    games: MINIGAMES,
    worlds: registry.ids(),
  };

  it('cada logro de la muestra cumple su catálogo de parámetros', () => {
    for (const t of ACHIEVEMENT_TRIGGERS) expect(TRIGGER_PARAMS[t], t).toBeDefined();
    for (const a of SAMPLE_ACHIEVEMENTS) {
      const params = (a.triggerParams ?? {}) as Record<string, JsonValue>;
      expect(triggerParamsProblem(a.trigger, params, choices), a.id).toBeNull();
    }
  });

  it('se crea con icono, ámbito y fechas; cambiar la condición es una versión nueva', async () => {
    const { repo, actions } = setup();
    const created = await actions.saveAchievement({
      title: 'Cinco islas',
      trigger: 'visit_island',
      triggerParams: { count: 5 },
      points: 10,
      coins: 5,
      iconKey: 'isla',
      scope: 'season',
      seasonId: registry.defaultId,
      startsAt: '2026-10-01T00:00:00+02:00',
      endsAt: '2026-11-01T00:00:00+01:00',
      secret: false,
      active: true,
    });
    expect(created).toMatchObject({ id: 'cinco-islas', version: 1, iconKey: 'isla' });
    const renamed = await actions.saveAchievement({ ...created, title: 'Cinco islas y pico' });
    expect(renamed.version).toBe(1);
    const harder = await actions.saveAchievement({ ...renamed, triggerParams: { count: 6 } });
    expect(harder.version).toBe(2);
    const copy = await actions.duplicateAchievement(created.id);
    expect(copy).toMatchObject({ active: false, version: 1, title: 'Cinco islas y pico (copia)' });
    expect((await repo.content.list('achievements')).map((a) => a.id)).toContain(copy.id);
  });

  it('una condición mal rellenada se rechaza con su motivo', async () => {
    const { actions } = setup();
    const base = {
      title: 'Mal',
      points: 0,
      coins: 0,
      scope: 'global' as const,
      secret: false,
      active: true,
    };
    expect(
      await reason(
        actions.saveAchievement({ ...base, trigger: 'visit_island', triggerParams: { count: 0 } }),
      ),
    ).toMatch(/fuera de rango/);
    expect(
      await reason(
        actions.saveAchievement({
          ...base,
          trigger: 'complete_circuit',
          triggerParams: { circuit: 'no-existe' },
        }),
      ),
    ).toMatch(/no existe/);
    expect(
      await reason(
        actions.saveAchievement({
          ...base,
          trigger: 'visit_island',
          triggerParams: { count: 2 },
          scope: 'season',
        }),
      ),
    ).toMatch(/temporada/);
    expect(
      await reason(
        actions.saveAchievement({
          ...base,
          trigger: 'time_played',
          triggerParams: { minutes: 5 },
          startsAt: '2026-11-01T00:00:00+01:00',
          endsAt: '2026-10-01T00:00:00+02:00',
        }),
      ),
    ).toMatch(/termina antes/);
  });
});

describe('música con licencia (REQ-ADM-020)', () => {
  const src = `data:audio/mpeg;base64,${Buffer.from('ID3 muestra').toString('base64')}`;

  it('se guarda con licencia y origen, siempre muestra', async () => {
    const { repo, actions } = setup();
    const track = await actions.saveMusic({
      title: 'Brisa',
      src,
      licence: 'CC BY 4.0',
      origin: 'Equipo BOIA',
      worldId: registry.defaultId,
    });
    expect(track).toMatchObject({ id: 'musica-brisa', sample: true, kind: 'ambient' });
    expect(await repo.content.list('music')).toHaveLength(1);
  });

  it('sin licencia o sin audio no se guarda', async () => {
    const { actions } = setup();
    expect(
      await reason(actions.saveMusic({ title: 'X', src, licence: ' ', origin: 'Yo' })),
    ).toMatch(/licencia/);
    expect(
      await reason(
        actions.saveMusic({
          title: 'X',
          src: 'data:image/png;base64,AAAA',
          licence: 'L',
          origin: 'Yo',
        }),
      ),
    ).toMatch(/audio/);
  });
});

it('AdminError es lo que ve la interfaz', () => {
  expect(new AdminError('x').name).toBe('AdminError');
});
