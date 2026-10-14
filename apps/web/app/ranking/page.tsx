import type { Metadata } from 'next';
import { AccountGate } from '../../lib/account/sign-in-sheet';
import { t } from '../../lib/i18n';
import { publicPage } from '../../lib/seo';
import { RankingPage } from './ranking-page';

export const metadata: Metadata = {
  title: t('seo.rankingTitle'),
  ...publicPage('/ranking', t('seo.ranking')),
};

/** Los rankings desde el menú de la web (plan 017 T188), sin entrar al mar. */
export default function RankingRoute() {
  return (
    <>
      <RankingPage />
      <AccountGate />
    </>
  );
}
