import type PptxGenJS from 'pptxgenjs';
import QRCode from 'qrcode';
import type {
  Diapositiva,
  Falta,
  HojaDeRuta,
  Portada,
  PortadaParte,
  Preguntas,
  QueEs,
  QueFalta,
  QueTiene,
  Telefonos,
  Texto,
} from './deck.ts';
import { marca, type Imagen } from './imagen.ts';
import { COLOR, ETIQUETA, FUENTE, LIENZO, PT } from './tema.ts';

type Pres = PptxGenJS;
type Slide = PptxGenJS.Slide;
type Nueva = (masterName: string) => Slide;

const { w: W, h: H, margen: M } = LIENZO;
/** Ancho útil entre márgenes. */
const ANCHO = W - 2 * M;
/** Arriba de todo: la sección (antetítulo naranja) y el título. */
const Y_SECCION = 0.45;
const Y_TITULO = 0.78;
/** Columna de texto de las diapositivas con un teléfono a la derecha. */
const COL_TEXTO = 6.6;
/** Caja del teléfono a la derecha. */
const CAJA_DERECHA = { x: 7.6, y: 0.45, w: W - M - 7.6, h: 6.3 };

/** Lo que el generador sabe de una parte al dibujar sus diapositivas. */
export interface Contexto {
  numero: string;
  tituloParte: string;
  /** Una captura por nombre, ya leída (el generador comprobó antes que existen todas). */
  captura: (nombre: string) => Imagen;
}

export const LAYOUT = {
  portada: 'BOIA_PORTADA',
  parte: 'BOIA_PARTE',
  ancho: 'BOIA_ANCHO',
  mitad: 'BOIA_MITAD',
} as const;

/** Los layouts: fondo, logo pequeño, número de diapositiva y el hueco del título. */
export async function definirLayouts(pres: Pres) {
  const logo = await marca('boia-wordmark');
  const hLogo = 0.26;
  const wLogo = (hLogo * logo.w) / logo.h;
  const pie = [{ image: { x: W - M - wLogo, y: H - 0.47, w: wLogo, h: hLogo, data: logo.data } }];
  const numero = {
    x: M,
    y: H - 0.52,
    w: 0.8,
    h: 0.35,
    color: COLOR.tintaSuave,
    fontFace: FUENTE.texto,
    fontSize: 10,
  };
  const titulo = (w: number) => ({
    placeholder: {
      options: {
        name: 'title',
        type: 'title' as const,
        x: M,
        y: Y_TITULO,
        w,
        h: 1.05,
        fontFace: FUENTE.titulo,
        fontSize: PT.titulo,
        color: COLOR.blanco,
        valign: 'top' as const,
        align: 'left' as const,
        margin: 0,
      },
      text: '',
    },
  });

  pres.defineSlideMaster({ title: LAYOUT.portada, background: { color: COLOR.negro } });
  pres.defineSlideMaster({
    title: LAYOUT.parte,
    background: { color: COLOR.navy },
    objects: [...pie],
    slideNumber: numero,
  });
  pres.defineSlideMaster({
    title: LAYOUT.ancho,
    background: { color: COLOR.marProfundo },
    objects: [...pie, titulo(ANCHO)],
    slideNumber: { ...numero },
  });
  pres.defineSlideMaster({
    title: LAYOUT.mitad,
    background: { color: COLOR.marProfundo },
    objects: [...pie, titulo(COL_TEXTO)],
    slideNumber: { ...numero },
  });
}

// ── piezas ──────────────────────────────────────────────────────────────

function antetitulo(s: Slide, texto: string, w = ANCHO) {
  s.addText(texto.toUpperCase(), {
    x: M,
    y: Y_SECCION,
    w,
    h: 0.3,
    margin: 0,
    fontFace: FUENTE.texto,
    fontSize: PT.kicker,
    bold: true,
    color: COLOR.naranja,
    charSpacing: 2,
    isTextBox: true,
    objectName: 'Sección',
  });
}

