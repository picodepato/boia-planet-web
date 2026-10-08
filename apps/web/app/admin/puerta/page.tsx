import type { Metadata } from 'next';
import { isSupabaseConfigured } from '../../../lib/supabase/config';
import { t } from '../../../lib/i18n';
import { DemoAdminGate } from '../demo-gate';
import { RealAdminGate } from '../real/gate';
import '../admin.css';

export const metadata: Metadata = {
  title: t('puerta.metaTitle'),
  robots: { index: false, follow: false },
};

/**
 * El lector de la puerta (plan 019 T218, decisión 11), con la misma entrada
 * que el Admin: sin Supabase, el Carnet 000 de la demo; con cuentas, el
 * código del email y el TOTP (editor o más).
 */
export default function DoorScannerPage() {
  return isSupabaseConfigured() ? <RealAdminGate door /> : <DemoAdminGate door />;
}
