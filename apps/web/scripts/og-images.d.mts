/** Tipos de `og-images.mjs` (plan 030 T286), para las pruebas. */

export interface OgImage {
  width: number;
  height: number;
  data: Buffer;
}

export interface OgEvent {
  name: string;
  startsAt: string;
  timeZone?: string;
}

export const OG_DIR: string;
export const OG_SITE_FILE: string;
export const OG_WIDTH: number;
export const OG_HEIGHT: number;
export function ogDateLabel(startsAt: string, timeZone?: string): string;
export function fitTitle(
  name: string,
  maxWidth: number,
  maxHeight: number,
  options?: { maxK?: number; minK?: number; lineGap?: number },
): { k: number; lines: string[]; lineHeight: number; height: number };
export function composeHome(): OgImage;
export function composeEvent(event: OgEvent): OgImage;
export function encode(img: OgImage): Buffer;
export function ogEvents(): Promise<Array<OgEvent & { slug: string }>>;