function seccion(ctx: Contexto, que?: string) {
  return [ctx.numero, ctx.tituloParte, que].filter(Boolean).join('  ·  ');
}

function titulo(s: Slide, texto: string) {
  s.addText(texto, { placeholder: 'title' });
}

/**
 * Un teléfono (captura vertical) o una ventana de escritorio (horizontal),
 * encajado en la caja sin deformar la captura.
 */
function marco(s: Slide, img: Imagen, caja: { x: number; y: number; w: number; h: number }) {
  const vertical = img.h >= img.w;
  // Bisel: lados finos y arriba/abajo algo más, como un móvil; la ventana lleva barra.
  const lado = vertical ? 0.09 : 0.06;
  const arriba = vertical ? 0.24 : 0.26;
  const abajo = vertical ? 0.24 : 0.06;
  const ratio = img.w / img.h;
  let iw = caja.w - 2 * lado;
  let ih = iw / ratio;
  if (ih + arriba + abajo > caja.h) {
    ih = caja.h - arriba - abajo;
    iw = ih * ratio;
  }
  const fw = iw + 2 * lado;
  const fh = ih + arriba + abajo;
  const fx = caja.x + (caja.w - fw) / 2;
  const fy = caja.y + (caja.h - fh) / 2;
  s.addShape('roundRect', {
    x: fx,
    y: fy,
    w: fw,
    h: fh,
    rectRadius: vertical ? 0.28 : 0.1,
    fill: { color: COLOR.negro },
    line: { color: COLOR.linea, width: 1.25 },
    shadow: { type: 'outer', color: '000000', opacity: 0.45, blur: 10, offset: 4, angle: 90 },
    objectName: vertical ? 'Teléfono' : 'Ventana',
  });
  if (vertical) {
    // El altavoz del móvil.
    s.addShape('roundRect', {
      x: fx + fw / 2 - 0.3,
      y: fy + 0.09,
      w: 0.6,
      h: 0.07,
      rectRadius: 0.035,
      fill: { color: COLOR.linea },
      line: { color: COLOR.linea, width: 0 },
    });
  } else {
    for (const [i, c] of [COLOR.naranja, COLOR.violeta, COLOR.linea].entries())
      s.addShape('ellipse', {
        x: fx + 0.14 + i * 0.17,
        y: fy + 0.08,
        w: 0.1,
        h: 0.1,
        fill: { color: c },
        line: { color: c, width: 0 },
      });
  }
  s.addImage({
    data: img.data,
    x: fx + lado,
    y: fy + arriba,
    w: iw,
    h: ih,
    altText: 'Captura de la web',
  });
  return { x: fx, y: fy, w: fw, h: fh };
}

function parrafos(
  textos: string[],
  tam: number,
  color: string = COLOR.blanco,
): PptxGenJS.TextProps[] {
  return textos.map((t, i) => ({
    text: t,
    options: {
      fontSize: tam,
      color,
      paraSpaceAfter: 10,
      ...(i < textos.length - 1 ? { breakLine: true } : {}),
    },
  }));
}

function vinetas(
  textos: string[],
  tam: number = PT.lista,
  color: string = COLOR.blanco,
  espacio = 9,
): PptxGenJS.TextProps[] {
  return textos.map((t, i) => ({
    text: t,
    options: {
      fontSize: tam,
      color,
      bullet: { indent: 18 },
      paraSpaceAfter: espacio,
      ...(i < textos.length - 1 ? { breakLine: true } : {}),
    },
  }));
}

function cajaTexto(
  s: Slide,
  contenido: PptxGenJS.TextProps[],
  pos: PptxGenJS.PositionProps,
  extra = {},
) {
  s.addText(contenido, {
    ...pos,
    margin: 0,
    fontFace: FUENTE.texto,
    valign: 'top',
    isTextBox: true,
    ...extra,
  });
}

