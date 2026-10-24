import { t } from '../i18n';

/**
 * Textos del Admin de la demo (T26, D-20, REQ-ADM-039). Todo `muestra`
 * [pendiente Álvaro]. Desde 2026-10-24 (Álvaro) ni la landing ni el menú
 * enlazan al Admin: se entra escribiendo `/admin`.
 */

export { ADMIN_PATH, ADMIN_PREVIEW_PATH } from './paths';

export const ADMIN_COPY = {
  bannerTitle: t('admin.copy.adminDePrueba'),
  banner: t('admin.copy.estoEsUnaDemo'),
  saved: t('admin.copy.guardadoEnEsteNavegador'),
  resetArea: t('admin.copy.volverALaMuestra'),
  resetAll: t('admin.copy.volverTodoALa'),
  confirmResetAll: t('admin.copy.seguroSePierdenTodos'),
  sharedMapNote: t('admin.copy.elMapaEsCompartido'),
  skinNote: t('admin.copy.nombreTextosYSi'),
  renameAsk: t('admin.copy.dondeCambiaElNombre'),
  renameThisWorld: t('admin.copy.soloEnEsteMundo'),
  renameAllWorlds: t('admin.copy.enTodosLosMundos'),
  islandKeepsMemories: t('admin.copy.laIslaNoEs'),
} as const;
