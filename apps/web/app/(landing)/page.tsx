import { bootScript } from '@boia/engine/intro';
import type { Metadata } from 'next';
import { t } from '../../lib/i18n';
import { introCss, loadIntroData, stillCss } from '../../lib/intro/load';
import { resolveHome } from '../../lib/landing/resolve';
import { SAMPLE_CONTENT } from '../../lib/landing/sample-content';
import { IntroStage } from './components/intro-stage';
import { LandingClientLazy } from './components/landing-client-lazy';
import { LiveLanding } from './components/live-landing';

export const metadata: Metadata = {
  title: t('site.title'),
  description: t('site.description'),
};

export default function LandingPage() {
  // El servidor pinta la muestra; en el navegador, `LiveLanding` pasa a leer el
  // repositorio local con los cambios del Admin de la demo (T26, D-20). Con
  // Supabase, lo publicado.
  const content = SAMPLE_CONTENT;
  const now = new Date();

  const view = resolveHome(content, now);
  // Entrada 3D con el planeta (T57; D-19, D-21): configuración y hoja del
  // título, leídas al construir la página. three.js llega aparte, bajo demanda.
  const intro = loadIntroData();
  const hasHero = view.main.some((b) => b.type === 'hero');

  return (
    <>
      {intro && hasHero && (
        <>
          {/* Antes que nada: decide la entrada antes del primer pintado. */}
          <script
            dangerouslySetInnerHTML={{
              // El tope sólo cuenta si la app nunca monta la escena; el plazo
              // de la escena lo lleva el controlador desde el montaje.
              __html: bootScript({ capMs: intro.config.bootCapMs }),
            }}
          />
          <style dangerouslySetInnerHTML={{ __html: `${stillCss(intro)}\n${introCss(intro)}` }} />
        </>
      )}
      <LiveLanding
        initial={view}
        heroScene={<IntroStage data={intro} coverLabel={t('mar.client.preparandoElMar')} />}
      />
      <LandingClientLazy />
    </>
  );
}