/** La etiqueta de «qué falta»: «Necesario» naranja lleno; «Puede esperar» violeta en hueco. */
function etiqueta(s: Slide, e: Falta['etiqueta'], x: number, y: number, w: number, h: number) {
  const lleno = e === 'necesario';
  s.addText(ETIQUETA[e], {
    shape: 'roundRect',
    rectRadius: h / 2,
    x,
    y,
    w,
    h,
    margin: 0,
    align: 'center',
    valign: 'middle',
    fontFace: FUENTE.texto,
    fontSize: PT.etiqueta,
    bold: true,
    color: lleno ? COLOR.blanco : COLOR.violeta,
    fill: lleno ? { color: COLOR.naranja } : { color: COLOR.marProfundo },
    line: { color: lleno ? COLOR.naranja : COLOR.violeta, width: 1.5 },
    isTextBox: true,
    objectName: ETIQUETA[e],
  });
}

function circulo(
  s: Slide,
  texto: string,
  x: number,
  y: number,
  d: number,
  fondo: string,
  tinta: string,
) {
  s.addText(texto, {
    shape: 'ellipse',
    x,
    y,
    w: d,
    h: d,
    margin: 0,
    align: 'center',
    valign: 'middle',
    fontFace: FUENTE.titulo,
    fontSize: 18,
    color: tinta,
    fill: { color: fondo },
    line: { color: fondo, width: 0 },
    isTextBox: true,
  });
}

// ── diapositivas ────────────────────────────────────────────────────────

async function portada(nueva: Nueva, s: Portada) {
  const sl = nueva(LAYOUT.portada);
  const logo = await marca('boia-wordmark');
  const mascota = await marca('boia-mascota', 1400);
  // El motivo: la boia (un aro) detrás de la mascota.
  sl.addShape('ellipse', {
    x: 7.55,
    y: 0.85,
    w: 5.6,
    h: 5.6,
    fill: { color: COLOR.banda },
    line: { color: COLOR.linea, width: 2 },
  });
  const hm = 4.3;
  sl.addImage({
    data: mascota.data,
    x: 7.55 + (5.6 - (hm * mascota.w) / mascota.h) / 2,
    y: 1.5,
    w: (hm * mascota.w) / mascota.h,
    h: hm,
    altText: 'La mascota de BOIA',
  });
  const wl = 4.6;
  sl.addImage({ data: logo.data, x: M, y: 0.9, w: wl, h: (wl * logo.h) / logo.w, altText: 'BOIA' });
  if (s.antetitulo)
    sl.addText(s.antetitulo.toUpperCase(), {
      x: M,
      y: 2.55,
      w: 6.6,
      h: 0.35,
      margin: 0,
      fontFace: FUENTE.texto,
      fontSize: 13,
      bold: true,
      color: COLOR.naranja,
      charSpacing: 2,
      isTextBox: true,
    });
  sl.addText(s.titulo, {
    x: M,
    y: 2.95,
    w: 6.7,
    h: 0.95,
    margin: 0,
    fontFace: FUENTE.titulo,
    fontSize: PT.portada,
    color: COLOR.blanco,
    valign: 'top',
    isTextBox: true,
    objectName: 'Título',
  });
  sl.addText(s.subtitulo, {
    x: M,
    y: 3.95,
    w: 6.7,
    h: 1.3,
    margin: 0,
    fontFace: FUENTE.titulo,
    fontSize: 24,
    color: COLOR.naranja,
    valign: 'top',
    isTextBox: true,
  });
  sl.addText(s.fecha, {
    x: M,
    y: 6.3,
    w: 6,
    h: 0.4,
    margin: 0,
    fontFace: FUENTE.texto,
    fontSize: 14,
    color: COLOR.tintaSuave,
    isTextBox: true,
  });
  return sl;
}

