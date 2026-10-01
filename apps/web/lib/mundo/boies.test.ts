import { rectGap, sectorsOf } from '@boia/engine/streaming';
import { MemoryStorage, SAMPLE_ACHIEVEMENTS, createLocalRepository } from '@boia/store';
import { INFO_BOIES, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { unreachablePlaces } from '../admin/validate';
import { buoyFoundTitle, recordBuoy, signalFromWorldEvent, worldBuoys } from './achievements';

/**
 * Las seis boies (O12, D-23; T45): la primera y cinco informativas en la ruta
 * del mapa compartido, con sus textos en cada mundo, dentro de un sector (se
 * cargan por sectores, T47), al alcance del barco y contando para el logro
 * «Las seis boies», que ahora se puede conseguir navegando.
 */

const sixBoies = SAMPLE_ACHIEVEMENTS.find(
  (a) => a.trigger === 'find_buoy' && (a.triggerParams as { count?: number }).count === 6,
)!;

describe('las seis boies del mapa compartido', () => {
  it('cada mundo tiene las boies que pide el logro de las seis, con su arte y sus textos', () => {
    expect(sixBoies).toBeDefined();
    for (const id of WORLD_REGISTRY.ids()) {
      const w = WORLD_REGISTRY.get(id);
      const buoys = worldBuoys(w.config);
      expect(buoys.length, id).toBe(6);
      expect(buoys).toContain('puerto-boia');
      for (const b of INFO_BOIES) {
        expect(buoys, id).toContain(b.id);
        const o = w.config.objects.find((x) => x.identity.id === b.id)!;
        // El arte es la mascota (T39) y los bocadillos, los del mundo.
        expect(o.appearance.asset, id).toMatch(new RegExp(`^mundos/${id}/boias#info_\\d$`));
        const talk = o.behaviors.find((x) => x.type === 'dialogue');
        expect(talk?.type === 'dialogue' && talk.params.lines.length, id).toBe(2);
        const skinLines = WORLD_REGISTRY.skin(id).places[b.id]?.lines;
        expect(skinLines, `${id}/${b.id}`).toHaveLength(2);
      }
    }
    // Los bocadillos cambian de un mundo a otro; la posición, no.
    const [a, b] = WORLD_REGISTRY.ids().map((id) => WORLD_REGISTRY.get(id));
    for (const boia of INFO_BOIES) {
      const oa = a!.config.objects.find((x) => x.identity.id === boia.id)!;
      const ob = b!.config.objects.find((x) => x.identity.id === boia.id)!;
      expect(ob.position).toEqual(oa.position);
      expect(ob.identity.name).not.toBe(oa.identity.name);
    }
  });

  it('las boies caen dentro de un sector y el barco llega a todas desde la salida', () => {
    for (const id of WORLD_REGISTRY.ids()) {
      const world = WORLD_REGISTRY.get(id).config;
      const sectors = sectorsOf(world);
      const buoys = world.objects.filter((o) => worldBuoys(world).includes(o.identity.id));
      for (const o of buoys) {
        const inside = sectors.some((s) => {
          const gap = rectGap(s.area, o.position);
          return gap.dx === 0 && gap.dy === 0;
        });
        expect(inside, `${id}/${o.identity.id}`).toBe(true);
      }
      const unreachable = unreachablePlaces(world).map((o) => o.identity.id);
      expect(buoys.filter((o) => unreachable.includes(o.identity.id))).toEqual([]);
    }
  });

  it('hablar con las seis completa «Las seis boies», con el aviso n de 6 una sola vez', async () => {
    const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
    const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const ids = worldBuoys(world);
    const titles: string[] = [];
    for (const [i, objectId] of ids.entries()) {
      // La señal sale del evento del mundo, como en /juego.
      const signal = signalFromWorldEvent(
        { type: 'achievement', objectId, trigger: 'find_boia' } as never,
        world,
      );
      expect(signal).toEqual({ trigger: 'find_buoy', objectId });
      const notices = await recordBuoy(repo, objectId, world);
      expect(notices.at(-1)!.title).toBe(buoyFoundTitle(i + 1, ids.length));
      titles.push(...notices.map((n) => n.title));
    }
    expect(titles).toContain(sixBoies.title);
    const state = (await repo.progress.achievements()).find((a) => a.definition.id === sixBoies.id);
    expect(state?.state).toBe('ready');
    // Volver a hablar con una no repite el aviso.
    expect(await recordBuoy(repo, ids[0]!, world)).toEqual([]);
  });
});
