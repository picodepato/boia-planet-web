#!/usr/bin/env node
/**
 * Iconos de la app instalable (plan 027 T264), sacados del logo que ya existe
 * (`app/icon.svg`, la mascota de T50): sin dibujo nuevo. Pinta el SVG con el
 * Chromium de Playwright (ya es dependencia de las e2e) y deja en
 * `public/icons/`:
 *   - icon-192.png, icon-512.png: la mascota sobre blanco, como `apple-icon.png`;
 *   - maskable-512.png: la misma, más pequeña (dentro del círculo seguro del
 *     80 % que recortan los lanzadores de Android), sobre blanco a sangre.
 * El icono de Apple (`app/apple-icon.png`, 180 px) ya existe y Next lo sirve
 * como `apple-touch-icon`; no se regenera.
 *
 * Los PNG van al repositorio: el build no necesita Chromium. Se corre a mano
 * cuando cambie el logo: `pnpm --filter @boia/web pwa:icons`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'app/icon.svg'), 'utf8');
const outDir = join(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

/** Tamaño del lienzo y fracción que ocupa el logo. */
const ICONS = [
  { file: 'icon-192.png', size: 192, logo: 0.86 },
  { file: 'icon-512.png', size: 512, logo: 0.86 },
  // Zona segura de las maskable: un círculo de radio 40 % del lado.
  { file: 'maskable-512.png', size: 512, logo: 0.6 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, logo } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    const px = Math.round(size * logo);
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;` +
        `display:grid;place-items:center;background:#ffffff">` +
        `<div style="width:${px}px;height:${px}px">${svg.replace(
          '<svg ',
          `<svg width="${px}" height="${px}" `,
        )}</div></body></html>`,
    );
    const png = await page.screenshot({ type: 'png', omitBackground: false });
    writeFileSync(join(outDir, file), png);
    console.log(`pwa-icons: public/icons/${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