async function portadaParte(nueva: Nueva, ctx: Contexto, s: PortadaParte) {
  const sl = nueva(LAYOUT.parte);
  const mascota = await marca('boia-mascota', 1000);
  sl.addShape('ellipse', {
    x: 8.75,
    y: 1.45,
    w: 4.1,
    h: 4.1,
    fill: { color: COLOR.marProfundo },
    line: { color: COLOR.linea, width: 2 },
  });
  const hm = 3.1;
  const wm = (hm * mascota.w) / mascota.h;
  sl.addImage({
    data: mascota.data,
    x: 8.75 + (4.1 - wm) / 2,
    y: 1.95,
    w: wm,
    h: hm,
    altText: 'La mascota de BOIA',
  });
  sl.addText(ctx.numero, {
    x: M,
    y: 0.7,
    w: 4,
    h: 1.9,
    margin: 0,
    fontFace: FUENTE.titulo,
    fontSize: PT.numeroParte,
    color: COLOR.naranja,
    valign: 'bottom',
    isTextBox: true,
    objectName: 'Número de parte',
  });
  sl.addText(s.titulo ?? ctx.tituloParte, {
    x: M,
    y: 2.85,
    w: 8.0,
    h: 1.55,
    margin: 0,
    fontFace: FUENTE.titulo,
    fontSize: PT.tituloParte,
    color: COLOR.blanco,
    valign: 'top',
    isTextBox: true,
    objectName: 'Título',
  });
  if (s.subtitulo)
    sl.addText(s.subtitulo, {
      x: M,
      y: 4.5,
      w: 7.6,
      h: 0.9,
      margin: 0,
      fontFace: FUENTE.texto,
      fontSize: PT.subtitulo,
      color: COLOR.tintaSuave,
      valign: 'top',
      isTextBox: true,
    });
  if (s.secciones?.length)
    sl.addText(s.secciones.join('   ·   '), {
      x: M,
      y: 5.5,
      w: 7.6,
      h: 0.9,
      margin: 0,
      fontFace: FUENTE.texto,
      fontSize: 14,
      bold: true,
      color: COLOR.violeta,
      valign: 'top',
      isTextBox: true,
      objectName: 'Secciones',
    });
  return sl;
}

function queEs(nueva: Nueva, ctx: Contexto, s: QueEs) {
  const sl = nueva(LAYOUT.mitad);
  antetitulo(sl, seccion(ctx, s.seccion), COL_TEXTO);
  titulo(sl, s.titulo);
  const textos = Array.isArray(s.texto) ? s.texto : [s.texto];
  const hTexto = s.destacado ? 3.15 : 4.6;
  cajaTexto(
    sl,
    parrafos(textos, PT.texto),
    { x: M, y: 2.0, w: COL_TEXTO, h: hTexto },
    { lineSpacingMultiple: 1.1 },
  );
  if (s.destacado)
    sl.addText(s.destacado, {
      shape: 'roundRect',
      rectRadius: 0.12,
      x: M,
      y: 5.4,
      w: COL_TEXTO,
      h: 1.15,
      margin: [10, 16, 10, 16],
      fontFace: FUENTE.texto,
      fontSize: 17,
      bold: true,
      color: COLOR.blanco,
      fill: { color: COLOR.tarjeta },
      line: { color: COLOR.linea, width: 1 },
      valign: 'middle',
      isTextBox: true,
      objectName: 'Destacado',
    });
  marco(sl, ctx.captura(s.captura), CAJA_DERECHA);
  return sl;
}

function queTiene(nueva: Nueva, ctx: Contexto, s: QueTiene) {
  const sl = nueva(LAYOUT.mitad);
  antetitulo(sl, seccion(ctx, s.seccion), COL_TEXTO);
  titulo(sl, s.titulo);
  cajaTexto(sl, vinetas(s.puntos), { x: M, y: 2.0, w: COL_TEXTO, h: 4.65 });
  marco(sl, ctx.captura(s.captura), CAJA_DERECHA);
  return sl;
}

