import type { Metadata } from 'next';
import { t } from '../../../lib/i18n';
import { isSupabaseConfigured } from '../../../lib/supabase/config';
import { RecoverPassword } from './recover';
import '../admin.css';

export const metadata: Metadata = {
  title: t('admin.real.recover.title'),
  robots: { index: false, follow: false },
};

/**
 * A donde lleva el enlace del email de «He olvidado la contraseña» (plan 029
 * T283). Sólo existe con cuentas; sin ellas, la demo local cambia el hash con
 * `pnpm admin:password`.
 */
export default function RecoverPasswordPage() {
  return isSupabaseConfigured() ? (
    <RecoverPassword />
  ) : (
    <div className="admin">
      <main className="admin-login">
        <div className="admin-card admin-login__card">
          <p>{t('admin.real.recover.noAccounts')}</p>
        </div>
      </main>
    </div>
  );
}
