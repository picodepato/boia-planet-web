import type { GuestListApi } from '@boia/store';
import { gameRepository } from '../repo';
import { browserSupabase } from '../supabase/browser';
import { isSupabaseConfigured } from '../supabase/config';
import { localGuestList, supabaseGuestList } from './index';

/**
 * El cliente de la lista que toca (plan 034 T308): sin las variables de
 * Supabase, la demo de este navegador (D-20); con ellas, las RPC con la
 * sesión de este navegador. null en el servidor con Supabase (allí no hay
 * sesión de nadie): se llama desde el navegador (efectos, clics).
 */
export function guestListClient(): GuestListApi | null {
  if (!isSupabaseConfigured()) return localGuestList(gameRepository());
  const sb = browserSupabase();
  return sb ? supabaseGuestList(sb) : null;
}
