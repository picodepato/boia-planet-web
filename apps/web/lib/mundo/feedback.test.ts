import { type WorldConfig, Behavior } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { worlds } from './demo-world';
import { feedbackFor } from './feedback';

const world = worlds.get(worlds.defaultId).config;

function withBehavior(w: WorldConfig, objectId: string, b: Behavior): WorldConfig {
  return {
    ...w,
    objects: w.objects.map((o) =>
      o.identity.id === objectId
        ? { ...o, behaviors: [...o.behaviors.filter((x) => x.type !== b.type), b] }
        : o,
    ),
  };
}

describe('respuesta a cada interacción (REQ-PRO-011)', () => {
  const id = world.objects[0]!.identity.id;

  it('sin nada declarado: recoger suena «ping» y el boost hace WHOOSH', () => {
    const bare = withBehavior(world, id, Behavior.parse({ type: 'collectible' }));
    expect(feedbackFor({ type: 'collected', objectId: id }, bare)).toEqual({
      sound: 'ping',
      animation: null,
    });
    const boost = {
      type: 'effect',
      objectId: id,
      effect: 'boost',
      factor: 1.6,
      duration: 2,
    } as const;
    expect(feedbackFor(boost, bare)?.sound).toBe('whoosh');
    expect(feedbackFor({ type: 'proximity_exit', objectId: id }, bare)).toBeNull();
  });

  it('el sonido y la animación que declara el comportamiento mandan', () => {
    const declared = withBehavior(
      world,
      id,
      Behavior.parse({ type: 'collectible', params: { sound: 'chime', animation: 'spin' } }),
    );
    expect(feedbackFor({ type: 'collected', objectId: id }, declared)).toEqual({
      sound: 'chime',
      animation: 'spin',
    });
    const touch = withBehavior(
      world,
      id,
      Behavior.parse({ type: 'collision', params: { mode: 'bounce', sound: 'bump' } }),
    );
    expect(feedbackFor({ type: 'contact', objectId: id, mode: 'bounce' }, touch)?.sound).toBe(
      'bump',
    );
  });

  it('un sonido o una animación que no son de serie no pasan el esquema', () => {
    expect(Behavior.safeParse({ type: 'reward', params: { sound: 'trompeta' } }).success).toBe(
      false,
    );
    expect(Behavior.safeParse({ type: 'reward', params: { animation: 'baile' } }).success).toBe(
      false,
    );
  });
});