function telefonos(nueva: Nueva, ctx: Contexto, s: Telefonos) {
  const sl = nueva(LAYOUT.ancho);
  antetitulo(sl, seccion(ctx, s.seccion));
  titulo(sl, s.titulo);
  const imgs = s.telefonos.map((t) => ctx.captura(t.captura));
  const n = imgs.length;
  const hueco = 0.6;
  const yArriba = 1.5;
  const hPie = 0.62;
  const hCaja = H - 0.62 - yArriba - hPie;
  // Las cajas se reparten por el ancho según lo que ocupa cada captura a esa altura.
  const anchoNatural = imgs.map((im) =>
    Math.min(hCaja * (im.w / im.h) + 0.2, (ANCHO - hueco * (n - 1)) / n),
  );
  const total = anchoNatural.reduce((a, b) => a + b, 0) + hueco * (n - 1);
  let x = M + (ANCHO - total) / 2;
  imgs.forEach((im, i) => {
    const w = anchoNatural[i]!;
    const f = marco(sl, im, { x, y: yArriba, w, h: hCaja });
    sl.addText(s.telefonos[i]!.pie, {
      x: x - 0.15,
      y: f.y + f.h + 0.1,
      w: w + 0.3,
      h: hPie - 0.05,
      margin: 0,
      align: 'center',
      valign: 'top',
      fontFace: FUENTE.texto,
      fontSize: PT.pie,
      color: COLOR.tintaSuave,
      isTextBox: true,
      objectName: 'Pie',
    });
    x += w + hueco;
  });
  return sl;
}

function queFalta(nueva: Nueva, ctx: Contexto, s: QueFalta) {
  const sl = nueva(LAYOUT.ancho);
  antetitulo(sl, seccion(ctx, s.seccion));
  titulo(sl, s.titulo ?? 'Qué falta');
  const nec = s.items.filter((i) => i.etiqueta === 'necesario').length;
  const esp = s.items.length - nec;
  const resumen = [
    nec ? `${nec} ${nec === 1 ? 'necesario' : 'necesarios'} para salir` : '',
    esp ? `${esp} ${esp === 1 ? 'puede' : 'pueden'} esperar` : '',
  ]
    .filter(Boolean)
    .join('   ·   ');
  sl.addText(resumen, {
    x: M,
    y: 1.35,
    w: ANCHO,
    h: 0.35,
    margin: 0,
    fontFace: FUENTE.texto,
    fontSize: 13,
    color: COLOR.tintaSuave,
    isTextBox: true,
  });
  const yIni = 1.9;
  const disponible = H - 0.7 - yIni;
  const gap = 0.14;
  const n = s.items.length;
  const hFila = Math.min(0.82, (disponible - gap * (n - 1)) / n);
  // Primero lo necesario, después lo que puede esperar.
  const orden = [...s.items].sort(
    (a, b) => Number(b.etiqueta === 'necesario') - Number(a.etiqueta === 'necesario'),
  );
  orden.forEach((it, i) => {
    const y = yIni + i * (hFila + gap);
    sl.addShape('roundRect', {
      x: M,
      y,
      w: ANCHO,
      h: hFila,
      rectRadius: 0.1,
      fill: { color: COLOR.tarjeta },
      line: { color: COLOR.tarjeta, width: 0 },
      objectName: 'Fila',
    });
    const hPill = 0.38;
    etiqueta(sl, it.etiqueta, M + 0.2, y + (hFila - hPill) / 2, 2.35, hPill);
    const wQuien = it.quien ? 1.7 : 0;
    cajaTexto(
      sl,
      [{ text: it.texto, options: { fontSize: PT.lista, color: COLOR.blanco } }],
      {
        x: M + 2.85,
        y,
        w: ANCHO - 2.85 - 0.25 - wQuien,
        h: hFila,
      },
      { valign: 'middle' },
    );
    if (it.quien)
      sl.addText(it.quien, {
        x: W - M - 0.2 - wQuien,
        y,
        w: wQuien,
        h: hFila,
        margin: 0,
        align: 'right',
        valign: 'middle',
        fontFace: FUENTE.texto,
        fontSize: PT.pie,
        bold: true,
        color: COLOR.tintaSuave,
        isTextBox: true,
        objectName: 'Quién',
      });
  });
  return sl;
}

