import type { LetterPose, TitleSheet } from '@boia/engine/intro';

/**
 * Pinta el título 3D «BOIA» (T27) en un canvas 2D: cada letra es un recorte
 * de la hoja de Blender (su fila y la columna de su guiñada), movido, girado
 * en el plano y escalado según su pose (`titlePoses`). Sin WebGL: el 3D ya
 * viene en los sprites (D-05).
 */

/** Alto de la caja del título, en celdas: sitio para subir desde abajo y para el saltito de salida. */
const BOX_CELLS_H = 2.2;
/** Tamaño de la palabra: fracción del ancho de la vista y alto de la tinta como fracción del alto. */
// Plan 007 T79: a little smaller, so «BOIA» sits over the planet as in T77 §4.
const FIT_WIDTH = 0.66;
const FIT_HEIGHT = 0.14;
/** Nunca más grande que esto (px CSS por px de la hoja): la hoja se vería blanda. */
const MAX_SCALE = 1.1;
/** Alto de la tinta de una letra (con el canto de arriba) en mayúsculas. */
const INK_CAPS = 1.35;

export interface TitleLayout {
  /** px CSS por px de la hoja. */
  scale: number;
  /** Caja del canvas en px CSS. */
  width: number;
  height: number;
}

export function fitTitle(sheet: TitleSheet, vw: number, vh: number): TitleLayout {
  const scale = Math.min(
    (FIT_WIDTH * vw) / sheet.wordWidthPx,
    (FIT_HEIGHT * vh) / (sheet.capPx * INK_CAPS),
    MAX_SCALE,
  );
  return {
    scale,
    width: Math.ceil((sheet.wordWidthPx + sheet.cellW) * scale),
    height: Math.ceil(sheet.cellH * BOX_CELLS_H * scale),
  };
}

/** Ajusta el canvas a la caja (px CSS × densidad). Devuelve si cambió. */
export function sizeTitleCanvas(canvas: HTMLCanvasElement, layout: TitleLayout, dpr: number) {
  const w = Math.round(layout.width * dpr);
  const h = Math.round(layout.height * dpr);
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;
  return true;
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sheet: TitleSheet,
  poses: readonly LetterPose[],
  layout: TitleLayout,
  dpr: number,
) {
  const k = layout.scale * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Coordenadas de la hoja: la palabra centrada, las letras en reposo a media altura.
  const ox = (layout.width / layout.scale - sheet.wordWidthPx) / 2;
  const oy = layout.height / layout.scale / 2;
  const { cellW, cellH, capPx } = sheet;
  sheet.letters.forEach((l, i) => {
    const p = poses[i];
    if (!p || p.alpha <= 0 || p.scale <= 0) return;
    const c = Math.cos(p.roll) * p.scale;
    const s = Math.sin(p.roll) * p.scale;
    const x = ox + l.centerPx + p.x * capPx;
    const y = oy + p.y * capPx;
    ctx.globalAlpha = p.alpha;
    ctx.setTransform(k * c, k * s, -k * s, k * c, k * x, k * y);
    ctx.drawImage(
      img,
      p.frame * cellW,
      l.row * cellH,
      cellW,
      cellH,
      -cellW / 2,
      -cellH / 2,
      cellW,
      cellH,
    );
  });
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function clearTitle(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
