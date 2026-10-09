'use client';

import Link from 'next/link';
import { type ComponentType, useEffect, useState } from 'react';
import { ADMIN_COPY } from '../../lib/admin/copy';
import { pruneLocalPhotos } from '../../lib/admin/local-photo-cleanup';
import { AchievementsSection } from './sections/achievements';
import { ArtistsSection } from './sections/artists';
import { DiscountsSection } from './sections/discounts';
import { DoorSection } from './door/door-section';
import { EventsSection } from './sections/events';
import { HomeSection } from './sections/home';
import { LinksSection } from './sections/links';
import {
  AuditSection,
  IntegrationsSection,
  SeasonsSection,
  TrashSection,
  UsersSection,
} from './sections/misc';
import { MissionSection } from './sections/mission';
import { RealCalitasModeration } from './sections/calitas';
import { ModerationSection } from './sections/moderation';
import { ObjectsSection } from './sections/objects';
import { PhotosSection } from './sections/photos';
import { RadioSection } from './sections/radio';
import { TextsSection } from './sections/texts';
import { WorldSection } from './sections/world';
import { RealBottles } from './real/botellas';
import { RealCarnets } from './real/carnets';
import { type RealAdmin, RealAdminProvider } from './real/common';
import { FiestasSection } from './real/fiestas';
import { RealDeletedTrash } from './real/papelera';
import { RankingsSection } from './real/rankings';
import { SecuritySection } from './real/seguridad';
import { SociosSection } from './real/socios';
import { type AdminContext, useAdminContext } from './use-admin';
import { t } from '../../lib/i18n';
import { MAR_PATH } from '../../lib/world-handoff';

type Section = { id: string; label: string; Component: ComponentType<{ ctx: AdminContext }> };

/** Secciones de L1 (REQ-ADM-008), con su ancla en la URL (`/admin#mundo`). */
const SECTIONS: Section[] = [
  { id: 'inicio', label: t('admin.adminApp.paginaPrincipal'), Component: HomeSection },
  { id: 'enlaces', label: t('admin.links.nav'), Component: LinksSection },
  { id: 'eventos', label: t('admin.adminApp.eventos'), Component: EventsSection },
  // La puerta: QR de alta, lector y sellar a mano (plan 019 T218, decisión 11).
  { id: 'puerta', label: t('puerta.section.nav'), Component: DoorSection },
  { id: 'descuentos', label: t('admin.adminApp.descuentos'), Component: DiscountsSection },
  { id: 'mundo', label: t('admin.adminApp.mundo'), Component: WorldSection },
  { id: 'objetos', label: t('admin.objects.nav'), Component: ObjectsSection },
  { id: 'mision', label: t('admin.adminApp.destinoDeLaFiestera'), Component: MissionSection },
  { id: 'artistas', label: t('admin.adminApp.artistas'), Component: ArtistsSection },
  { id: 'fotos', label: t('admin.adminApp.fotosYVideos'), Component: PhotosSection },
  { id: 'logros', label: t('admin.adminApp.logrosYCosmeticos'), Component: AchievementsSection },
  { id: 'moderacion', label: t('admin.adminApp.moderacion'), Component: ModerationSection },
  { id: 'textos', label: t('admin.adminApp.textosYMusica'), Component: TextsSection },
  // La radio de la web: canciones, géneros y la primera (plan 022 T246).
  { id: 'radio', label: t('admin.radio.nav'), Component: RadioSection },
  { id: 'temporadas', label: t('admin.adminApp.temporadas'), Component: SeasonsSection },
  { id: 'usuarios', label: t('admin.adminApp.usuariosDeAdministracion'), Component: UsersSection },
  { id: 'integraciones', label: t('admin.adminApp.integraciones'), Component: IntegrationsSection },
  { id: 'papelera', label: t('admin.adminApp.papelera'), Component: TrashSection },
  { id: 'auditoria', label: t('admin.adminApp.auditoriaYMuestra'), Component: AuditSection },
];

/** Moderación con cuentas (plan 017 T191): los Carnets, las botellas y Las Calitas (T222) reales. */
function RealModeration() {
  return (
    <>
      <RealCarnets />
      <RealBottles />
      <RealCalitasModeration />
    </>
  );
}

/**
 * Papelera con cuentas (plan 020 T230): los socios y las fiestas borrados de
 * la base de datos y, debajo, la papelera del contenido de este Admin.
 */
function RealTrash({ ctx }: { ctx: AdminContext }) {
  return (
    <>
      <RealDeletedTrash />
      <TrashSection ctx={ctx} />
    </>
  );
}

/**
 * Con cuentas (T94, decisión 11) cuatro secciones van sobre los datos reales
 * de Supabase: Fiestas y QR, Socios y emails, Moderación (botellas) y
 * Rankings. El resto sigue siendo la demo de este navegador.
 */
