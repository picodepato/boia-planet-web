import type { Metadata } from 'next';
import { t } from '../../../lib/i18n';
import { NOINDEX } from '../../../lib/seo';
import { isSupabaseConfigured } from '../../../lib/supabase/config';
import { DoorLinkPage } from './door-link-page';
import '../../admin/admin.css';

export const metadata: Metadata = {
  title: t('puerta.link.metaTitle'),
  description: t('seo.private'),
  robots: NOINDEX, // El enlace lleva el código de la puerta.
};

/**
 * El enlace de la puerta (plan 034 T307): el lector de la puerta de una
 * fiesta, sin cuenta, para quien tenga el enlace. Sin Supabase, los enlaces
 * de este navegador (D-20); con cuentas, `door_link_info` y `door_link_stamp`.
 */
export default async function DoorLinkRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DoorLinkPage token={token} real={isSupabaseConfigured()} />;
}
