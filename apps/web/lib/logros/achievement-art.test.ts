import { SAMPLE_ACHIEVEMENTS } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_ART_NAMES, achievementArtName } from './achievement-art';

describe('dibujos de los logros (plan 029 T274)', () => {
  it('every sample achievement with an iconKey has its drawing', () => {
    const withIcon = SAMPLE_ACHIEVEMENTS.filter((a) => a.iconKey);
    expect(withIcon.length).toBeGreaterThan(0);
    for (const a of withIcon) expect(achievementArtName(a.iconKey)).not.toBeNull();
  });

  it('an unknown or empty key has no drawing', () => {
    expect(achievementArtName('no-existe')).toBeNull();
    expect(achievementArtName(null)).toBeNull();
    expect(ACHIEVEMENT_ART_NAMES).toContain('ola');
  });
});
