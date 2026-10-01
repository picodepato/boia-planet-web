import type { BehaviorType, FeedbackAnimation, FeedbackSound, WorldConfig } from '@boia/world';
import type { WorldEvent } from '@boia/engine';

/**
 * Respuesta inmediata a cada interacción del mundo (REQ-PRO-011): qué sonido
 * y qué animación de serie tocan con un evento. Lo que declare el
 * comportamiento que lo produjo manda; si no declara nada, la de por defecto
 * del juego (recoger suena «ping», el boost hace WHOOSH).
 */
export interface Feedback {
  sound: FeedbackSound | null;
  animation: FeedbackAnimation | null;
}

/**
 * Qué comportamiento del objeto produce cada evento. El choque con un objeto
 * de COLISIÓN suena en `contact`; su efecto (boost, ralentizar) sólo trae el
 * sonido por defecto, para no sonar dos veces.
 */
const EVENT_BEHAVIOR: Partial<Record<WorldEvent['type'], BehaviorType>> = {
  proximity_enter: 'proximity',
  contact: 'collision',
  collected: 'collectible',
  reward: 'reward',
  content_open: 'content',
  ticket: 'ticket',
  checkpoint: 'checkpoint',
  teleport: 'teleport',
  achievement: 'achievement',
  minigame: 'start_minigame',
};

/** Sonido por defecto de un evento sin sonido declarado. */
function defaultSound(e: WorldEvent): FeedbackSound | null {
  if (e.type === 'collected') return 'ping';
  if (e.type === 'effect' && e.effect === 'boost') return 'whoosh';
  return null;
}

export function feedbackFor(e: WorldEvent, world: WorldConfig): Feedback | null {
  const type = EVENT_BEHAVIOR[e.type];
  const object = world.objects.find((o) => o.identity.id === e.objectId);
  const behavior = type ? object?.behaviors.find((b) => b.type === type) : undefined;
  const declared =
    behavior && 'sound' in behavior.params
      ? (behavior.params as { sound?: FeedbackSound; animation?: FeedbackAnimation })
      : {};
  const sound = declared.sound ?? defaultSound(e);
  const animation = declared.animation ?? null;
  return sound || animation ? { sound, animation } : null;
}
