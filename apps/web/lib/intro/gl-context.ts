/**
 * The landing hero's WebGL context, as the browser can take it away (plan
 * 030 T289, REQ-ARQ-016): an app switch, memory pressure, another WebGL tab
 * (/mar), a locked screen. A pure state, so the rules are tested apart from
 * the scene (`run.ts` feeds it the canvas's `webglcontextlost` /
 * `webglcontextrestored` events and its own wait):
 *
 * - `running`: the scene paints.
 * - `lost`: the context is gone; the static version shows (no black hole)
 *   and the scene waits for the browser to give it back.
 * - `fallback`: the static version for the rest of the visit (the context
 *   did not come back in time, or it went away too many times).
 */

export type GlState = 'running' | 'lost' | 'fallback';

/** `lost` / `restored`: the canvas's events; `timeout`: no restore within `GL_RESTORE_WAIT_MS`. */
export type GlEvent = 'lost' | 'restored' | 'timeout';

export interface GlTrack {
  readonly state: GlState;
  /** Times the context went away in this visit. */
  readonly losses: number;
  /** Times it came back. */
  readonly restores: number;
}

/** How long (ms, with the page in view) the scene waits for its context to come back. */
export const GL_RESTORE_WAIT_MS = 5000;

/** The loss that makes the static version stay for the rest of the visit. */
export const GL_MAX_LOSSES = 3;

export const GL_START: GlTrack = { state: 'running', losses: 0, restores: 0 };

export function glNext(t: GlTrack, e: GlEvent): GlTrack {
  if (t.state === 'fallback') return t;
  switch (e) {
    case 'lost': {
      const losses = t.losses + 1;
      return { ...t, losses, state: losses >= GL_MAX_LOSSES ? 'fallback' : 'lost' };
    }
    case 'restored':
      return t.state === 'lost' ? { ...t, state: 'running', restores: t.restores + 1 } : t;
    case 'timeout':
      return t.state === 'lost' ? { ...t, state: 'fallback' } : t;
  }
}

/** Whether the scene paints (otherwise the static version shows). */
export const glPaints = (t: GlTrack): boolean => t.state === 'running';
