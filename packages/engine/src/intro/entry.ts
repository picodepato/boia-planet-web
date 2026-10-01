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
}

export const LANDED_EVENT = 'boia:landed';

/**
 * Script en línea que va antes del contenido de la landing. Decide el modo,
 * lo marca en `<html data-entry>` y, si toca cinemática (o su variante
 * reducida), oculta la landing con `<html data-intro="play">` (CSS) hasta
 * que la escena llegue. Garantías aunque el JavaScript de la app nunca
 * llegue a ejecutarse:
 * - «Saltar animación» y «Solo quiero ver las entradas» funcionan antes de
 *   hidratar (cualquier `[data-intro-skip]`);
 * - si nadie toma el relevo en `capMs` con la pestaña a la vista, la landing
 *   se muestra. El tope no corre con la pestaña oculta (una carga en segundo
 *   plano espera a que se mire) ni compite con el plazo de la escena: ese lo
 *   lleva el controlador desde el montaje.
 * Sin JavaScript el script no corre y la landing sale tal cual.
 */
export function bootScript(opts: {
  capMs: number;
  /** Recursos que la cinemática necesita primero; se piden ya, sólo si se va a reproducir. */
  preload?: readonly string[];
}): string {
  return `(function(){try{
var decide=${decideEntry.toString()};
var d=document.documentElement,w=window,doc=document,reduced=false;
try{reduced=w.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){}
var mode=decide({pathname:location.pathname,search:location.search,hash:location.hash,reducedMotion:reduced});
var entry=w.__boiaEntry={mode:mode,t0:performance.now(),claimed:false,skipped:false,landed:null,timer:0,
reveal:function(o){if(entry.landed)return;entry.landed=o;clearTimeout(entry.timer);entry.timer=0;d.removeAttribute("data-intro");
try{w.dispatchEvent(new CustomEvent(${JSON.stringify(LANDED_EVENT)},{detail:{intro:o}}));}catch(e){}}};
d.setAttribute("data-entry",mode);
if(mode==="direct"){entry.landed="none";return;}
d.setAttribute("data-intro","play");
var pre=${JSON.stringify(opts.preload ?? [])};for(var i=0;i<pre.length;i++){new Image().src=pre[i];}
var arm=function(){if(entry.claimed||entry.landed||entry.timer||doc.hidden)return;
entry.timer=setTimeout(function(){entry.timer=0;if(!entry.claimed)entry.reveal("none");},${Math.round(opts.capMs)});};
doc.addEventListener("visibilitychange",function(){if(doc.hidden){clearTimeout(entry.timer);entry.timer=0;}else arm();});
arm();
doc.addEventListener("click",function(e){var t=e.target;
if(!entry.claimed&&t&&t.closest&&t.closest("[data-intro-skip]")){entry.skipped=true;entry.reveal("skipped");}},true);
}catch(e){document.documentElement.removeAttribute("data-intro");}})();`;
}
