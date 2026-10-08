import type { ClientFunnelEvent, FunnelEvent, FunnelEventProps } from '@boia/contracts/analytics';

/**
 * Embudo en PostHog, nube UE (D-04, REQ-ARQ-019), sin SDK: cada evento es un
 * POST a la API pública de captura. Motivos: cero kB en la ruta crítica y
 * nada guardado en el navegador (identificador anónimo en memoria, sin
 * cookies ni localStorage), así que no hace falta banner de consentimiento.
 * Sin `NEXT_PUBLIC_POSTHOG_KEY` no sale nada de la página; los eventos sólo
 * quedan en `window.__boiaAnalytics` para depurar y para las pruebas e2e.
 *
 * Interruptor del Admin (plan 019 T223, decisión 17): con la clave puesta,
 * tampoco sale nada mientras la analítica esté apagada en el Admin (lo está
 * por defecto). Lo lee `./switch` a demanda (fuera de la ruta crítica): con
 * Supabase, `site_settings.analytics_enabled`; en modo local, los ajustes
 * del Admin de este navegador.
 *
 * `purchase_confirmed` no se puede emitir con `track`: lo manda el servidor
 * desde el webhook verificado de la ticketera (REQ-COM-017). La única
 * excepción es la compra de prueba (`trackSandboxPurchase`), que en la
 * versión sin servidor hace de ticketera (D-20).
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

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let distinctId: string | undefined;

/** Lee si la analítica está encendida en el Admin. */
export type AnalyticsSwitchReader = () => Promise<boolean>;

const readFromAdmin: AnalyticsSwitchReader = async () =>
  (await import('./switch')).readAnalyticsSwitch();

let reader: AnalyticsSwitchReader = readFromAdmin;
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

// Con la clave, el interruptor se lee pronto: así el primer evento no espera
// (p. ej. uno justo antes de navegar).
if (KEY && typeof window !== 'undefined') void analyticsEnabled();

function anonymousId(): string {
  distinctId ??=
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return distinctId;
}

export function track<E extends ClientFunnelEvent>(event: E, props: FunnelEventProps[E]): void {
  capture(event, props);
}

/**
 * `purchase_confirmed` de la compra de prueba (T43, REQ-ARQ-019): en la
 * versión de prueba no hay webhook ni servidor (D-20), así que lo emite el
 * sandbox al confirmar, con `provider: 'sandbox'`. Con la ticketera real
 * vuelve a salir sólo del servidor y esto se retira con el sandbox.
 */
export function trackSandboxPurchase(
  props: FunnelEventProps['purchase_confirmed'] & { provider: 'sandbox' },
): void {
  capture('purchase_confirmed', props);
}

function capture<E extends FunnelEvent>(event: E, props: FunnelEventProps[E]): void {
  if (typeof window === 'undefined') return;
  const record: CapturedEvent = {
    event,
    properties: {
      ...props,
      $pathname: window.location.pathname,
      $lib: 'boia-web',
      // Eventos anónimos: PostHog no crea perfil de persona.
      $process_person_profile: false,
    },
    timestamp: new Date().toISOString(),
  };
  (window.__boiaAnalytics ??= []).push(record);
  if (!KEY) return;
  const key = KEY;
  void analyticsEnabled().then((on) => {
    if (on) send(key, record);
  });
}

function send(key: string, record: CapturedEvent): void {
  const body = JSON.stringify({ api_key: key, distinct_id: anonymousId(), ...record });
  try {
    // text/plain evita el preflight CORS; keepalive deja salir el evento
    // aunque la página navegue (Explorar, ticketera).
    void fetch(`${HOST}/i/v0/e/`, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }).catch(() => undefined);
  } catch {
    // La analítica nunca rompe la página.
  }
}
