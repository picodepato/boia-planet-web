import type { ExternalLink, HomeBlock } from '@boia/contracts';
import { MERCHANDISE_CONTACT, type MerchandiseContact } from '../merchandise/catalog';
import { t as msg } from '../i18n';

/**
 * Los enlaces de la tienda, el contacto y el pie, editables desde el Admin
 * sin código (plan 017 T192, plan 007 propuesta, decisión 5). Aquí sólo se
 * comprueba lo que se escribe; guardar es de `actions.ts`. Cada fallo es un
 * texto para la interfaz (null: está bien).
 */

/** Etiqueta corta: cabe en una línea del pie. */
export const LINK_LABEL_MAX = 40;
/** Como mucho estos enlaces por bloque. */
export const LINKS_MAX = 8;

/** Sólo páginas web: `https:` o `http:` con dominio; nunca `javascript:` ni `data:`. */
export function isWebUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Una fila del formulario, tal como se escribe. */
export interface LinkRow {
  label: string;
  url: string;
}

/**
 * Las filas del formulario como enlaces: se recortan los espacios y se
 * ignoran las filas vacías del todo. Falla con el motivo de la primera fila
 * que no vale.
 */
export function parseLinks(
  rows: readonly LinkRow[],
): { ok: true; links: ExternalLink[] } | { ok: false; error: string } {
  const links: ExternalLink[] = [];
  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const label = row.label.trim();
    const url = row.url.trim();
    if (!label && !url) continue;
    const n = i + 1;
    if (!label) return { ok: false, error: msg('admin.links.error.label', { n }) };
    if (label.length > LINK_LABEL_MAX) {
      return { ok: false, error: msg('admin.links.error.labelLong', { n, max: LINK_LABEL_MAX }) };
    }
    if (!isWebUrl(url)) return { ok: false, error: msg('admin.links.error.url', { n, label }) };
    const canonical = new URL(url).href;
    if (seen.has(canonical)) {
      return { ok: false, error: msg('admin.links.error.repeated', { label }) };
    }
    seen.add(canonical);
    links.push({ label, url: canonical });
  }
  if (links.length > LINKS_MAX) {
    return { ok: false, error: msg('admin.links.error.tooMany', { max: LINKS_MAX }) };
  }
  return { ok: true, links };
}

/** Un usuario de Instagram: con o sin «@»; se guarda con «@». */
export function parseHandle(handle: string): string | null {
  const h = handle.trim().replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? `@${h}` : null;
}

/**
 * El contacto de «Comprar» de la tienda. Los dos vacíos: vuelve al de
 * serie (products.json), `contact: null`.
 */
export function parseStoreContact(
  handle: string,
  url: string,
): { ok: true; contact: MerchandiseContact | null } | { ok: false; error: string } {
  if (!handle.trim() && !url.trim()) return { ok: true, contact: null };
  const h = parseHandle(handle);
  if (!h) return { ok: false, error: msg('admin.links.error.handle') };
  if (!isWebUrl(url)) return { ok: false, error: msg('admin.links.error.storeUrl') };
  return { ok: true, contact: { handle: h, url: new URL(url.trim()).href } };
}

/** Lo que el Admin enseña de cada bloque: lo guardado o, sin nada, lo de serie. */
export function linksView(blocks: readonly HomeBlock[]) {
  const store = blocks.find((b) => b.type === 'store');
  const contact = blocks.find((b) => b.type === 'contact');
  const footer = blocks.find((b) => b.type === 'footer');
  return {
    store:
      store?.type === 'store'
        ? { contact: store.contact ?? MERCHANDISE_CONTACT, custom: Boolean(store.contact) }
        : null,
    contact:
      contact?.type === 'contact' ? { email: contact.email ?? '', links: contact.links } : null,
    footer: footer?.type === 'footer' ? { links: footer.officialLinks } : null,
  };
}
