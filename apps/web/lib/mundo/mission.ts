import type { Notice } from '@boia/engine/ui';
import type { MissionEvent, SavedRescue } from '@boia/engine/mission';
import type { BoiaRepository, ProgressApi } from '@boia/store';
import { recordSignal } from './achievements';
import { type ProgressOutcome, discountFound, rewardTitle } from './world-progress';
import { t } from '../i18n';

/**
 * La misión de la Boia Fiestera en el repositorio local (T21,
 * REQ-AVE-005…010): el motor (`@boia/engine/mission`) la juega y aquí se
 * guarda su paso, se conceden su logro y su premio grande (una vez para
 * siempre, también tras recargar) y se escriben sus avisos. El destino se
 * guarda por id de lugar y mundo (temporada), nunca por coordenadas. Textos
 * y premios son `muestra` [pendiente Álvaro].
 */

type Repo = Pick<BoiaRepository, 'progress' | 'content'>;

/** El aviso del rescate (REQ-AVE-006), tal cual. */
export const BOARDED_NOTICE = {
  title: t('mission.rescued.title'),
  body: t('juego.mission.boiaFiesteraRescatadaDestino'),
} as const;

/** La celebración de la entrega. muestra */
export const DELIVERED_NOTICE = {
  title: t('juego.mission.fiestaEnLaUltima'),
  body: t('juego.mission.laBoiaFiesteraYa'),
} as const;

/** Reacción ocasional de la tripulante a un descubrimiento (REQ-AVE-007). muestra */
export const CREW_REACTIONS = [
  t('juego.mission.laFiesteraUyQue'),
  t('juego.mission.laFiesteraAquiMontaba'),
  t('juego.mission.laFiesteraEstoSale'),
] as const;

export function crewReaction(n: number): string {
  return CREW_REACTIONS[Math.abs(n) % CREW_REACTIONS.length]!;
}

/** Origen estable del premio de la entrega: uno por misión, para siempre. */
export const deliveryRewardRef = (missionId: string) => `mision:${missionId}:entrega`;

export function boardedNotice(missionId: string): Notice {
  return { id: `mision:${missionId}:a-bordo`, kind: 'info', ...BOARDED_NOTICE };
}

export function deliveredNotice(missionId: string): Notice {
  return { id: `mision:${missionId}:entregada`, kind: 'info', ...DELIVERED_NOTICE };
}

/** Lo guardado de la misión, en la forma del motor; null si no ha empezado. */
export async function loadMission(
  progress: ProgressApi,
  missionId: string,
): Promise<SavedRescue | null> {
  const m = await progress.mission(missionId);
  const destination = m?.data.destination;
  if (!m || typeof destination !== 'string') return null;
  if (m.step === 'delivered' || m.completedAt) return { step: 'delivered', destination };
  if (m.step === 'rescued') return { step: 'rescued', destination };
  return null;
}

/**
 * Guarda lo que toca de un evento de la misión y devuelve los avisos que
 * sólo existen si el repositorio concedió algo ahora (logros, premio).
 * `worldId` es el mundo que se juega: la temporada del destino.
 */
export async function persistMissionEvent(
  repo: Repo,
  e: MissionEvent,
  ctx: { worldId: string },
): Promise<Notice[]> {
  const p = repo.progress;
  switch (e.type) {
    case 'rescued': {
      const prev = await p.mission(e.missionId);
      // Ya rescatada o entregada (otra pestaña, otra visita): no se retrocede.
      if (!prev || (prev.step !== 'rescued' && prev.step !== 'delivered')) {
        await p.setMission(e.missionId, {
          step: 'rescued',
          data: { character: e.character, destination: e.destination, season: ctx.worldId },
          worldId: ctx.worldId,
        });
      }
      return recordSignal(repo, { trigger: 'rescue_character', character: e.character });
    }
    case 'delivered': {
      const prev = await p.mission(e.missionId);
      const out: Notice[] = [];
      if (!prev?.completedAt) {
        await p.setMission(e.missionId, {
          step: 'delivered',
          data: {
            character: e.character,
            destination: e.destination,
            deliveredIn: ctx.worldId,
          },
          completed: true,
        });
      }
      const { points, coins } = e.reward;
      if (points + coins > 0) {
        const sourceRef = deliveryRewardRef(e.missionId);
        const r = await p.grantWorldReward({ sourceRef, points, coins, policy: 'once' });
        if (r.granted) {
          const parts = [
            ...(points > 0 ? [rewardTitle('points', points)] : []),
            ...(coins > 0 ? [rewardTitle('coins', coins)] : []),
          ];
          out.push({ id: `premio:${sourceRef}`, kind: 'reward', title: parts.join(' · ') });
        }
      }
      out.push(
        ...(await recordSignal(repo, { trigger: 'deliver_character', character: e.character })),
      );
      return out;
    }
    default:
      return [];
  }
}

/**
 * El código de entradas de la entrega (T59): la misión central premia con un
 * descuento (`reward.discount` del destino) que se encuentra una sola vez,
 * como los escondidos, y la compra aplica. Lo que devuelve es lo de
 * `discountFound`: la ficha del código y su aviso, o nada si ya lo tenía.
 */
export async function deliveryDiscount(
  progress: ProgressApi,
  e: Extract<MissionEvent, { type: 'delivered' }>,
  ctx: { sessionId: string; worldId: string },
): Promise<ProgressOutcome[]> {
  const id = e.reward.discount;
  if (!id) return [];
  return discountFound(progress, id, ctx);
}

/**
 * Quien ya entregó a la Fiestera antes de que la entrega diera código (o en
 * otra pestaña) lo recibe al volver: si la misión está entregada y su
 * destino da un código que aún no tiene, se le da ahora (una vez).
 */
export async function missedDeliveryDiscount(
  progress: ProgressApi,
  missionId: string,
  discountId: string | null,
  ctx: { sessionId: string; worldId: string },
): Promise<ProgressOutcome[]> {
  if (!discountId) return [];
  const m = await progress.mission(missionId);
  if (!m?.completedAt) return [];
  return discountFound(progress, discountId, ctx);
}