const REAL_SECTIONS: Section[] = SECTIONS.flatMap((s): Section[] => {
  if (s.id === 'eventos') {
    return [s, { id: 'fiestas', label: t('admin.real.nav.fiestas'), Component: FiestasSection }];
  }
  if (s.id === 'artistas') {
    return [s, { id: 'socios', label: t('admin.real.nav.socios'), Component: SociosSection }];
  }
  if (s.id === 'moderacion') {
    return [
      { ...s, label: t('admin.real.nav.moderacion'), Component: RealModeration },
      { id: 'rankings', label: t('admin.real.nav.rankings'), Component: RankingsSection },
    ];
  }
  if (s.id === 'papelera') return [{ ...s, Component: RealTrash }];
  return [s];
}).concat({
  // Códigos de respaldo del TOTP (plan 017 T193).
  id: 'seguridad',
  label: t('admin.real.nav.seguridad'),
  Component: SecuritySection,
});

function sectionFromHash(sections: readonly Section[]): string {
  const id = window.location.hash.slice(1);
  return sections.some((s) => s.id === id) ? id : sections[0]!.id;
}

/**
 * El Admin de la demo (T26, D-20, REQ-ADM-039): con un aviso
 * permanente de que es una prueba y de que los cambios se quedan en este
 * navegador. Lee y escribe el repositorio local, el mismo que la landing y
 * el mar: lo que se cambia aquí se ve allí, en este navegador. Desde el
 * plan 017 T193 (decisión 9) se entra con el Carnet 000 y su contraseña
 * (`demo-gate.tsx`); `demo.signOut` sale.
 *
 * Con cuentas (`real`, T94) se llega aquí tras el código del email y el
 * TOTP (`real/gate.tsx`), y cuatro secciones van sobre datos reales.
 */
export function AdminApp({
  real,
  demo,
}: { real?: RealAdmin; demo?: { signOut: () => void } } = {}) {
  const ctx = useAdminContext();
  const sections = real ? REAL_SECTIONS : SECTIONS;
  const [active, setActive] = useState(sections[0]!.id);
  const localRepo = real ? null : (ctx?.repo ?? null);
  useEffect(() => {
    // Una vez al abrir el Admin de la demo: los blobs de fotos locales que
    // ya nada referencia (purgas automáticas, borradores descartados) se van.
    if (!localRepo) return;
    void pruneLocalPhotos(localRepo).catch(() => undefined);
  }, [localRepo]);
  useEffect(() => {
    setActive(sectionFromHash(sections));
    const onHash = () => setActive(sectionFromHash(sections));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [sections]);
  const section = sections.find((s) => s.id === active) ?? sections[0]!;
  const storage = ctx?.repo.status();

  return (
    <RealAdminProvider value={real ?? null}>
      <div className="admin" data-testid="admin" data-admin={real ? 'real' : 'demo'}>
        {real ? (
          <div className="admin-banner admin-banner--real" role="note" data-testid="admin-aviso">
            <strong>{t('admin.real.bannerTitle')}.</strong> {t('admin.real.banner')}{' '}
            <span data-testid="admin-quien">
              {t('admin.real.signedInRole', { email: real.email ?? '—', role: real.role })}
            </span>{' '}
            <button
              type="button"
              className="admin-link"
              data-testid="admin-salir"
              onClick={() => void real.signOut()}
            >
              {t('admin.real.signOut')}
            </button>
          </div>
        ) : (
          <div className="admin-banner" role="note" data-testid="admin-aviso">
            <strong>{ADMIN_COPY.bannerTitle}.</strong> {ADMIN_COPY.banner}
            {storage?.message ? (
              <span className="admin-banner__warn"> {storage.message}</span>
            ) : null}
            {demo ? (
              <>
                {' '}
                <button
                  type="button"
                  className="admin-link"
                  data-testid="admin-salir"
                  onClick={demo.signOut}
                >
                  {t('admin.demoLogin.signOut')}
                </button>
              </>
            ) : null}
          </div>
        )}
        <header className="admin-top">
          <h1>{t('admin.adminApp.boiaAdmin')}</h1>
          <nav className="admin-top__links" aria-label={t('admin.adminApp.verLosCambios')}>
            <Link href="/?intro=0" prefetch={false} data-testid="admin-ver-web">
              {t('admin.adminApp.verLaWeb')}
            </Link>
            <Link href={MAR_PATH} prefetch={false} data-testid="admin-ver-mundo">
              {t('admin.adminApp.verElMundo')}
            </Link>
          </nav>
        </header>
        <div className="admin-layout">
          <nav className="admin-nav" aria-label={t('admin.adminApp.seccionesDelAdmin')}>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={s.id === section.id ? 'page' : undefined}
                    data-testid={`admin-nav-${s.id}`}
                    onClick={() => setActive(s.id)}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <main className="admin-main" data-testid={`admin-seccion-${section.id}`}>
            {ctx ? <section.Component ctx={ctx} /> : <p>{t('admin.adminApp.cargandoElAdmin')}</p>}
          </main>
        </div>
      </div>
    </RealAdminProvider>
  );
}
