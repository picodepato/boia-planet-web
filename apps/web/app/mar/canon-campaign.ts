import { SURVIVORS_CONFIG, type SurvivorsConfig, actFinalBoss } from '@boia/engine/survivors';

/**
 * La campaña del Cañón (plan 012 T144, §8): vencer al boss final de un acto
 * abre el siguiente. Acto 1 (Barco Fantasma) → acto 2 (Kraken); el acto 3
 * (el Capitán, beta 4) se enseña cerrado, «próximamente», hasta que exista
 * en la config.
 *
 * Se guarda en los contadores del progreso (`ProgressApi.counter` /
 * `increment`): en modo local, en el repositorio de este navegador, como el
 * resto del progreso del invitado; con cuenta (Supabase), en la misma copia,
 * que viaja con `save_snapshot` y se mezcla tomando el mayor de cada
 * contador. Sin tablas nuevas. Un contador por acto: las veces que cayó su
 * boss final.
 */

/** Los actos de la campaña del diseño (§8): los que aún no existen salen como «próximamente». */
export const CAMPAIGN_ACTS = 3;

/** El contador de un acto: veces que cayó su boss final. */
export function campaignCounter(act: number): string {
  return `canon:acto-${act}:boss-final`;
}

/** Lo que la campaña necesita del progreso (`repo.progress`). */
export interface CampaignStore {
  counter(name: string): Promise<number>;
  increment(name: string, by?: number): Promise<number>;
}

export interface CampaignProgress {
  /** Los actos cuyo boss final ya cayó, en orden. */
  readonly beaten: readonly number[];
}

export const EMPTY_CAMPAIGN: CampaignProgress = { beaten: [] };

/** Cómo sale un acto en el panel: jugable, cerrado (falta vencer al anterior) o aún sin hacer. */
export type ActState = 'open' | 'locked' | 'soon';

export interface CampaignAct {
  act: number;
  state: ActState;
  /** Su boss final ya cayó alguna vez. */
  beaten: boolean;
}

/** Lee la campaña del progreso. */
export async function readCampaign(
  store: CampaignStore,
  config: SurvivorsConfig = SURVIVORS_CONFIG,
): Promise<CampaignProgress> {
  const acts = config.acts.map((a) => a.act).sort((a, b) => a - b);
  const counts = await Promise.all(acts.map((a) => store.counter(campaignCounter(a))));
  return { beaten: acts.filter((_, i) => (counts[i] ?? 0) > 0) };
}

/** Apunta que cayó el boss final del acto `act` (sólo actos de la config con boss final). */
export async function recordFinalBoss(
  store: CampaignStore,
  act: number,
  config: SurvivorsConfig = SURVIVORS_CONFIG,
): Promise<boolean> {
  if (!actFinalBoss(act, config)) return false;
  await store.increment(campaignCounter(act));
  return true;
}

/** Los actos del panel, del 1 al `CAMPAIGN_ACTS` (o más, si la config trae más). */
export function campaignActs(
  progress: CampaignProgress,
  config: SurvivorsConfig = SURVIVORS_CONFIG,
): CampaignAct[] {
  const inConfig = new Set(config.acts.map((a) => a.act));
  const last = Math.max(CAMPAIGN_ACTS, ...inConfig);
  const beaten = new Set(progress.beaten);
  const out: CampaignAct[] = [];
  for (let act = 1; act <= last; act++) {
    const state: ActState = !inConfig.has(act)
      ? 'soon'
      : act === 1 || beaten.has(act - 1)
        ? 'open'
        : 'locked';
    out.push({ act, state, beaten: beaten.has(act) });
  }
  return out;
}

/** ¿Se puede jugar el acto `act`? */
export function actUnlocked(
  progress: CampaignProgress,
  act: number,
  config: SurvivorsConfig = SURVIVORS_CONFIG,
): boolean {
  return campaignActs(progress, config).some((a) => a.act === act && a.state === 'open');
}

/** El acto elegido si se puede jugar; si no, el 1. */
export function playableAct(
  progress: CampaignProgress,
  act: number,
  config: SurvivorsConfig = SURVIVORS_CONFIG,
): number {
  return actUnlocked(progress, act, config) ? act : 1;
}
