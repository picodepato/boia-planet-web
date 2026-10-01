import { t } from '../i18n';

/**
 * Textos del Admin de la demo (T26, D-20, REQ-ADM-039). Todo `muestra`
 * [pendiente Álvaro]. Lo importa el menú del 2D para el botón, sin cargar
 * el Admin; la landing usa `paths.ts` y sus propias claves (`footer.tryAdmin`)
 * para no cargar el catálogo entero.
 */

export { ADMIN_PATH, ADMIN_PREVIEW_PATH } from './paths';

export const ADMIN_COPY = {
  tryAdmin: t('footer.tryAdmin'),
  tryAdminHint: t('footer.tryAdmin.hint'),
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
