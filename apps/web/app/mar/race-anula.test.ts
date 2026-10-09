import { CircuitRace, type RaceEvent, circuitFromWorld, circuitRecordId } from '@boia/engine/circuit';
import { createLocalRepository } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { loadGhost, raceStepInvalid, raceVisibilityInvalid } from './race';

/**
 * REQ-AVE-032, intento invalidado: los cuatro casos en /mar. El panel anula
 * al abrirse (`invalidate('panel')` en cada panel de `mar-client.tsx`); la
 * pestaña oculta, con `raceVisibilityInvalid` en `visibilitychange`; el
 * teletransporte, con `raceStepInvalid` en cada paso (`Mar3D.jumpCount` o un
 * viaje/vuelo en curso); la recarga no deja nada: el intento vive en memoria
 * y sólo la meta (`finish`) guarda récord y fantasma.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const idOf = (order: number) => spec.gates.find((g) => g.order === order)!.objectId;

/** Una carrera en marcha: salida, «Empezar», «¡Ya!» y la primera boia. */
function midRace(): { race: CircuitRace; t: number; events: RaceEvent[] } {
  const race = new CircuitRace(spec);
  const events = [...race.checkpoint(0, 0, idOf(0)), ...race.start(0)];
  const go = spec.countdown;
  events.push(...race.tick(go), ...race.checkpoint(1, go + 2, idOf(1)));
  return { race, t: go + 2, events };
}

/** Anula con `reason` y comprueba que la boia siguiente ya no cuenta. */
function expectVoided(race: CircuitRace, reason: ReturnType<typeof raceVisibilityInvalid>, t: number) {
  expect(reason).not.toBeNull();
  expect(race.invalidate(reason!)).toEqual({ type: 'invalid', reason });
  expect(race.active).toBe(false);
  expect(race.checkpoint(2, t + 2, idOf(2))).toEqual([]);
}

describe('intento invalidado en /mar: panel, pestaña, recarga y teletransporte (REQ-AVE-032)', () => {
  it('panel: abrir un panel anula la vuelta en curso', () => {
    const { race, t } = midRace();
    expect(race.racing).toBe(true);
    expectVoided(race, 'panel', t);
  });

  it('pestaña: ocultarla anula; volver a verla, no', () => {
    expect(raceVisibilityInvalid('visible')).toBeNull();
    const { race, t } = midRace();
    expectVoided(race, raceVisibilityInvalid('hidden'), t);
  });

  it('teletransporte: un salto del barco o un viaje solo anulan; navegar, no', () => {
    expect(raceStepInvalid({ jumpsBefore: 3, jumpsNow: 3, autopilot: false })).toBeNull();
    expect(raceStepInvalid({ jumpsBefore: 3, jumpsNow: 3, autopilot: true })).toBe('teleport');
    const { race, t } = midRace();
    expectVoided(race, raceStepInvalid({ jumpsBefore: 3, jumpsNow: 4, autopilot: false }), t);
  });

  it('recarga: el intento no se guarda; tras recargar no hay carrera ni récord ni fantasma', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    const ghosts = new Map<string, string>();
    const { events, t } = midRace();
    // Nada de lo que pasa antes de la meta guarda algo: récord y fantasma salen de `finish`.
    expect(events.some((e) => e.type === 'finish')).toBe(false);
    const reloaded = new CircuitRace(spec);
    expect(reloaded.active).toBe(false);
    expect(reloaded.checkpoint(2, t + 2, idOf(2))).toEqual([]);
    expect(await repo.progress.record(circuitRecordId(spec))).toBeNull();
    expect(loadGhost({ getItem: (k) => ghosts.get(k) ?? null }, spec)).toBeNull();
  });
});
