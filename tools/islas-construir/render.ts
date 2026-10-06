/**
 * Las imágenes de las islas de «Construir» (plan 015 T172, decisión 13): una
 * foto fija de cada isla que construye «Defensa del Castillo», hecha con su
 * modelo de verdad (`islandTemplate` de `apps/web/app/mar/engine/defense-islands.ts`,
 * la misma geometría que pone la partida), vista de frente (desde +z, el lado
 * del muelle) con la cámara del juego normal (40° de campo, ~40° de
 * elevación), la luz de día del juego, sin lo que queda bajo el agua, fondo
 * transparente y el mismo encuadre para todas: la misma cámara acercada hasta
 * que la isla llena la imagen con el mismo margen, centrada.
 *
 * Regenera desde cero, con Chromium sin ventana (Playwright de apps/web):
 *
 *   node --experimental-transform-types --no-warnings --import ./packages/world/scripts/ts-resolve.mjs tools/islas-construir/render.ts
 *
 * (`--sheet <ruta.png>` deja además una hoja con las siete para revisarlas.)
 *
 * Escribe `apps/web/public/castillo/islas/<tipo>.webp` (1×) y `<tipo>@2x.webp`
 * (2×) y el manifiesto tipado `apps/web/lib/mundo/castle-island-images.ts`.
 * Primera vez en una máquina: `pnpm --filter @boia/web exec playwright install chromium`.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFENSE_TOWER_KINDS } from '../../packages/engine/src/defense/index.ts';
import { islandTemplate } from '../../apps/web/app/mar/engine/defense-islands.ts';
import { moods } from '../../apps/web/app/mar/engine/palette.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = join(ROOT, 'apps/web');
const OUT_DIR = join(WEB, 'public/castillo/islas');
const MANIFEST = join(WEB, 'lib/mundo/castle-island-images.ts');
const PUBLIC_BASE = '/castillo/islas';

/** Lado (px) de la imagen 1×; la 2× es el doble. Se pinta a 4× y se reduce. */
const SIZE = 96;
const SUPER = 4;
/** La cámara del juego normal: campo vertical de `mar3d.ts` y elevación de su zoom de salida. */
const FOV = 40;
const ELEVATION = 0.71;
/** Margen alrededor de la isla (fracción del medio lado de la imagen). */
const MARGIN = 0.06;
const WEBP_QUALITY = 0.9;

interface GeometryData {
  position: number[];
  normal: number[] | null;
  color: number[];
  index: number[] | null;
}

type Geo = ReturnType<typeof islandTemplate>['lit'];

function serialize(g: Geo): GeometryData {
  const attr = (n: string) => {
    const a = g.getAttribute(n);
    return a ? Array.from(a.array as ArrayLike<number>) : null;
  };
  return {
    position: attr('position')!,
    normal: attr('normal'),
    color: attr('color')!,
    index: g.index ? Array.from(g.index.array as ArrayLike<number>) : null,
  };
}

// Algunas islas traen piezas animadas con letrero de canvas (la pantalla del
// escenario); la arena no las usa (sólo `lit` y `glow`), así que en Node basta
// un canvas de mentira para que se construyan.
const noop2d = new Proxy({}, { get: () => () => undefined, set: () => true });
(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => noop2d }),
};

const islands = DEFENSE_TOWER_KINDS.map((kind) => {
  const t = islandTemplate(kind);
  return {
    kind,
    // A huella 1, como la arena las lleva todas a la misma huella por nivel.
    scale: 1 / t.measured,
    lit: serialize(t.lit),
    glow: t.glow ? serialize(t.glow) : null,
  };
});

const day = moods().dia;
const light = {
  hemiSky: `#${day.hemiSky.getHexString()}`,
  hemiGround: `#${day.hemiGround.getHexString()}`,
  hemi: day.hemi,
  sun: `#${day.sun.getHexString()}`,
  sunI: day.sunI,
  sunDir: day.sunDir,
};

const webRequire = createRequire(join(WEB, 'package.json'));
const threeDir = dirname(webRequire.resolve('three'));
const { chromium } = webRequire('@playwright/test') as typeof import('@playwright/test');

