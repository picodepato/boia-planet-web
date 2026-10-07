import { canBuy } from '@boia/contracts';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * El primer evento a la venta con checkout online. Halloween y SONIDO se
 * venden sólo en taquilla (plan 017 T199, decisión 8): las e2e que compran
 * usan éste para seguir cubriendo el checkout.
 */
export const ONLINE_EVENT = SAMPLE_CONTENT.events.find((e) => canBuy(e) && !e.boxOfficeOnly)!;

/** Los que se venden sólo en taquilla. */
export const BOX_OFFICE_EVENTS = SAMPLE_CONTENT.events.filter((e) => canBuy(e) && e.boxOfficeOnly);
