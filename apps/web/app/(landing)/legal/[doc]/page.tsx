import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { t } from '../../../../lib/i18n';
import { LEGAL_DOCS, PRIVACY_WITH_ACCOUNTS } from '../../../../lib/legal/docs';
import { isSupabaseConfigured } from '../../../../lib/supabase/config';

/**
 * Páginas legales enlazadas desde el pie (REQ-ENT-032): aviso legal,
 * privacidad y cookies (lib/legal/docs.ts), con el aviso de datos
 * inventados arriba (`legal.sampleBanner`, D-23 O14). Con cuentas (plan
 * 008, T89) la de privacidad dice qué se recoge y para qué.
 */
type DocId = keyof typeof LEGAL_DOCS;
const docOf = (id: string) => (id in LEGAL_DOCS ? LEGAL_DOCS[id as DocId] : undefined);

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

type Props = { params: Promise<{ doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = docOf((await params).doc);
  return { title: doc ? `${t(doc.title)} · ${t('site.title')}` : t('site.title') };
}

export default async function LegalPage({ params }: Props) {
  const id = (await params).doc;
  const found = docOf(id);
  if (!found) notFound();
  const accounts = id === 'privacidad' && isSupabaseConfigured();
  const doc = accounts ? PRIVACY_WITH_ACCOUNTS : found;
  const updated = accounts ? PRIVACY_WITH_ACCOUNTS.updated : 'legal.updated';
  return (
    <main id="contenido" className="legal">
      <div className="section__inner">
        <p>
          <Link href="/">{t('legal.back')}</Link>
        </p>
        <h1 className="section__title">{t(doc.title)}</h1>
        <p className="legal__sample" data-testid="legal-muestra" role="note">
          <strong>{t('legal.sampleBanner')}</strong>
        </p>
        {doc.body.map((key) => (
          <p key={key}>{t(key)}</p>
        ))}
        <p>
          <small>{t(updated)}</small>
        </p>
      </div>
    </main>
  );
}