const HOST = 'http://islas.render';
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"${HOST}/three/three.module.js"}}</script>
</head><body style="margin:0;background:transparent"></body></html>`;

/** Lo que corre en la página: pinta cada isla y devuelve sus imágenes (data URL). */
async function inPage(args: {
  islands: typeof islands;
  light: typeof light;
  size: number;
  superSample: number;
  fov: number;
  elevation: number;
  margin: number;
  quality: number;
}): Promise<{ kind: string; x1: string; x2: string; opaque: number; corner: number }[]> {
  const T = await import(/* @vite-ignore */ 'three' as string);
  const big = args.size * args.superSample;
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(big, big);
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const hemi = new T.HemisphereLight(args.light.hemiSky, args.light.hemiGround, args.light.hemi);
  const sun = new T.DirectionalLight(args.light.sun, args.light.sunI);
  const d = args.light.sunDir;
  sun.position.set(d[0] * 100, d[1] * 100, d[2] * 100);
  scene.add(hemi, sun, sun.target);
  const lit = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: T.DoubleSide });
  const glow = new T.MeshBasicMaterial({ vertexColors: true });

  const geometry = (g: GeometryData) => {
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(g.position, 3));
    if (g.normal) out.setAttribute('normal', new T.Float32BufferAttribute(g.normal, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(g.color, 3));
    if (g.index) out.setIndex(g.index);
    return out;
  };
  const groups = args.islands.map((isl) => {
    const g = new T.Group();
    g.add(new T.Mesh(geometry(isl.lit), lit));
    if (isl.glow) g.add(new T.Mesh(geometry(isl.glow), glow));
    g.scale.setScalar(isl.scale);
    g.updateMatrixWorld(true);
    return g;
  });

  // Como en el juego, el mar tapa lo que queda bajo el agua (la base de la isla).
  renderer.localClippingEnabled = true;
  const sea = [new T.Plane(new T.Vector3(0, 1, 0), 0)];
  lit.clippingPlanes = sea;
  glow.clippingPlanes = sea;

  // El mismo encuadre para todas: la misma cámara (campo y elevación del
  // juego, de frente) acercada hasta que la parte de la isla sobre el agua
  // llena la imagen con el mismo margen, centrada.
  const camera = new T.PerspectiveCamera(args.fov, 1, 0.01, 100);
  const dir = new T.Vector3(0, Math.sin(args.elevation), Math.cos(args.elevation));
  const frame = (g: InstanceType<typeof T.Group>) => {
    const pts: number[] = [];
    const v = new T.Vector3();
    g.traverse((o: InstanceType<typeof T.Object3D>) => {
      const m = o as InstanceType<typeof T.Mesh>;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (v.y >= 0) pts.push(v.x, v.y, v.z);
      }
    });
    const box = new T.Box3();
    for (let i = 0; i < pts.length; i += 3) box.expandByPoint(v.set(pts[i]!, pts[i + 1]!, pts[i + 2]!));
    const target = box.getCenter(new T.Vector3());
    const pm = new T.Matrix4();
    const place = (dist: number) => {
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < pts.length; i += 3) {
        v.set(pts[i]!, pts[i + 1]!, pts[i + 2]!).applyMatrix4(pm);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      return { x0, x1, y0, y1 };
    };
    const up = new T.Vector3();
    const right = new T.Vector3();
    let dist = 4;
    for (let pass = 0; pass < 3; pass++) {
      // La distancia a la que lo más ancho o lo más alto toca el margen…
      let lo = 0.2;
      let hi = 50;
      for (let i = 0; i < 40; i++) {
        dist = (lo + hi) / 2;
        const r = place(dist);
        const ext = Math.max(-r.x0, r.x1, -r.y0, r.y1);
        if (ext > 1 - args.margin) lo = dist;
        else hi = dist;
      }
      dist = hi;
      // …y el blanco movido (en el plano de la pantalla) para centrarla.
      const r = place(dist);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      const h = Math.tan((args.fov * Math.PI) / 360) * dist;
      target.addScaledVector(up, ((r.y0 + r.y1) / 2) * h);
      target.addScaledVector(right, ((r.x0 + r.x1) / 2) * h);
    }
    place(dist);
  };

  const shrink = (src: HTMLCanvasElement, to: number) => {
    let cur: HTMLCanvasElement = src;
    while (cur.width > to) {
      const next = document.createElement('canvas');
      next.width = Math.max(to, cur.width / 2);
      next.height = next.width;
      const ctx = next.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cur, 0, 0, next.width, next.height);
      cur = next;
    }
    return cur;
  };

  const out = [];
  for (let i = 0; i < groups.length; i++) {
    scene.add(groups[i]!);
    frame(groups[i]!);
    renderer.render(scene, camera);
    scene.remove(groups[i]!);
    const x2 = shrink(renderer.domElement, args.size * 2);
    const x1 = shrink(x2, args.size);
    const px = x1.getContext('2d')!.getImageData(0, 0, args.size, args.size).data;
    let opaque = 0;
    for (let p = 3; p < px.length; p += 4) if (px[p]! > 200) opaque++;
    out.push({
      kind: args.islands[i]!.kind,
      x1: x1.toDataURL('image/webp', args.quality),
      x2: x2.toDataURL('image/webp', args.quality),
      opaque: opaque / (args.size * args.size),
      corner: px[3]! + px[(args.size - 1) * 4 + 3]!,
    });
  }
  return out;
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  await page.route(`${HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/three/')) {
      const file = join(threeDir, url.pathname.slice('/three/'.length));
      await route.fulfill({ body: readFileSync(file), contentType: 'text/javascript' });
    } else await route.fulfill({ body: PAGE, contentType: 'text/html' });
  });
  page.on('pageerror', (e) => console.error('página:', e.message));
  await page.goto(`${HOST}/`);
  const shots = await page.evaluate(inPage, {
    islands,
    light,
    size: SIZE,
    superSample: SUPER,
    fov: FOV,
    elevation: ELEVATION,
    margin: MARGIN,
    quality: WEBP_QUALITY,
  });

  // `--sheet <ruta.png>`: una hoja con las siete (2× sobre cuadros y 1× sobre
  // el azul del panel) para revisarlas a ojo; va fuera del repo.
  const sheetAt = process.argv.indexOf('--sheet');
  if (sheetAt > 0 && process.argv[sheetAt + 1]) {
    const png = await page.evaluate(
      async ({ urls, size }) => {
        const load = (src: string) =>
          new Promise<HTMLImageElement>((ok, ko) => {
            const im = new Image();
            im.onload = () => ok(im);
            im.onerror = ko;
            im.src = src;
          });
        const pad = 12;
        const cell = size * 2 + pad;
        const cv = document.createElement('canvas');
        cv.width = urls.length * cell + pad;
        cv.height = size * 3 + pad * 3;
        const g = cv.getContext('2d')!;
        g.fillStyle = '#12233f';
        g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < urls.length; i++) {
          const x = pad + i * cell;
          for (let cy = 0; cy < size * 2; cy += 12)
            for (let cx = 0; cx < size * 2; cx += 12) {
              g.fillStyle = (cx + cy) % 24 ? '#d8d8d8' : '#ffffff';
              g.fillRect(x + cx, pad + cy, 12, 12);
            }
          g.drawImage(await load(urls[i]![1]), x, pad);
          g.drawImage(await load(urls[i]![0]), x + size / 2, pad * 2 + size * 2);
        }
        return cv.toDataURL('image/png');
      },
      { urls: shots.map((s) => [s.x1, s.x2] as [string, string]), size: SIZE },
    );
    const file = resolve(process.argv[sheetAt + 1]!);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
    console.log(`hoja: ${file}`);
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const decode = (url: string) => {
    if (!url.startsWith('data:image/webp;base64,')) throw new Error('el navegador no dio webp');
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  };
  for (const s of shots) {
    if (s.corner !== 0) throw new Error(`${s.kind}: el fondo no es transparente`);
    if (s.opaque < 0.08) throw new Error(`${s.kind}: casi no se ve la isla (${s.opaque})`);
    const a = decode(s.x1);
    const b = decode(s.x2);
    writeFileSync(join(OUT_DIR, `${s.kind}.webp`), a);
    writeFileSync(join(OUT_DIR, `${s.kind}@2x.webp`), b);
    console.log(`${s.kind}: ${a.length} B (1×), ${b.length} B (2×), ${(s.opaque * 100).toFixed(0)} % isla`);
  }

  const entries = shots
    .map(
      (s) =>
        `  ${s.kind}: {\n    src: '${PUBLIC_BASE}/${s.kind}.webp',\n    src2x: '${PUBLIC_BASE}/${s.kind}@2x.webp',\n  },`,
    )
    .join('\n');
  writeFileSync(
    MANIFEST,
    `import type { DefenseTowerKind } from '@boia/engine/defense';

/**
 * Las imágenes de las islas de «Construir» (plan 015 T172, decisión 13): una
 * foto de frente del modelo que construye el castillo, mismo encuadre y luz
 * para todas, fondo transparente. Archivo generado por
 * \`tools/islas-construir/render.ts\`; no se edita a mano:
 *
 *   node --experimental-transform-types --no-warnings --import ./packages/world/scripts/ts-resolve.mjs tools/islas-construir/render.ts
 */

export interface CastleIslandImage {
  /** Ruta pública de la imagen 1× (webp, fondo transparente). */
  src: string;
  /** La misma a doble tamaño (pantallas densas). */
  src2x: string;
}

/** Lado en px de la imagen 1× (cuadrada); la 2× mide el doble. */
export const CASTLE_ISLAND_IMAGE_SIZE = ${SIZE};

export const CASTLE_ISLAND_IMAGES: Record<DefenseTowerKind, CastleIslandImage> = {
${entries}
};
`,
  );
  console.log(`manifiesto: ${MANIFEST}`);
} finally {
  await browser.close();
}
