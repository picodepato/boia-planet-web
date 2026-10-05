import { SURVIVORS_CONFIG, type SurvivorsConfig, actFinalBoss } from '@boia/engine/survivors';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_ACTS,
  EMPTY_CAMPAIGN,
  actUnlocked,
  campaignActs,
  campaignCounter,
  playableAct,
  readCampaign,
  recordFinalBoss,
} from './canon-campaign';

/**
 * La campaña del Cañón (plan 012 T144): el acto 2 se abre al vencer al boss
 * final del 1; el 3 sale «próximamente»; lo vencido se guarda en el progreso
 * del invitado (modo local) y se vuelve a leer en otra visita.
 */

const ACTS = SURVIVORS_CONFIG.acts.map((a) => a.act);
const LAST = Math.max(...ACTS);

describe('campaña T144: actos del panel', () => {
  it('de primeras sólo el acto 1; los demás de la config cerrados; los que faltan, próximamente', () => {
    const acts = campaignActs(EMPTY_CAMPAIGN);
    expect(acts.map((a) => a.act)).toEqual(Array.from({ length: Math.max(CAMPAIGN_ACTS, LAST) }, (_, i) => i + 1));
    expect(acts[0]).toEqual({ act: 1, state: 'open', beaten: false });
    for (const a of acts.slice(1)) {
      expect(a.state).toBe(ACTS.includes(a.act) ? 'locked' : 'soon');
    }
    // El acto 3 (el Capitán, beta 4) aún no existe: próximamente.
    expect(acts.find((a) => a.act === 3)?.state).toBe(ACTS.includes(3) ? 'locked' : 'soon');
    expect(actUnlocked(EMPTY_CAMPAIGN, 2)).toBe(false);
    expect(playableAct(EMPTY_CAMPAIGN, 2)).toBe(1);
  });

  it('vencer al boss final de un acto abre el siguiente (si existe)', () => {
    const acts = campaignActs({ beaten: [1] });
    expect(acts.find((a) => a.act === 1)).toMatchObject({ state: 'open', beaten: true });
    expect(acts.find((a) => a.act === 2)).toMatchObject({ state: 'open', beaten: false });
    expect(playableAct({ beaten: [1] }, 2)).toBe(2);
    const all = campaignActs({ beaten: ACTS });
    for (const a of all) {
      expect(a.state).toBe(ACTS.includes(a.act) ? 'open' : 'soon');
      expect(a.beaten).toBe(ACTS.includes(a.act));
    }
  });

  it('un acto que llega a la config sale cerrado hasta vencer el anterior', () => {
    const three: SurvivorsConfig = {
      ...SURVIVORS_CONFIG,
      acts: [...SURVIVORS_CONFIG.acts, { ...SURVIVORS_CONFIG.acts[1]!, act: LAST + 1 }],
    };
    expect(campaignActs({ beaten: [1] }, three).find((a) => a.act === LAST + 1)?.state).toBe('locked');
    expect(campaignActs({ beaten: ACTS }, three).find((a) => a.act === LAST + 1)?.state).toBe('open');
  });
});

describe('campaña T144: se guarda en el progreso local', () => {
  it('lo vencido se apunta, sobrevive a otra visita y abre el acto siguiente', async () => {
    const storage = new MemoryStorage();
    const repo = createLocalRepository({ storage, watch: false });
    expect(await readCampaign(repo.progress)).toEqual({ beaten: [] });
    expect(await recordFinalBoss(repo.progress, 1)).toBe(true);
    // Otra visita (otro repositorio sobre el mismo almacenamiento) lo lee igual.
    const later = createLocalRepository({ storage, watch: false });
    const progress = await readCampaign(later.progress);
    expect(progress).toEqual({ beaten: [1] });
    expect(actUnlocked(progress, 2)).toBe(ACTS.includes(2));
    expect(await later.progress.counter(campaignCounter(1))).toBe(1);
    // Repetir suma, no cambia nada más.
    await recordFinalBoss(later.progress, 1);
    expect(await readCampaign(later.progress)).toEqual({ beaten: [1] });
    // Vencer al Kraken lo apunta también.
    expect(actFinalBoss(2)).toBe('kraken');
    await recordFinalBoss(later.progress, 2);
    expect((await readCampaign(createLocalRepository({ storage, watch: false }).progress)).beaten).toEqual([1, 2]);
  });

  it('un acto sin boss final (o que no existe) no se apunta', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    expect(await recordFinalBoss(repo.progress, LAST + 1)).toBe(false);
    expect(await repo.progress.counter(campaignCounter(LAST + 1))).toBe(0);
  });
});