function preguntas(nueva: Nueva, ctx: Contexto, s: Preguntas) {
  const sl = nueva(LAYOUT.ancho);
  antetitulo(sl, seccion(ctx, s.seccion));
  titulo(sl, 'Preguntas y propuestas');
  const y = 1.55;
  const h = H - 0.7 - y;
  const gap = 0.4;
  const w = (ANCHO - gap) / 2;
  const columnas: Array<[string, string, string, string, string[]]> = [
    ['?', 'Preguntas', COLOR.naranja, COLOR.blanco, s.preguntas],
    ['+', 'Propuestas', COLOR.violeta, COLOR.negro, s.propuestas],
  ];
  columnas.forEach(([icono, cabecera, fondo, tinta, items], i) => {
    const x = M + i * (w + gap);
    sl.addShape('roundRect', {
      x,
      y,
      w,
      h,
      rectRadius: 0.14,
      fill: { color: COLOR.tarjeta },
      line: { color: COLOR.linea, width: 1 },
      objectName: cabecera,
    });
    circulo(sl, icono, x + 0.3, y + 0.3, 0.5, fondo, tinta);
    sl.addText(cabecera, {
      x: x + 0.95,
      y: y + 0.3,
      w: w - 1.2,
      h: 0.5,
      margin: 0,
      valign: 'middle',
      fontFace: FUENTE.titulo,
      fontSize: 20,
      color: COLOR.blanco,
      isTextBox: true,
    });
    cajaTexto(sl, vinetas(items, PT.lista, COLOR.blanco, 12), {
      x: x + 0.3,
      y: y + 1.05,
      w: w - 0.6,
      h: h - 1.3,
    });
  });
  return sl;
}

function hojaDeRuta(nueva: Nueva, ctx: Contexto, s: HojaDeRuta) {
  const sl = nueva(LAYOUT.ancho);
  antetitulo(sl, seccion(ctx, s.seccion));
  titulo(sl, s.titulo);
  const anchos = s.anchos ?? s.columnas.map(() => 1);
  const suma = anchos.reduce((a, b) => a + b, 0);
  const colW = anchos.map((a) => (a / suma) * ANCHO);
  const borde = { type: 'solid' as const, pt: 0.75, color: COLOR.linea };
  const cabecera: PptxGenJS.TableRow = s.columnas.map((c) => ({
    text: c,
    options: {
      bold: true,
      color: COLOR.blanco,
      fill: { color: COLOR.naranja },
      fontSize: PT.tabla,
    },
  }));
  const filas: PptxGenJS.TableRow[] = s.filas.map((f, i) =>
    f.map((c) => {
      const esEtiqueta = c === ETIQUETA.necesario || c === ETIQUETA['puede-esperar'];
      const necesario = c === ETIQUETA.necesario;
      return {
        text: c,
        options: {
          fontSize: PT.tabla,
          color: esEtiqueta ? (necesario ? COLOR.naranjaVivo : COLOR.violeta) : COLOR.blanco,
          bold: esEtiqueta,
          fill: { color: i % 2 ? COLOR.navy : COLOR.tarjeta },
        },
      };
    }),
  );
  sl.addTable([cabecera, ...filas], {
    x: M,
    y: 1.55,
    w: ANCHO,
    colW,
    fontFace: FUENTE.texto,
    border: borde,
    valign: 'middle',
    margin: [4, 8, 4, 8],
    rowH: 0.42,
    autoPage: false,
  });
  return sl;
}

