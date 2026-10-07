import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Emoji nuevos en las capturas (plan 018 T209). Windows 10 no trae los emoji
 * de Unicode 14 o más (🪪 de «Mi Carnet»), así que el navegador de las
 * capturas los pinta como un cuadrado. Las capturas usan Noto Color Emoji
 * (Google, SIL OFL), que se descarga una vez del repositorio oficial de
 * Google Fonts a esta carpeta ignorada por git; `deck-helpers` la sirve y la
 * añade a cada página antes de la foto. La web no cambia.
 */
export const CARPETA_FUENTES = fileURLToPath(new URL('./.fuentes/', import.meta.url));
export const FUENTE_EMOJI = join(CARPETA_FUENTES, 'NotoColorEmoji-Regular.ttf');
const ORIGEN =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notocoloremoji/NotoColorEmoji-Regular.ttf';
const LICENCIA =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notocoloremoji/OFL.txt';

/** `globalSetup` de playwright.deck.config.ts: descarga la fuente si no está. */
export default async function descargarFuenteEmoji(): Promise<void> {
  if (existsSync(FUENTE_EMOJI) && statSync(FUENTE_EMOJI).size > 1_000_000) return;
  mkdirSync(CARPETA_FUENTES, { recursive: true });
  console.log(`Descargando Noto Color Emoji (una vez) de ${ORIGEN}`);
  const r = await fetch(ORIGEN);
  if (!r.ok) throw new Error(`Noto Color Emoji: ${r.status} ${r.statusText} (${ORIGEN})`);
  const temporal = `${FUENTE_EMOJI}.${process.pid}.part`;
  writeFileSync(temporal, Buffer.from(await r.arrayBuffer()));
  renameSync(temporal, FUENTE_EMOJI);
  const l = await fetch(LICENCIA);
  if (l.ok) writeFileSync(join(CARPETA_FUENTES, 'OFL.txt'), await l.text());
}
