import { describe, expect, it } from 'vitest';
import { GL_RESTORE_WAIT_MS, type GlTrack } from '../../../lib/intro/gl-context';
import { GlWatch, type GlWatchHost } from './gl-watch';

/** A canvas and a page that are only event targets, and a clock that is advanced by hand. */
function setup() {
  const listeners = new Map<string, Set<(e: Event) => void>>();
  const target = (): Pick<HTMLCanvasElement, 'addEventListener' | 'removeEventListener'> => ({
    addEventListener: (t: string, f: unknown) => {
      const set = listeners.get(t) ?? new Set();
      set.add(f as (e: Event) => void);
      listeners.set(t, set);
    },
    removeEventListener: (t: string, f: unknown) => {
      listeners.get(t)?.delete(f as (e: Event) => void);
    },
  });
  const canvas = target();
  const doc = { hidden: false, ...target() };
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const host: GlWatchHost = {
    doc,
    setTimer: (fn, ms) => {
      timers.set(next, { at: now + ms, fn });
      return next++;
    },
    clearTimer: (id) => void timers.delete(id),
  };
  const fire = (type: string) => {
    const e = {
      type,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    listeners.get(type)?.forEach((f) => f(e as unknown as Event));
    return e;
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  const changes: GlTrack[] = [];
  const watch = new GlWatch(canvas, (t) => changes.push(t), host);
  return { watch, fire, advance, changes, doc, listeners };
}

describe('/mar survives losing its WebGL context (plan 032 T299)', () => {
  it('starts painting', () => {
    const { watch } = setup();
    expect(watch.paints).toBe(true);
  });

  it('context lost: paused, the browser is told to give it back, the web is told', () => {
    const { watch, fire, changes } = setup();
    const e = fire('webglcontextlost');
    expect(e.defaultPrevented).toBe(true);
    expect(watch.paints).toBe(false);
    expect(changes.map((c) => c.state)).toEqual(['lost']);
  });

  it('context restored: it resumes', () => {
    const { watch, fire, changes, advance } = setup();
    fire('webglcontextlost');
    fire('webglcontextrestored');
    expect(watch.paints).toBe(true);
    expect(changes.map((c) => c.state)).toEqual(['lost', 'running']);
    // The wait is over: no late fallback.
    advance(GL_RESTORE_WAIT_MS * 2);
    expect(watch.paints).toBe(true);
  });

  it('no restore in time, in view: fallback (the web offers to reload)', () => {
    const { watch, fire, changes, advance } = setup();
    fire('webglcontextlost');
    advance(GL_RESTORE_WAIT_MS - 1);
    expect(watch.state.state).toBe('lost');
    advance(1);
    expect(watch.state.state).toBe('fallback');
    expect(changes.map((c) => c.state)).toEqual(['lost', 'fallback']);
  });

  it('a locked screen or an app switch is not a failure: the wait only runs in view', () => {
    const { watch, fire, doc, advance, listeners } = setup();
    doc.hidden = true;
    fire('webglcontextlost');
    advance(GL_RESTORE_WAIT_MS * 3);
    expect(watch.state.state).toBe('lost');
    // Back in view: the wait starts now, and a restore ends it.
    doc.hidden = false;
    listeners.get('visibilitychange')?.forEach((f) => f({} as Event));
    advance(GL_RESTORE_WAIT_MS - 1);
    fire('webglcontextrestored');
    advance(GL_RESTORE_WAIT_MS);
    expect(watch.state.state).toBe('running');
  });

  it('dispose removes the listeners and the wait', () => {
    const { watch, fire, advance, changes } = setup();
    fire('webglcontextlost');
    watch.dispose();
    advance(GL_RESTORE_WAIT_MS * 2);
    fire('webglcontextrestored');
    expect(changes.map((c) => c.state)).toEqual(['lost']);
  });
});
