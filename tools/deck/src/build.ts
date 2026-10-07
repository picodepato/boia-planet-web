/**
 * `pnpm deck`: construye docs/presentacion/boia-planet.pptx con las partes de
 * docs/presentacion/partes/NN-slug.ts (en orden de número, descubiertas por
 * nombre) y sus capturas de docs/presentacion/capturas/NN-slug/*.jpg.
 * Si falta alguna captura, no escribe nada y dice cuáles.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import { Deck, type ModuloParte } from './deck.ts';
import { capturasDe, definirLayouts, dibujar } from './dibujar.ts';
import { jpeg, type Imagen } from './imagen.ts';
import { CAPTURAS, PPTX, RAIZ, RENDER, partes } from './rutas.ts';
import { FUENTE } from './tema.ts';

const rel = (p: string) => relative(RAIZ, p).replaceAll('\\', '/');

interface Parte {
  numero: string;
  id: string;
  titulo: string;
  deck: Deck;
}

async function cargar(): Promise<Parte[]> {
  const archivos = partes();
  if (!archivos.length) throw new Error('No hay partes en docs/presentacion/partes/ (NN-slug.ts)');
  const out: Parte[] = [];
  for (const a of archivos) {
    const mod = (await import(pathToFileURL(a.ruta).href)) as Partial<ModuloParte>;
    if (typeof mod.titulo !== 'string' || !mod.titulo.trim())
      throw new Error(`${a.id}.ts: falta «export const titulo = '…'»`);
    if (typeof mod.default !== 'function')
      throw new Error(`${a.id}.ts: falta «export default function (d: Deck) { … }»`);
    const deck = new Deck(a.id, mod.titulo);
    mod.default(deck);
    if (!deck.diapositivas.length) throw new Error(`${a.id}.ts no tiene diapositivas`);
    const primera = deck.diapositivas[0]!.tipo;
    if (primera !== 'portada' && primera !== 'portadaParte')
      throw new Error(`${a.id}.ts: la primera diapositiva es su portada (portada o portadaParte)`);
    out.push({ numero: a.numero, id: a.id, titulo: mod.titulo, deck });
  }
  return out;
}

/** La ruta de una captura: «hero» en su parte, o «NN-otra/hero». */
function rutaCaptura(parte: string, nombre: string) {
  const [carpeta, archivo] = nombre.includes('/') ? nombre.split('/') : [parte, nombre];
  return join(CAPTURAS, carpeta!, `${archivo}.jpg`);
}

async function main() {
  const lista = await cargar();

  // Todas las capturas antes de dibujar: si falta alguna, la lista entera.
  const faltan: string[] = [];
  const imagenes = new Map<string, Imagen>();
  const usadas = new Set<string>();
  for (const p of lista)
    for (const d of p.deck.diapositivas)
      for (const c of capturasDe(d)) {
        const ruta = rutaCaptura(p.id, c);
        usadas.add(ruta);
        if (imagenes.has(ruta)) continue;
        if (!existsSync(ruta)) {
          if (!faltan.includes(ruta)) faltan.push(ruta);
          continue;
        }
        imagenes.set(ruta, jpeg(ruta));
      }
  if (faltan.length) {
    console.error(`Faltan ${faltan.length} capturas (hazlas con «pnpm deck:capturas NN»):`);
    for (const f of faltan) console.error(`  ${rel(f)}`);
    process.exit(1);
  }

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'BOIA';
  pres.company = 'BOIA';
  pres.title = 'BOIA.PLANET — qué hay y qué falta para salir';
  pres.theme = { headFontFace: FUENTE.titulo, bodyFontFace: FUENTE.texto };
  await definirLayouts(pres);

  const indice: string[] = [];
  let n = 0;
  for (const p of lista) {
    const seccion = `${p.numero} · ${p.titulo}`;
    pres.addSection({ title: seccion });
    const desde = n + 1;
    for (const d of p.deck.diapositivas) {
      n++;
      await dibujar(
        pres,
        {
          numero: p.numero,
          tituloParte: p.titulo,
          captura: (c) => imagenes.get(rutaCaptura(p.id, c))!,
        },
        d,
        seccion,
      );
    }
    indice.push(
      `${p.id.padEnd(22)} ${String(desde).padStart(3)}–${String(n).padEnd(3)} (${p.deck.diapositivas.length})  ${p.titulo}`,
    );
  }

  await pres.writeFile({ fileName: PPTX });

  // Capturas que nadie usa: aviso, no error (puede que la parte aún no las use).
  if (existsSync(CAPTURAS))
    for (const carpeta of readdirSync(CAPTURAS))
      for (const f of readdirSync(join(CAPTURAS, carpeta)).filter((x) => x.endsWith('.jpg'))) {
        const ruta = join(CAPTURAS, carpeta, f);
        if (!usadas.has(ruta)) console.warn(`aviso: captura sin usar ${rel(ruta)}`);
      }

  mkdirSync(RENDER, { recursive: true });
  writeFileSync(join(RENDER, 'indice.txt'), `${indice.join('\n')}\n`);
  console.log(`${rel(PPTX)}: ${n} diapositivas en ${lista.length} partes`);
  for (const l of indice) console.log(`  ${l}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
