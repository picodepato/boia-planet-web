import { DEFAULT_PLANET_INTRO, decideEntry } from '@boia/engine/intro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AFTER_LETTERS_MS, FLAT_TITLE_MS, lettersRiseMs, playsOrder, titleStageMs } from './stages';

const motion = DEFAULT_PLANET_INTRO.title;
const css = readFileSync(join(__dirname, '../../app/(landing)/landing.css'), 'utf8');

/** The selectors of the rule that hides things until their turn (landing.css). */
function hiddenSelectors(): string[] {
  const m = css.match(
    /((?:html\[data-[^{]+,\s*)*html\[data-[^{]+)\{\s*opacity: 0;\s*visibility: hidden;/,
  );
  return (m?.[1] ?? '').split(',').map((s) => s.trim().replace(/\s+/g, ' '));
}

describe('the order of the hero (plan 020 T227): globe, «BOIA», then the buttons', () => {
  it('plays on every plain load of `/`, not on a direct URL nor with reduced motion', () => {
    const at = (search: string, hash = '') =>
      decideEntry({ pathname: '/', search, hash, reducedMotion: false });
    expect(playsOrder(at(''), false)).toBe(true);
    expect(playsOrder(at('?utm_source=ig'), false)).toBe(true);
    expect(playsOrder(at('?intro=1'), false)).toBe(true);
    expect(playsOrder(at('?intro=0'), false)).toBe(false);
    expect(playsOrder(at('', '#tickets'), false)).toBe(false);
    expect(playsOrder(at(''), true)).toBe(false);
  });

  it('the buttons wait for the last 3D letter to land, or for the flat title', () => {
    const letters = motion.rise;
    expect(lettersRiseMs(motion, 4)).toBe(
      letters.delayMs + 3 * letters.staggerMs + letters.durationMs,
    );
    expect(titleStageMs(motion, 4)).toBe(lettersRiseMs(motion, 4) + AFTER_LETTERS_MS);
    expect(titleStageMs(motion, null)).toBe(FLAT_TITLE_MS);
    expect(lettersRiseMs(motion, 0)).toBe(letters.delayMs + letters.durationMs);
  });

  it('the CSS hides «BOIA» in the globe stage and the three buttons until the ready one', () => {
    const hidden = hiddenSelectors();
    for (const el of ['.hero__wordmark', '.hero__actions', '.hero__hint']) {
      // Before `run.ts`, the boot script's mark hides all three.
      expect(hidden).toContain(`html[data-intro='play'] ${el}`);
      expect(hidden).toContain(`html[data-hero-stage='globe'] ${el}`);
    }
    // In the title stage «BOIA» shows; «Zarpar» (with «Consigue descuentos») and «Desliza» do not.
    expect(hidden).not.toContain(`html[data-hero-stage='title'] .hero__wordmark`);
    expect(hidden).toContain(`html[data-hero-stage='title'] .hero__actions`);
    expect(hidden).toContain(`html[data-hero-stage='title'] .hero__hint`);
    expect(hidden.some((s) => s.includes("'ready'"))).toBe(false);
  });
});
