import { describe, expect, it } from 'vitest';
import {
  GL_MAX_LOSSES,
  GL_START,
  glNext,
  glPaints,
  type GlEvent,
  type GlTrack,
} from './gl-context';

const run = (...events: GlEvent[]): GlTrack => events.reduce(glNext, GL_START);

describe('the hero survives losing its WebGL context (plan 030 T289)', () => {
  it('starts painting', () => {
    expect(GL_START.state).toBe('running');
    expect(glPaints(GL_START)).toBe(true);
  });

  it('running → lost (static version) → restored → running', () => {
    const lost = run('lost');
    expect(lost.state).toBe('lost');
    expect(glPaints(lost)).toBe(false);
    const back = glNext(lost, 'restored');
    expect(back).toEqual({ state: 'running', losses: 1, restores: 1 });
    expect(glPaints(back)).toBe(true);
  });

  it('no restore in time: the static version for the rest of the visit', () => {
    const t = run('lost', 'timeout');
    expect(t.state).toBe('fallback');
    expect(glNext(t, 'restored').state).toBe('fallback');
    expect(glNext(t, 'lost').state).toBe('fallback');
    expect(glPaints(glNext(t, 'restored'))).toBe(false);
  });

  it(`lost ${GL_MAX_LOSSES} times: the static version stays`, () => {
    const events: GlEvent[] = [];
    for (let i = 1; i < GL_MAX_LOSSES; i++) events.push('lost', 'restored');
    expect(run(...events).state).toBe('running');
    const t = run(...events, 'lost');
    expect(t.state).toBe('fallback');
    expect(t.losses).toBe(GL_MAX_LOSSES);
    expect(glNext(t, 'restored').state).toBe('fallback');
  });

  it('a timeout or a restore while running changes nothing', () => {
    expect(run('timeout')).toEqual(GL_START);
    expect(run('restored')).toEqual(GL_START);
    expect(run('lost', 'restored', 'timeout').state).toBe('running');
  });
});
