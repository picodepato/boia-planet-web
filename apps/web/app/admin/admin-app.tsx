'use client';

import Link from 'next/link';
import { type ComponentType, useEffect, useState } from 'react';
import { ADMIN_COPY } from '../../lib/admin/copy';
import { AchievementsSection } from './sections/achievements';
import { ArtistsSection } from './sections/artists';
import { DiscountsSection } from './sections/discounts';
import { EventsSection } from './sections/events';
import { HomeSection } from './sections/home';
import {
  AuditSection,
  IntegrationsSection,
  SeasonsSection,
  TrashSection,
  UsersSection,
} from './sections/misc';
import { MissionSection } from './sections/mission';
import { ModerationSection } from './sections/moderation';
import { PhotosSection } from './sections/photos';
import { TextsSection } from './sections/texts';
import { WorldSection } from './sections/world';
import { type AdminContext, useAdminContext } from './use-admin';
import { t } from '../../lib/i18n';
import { MAR_PATH } from '../../lib/world-handoff';

/** Secciones de L1 (REQ-ADM-008), con su ancla en la URL (`/admin#mundo`). */
const SECTIONS: { id: string; label: string; Component: ComponentType<{ ctx: AdminContext }> }[] = [
  { id: 'inicio', label: t('admin.adminApp.paginaPrincipal'), Component: HomeSection },
  { id: 'eventos', label: t('admin.adminApp.eventos'), Component: EventsSection },
  { id: 'descuentos', label: t('admin.adminApp.descuentos'), Component: DiscountsSection },
  { id: 'mundo', label: t('admin.adminApp.mundo'), Component: WorldSection },
  { id: 'mision', label: t('admin.adminApp.destinoDeLaFiestera'), Component: MissionSection },
  { id: 'artistas', label: t('admin.adminApp.artistas'), Component: ArtistsSection },
  { id: 'fotos', label: t('admin.adminApp.fotosYVideos'), Component: PhotosSection },
  { id: 'logros', label: t('admin.adminApp.logrosYCosmeticos'), Component: AchievementsSection },
  { id: 'moderacion', label: t('admin.adminApp.moderacion'), Component: ModerationSection },
  { id: 'textos', label: t('admin.adminApp.textosYMusica'), Component: TextsSection },
  { id: 'temporadas', label: t('admin.adminApp.temporadas'), Component: SeasonsSection },
  { id: 'usuarios', label: t('admin.adminApp.usuariosDeAdministracion'), Component: UsersSection },
  { id: 'integraciones', label: t('admin.adminApp.integraciones'), Component: IntegrationsSection },
  { id: 'papelera', label: t('admin.adminApp.papelera'), Component: TrashSection },
  { id: 'auditoria', label: t('admin.adminApp.auditoriaYMuestra'), Component: AuditSection },
];

function sectionFromHash(): string {
  const id = window.location.hash.slice(1);
  return SECTIONS.some((s) => s.id === id) ? id : SECTIONS[0]!.id;
}

/**
 * El Admin de la demo (T26, D-20, REQ-ADM-039): sin login, con un aviso
 * permanente de que es una prueba y de que los cambios se quedan en este
 * navegador. Lee y escribe el repositorio local, el mismo que la landing y
 * el mar: lo que se cambia aquí se ve allí, en este navegador.
 */
export function AdminApp() {
  const ctx = useAdminContext();
  const [active, setActive] = useState(SECTIONS[0]!.id);
  useEffect(() => {
    setActive(sectionFromHash());
    const onHash = () => setActive(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]!;
  const storage = ctx?.repo.status();

  return (
    <div className="admin" data-testid="admin">
      <div className="admin-banner" role="note" data-testid="admin-aviso">
        <strong>{ADMIN_COPY.bannerTitle}.</strong> {ADMIN_COPY.banner}
        {storage?.message ? <span className="admin-banner__warn"> {storage.message}</span> : null}
      </div>
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
            {SECTIONS.map((s) => (
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
  );
}
