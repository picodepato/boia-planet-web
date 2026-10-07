import type { Metadata } from 'next';
import { ADMIN_COPY } from '../../lib/admin/copy';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { DemoAdminGate } from './demo-gate';
import { RealAdminGate } from './real/gate';
import './admin.css';
import { t } from '../../lib/i18n';

export const metadata: Metadata = {
  title: t('admin.admin.boiaPlanet', { bannerTitle: ADMIN_COPY.bannerTitle }),
  robots: { index: false, follow: false },
};

/**
 * Sin Supabase, «Probar admin» (T26, D-20): todo pasa en el navegador, con el
 * repositorio local, tras el Carnet 000 y su contraseña (plan 017 T193). Con
 * Supabase (T94, decisión 11; T193), el Carnet 000 con su contraseña (o el
 * código del email) y el TOTP, y las secciones sobre datos reales.
 */
export default function AdminPage() {
  return isSupabaseConfigured() ? <RealAdminGate /> : <DemoAdminGate />;
}
