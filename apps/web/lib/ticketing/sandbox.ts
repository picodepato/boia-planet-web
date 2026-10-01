import { EVENT_STATE_BEHAVIOR, eventKicker, eventState } from '@boia/contracts';
import type { BoiaRepository } from '@boia/store';
import { completeBySignal } from '../mundo/achievements';
import { trackSandboxPurchase } from '../analytics';
import type {
  CheckoutEvent,
  CheckoutSession,
  CheckoutStart,
  PurchaseOutcome,
  TicketingAdapter,
} from './adapter';
import { quoteFor } from './pricing';

/** Los logros de la entrada se buscan por su disparador, no por un id fijo. */
export const TICKET_TRIGGER = 'buy_ticket';

export interface SandboxOptions {
  now?: () => Date;
  /** Id de compra nuevo; por defecto, aleatorio. */
  newPurchaseId?: (eventId: string) => string;
}

function randomId(eventId: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `sbx-${eventId}-${rand}`.slice(0, 100);
}

/**
 * Ticketera de la versión de prueba (D-20, REQ-COM-035): sin proveedor ni
 * pago. `start` calcula el precio `muestra` con el descuento encontrado que
 * valga; `confirm` registra la compra en el repositorio, que concede el sello
 * una vez por id de compra (y ninguno más si ese evento ya tenía sello), y
 * completa los logros de entradas que toquen (se reclaman aparte, D-22). Todo
 * queda en este navegador.
 */
export function createSandboxTicketing(
  repo: BoiaRepository,
  opts: SandboxOptions = {},
): TicketingAdapter {
  const now = opts.now ?? (() => new Date());
  const newId = opts.newPurchaseId ?? randomId;

  return {
    provider: 'sandbox',
    isTest: true,

    async start(eventId): Promise<CheckoutStart> {
      const event = (await repo.content.events()).find((e) => e.id === eventId);
      if (!event) return { ok: false, reason: 'not_found', event: null };
      const view: CheckoutEvent = {
        id: event.id,
        name: event.name,
        format: eventKicker(event),
        startsAt: event.startsAt,
        timeZone: event.timeZone,
        placeLabel: event.placeLabel,
      };
      // Con el estado de ahora (REQ-COM-004): un evento pasado ya no se compra.
      if (!EVENT_STATE_BEHAVIOR[eventState(event, now())].purchasable) {
        return { ok: false, reason: 'not_on_sale', event: view };
      }
      const found = await repo.progress.discounts();
      return {
        ok: true,
        session: {
          purchaseId: newId(event.id),
          event: view,
          quote: quoteFor(event, found, now()),
          flow: { kind: 'inline' },
        },
      };
    },

    async confirm(session: CheckoutSession): Promise<PurchaseOutcome> {
      const { purchase, first, stamp } = await repo.purchases.confirmSandbox({
        purchaseId: session.purchaseId,
        eventId: session.event.id,
        quantity: session.quote.quantity,
        discountId: session.quote.discount?.id ?? null,
        amountCents: session.quote.totalCents,
      });
      // En la versión de prueba el sandbox hace de webhook (REQ-ARQ-019).
      if (first) {
        trackSandboxPurchase({
          eventId: purchase.eventId,
          provider: 'sandbox',
          orderRef: purchase.id,
          ...(purchase.discountId ? { discountId: purchase.discountId } : {}),
        });
      }
      // El repositorio no completa los logros de entradas: se piden aquí (con
      // los sellos ya en el libro), y son idempotentes por id de logro.
      const done = await completeBySignal(repo, {
        trigger: TICKET_TRIGGER,
        eventId: purchase.eventId,
      });
      const justDone = done[0]?.definition;
      const base = justDone
        ? null
        : (await repo.progress.achievements()).find((a) => a.definition.trigger === TICKET_TRIGGER)
            ?.definition;
      const achievement: PurchaseOutcome['achievement'] = justDone
        ? { id: justDone.id, title: justDone.title, granted: true }
        : base
          ? { id: base.id, title: base.title, granted: false }
          : null;
      return {
        purchaseId: purchase.id,
        eventId: purchase.eventId,
        firstConfirmation: first,
        stamp: stamp.granted ? 'granted' : stamp.reason,
        achievement,
      };
    },
  };
}
