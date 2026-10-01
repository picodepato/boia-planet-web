import { WorldRuntime } from '@boia/engine';
import {
  type MissionEvent,
  type MissionHost,
  type Point,
  RescueMission,
  missionDestination,
  rescueMissionOf,
} from '@boia/engine/mission';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { type ComposedWorld, WORLD_REGISTRY, type WorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { BOARDED_NOTICE, deliveryRewardRef, loadMission, persistMissionEvent } from './mission';

/**
 * La misión de la Fiestera de punta a punta con el repositorio local (T21):
 * el motor la juega, aquí se guarda. Los pasos van en orden, el premio de
 * la entrega se concede una vez aunque se recargue, y el destino (por id de
 * lugar) sobrevive al cambio de mundo. Cada «visita» es un repositorio y un
 * runtime nuevos sobre el mismo almacenamiento.
 */

const DT = 1 / 60;
const worlds = WORLD_REGISTRY;
const home = worlds.get(worlds.defaultId);
const other = worlds.get(worlds.list().find((w) => w.id !== home.id)!.id);

function browser() {
  const storage = new MemoryStorage();
  const clock = new Date('2026-09-29T18:00:00Z');
  return () => createLocalRepository({ storage, now: () => clock, watch: false });
}

/** Una visita: repositorio, runtime del mundo y misión con lo guardado. */
async function visit(
  open: () => ReturnType<typeof createLocalRepository>,
  composed: ComposedWorld,
) {
  const world: WorldConfig = composed.config;
  const repo = open();
  const rt = new WorldRuntime(world);
  let passenger = false;
  const host: MissionHost = {
    moveObject: (id, x, y, z) => rt.moveObject(id, x, y, z),
    setObjectPresent: (id, on) => rt.setObjectPresent(id, on),
    setObjectInteractive: (id, on) => rt.setObjectInteractive(id, on),
    setPassenger: (on) => {
      passenger = on;
    },
  };
  const spec = rescueMissionOf(world)!;
  const mission = new RescueMission(world, spec);
  mission.restore(await loadMission(repo.progress, spec.missionId));
  const sail = async (p: Point, seconds: number) => {
    const events: MissionEvent[] = [];
    const notices = [];
    for (let t = 0; t < seconds; t += DT) {
      for (const e of mission.step(host, p, DT)) {
        events.push(e);
        notices.push(...(await persistMissionEvent(repo, e, { worldId: composed.id })));
      }
    }
    return { events: events.filter((e) => !e.type.startsWith('croc_')), notices };
  };
  return { repo, rt, mission, spec, sail, passenger: () => passenger };
}

describe('la misión de la Fiestera, guardada', () => {
  it('rescate y entrega en orden; el premio grande, una vez aunque se recargue', async () => {
    const open = browser();
    const v1 = await visit(open, home);
    const { spec } = v1;
    const dest = missionDestination(home.config, spec.destination)!;
    expect(v1.mission.phase).toBe('waiting');

    // Llegar primero al destino no hace nada.
    expect((await v1.sail(dest.center, 1)).events).toEqual([]);

    // Al remanso: se sumergen, sube a bordo, se guarda y sale el logro del rescate.
    const near = { x: spec.home.x, y: spec.home.y + spec.rescueRadius / 2 };
    const r = await v1.sail(near, 4);
    expect(r.events.map((e) => e.type)).toEqual(['rescued', 'boarded']);
    expect(r.notices.map((n) => n.kind)).toContain('achievement');
    const saved = await v1.repo.progress.mission(spec.missionId);
    expect(saved).toMatchObject({ step: 'rescued', worldId: home.id });
    expect(saved!.data).toMatchObject({ destination: spec.destination, season: home.id });
    // Nunca coordenadas en lo guardado.
    expect(JSON.stringify(saved!.data)).not.toMatch(/"[xy]":/);

    // Recarga: sigue a bordo, sin repetir el rescate.
    const v2 = await visit(open, home);
    expect(v2.mission.phase).toBe('aboard');
    expect((await v2.sail(near, 2)).events).toEqual([]);
    expect(v2.passenger()).toBe(true);

    // Entrega: logro (listo para reclamar) y premio grande, una vez.
    const before = await v2.repo.progress.balances();
    const d = await v2.sail(dest.center, 2);
    expect(d.events.map((e) => e.type)).toEqual(['delivered', 'landed']);
    expect(d.notices.map((n) => n.kind).sort()).toEqual(['achievement', 'reward']);
    const after = await v2.repo.progress.balances();
    const deliverDef = (await v2.repo.content.list('achievements')).find(
      (x) =>
        x.trigger === 'deliver_character' &&
        (x.triggerParams as Record<string, unknown>).character === spec.character,
    )!;
    // El premio del logro llega al reclamarlo (D-22); aquí sólo el de la misión.
    expect(after.points - before.points).toBe(dest.reward.points);
    expect(after.coins - before.coins).toBe(dest.reward.coins);
    const deliverState = (await v2.repo.progress.achievements()).find(
      (a) => a.definition.id === deliverDef.id,
    )?.state;
    expect(deliverState).toBe('ready');
    expect(await v2.repo.progress.mission(spec.missionId)).toMatchObject({ step: 'delivered' });

    // Otra visita: entregada, se queda en su isla y el premio no vuelve.
    const v3 = await visit(open, home);
    expect(v3.mission.phase).toBe('delivered');
    expect((await v3.sail(dest.center, 2)).events).toEqual([]);
    // Aunque el evento llegara otra vez (otra pestaña), el libro no repite.
    const dup = await persistMissionEvent(
      v3.repo,
      {
        type: 'delivered',
        missionId: spec.missionId,
        character: spec.character,
        destination: spec.destination,
        reward: dest.reward,
      },
      { worldId: home.id },
    );
    expect(dup).toEqual([]);
    const rewards = (await v3.repo.progress.ledger()).filter(
      (e) => e.sourceRef === deliveryRewardRef(spec.missionId),
    );
    expect(rewards).toHaveLength(1);
  });

  it('el destino guardado sobrevive a cambiar de mundo', async () => {
    const open = browser();
    const v1 = await visit(open, home);
    const near = { x: v1.spec.home.x, y: v1.spec.home.y + v1.spec.rescueRadius / 2 };
    await v1.sail(near, 4);
    expect(v1.mission.phase).toBe('aboard');

    // Recarga en el otro mundo: la misma misión, a bordo, con el destino guardado.
    const v2 = await visit(open, other);
    expect(v2.mission.phase).toBe('aboard');
    expect(v2.mission.destination).toBe(v1.spec.destination);
    const dest = missionDestination(other.config, v2.mission.destination)!;
    const d = await v2.sail(dest.center, 2);
    expect(d.events.map((e) => e.type)).toEqual(['delivered', 'landed']);
    const saved = await v2.repo.progress.mission(v1.spec.missionId);
    expect(saved).toMatchObject({ step: 'delivered', worldId: home.id });
    expect(saved!.data).toMatchObject({ season: home.id, deliveredIn: other.id });
  });

  it('el aviso del rescate dice lo que pide REQ-AVE-006', () => {
    expect(`${BOARDED_NOTICE.title} · ${BOARDED_NOTICE.body}`).toBe(
      'Nueva tripulante a bordo · Boia Fiestera rescatada · Destino: última isla',
    );
  });
});
