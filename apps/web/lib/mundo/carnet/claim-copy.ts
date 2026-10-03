/**
 * Lo que se dice de cada resultado de un sello (T87, marcos 09–11): el título
 * y el texto de cada error, y el aviso de un sello concedido. Las fechas y
 * horas, en Europe/Madrid.
 */
import { t } from '../../i18n';
import type { ClaimOutcome, StampEvent } from './claim';

const TZ = 'Europe/Madrid';

function valid(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «sábado 31 de octubre». */
export function longDate(iso: string | null | undefined): string {
  const d = valid(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  })
    .format(d)
    .replace(/^([^,\s]+),\s*/, '$1 ');
}

/** «31 de octubre». */
export function dayMonth(iso: string | null | undefined): string {
  const d = valid(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: TZ }).format(
    d,
  );
}

/** «23:00». */
export function clock(iso: string | null | undefined): string {
  const d = valid(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(d);
}

export interface OutcomeCopy {
  title: string;
  body: string;
}

/** Título y texto de un resultado que no es «concedido» (ni cancelado). */
export function outcomeCopy(o: ClaimOutcome): OutcomeCopy {
  const name = (e: StampEvent | null) => e?.name ?? t('stamp.thisParty');
  switch (o.kind) {
    case 'early':
      return {
        title: t('stamp.err.early.title'),
        body: t('stamp.err.early.body', {
          event: name(o.event),
          date: longDate(o.from),
          from: clock(o.from),
          to: clock(o.until),
        }),
      };
    case 'late':
      return {
        title: t('stamp.err.late.title'),
        body: t('stamp.err.late.body', {
          date: dayMonth(o.from),
          from: clock(o.from),
          to: clock(o.until),
        }),
      };
    case 'already':
      return {
        title: t('stamp.err.already.title'),
        body: o.at
          ? t('stamp.err.already.body', { event: name(o.event), time: clock(o.at) })
          : t('stamp.err.already.bodyNoTime', { event: name(o.event) }),
      };
    case 'offline':
      return { title: t('stamp.err.offline.title'), body: t('stamp.err.offline.body') };
    case 'local':
      return { title: t('stamp.err.local.title'), body: t('sello.localOnly') };
    case 'granted':
      return {
        title: t('scan.found.title'),
        body: t('stamp.received', { event: name(o.event), points: o.points }),
      };
    default:
      return { title: t('stamp.err.invalid.title'), body: t('stamp.err.invalid.body') };
  }
}

/** «31 oct 2026 · 23:00–07:00 · Explanada» de la cabecera de /sello. */
export function eventMeta(e: StampEvent): string {
  const d = valid(e.startsAt);
  if (!d) return e.place ?? '';
  const date = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(d);
  return t('sello.meta', {
    date,
    from: clock(e.startsAt),
    to: e.endsAt ? clock(e.endsAt) : '',
    place: e.place ?? '',
  })
    .replace(/–\s·/, ' ·')
    .replace(/\s·\s*$/, '');
}
