/**
 * Ruta del Carnet a pantalla completa: `/carnet/<id>`. Será el enlace para
 * compartir cuando haya servidor; en la versión de prueba los Carnets viven
 * en el navegador de cada cual y no se comparten (REQ-IDE-051, D-20).
 */
export function carnetPath(userId: string): string {
  return `/carnet/${encodeURIComponent(userId)}`;
}
