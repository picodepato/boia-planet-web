import type { ProgressApi } from '@boia/store';
import { t } from '../i18n';

/** Profile preference: opening Mi Barco manually also completes the introduction. */
export const SHIP_MENU_SEEN = 'barco:menu-abierto';

export async function markShipMenuSeen(progress: ProgressApi): Promise<void> {
  await progress.setPref(SHIP_MENU_SEEN, true);
}

export async function discoverShipMenu(progress: ProgressApi): Promise<boolean> {
  if (await progress.pref(SHIP_MENU_SEEN)) return false;
  await markShipMenuSeen(progress);
  return true;
}

export const CASTAWAY_REVISIT = t('naufrago.revisit');
