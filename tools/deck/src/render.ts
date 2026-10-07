/**
 * `pnpm deck:render`: LibreOffice pasa docs/presentacion/boia-planet.pptx a
 * boia-planet.pdf (se sube al repositorio) y cada página del PDF a un PNG en
 * docs/presentacion/render/ (ignorada por git), para la revisión visual.
 * `soffice` se busca en SOFFICE, en el PATH y en los sitios de siempre.
 */
import { createCanvas } from '@napi-rs/canvas';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDF, PPTX, PRESENTACION, RAIZ, RENDER } from './rutas.ts';

const rel = (p: string) => relative(RAIZ, p).replaceAll('\\', '/');

function soffice(): string {
  const candidatos = [
    process.env.SOFFICE,
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
  ].filter((c): c is string => !!c);
  for (const c of candidatos) if (existsSync(c)) return c;
  const enPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['soffice'], {
    encoding: 'utf8',
  });
  const linea = enPath.stdout?.split(/\r?\n/).find(Boolean);
  if (enPath.status === 0 && linea) return linea.trim();
  throw new Error('No encuentro LibreOffice (soffice). Instálalo o pon su ruta en SOFFICE.');
}

if (!existsSync(PPTX)) {
  console.error(`No existe ${rel(PPTX)}: primero «pnpm deck».`);
  process.exit(1);
}

// Un perfil de LibreOffice propio: funciona aunque haya otro LibreOffice abierto.
const perfil = mkdtempSync(join(tmpdir(), 'boia-deck-lo-'));
try {
  const r = spawnSync(
    soffice(),
    [
      `-env:UserInstallation=${pathToFileURL(perfil).href}`,
      '--headless',
      '--norestore',
      '--convert-to',
      'pdf',
      '--outdir',
      PRESENTACION,
      PPTX,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 300_000 },
  );
  if (r.status !== 0 || !existsSync(PDF)) {
    console.error(r.stdout, r.stderr);
    throw new Error(`LibreOffice no pudo convertir la presentación (salida ${r.status})`);
  }
} finally {
  rmSync(perfil, { recursive: true, force: true });
}

// PDF → un PNG por diapositiva (1600 px de ancho), con pdf.js.
mkdirSync(RENDER, { recursive: true });
for (const f of readdirSync(RENDER)) if (/^diapositiva-\d+\.png$/.test(f)) rmSync(join(RENDER, f));
const tarea = getDocument({ data: new Uint8Array(readFileSync(PDF)), verbosity: 0 });
const pdf = await tarea.promise;
const ancho = 1600;
for (let i = 1; i <= pdf.numPages; i++) {
  const pagina = await pdf.getPage(i);
  const base = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({ scale: ancho / base.width });
  const lienzo = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  await pagina.render({
    // El lienzo de @napi-rs/canvas hace de canvas del navegador para pdf.js.
    canvas: lienzo as never,
    canvasContext: lienzo.getContext('2d') as never,
    viewport,
  }).promise;
  writeFileSync(
    join(RENDER, `diapositiva-${String(i).padStart(2, '0')}.png`),
    lienzo.toBuffer('image/png'),
  );
}
console.log(`${rel(PDF)}: ${pdf.numPages} páginas; PNG en ${rel(RENDER)}/diapositiva-NN.png`);
await tarea.destroy();
