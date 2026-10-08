import { canBuy } from '@boia/contracts';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';

/**
 * El primer evento a la venta con checkout online. Halloween es «Solo en
 * puerta» (plan 019 T215, decisión 6): las e2e que compran usan éste para
 * seguir cubriendo el checkout.
 */
export const ONLINE_EVENT = SAMPLE_CONTENT.events.find((e) => canBuy(e) && !e.boxOfficeOnly)!;

/** Los que se venden sólo en la puerta. */
export const BOX_OFFICE_EVENTS = SAMPLE_CONTENT.events.filter((e) => canBuy(e) && e.boxOfficeOnly);
