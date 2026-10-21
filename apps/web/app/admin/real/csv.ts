/**
 * El CSV de socios con noticias (T94, decisión 3): sólo quien dijo que sí,
 * con la fecha y la versión de ese consentimiento. Lo abre una hoja de
 * cálculo: una celda que empieza por = + - @ se escapa con «'» (inyección de
 * fórmulas) y todo va entre comillas.
 */

/** Una fila de `admin_list_members`. */
export interface MemberRow {
  user_id: string;
  email: string;
  nickname: string | null;
  member_number: number | null;
  member_since: string | null;
  signed_up_at: string;
  is_artist: boolean;
  news: boolean;
  news_at: string | null;
  news_version: string | null;
  privacy_version: string | null;
  privacy_at: string | null;
  total: number;
}

export const NEWS_CSV_COLUMNS = [
  'email',
  'apodo',
  'numero_socio',
  'alta',
  'noticias_desde',
  'version_politica_noticias',
] as const;

/** Marca de orden de bytes: Excel abre el CSV como UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

function cell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Las filas con noticias (las demás se descartan aunque lleguen). */
export function newsCsv(rows: readonly MemberRow[]): string {
  const lines = [NEWS_CSV_COLUMNS.join(',')];
  for (const r of rows) {
    if (!r.news) continue;
    lines.push(
      [r.email, r.nickname, r.member_number, r.signed_up_at, r.news_at, r.news_version]
        .map(cell)
        .join(','),
    );
  }
  // BOM: Excel lo abre como UTF-8 (tildes y eñes en los apodos).
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/**
 * El CSV de la lista de una fiesta (plan 034 T310): las mismas columnas que
 * la tabla del Admin, por orden de llegada. `entro`: «sí» si leyeron su
 * Carnet en la puerta de esa fiesta.
 */
export const GUEST_LIST_CSV_COLUMNS = [
  'nombre_lista',
  'apodo',
  'email',
  'apuntado',
  'entro',
] as const;

/** Una fila de la lista (`GuestListAdminRow` de lib/guestlist). */
export interface GuestListCsvRow {
  listName: string;
  nickname: string | null;
  email: string | null;
  createdAt: string;
  attended: boolean;
}

export function guestListCsv(rows: readonly GuestListCsvRow[]): string {
  const lines = [GUEST_LIST_CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(
      [r.listName, r.nickname, r.email, r.createdAt, r.attended ? 'sí' : 'no'].map(cell).join(','),
    );
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
