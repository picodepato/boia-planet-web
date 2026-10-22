import type { IntroMode } from './planet';

/**
 * La puerta de la entrada (REQ-ENT-001, 009, 010, 011; D-21): qué toca al
 * cargar la página, según la URL y nada más.
 * - `/` a secas, en cada carga completa o recarga: la entrada (la cinemática,
 *   o su variante quieta con movimiento reducido). No hay marca de «ya la vio».
 * - Una URL que apunta a algo concreto entra directa a su contenido, sin
 *   entrada: cualquier `#…` (`/#tickets`, `/#fotos`), cualquier parámetro
 *   propio de la web (`?menu=…`, `?intro=0`) o una ruta distinta de `/`.
 * - Los parámetros que añaden al compartir o en campañas no apuntan a nada y
 *   no cuentan (T57): `utm_*`, los identificadores de clic (`fbclid`,
 *   `gclid`…), los de Instagram, YouTube y Spotify (`igsh`, `si`), X (`s`,
 *   `ref_src`), `ref`, Linktree (`ltclid`, `lt_*`), WhatsApp (`wa_*`) y los
 *   de Mailchimp y Google Analytics.
 * - `?intro=1` la pide explícitamente («Ver la introducción») aunque la URL
 *   apunte a otra cosa.
 *
 * Autocontenida a propósito: `bootScript` la serializa con `toString()` y
 * la ejecuta en línea antes del primer pintado, sin esperar a React.
 */
export function decideEntry(input: {
  pathname: string;
  search: string;
  hash: string;
  reducedMotion: boolean;
}): IntroMode {
  let plainHome = input.pathname === '/' && input.hash.length <= 1;
  let replay = false;
  for (const part of input.search.replace(/^\?/, '').split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = eq < 0 ? part : part.slice(0, eq);
    if (key === 'intro' && eq > 0 && part.slice(eq + 1) === '1') replay = true;
    else if (
      !/^(utm_\w+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|ttclid|twclid|yclid|li_fat_id|igsh|igshid|si|s|ref|ref_src|ref_url|ltclid|lt_\w+|wa_\w+|mc_cid|mc_eid|_ga|_gl|srsltid)$/i.test(
        key,
      )
    )
      plainHome = false;
  }
  if (!plainHome && !replay) return 'direct';
  return input.reducedMotion ? 'reduced' : 'intro';
}

/**
 * Modo con el que arranca el montaje de la escena del hero: la entrada sólo
 * se reproduce si el script de arranque de esta carga la pidió y nadie la ha
 * resuelto aún (saltada antes de hidratar, tope agotado o ya reclamada).
 * Volver a `/` navegando dentro de la app no es una carga completa: React no
 * ejecuta el `<script>` de arranque que inserta, así que el montaje encuentra
 * la entrada de la carga anterior ya resuelta, o ninguna, y entra directo.
 */
export function mountMode(
  entry: Pick<BootEntry, 'mode' | 'claimed' | 'landed'> | undefined,
): IntroMode {
  if (!entry || entry.claimed || entry.landed) return 'direct';
  return entry.mode;
}

/** Estado que el script de arranque deja en `window.__boiaEntry`. */
export interface BootEntry {
  mode: IntroMode;
  /** `performance.now()` al ejecutarse el script. */
  t0: number;
  /** La escena de la entrada tomó el relevo. */
  claimed: boolean;
  /** Saltar pulsado antes de que React hidratase. */
  skipped: boolean;
  /** Cómo se llegó a la landing; `null` mientras la entrada sigue en curso. */
  landed: 'played' | 'skipped' | 'none' | null;
  /** Muestra la landing (una vez) y avisa con el evento `boia:landed`. */
  reveal(outcome: 'played' | 'skipped' | 'none'): void;
  /** Tope de seguridad del script en curso (0 si no corre); se cancela al tomar el relevo. */
  timer: number;
  /**
   * From how many viewport heights of scroll the header shows (`<html
   * data-hero-top>` comes off): `bootScript`'s `headerFrom`, or
   * `HEADER_FROM` with reduced motion.
   */
  headerFrom: number;
}

/** The header shows from here (viewport heights of scroll) when nothing else is said (T77 §7.2). */
export const HEADER_FROM = 0.95;

