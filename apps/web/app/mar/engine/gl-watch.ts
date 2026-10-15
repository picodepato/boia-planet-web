import {
  GL_RESTORE_WAIT_MS,
  GL_START,
  glNext,
  glPaints,
  type GlEvent,
  type GlTrack,
} from '../../../lib/intro/gl-context';

/**
 * The WebGL context of /mar's canvas, as the browser can take it away (plan 032
 * T299, REQ-ARQ-016; the landing does the same since T289): an app switch,
 * memory pressure, a locked screen. The rules are `lib/intro/gl-context.ts`
 * (the same pure state); this watches the canvas' `webglcontextlost` /
 * `webglcontextrestored` events and the wait, apart from three.js so it is
 * tested without a GPU. On a loss the sea stops (no simulation, no paint) and
 * the web shows a calm notice; three.js rebuilds its GPU resources by itself on
 * a restore; no restore in `GL_RESTORE_WAIT_MS` with the page in view (or too
 * many losses): `fallback`, the web offers to reload.
 */

/** What `GlWatch` needs from the page; the real `window` and `document` by default. */
export interface GlWatchHost {
  /** The page document: `hidden` and `visibilitychange` (the wait only runs in view). */
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
  setTimer(fn: () => void, ms: number): number;
  clearTimer(id: number): void;
}

const pageHost = (): GlWatchHost => ({
  doc: document,
  setTimer: (fn, ms) => window.setTimeout(fn, ms),
  clearTimer: (id) => window.clearTimeout(id),
});

export class GlWatch {
  private track: GlTrack = GL_START;
  private timer = 0;
  private disposed = false;

  constructor(
    private readonly canvas: Pick<HTMLCanvasElement, 'addEventListener' | 'removeEventListener'>,
    private readonly onChange: (t: GlTrack) => void,
    private readonly host: GlWatchHost = pageHost(),
  ) {
    canvas.addEventListener('webglcontextlost', this.onLost, false);
    canvas.addEventListener('webglcontextrestored', this.onRestored, false);
    this.host.doc.addEventListener('visibilitychange', this.arm);
  }

  get state(): GlTrack {
    return this.track;
  }

  /** Whether the sea simulates and paints (otherwise it is paused). */
  get paints(): boolean {
    return glPaints(this.track);
  }

  dispose(): void {
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored, false);
    this.host.doc.removeEventListener('visibilitychange', this.arm);
    this.stopTimer();
  }

  private readonly onLost = (e: Event) => {
    // Without this the browser never gives the context back.
    e.preventDefault();
    this.event('lost');
  };

  private readonly onRestored = () => this.event('restored');

  private event(e: GlEvent): void {
    if (this.disposed) return;
    const before = this.track.state;
    this.track = glNext(this.track, e);
    this.arm();
    if (this.track.state !== before) this.onChange(this.track);
  }

  /** The wait runs while lost and in view, and stops otherwise (a locked screen is not a failure). */
  private readonly arm = () => {
    const waits = this.track.state === 'lost' && !this.host.doc.hidden && !this.disposed;
    if (!waits) this.stopTimer();
    else if (!this.timer) {
      this.timer = this.host.setTimer(() => {
        this.timer = 0;
        this.event('timeout');
      }, GL_RESTORE_WAIT_MS);
    }
  };

  private stopTimer(): void {
    if (this.timer) this.host.clearTimer(this.timer);
    this.timer = 0;
  }
}
