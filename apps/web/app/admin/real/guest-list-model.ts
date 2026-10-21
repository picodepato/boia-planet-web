import type { GuestListAdminRow, GuestListSettings, GuestListStatus } from '../../../lib/guestlist';
import type { MessageKey } from '../../../lib/i18n';

/**
 * Lo que no es React del panel «Lista» de cada fiesta en el Admin (plan 034
 * T310): el resumen (apuntados / tope / han entrado), el formulario de los
 * ajustes y el nombre del CSV.
 */

export interface GuestListSummary {
  count: number;
  cap: number | null;
  scanned: number;
}

/** Cuántos apuntados (del Admin; si no, las filas), el tope y cuántos han entrado. */
export function guestListSummary(
  status: GuestListStatus | null,
  rows: readonly GuestListAdminRow[],
): GuestListSummary {
  return {
    count: status?.count ?? rows.length,
    cap: status?.cap ?? null,
    scanned: rows.filter((r) => r.attended).length,
  };
}

/** El formulario de los ajustes, tal cual se escribe. */
export interface GuestListForm {
  enabled: boolean;
  cap: string;
  /** Valor de `<input type="datetime-local">` (hora de este navegador); '' sin hora. */
  closes: string;
  open: boolean;
}

/** ISO → valor de `<input type="datetime-local">` en la hora de este navegador. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formOf(status: GuestListStatus): GuestListForm {
  return {
    enabled: status.enabled,
    cap: String(status.cap ?? 100),
    closes: toLocalInput(status.closesAt),
    open: status.open,
  };
}

/** Del formulario a los ajustes, o la clave del error. */
export function settingsOf(
  form: GuestListForm,
): { ok: true; settings: GuestListSettings } | { ok: false; error: MessageKey } {
  const cap = Number(form.cap.trim());
  if (!Number.isInteger(cap) || cap < 1 || cap > 100000) {
    return { ok: false, error: 'admin.guestList.error.cap' };
  }
  let closesAt: string | null = null;
  if (form.closes.trim()) {
    const d = new Date(form.closes);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'admin.guestList.error.closes' };
    closesAt = d.toISOString();
  }
  return { ok: true, settings: { enabled: form.enabled, cap, closesAt, open: form.open } };
}

/** `boia-lista-halloween-2026-2026-10-21.csv` */
export function guestListCsvName(event: string, now = new Date()): string {
  return `boia-lista-${event}-${now.toISOString().slice(0, 10)}.csv`;
}