export const LANDED_EVENT = 'boia:landed';

/**
 * Script en línea que va antes del contenido de la landing (plan 007 T79).
 * Decide el modo y lo marca en `<html data-entry>`; with reduced motion it
 * marks `<html data-hero="still" data-hero-static>` (the static hero and
 * its one-screen track, before the first paint); if the appearance plays, `<html data-intro="play">` keeps the title
 * and the scroll hint hidden until the rest. `<html data-hero-top>` says the
 * page is still on the hero, or on what follows it before the content
 * (`headerFrom`: plan 022 T238, the landing's presentation): the header stays
 * hidden there. With reduced motion that stretch is the hero alone
 * (`HEADER_FROM`). Guarantees even
 * if the app's JavaScript never runs:
 * - «Entradas» (any `[data-intro-skip]`) and a scroll during the appearance
 *   fast-forward it before hydration (the app is then born at rest);
 * - si nadie toma el relevo en `capMs` con la pestaña a la vista, la landing
 *   se muestra. El tope no corre con la pestaña oculta (una carga en segundo
 *   plano espera a que se mire) ni compite con el plazo de la escena: ese lo
 *   lleva el controlador desde el montaje.
 * Sin JavaScript el script no corre y la landing sale tal cual.
 */
export function bootScript(opts: {
  capMs: number;
  /**
   * Viewport heights of scroll the header waits, with motion (default
   * `HEADER_FROM`); with reduced motion it is always `HEADER_FROM`.
   */
  headerFrom?: number;
  /** Recursos que la cinemática necesita primero; se piden ya, sólo si se va a reproducir. */
  preload?: readonly string[];
}): string {
  // Sin saltos de línea, con nombres cortos y sin el bucle de precarga si no hay
  // nada que pedir: el script va dos veces en el HTML de la landing y cuenta
  // para su presupuesto de bytes.
  const preload = opts.preload ?? [];
  const pre = preload.length
    ? `var pre=${JSON.stringify(preload)};for(var i=0;i<pre.length;i++){new Image().src=pre[i];}`
    : '';
  return `(function(){try{
var K=@@DECIDE@@;
var d=document.documentElement,w=window,c=document,r=!1;
try{r=w.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
var m=K({pathname:location.pathname,search:location.search,hash:location.hash,reducedMotion:r});
var h=r?${HEADER_FROM}:${Number(opts.headerFrom ?? HEADER_FROM)};
var E=w.__boiaEntry={mode:m,t0:performance.now(),claimed:!1,skipped:!1,landed:null,timer:0,headerFrom:h,
reveal:function(o){if(E.landed)return;E.landed=o;clearTimeout(E.timer);E.timer=0;d.removeAttribute("data-intro");
try{w.dispatchEvent(new CustomEvent(${JSON.stringify(LANDED_EVENT)},{detail:{intro:o}}))}catch(e){}}};
d.setAttribute("data-entry",m);
if(r){d.setAttribute("data-hero","still");d.setAttribute("data-hero-static","")}
var T=function(){if(w.scrollY<w.innerHeight*h)d.setAttribute("data-hero-top","");else d.removeAttribute("data-hero-top");
if(m==="intro"&&!E.claimed&&w.scrollY>0)E.reveal("skipped")};
T();w.addEventListener("scroll",T,{passive:!0});
if(m==="direct"){E.landed="none";return}
if(m==="intro")d.setAttribute("data-intro","play");
${pre}var A=function(){if(E.claimed||E.landed||E.timer||c.hidden)return;
E.timer=setTimeout(function(){E.timer=0;if(!E.claimed)E.reveal("none")},${Math.round(opts.capMs)})};
c.addEventListener("visibilitychange",function(){if(c.hidden){clearTimeout(E.timer);E.timer=0}else A()});
A();
c.addEventListener("click",function(e){var t=e.target;
if(!E.claimed&&t&&t.closest&&t.closest("[data-intro-skip]")){E.skipped=!0;E.reveal("skipped")}},!0);
}catch(e){document.documentElement.removeAttribute("data-intro")}})();`
    .replace(/\n/g, '')
    .replace('@@DECIDE@@', () => decideEntry.toString());
}
