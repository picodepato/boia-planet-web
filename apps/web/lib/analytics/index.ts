import {
  CLIENT_FUNNEL_EVENTS,
  type ClientFunnelEvent,
  type FunnelEvent,
  type FunnelEventProps,
} from '@boia/contracts/analytics';

/**
 * El embudo (D-04, REQ-ARQ-019) con contadores propios (plan 032 T301), sin
 * terceros: cada paso suma uno al contador del día en Supabase
 * (`funnel_hit`, sólo acepta los pasos del embudo) o, en modo local (D-20),
 * en este navegador (`./local-counts`), para que el panel «Embudo» del Admin
 * funcione en la demo. Sin cookies, sin datos personales y sin ningún
 * identificador de visitante.
 *
 * `track()` es la única entrada. Cada paso cuenta como mucho una vez por
 * visita: lo apuntado de esta pestaña va en `sessionStorage` (sólo los
 * nombres de los pasos; se borra al cerrar la pestaña). Un paso que no llegó
 * (la página navegó antes) se manda al cargar la siguiente página.
 *
 * Interruptor del Admin (plan 019 T223, decisión 17): no sale nada mientras
 * la analítica esté apagada (lo está por defecto). Lo lee `./sink` a demanda,
 * fuera de la ruta crítica, como el envío: aquí sólo queda lo mínimo.
 *
 * Todo evento queda además en `window.__boiaAnalytics`, para depurar y para
 * las pruebas e2e. `purchase_confirmed` no se puede emitir con `track`: lo
 * mandará el servidor desde el webhook verificado de la ticketera
 * (REQ-COM-017, sin construir). La compra de prueba (`trackSandboxPurchase`)
 * sólo lo apunta en la página.
 */

export interface CapturedEvent {
  event: FunnelEvent;
  properties: Record<string, unknown>;
  timestamp: string;
}

declare global {
  interface Window {
    __boiaAnalytics?: CapturedEvent[];
  }
}

/** Lee si la analítica está encendida en el Admin. */
export type AnalyticsSwitchReader = () => Promise<boolean>;
/** Suma un paso a los contadores; true si llegó. */
export type FunnelSender = (event: ClientFunnelEvent) => Promise<boolean>;

const sink = () => import('./sink');
const readFromAdmin: AnalyticsSwitchReader = async () => (await sink()).readAnalyticsSwitch();
const sendToSink: FunnelSender = async (event) => (await sink()).sendFunnelStep(event);

let reader: AnalyticsSwitchReader = readFromAdmin;
let sender: FunnelSender = sendToSink;
let enabled: Promise<boolean> | null = null;

/** ¿Encendida en el Admin? Se lee una vez por página; si no se puede leer, apagada. */
export function analyticsEnabled(): Promise<boolean> {
  enabled ??= reader().then(
    (on) => on === true,
    () => false,
  );
  return enabled;
}

/** El Admin acaba de encenderla o apagarla: vale ya en esta pestaña. */
export function setAnalyticsSwitch(on: boolean): void {
  enabled = Promise.resolve(on);
}

/** Para las pruebas: otro lector del interruptor (null: el del Admin). Olvida lo leído. */
export function setAnalyticsSwitchReader(next: AnalyticsSwitchReader | null): void {
  reader = next ?? readFromAdmin;
  enabled = null;
}

/** Para las pruebas: otro destino de los pasos (null: el de verdad). */
export function setFunnelSender(next: FunnelSender | null): void {
  sender = next ?? sendToSink;
}

/** Clave de `sessionStorage` con los pasos de esta visita. */
export const VISIT_KEY = 'boia.embudo.visita';

/** Por paso: 1, apuntado y aún sin confirmar; 2, contado (o descartado, apagada). */
type Visit = Partial<Record<string, 1 | 2>>;

let visitCache: Visit | null = null;
const inflight = new Set<string>();

function visit(): Visit {
  if (!visitCache) {
    try {
      const v: unknown = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? '{}');
      visitCache = v && typeof v === 'object' ? (v as Visit) : {};
    } catch {
      visitCache = {};
    }
  }
  return visitCache;
}

function mark(event: string, state: 1 | 2): void {
  const v = visit();
  v[event] = state;
  try {
    sessionStorage.setItem(VISIT_KEY, JSON.stringify(v));
  } catch {
    // Sin almacenamiento (modo privado): la visita vale mientras dure la página.
  }
}

export function track<E extends ClientFunnelEvent>(event: E, props: FunnelEventProps[E]): void {
  // Sólo los pasos del embudo: un nombre desconocido no se apunta ni se manda.
  if (typeof window === 'undefined' || !CLIENT_FUNNEL_EVENTS.includes(event)) return;
  capture(event, props);
  if (visit()[event]) return;
  mark(event, 1);
  flush();
}

/** Manda los pasos apuntados que aún no llegaron (los de una página anterior también). */
function flush(): void {
  const v = visit();
  const pending = CLIENT_FUNNEL_EVENTS.filter((e) => v[e] === 1 && !inflight.has(e));
  if (pending.length === 0) return;
  for (const e of pending) inflight.add(e);
  void analyticsEnabled().then((on) =>
    Promise.all(
      pending.map(async (e) => {
        // Apagada: se descarta, no se manda más tarde.
        const done = on ? await sender(e).catch(() => false) : true;
        inflight.delete(e);
        if (done) mark(e, 2);
      }),
    ),
  );
}

// Lo que quedó sin llegar en la página anterior (p. ej. «Explorar» → /mar),
// en cuanto acabe de cargar el módulo.
if (typeof window !== 'undefined') setTimeout(flush, 0);

/**
 * `purchase_confirmed` de la compra de prueba (T43): en la versión de prueba
 * no hay webhook ni servidor (D-20). Sólo queda en la página (para depurar y
 * para las pruebas); los contadores no lo aceptan.
 */
export function trackSandboxPurchase(
  props: FunnelEventProps['purchase_confirmed'] & { provider: 'sandbox' },
): void {
  if (typeof window !== 'undefined') capture('purchase_confirmed', props);
}

function capture<E extends FunnelEvent>(event: E, props: FunnelEventProps[E]): void {
  (window.__boiaAnalytics ??= []).push({
    event,
    properties: { ...props, $pathname: window.location.pathname },
    timestamp: new Date().toISOString(),
  });
}
