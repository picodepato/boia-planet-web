'use client';

import { useEffect, useState } from 'react';
import { adminClient } from '../../../lib/account/admin-auth';
import type { BoiaSupabase } from '../../../lib/supabase/browser';

/** El cliente con la sesión del Admin, sólo con cuentas (sin Supabase no hay a quién pedirlo). */
export function useDoorSupabase(real: boolean): BoiaSupabase | null {
  const [sb, setSb] = useState<BoiaSupabase | null>(null);
  useEffect(() => {
    if (!real) return;
    let alive = true;
    adminClient().then(
      (c) => alive && setSb(c),
      (e: unknown) => console.warn('[boia] puerta: sin cliente del Admin', e),
    );
    return () => {
      alive = false;
    };
  }, [real]);
  return sb;
}
