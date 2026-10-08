import { accountClient } from '../account/session';
import { isSupabaseConfigured } from '../supabase/config';
import { createLocalCalitas } from './local';
import type { CalitasModeration, CalitasStore } from './model';
import { createSharedCalitas } from './shared';

/**
 * El almacén de Las Calitas de la web: sin Supabase, el de este navegador
 * (muestra + los tuyos); con Supabase, el de todos. Uno por pestaña.
 */
let store: CalitasStore | null = null;
let localModeration: CalitasModeration | null = null;

export function calitasStore(): CalitasStore {
  if (store) return store;
  if (isSupabaseConfigured()) {
    store = createSharedCalitas(() => accountClient());
  } else {
    const local = createLocalCalitas();
    store = local.store;
    localModeration = local.moderation;
  }
  return store;
}

/** La moderación del Admin de la demo (modo local): la del mismo almacén. */
export function localCalitasModeration(): CalitasModeration {
  calitasStore();
  localModeration ??= createLocalCalitas().moderation;
  return localModeration;
}
