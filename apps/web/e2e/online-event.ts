import { type BoiaEvent, canBuy } from '@boia/contracts';
import { MemoryStorage, STORE_KEY, createLocalRepository } from '@boia/store';
import type { Page } from '@playwright/test';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * La venta online en las e2e (plan 030 T292). En la muestra, ALL DAY BOIA y
 * BOIA Nochevieja llevan «Tickets todavía no disponibles» y Halloween es
 * «Solo en puerta»: no queda ningún evento con checkout online. Las e2e que
 * compran abren la venta de los dos en este navegador, como lo haría el
 * Admin de la demo («Probar admin»): `openSales(page)` antes de cargar la
 * página (y después de las semillas propias de la spec, que sólo escriben si
 * no hay nada). El contenido de la muestra no cambia.
 */

/** Los eventos de la muestra con la venta cerrada («todavía no», T292). */
export const NOT_YET_EVENTS = SAMPLE_CONTENT.events.filter((e) => e.ticketsNotYet);

/** El evento, con la venta abierta (lo que ve la página tras `openSales`). */
export const opened = (e: BoiaEvent): BoiaEvent => ({ ...e, ticketsNotYet: false });

/** Los eventos de la muestra tal como los ve una página con `openSales`. */
export const OPENED_EVENTS: BoiaEvent[] = SAMPLE_CONTENT.events.map((e) =>
  e.ticketsNotYet ? opened(e) : e,
);

/**
 * El primer evento a la venta con checkout online (con `openSales`).
 * Halloween es «Solo en puerta» (plan 019 T215, decisión 6): las e2e que
 * compran usan éste para seguir cubriendo el checkout.
 */
export const ONLINE_EVENT = OPENED_EVENTS.find((e) => canBuy(e) && !e.boxOfficeOnly)!;

/**
 * Los que se venden sólo en la puerta y no van en lista: una fiesta en lista
 * (plan 034 T309, Halloween) lleva «Apuntarse en la lista» (lista.spec.ts).
 */
export const BOX_OFFICE_EVENTS = SAMPLE_CONTENT.events.filter(
  (e) => canBuy(e) && e.boxOfficeOnly && !e.guestList,
);

/** Las fiestas en lista (plan 034 T309). */
export const GUEST_LIST_EVENTS = SAMPLE_CONTENT.events.filter((e) => canBuy(e) && e.guestList);

let prepared: Promise<{ doc: string; entries: Record<string, unknown> }> | null = null;

/** El documento de un navegador cuyo Admin abrió la venta, y sus entradas de eventos. */
function salesDoc() {
  prepared ??= (async () => {
    const storage = new MemoryStorage();
    const repo = createLocalRepository({ storage, watch: false });
    for (const e of NOT_YET_EVENTS) await repo.admin.upsert('events', opened(e));
    const doc = storage.getItem(STORE_KEY)!;
    const items = (JSON.parse(doc) as { content: { items: { events: Record<string, unknown> } } })
      .content.items.events;
    const entries = Object.fromEntries(NOT_YET_EVENTS.map((e) => [e.id, items[e.id]]));
    return { doc, entries };
  })();
  return prepared;
}

/**
 * Abre la venta de ALL DAY BOIA y Nochevieja en este navegador antes de
 * cargar cada página. Sin documento guardado, deja el del Admin; con uno (la
 * semilla de la spec), le añade esos eventos si no los tiene ya. Llamar
 * después de las semillas propias de la spec.
 */
export async function openSales(page: Page): Promise<void> {
  const { doc, entries } = await salesDoc();
  await page.addInitScript(
    ([key, full, add]) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          window.localStorage.setItem(key, full);
          return;
        }
        const d = JSON.parse(raw) as {
          content?: { items?: { events?: Record<string, unknown> } };
        };
        d.content ??= {};
        d.content.items ??= {};
        const events = (d.content.items.events ??= {});
        let changed = false;
        for (const [id, entry] of Object.entries(add)) {
          if (events[id] === undefined) {
            events[id] = entry;
            changed = true;
          }
        }
        if (changed) window.localStorage.setItem(key, JSON.stringify(d));
      } catch {
        // sin almacenamiento: la prueba fallará más abajo, con su motivo
      }
    },
    [STORE_KEY, doc, entries] as const,
  );
}
