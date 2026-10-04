import type { WorldConfig, WorldObject } from '@boia/world';

/** Sólo impulsos/rampas y pasos de boia; nunca fichas, premios, encuentros o carrera. */
export function circuitInteractivesOf(world: WorldConfig): WorldObject[] {
  return world.objects.flatMap((o) => {
    if (!o.identity.active) return [];
    const behaviors = o.behaviors.filter(
      (b) => (b.type === 'collision' && b.params.mode === 'boost') || b.type === 'checkpoint',
    );
    if (!behaviors.length) return [];
    return [{ ...o, behaviors, params: { jump: o.params?.jump } }];
  });
}