async function texto(nueva: Nueva, ctx: Contexto, s: Texto) {
  const sl = nueva(LAYOUT.ancho);
  antetitulo(sl, seccion(ctx, s.seccion));
  titulo(sl, s.titulo);
  const contenido: PptxGenJS.TextProps[] = [];
  if (s.texto) contenido.push(...parrafos([s.texto], PT.texto));
  if (s.texto && s.puntos?.length) contenido[contenido.length - 1]!.options!.breakLine = true;
  if (s.puntos?.length) contenido.push(...vinetas(s.puntos));
  cajaTexto(sl, contenido, { x: M, y: 2.0, w: 7.6, h: 4.65 }, { lineSpacingMultiple: 1.05 });
  if (s.qr) {
    await qr(sl, s.qr, { x: 9.0, y: 1.75, lado: 3.7 });
    return sl;
  }
  const mascota = await marca('boia-mascota', 1000);
  sl.addShape('ellipse', {
    x: 9.0,
    y: 2.0,
    w: 3.7,
    h: 3.7,
    fill: { color: COLOR.banda },
    line: { color: COLOR.linea, width: 2 },
  });
  const hm = 2.8;
  const wm = (hm * mascota.w) / mascota.h;
  sl.addImage({
    data: mascota.data,
    x: 9.0 + (3.7 - wm) / 2,
    y: 2.45,
    w: wm,
    h: hm,
    altText: 'La mascota de BOIA',
  });
  return sl;
}

/**
 * El código QR de una dirección, en una tarjeta blanca (oscuro sobre claro
 * para que lo lea cualquier móvil), con la dirección escrita debajo.
 */
async function qr(sl: Slide, url: string, caja: { x: number; y: number; lado: number }) {
  const data = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 1200,
    color: { dark: `#${COLOR.negro}`, light: '#FFFFFF' },
  });
  const { x, y, lado } = caja;
  sl.addShape('roundRect', {
    x,
    y,
    w: lado,
    h: lado,
    rectRadius: 0.18,
    fill: { color: COLOR.blanco },
    line: { color: COLOR.naranja, width: 3 },
    objectName: 'QR',
  });
  const borde = 0.3;
  sl.addImage({
    data,
    x: x + borde,
    y: y + borde,
    w: lado - 2 * borde,
    h: lado - 2 * borde,
    altText: `Código QR de ${url}`,
  });
  sl.addText(url.replace(/^https:\/\//, ''), {
    x: x - 0.4,
    y: y + lado + 0.12,
    w: lado + 0.8,
    h: 0.4,
    margin: 0,
    align: 'center',
    fontFace: FUENTE.texto,
    fontSize: PT.pie,
    bold: true,
    color: COLOR.tintaSuave,
    isTextBox: true,
    objectName: 'Dirección del QR',
  });
}

/** Dibuja una diapositiva y le pone sus notas del orador. */
export async function dibujar(pres: Pres, ctx: Contexto, d: Diapositiva, seccionPres: string) {
  // Todas las diapositivas de la parte van en su sección de PowerPoint.
  const nueva: Nueva = (masterName) => pres.addSlide({ masterName, sectionTitle: seccionPres });
  let sl: Slide;
  switch (d.tipo) {
    case 'portada':
      sl = await portada(nueva, d);
      break;
    case 'portadaParte':
      sl = await portadaParte(nueva, ctx, d);
      break;
    case 'queEs':
      sl = queEs(nueva, ctx, d);
      break;
    case 'queTiene':
      sl = queTiene(nueva, ctx, d);
      break;
    case 'telefonos':
      sl = telefonos(nueva, ctx, d);
      break;
    case 'queFalta':
      sl = queFalta(nueva, ctx, d);
      break;
    case 'preguntas':
      sl = preguntas(nueva, ctx, d);
      break;
    case 'hojaDeRuta':
      sl = hojaDeRuta(nueva, ctx, d);
      break;
    case 'texto':
      sl = await texto(nueva, ctx, d);
      break;
  }
  sl.addNotes(d.notas.map((n) => `- ${n}`).join('\n'));
}

/** Las capturas que pide una diapositiva (para comprobarlas todas antes de dibujar). */
export function capturasDe(d: Diapositiva): string[] {
  switch (d.tipo) {
    case 'queEs':
    case 'queTiene':
      return [d.captura];
    case 'telefonos':
      return d.telefonos.map((t) => t.captura);
    default:
      return [];
  }
}
