import type { EnterSource } from '@boia/engine/intro';
import type { IntroData } from './load';
import type * as RunModule from './run';
import type { IntroView } from './run';

/**
 * The hero's runtime (`run.ts`: the controller, the scroll, the paint loop
 * and the analytics it sends) out of the landing's critical path (plan 007
 * T80): the page's chunk carries only this loader, and `run.ts` arrives in
 * its own chunk while React hydrates. Before it arrives nothing is lost: the
 * boot script already marked the entry and fast-forwards on a scroll,
 * «Zarpar» is a plain link to /mar and «Entradas» opens the panel; an
 * «Entradas» pressed in the meantime fast-forwards the appearance when the
 * runtime lands. The request starts when the page's chunk runs, so `run.ts`
 * is usually there by the time React mounts the hero and asks for the scene.
 */

type Run = typeof RunModule;

let mod: Run | null = null;
let loading: Promise<Run> | null = null;
let pendingSkip = false;

function load(): Promise<Run> {
  if (!loading) {
    loading = import('./run').then((m) => (mod = m));
  }
  return loading;
}

// Start fetching as soon as the page's chunk runs (in parallel with hydration).
if (typeof window !== 'undefined') void load().catch(() => {});

/** Hooks a mount of the hero's scene to this load's hero; returns the detach. */
export function attachIntro(data: IntroData, view: IntroView): () => void {
  let detach: (() => void) | null = null;
  let gone = false;
  load().then(
    (m) => {
      if (gone) return;
      detach = m.attachIntro(data, view);
      if (pendingSkip) {
        pendingSkip = false;
        m.skipIntro();
      }
    },
    (err: unknown) => {
      // Without the runtime the page stays as the server painted it (static hero).
      console.warn('[boia] el hero no cargó; se queda la página sin escena', err);
      if (!gone) window.__boiaEntry?.reveal('none');
    },
  );
  return () => {
    gone = true;
    detach?.();
  };
}

/** «Entradas» during the appearance: the hero jumps to the rest (now or when it lands). */
export function skipIntro(): void {
  if (mod) mod.skipIntro();
  else pendingSkip = true;
}

/** «Zarpar»: whether the hero took it (before the runtime lands, the link navigates). */
export function enterIntro(source: EnterSource = 'button'): boolean {
  return mod ? mod.enterIntro(source) : false;
}
