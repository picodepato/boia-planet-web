import type { Metadata } from 'next';
import { AccountGate } from '../../lib/account/sign-in-sheet';
import { RankingPage } from './ranking-page';

export const metadata: Metadata = { title: 'Ranking BOIA · boia-planet' };

/** Los rankings desde el menú de la web (plan 017 T188), sin entrar al mar. */
export default function RankingRoute() {
  return (
    <>
      <RankingPage />
      <AccountGate />
    </>
  );
}
