import type { Metadata } from 'next';
import { ADMIN_COPY } from '../../lib/admin/copy';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { AdminApp } from './admin-app';
import { RealAdminGate } from './real/gate';
import './admin.css';
import { t } from '../../lib/i18n';

export const metadata: Metadata = {
  title: t('admin.admin.boiaPlanet', { bannerTitle: ADMIN_COPY.bannerTitle }),
  robots: { index: false, follow: false },
};

/**
 * Sin Supabase, «Probar admin» (T26, D-20): todo pasa en el navegador, con el
 * repositorio local. Con Supabase (T94, decisión 11), el código del email y
 * el TOTP, y cuatro secciones sobre datos reales.
 */
export default function AdminPage() {
  return isSupabaseConfigured() ? <RealAdminGate /> : <AdminApp />;
}
