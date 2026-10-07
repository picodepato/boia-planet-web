/**
 * Las piezas con las que un archivo de parte (`docs/presentacion/partes/
 * NN-slug.ts`) describe sus diapositivas. Cada parte exporta su `titulo` y
 * una función que recibe un `Deck` y lo llama una vez por diapositiva:
 *
 *   import type { Deck } from '../../../tools/deck/src/deck.ts';
 *   export const titulo = 'Landing';
 *   export default function (d: Deck) {
 *     d.portadaParte({ subtitulo: '…', notas: ['…', '…'] });
 *     d.queEs({ seccion: 'Hero', titulo: '…', texto: '…', captura: 'hero', notas: [...] });
 *   }
 *
 * Cada método comprueba los límites de su diapositiva (para que nada se salga
 * de la caja) y falla con el nombre de la parte y el número de diapositiva.
 * Las capturas se nombran sin extensión: `'hero'` es
 * `capturas/<NN-slug>/hero.jpg`; `'05-mar/puerto'`, la de otra parte.
 */

import { LIENZO } from './tema.ts';

/** Ancho útil de la diapositiva y alto disponible para una tabla, en pulgadas. */
const ANCHO_UTIL = LIENZO.w - 2 * LIENZO.margen;
const ALTO_TABLA = 5.15;

export type Etiqueta = 'necesario' | 'puede-esperar';
export type Quien = 'Álvaro' | 'Socios' | 'Hernán' | 'Álvaro y socios';

/** Notas del orador: 2–4 ideas cortas (decisión 6). Van en todas las diapositivas. */
export interface ConNotas {
  notas: string[];
}

export interface Portada extends ConNotas {
  titulo: string;
  subtitulo: string;
  /** Línea pequeña encima del título («Presentación para los socios»). */
  antetitulo?: string;
  fecha: string;
}

export interface PortadaParte extends ConNotas {
  /** Por defecto, el `titulo` de la parte. */
  titulo?: string;
  subtitulo?: string;
  /** Las secciones que recorre la parte, en una línea. */
  secciones?: string[];
}

interface DeSeccion extends ConNotas {
  /** La sección dentro de la parte («Hero»); va encima del título. */
  seccion: string;
  titulo: string;
}

export interface QueEs extends DeSeccion {
  /** Uno o varios párrafos. */
  texto: string | string[];
  /** Una frase destacada al pie de la columna de texto. */
  destacado?: string;
  captura: string;
}

export interface QueTiene extends DeSeccion {
  puntos: string[];
  captura: string;
}

export interface Telefono {
  captura: string;
  pie: string;
}

export interface Telefonos extends DeSeccion {
  telefonos: Telefono[];
}

export interface Falta {
  texto: string;
  etiqueta: Etiqueta;
  /** Quién tiene que actuar, si se sabe. */
  quien?: Quien;
}

export interface QueFalta extends ConNotas {
  seccion: string;
  /** Por defecto «Qué falta». */
  titulo?: string;
  items: Falta[];
}

export interface Preguntas extends ConNotas {
  seccion: string;
  /** Preguntas abiertas para Álvaro y los socios. */
  preguntas: string[];
  /** Mejoras propuestas por el equipo (Hernán las revisa). */
  propuestas: string[];
}

export interface HojaDeRuta extends ConNotas {
  seccion?: string;
  titulo: string;
  columnas: string[];
  /** Una celda que sea exactamente el texto de una etiqueta se pinta como esa etiqueta. */
  filas: string[][];
  /** Anchos relativos de las columnas (por defecto, iguales). */
  anchos?: number[];
}

export interface Texto extends ConNotas {
  seccion?: string;
  titulo: string;
  texto?: string;
  puntos?: string[];
}

export type Diapositiva =
  | ({ tipo: 'portada' } & Portada)
  | ({ tipo: 'portadaParte' } & PortadaParte)
  | ({ tipo: 'queEs' } & QueEs)
  | ({ tipo: 'queTiene' } & QueTiene)
  | ({ tipo: 'telefonos' } & Telefonos)
  | ({ tipo: 'queFalta' } & QueFalta)
  | ({ tipo: 'preguntas' } & Preguntas)
  | ({ tipo: 'hojaDeRuta' } & HojaDeRuta)
  | ({ tipo: 'texto' } & Texto);

/** Límites de cada diapositiva: lo que cabe sin salirse, comprobado en el render. */
export const LIMITE = {
  titulo: 50,
  seccion: 40,
  /** El antetítulo entero: «02 · Landing · Hero». */
  antetitulo: 56,
  tituloParte: 32,
  seccionesJuntas: 150,
  portadaTitulo: 30,
  portadaSubtitulo: 60,
  subtituloParte: 90,
  secciones: 10,
  queEsTexto: 520,
  destacado: 110,
  puntos: 6,
  punto: 110,
  telefonos: 3,
  escritorios: 2,
  pie: 50,
  faltas: 6,
  falta: 120,
  preguntas: 4,
  pregunta: 120,
  filas: 10,
  columnas: 5,
  celda: 90,
  textoLibre: 420,
  nota: 220,
} as const;

export class Deck {
  readonly diapositivas: Diapositiva[] = [];
  readonly parte: string;
  readonly titulo: string;

  constructor(parte: string, titulo: string) {
    this.parte = parte;
    this.titulo = titulo;
    if (titulo.length > LIMITE.tituloParte)
      throw new Error(
        `${parte}: el título de la parte tiene ${titulo.length} caracteres (máximo ${LIMITE.tituloParte})`,
      );
  }

  private fallo(msg: string): never {
    throw new Error(`${this.parte}, diapositiva ${this.diapositivas.length + 1}: ${msg}`);
  }

  private largo(que: string, texto: string | undefined, max: number) {
    if (texto === undefined) return;
    if (!texto.trim()) this.fallo(`${que} está vacío`);
    if (texto.length > max)
      this.fallo(
        `${que} tiene ${texto.length} caracteres (máximo ${max}): «${texto.slice(0, 40)}…»`,
      );
  }

  private lista(que: string, items: string[], maxItems: number, maxLargo: number, min = 1) {
    if (items.length < min || items.length > maxItems)
      this.fallo(`${que}: ${items.length} elementos (entre ${min} y ${maxItems})`);
    items.forEach((t, i) => this.largo(`${que} ${i + 1}`, t, maxLargo));
  }

  private notas(n: string[]) {
    if (!Array.isArray(n) || n.length < 2 || n.length > 4)
      this.fallo(`las notas del orador son 2–4 ideas cortas (hay ${n?.length ?? 0})`);
    n.forEach((t, i) => this.largo(`nota ${i + 1}`, t, LIMITE.nota));
  }

  private comunes(s: { seccion?: string; titulo?: string; notas: string[] }) {
    this.largo('la sección', s.seccion, LIMITE.seccion);
    const ante = [this.parte.slice(0, 2), this.titulo, s.seccion].filter(Boolean).join(' · ');
    if (ante.length > LIMITE.antetitulo)
      this.fallo(
        `«${ante}» (parte · sección) tiene ${ante.length} caracteres (máximo ${LIMITE.antetitulo}): acorta la sección`,
      );
    this.largo('el título', s.titulo, LIMITE.titulo);
    if (s.titulo?.trim().endsWith('.')) this.fallo('el título no acaba en punto');
    this.notas(s.notas);
  }

  private captura(nombre: string) {
    if (!/^(\d\d-[a-z0-9-]+\/)?[a-z0-9]+(-[a-z0-9]+)*$/.test(nombre))
      this.fallo(
        `captura «${nombre}»: sin extensión, en minúsculas con guiones (o «NN-parte/nombre»)`,
      );
  }

  portada(s: Portada) {
    this.largo('el título', s.titulo, LIMITE.portadaTitulo);
    this.largo('el subtítulo', s.subtitulo, LIMITE.portadaSubtitulo);
    this.largo('el antetítulo', s.antetitulo, LIMITE.portadaSubtitulo);
    this.largo('la fecha', s.fecha, 40);
    this.notas(s.notas);
    this.diapositivas.push({ tipo: 'portada', ...s });
  }

  portadaParte(s: PortadaParte) {
    this.notas(s.notas);
    this.largo('el título', s.titulo, LIMITE.tituloParte);
    this.largo('el subtítulo', s.subtitulo, LIMITE.subtituloParte);
    if (s.secciones) {
      this.lista('secciones', s.secciones, LIMITE.secciones, 30);
      this.largo('las secciones juntas', s.secciones.join(' · '), LIMITE.seccionesJuntas);
    }
    this.diapositivas.push({ tipo: 'portadaParte', ...s });
  }

  queEs(s: QueEs) {
    this.comunes(s);
    const texto = Array.isArray(s.texto) ? s.texto : [s.texto];
    this.lista('párrafos', texto, 4, LIMITE.queEsTexto);
    this.largo('el texto', texto.join(' '), LIMITE.queEsTexto);
    this.largo('el destacado', s.destacado, LIMITE.destacado);
    this.captura(s.captura);
    this.diapositivas.push({ tipo: 'queEs', ...s });
  }

  queTiene(s: QueTiene) {
    this.comunes(s);
    this.lista('puntos', s.puntos, LIMITE.puntos, LIMITE.punto);
    this.captura(s.captura);
    this.diapositivas.push({ tipo: 'queTiene', ...s });
  }

  telefonos(s: Telefonos) {
    this.comunes(s);
    if (s.telefonos.length < 1 || s.telefonos.length > LIMITE.telefonos)
      this.fallo(`teléfonos: ${s.telefonos.length} (entre 1 y ${LIMITE.telefonos})`);
    s.telefonos.forEach((t, i) => {
      this.captura(t.captura);
      this.largo(`pie ${i + 1}`, t.pie, LIMITE.pie);
    });
    this.diapositivas.push({ tipo: 'telefonos', ...s });
  }

  queFalta(s: QueFalta) {
    this.comunes(s);
    if (s.items.length < 1 || s.items.length > LIMITE.faltas)
      this.fallo(
        `qué falta: ${s.items.length} elementos (entre 1 y ${LIMITE.faltas}; si hay más, otra diapositiva)`,
      );
    s.items.forEach((it, i) => {
      this.largo(`falta ${i + 1}`, it.texto, LIMITE.falta);
      if (it.etiqueta !== 'necesario' && it.etiqueta !== 'puede-esperar')
        this.fallo(`falta ${i + 1}: la etiqueta es 'necesario' o 'puede-esperar'`);
    });
    this.diapositivas.push({ tipo: 'queFalta', ...s });
  }

  preguntas(s: Preguntas) {
    this.comunes(s);
    this.lista('preguntas', s.preguntas, LIMITE.preguntas, LIMITE.pregunta);
    this.lista('propuestas', s.propuestas, LIMITE.preguntas, LIMITE.pregunta);
    this.diapositivas.push({ tipo: 'preguntas', ...s });
  }

  hojaDeRuta(s: HojaDeRuta) {
    this.comunes(s);
    this.lista('columnas', s.columnas, LIMITE.columnas, 30);
    if (s.filas.length < 1 || s.filas.length > LIMITE.filas)
      this.fallo(
        `hoja de ruta: ${s.filas.length} filas (entre 1 y ${LIMITE.filas}; si hay más, otra diapositiva)`,
      );
    s.filas.forEach((f, i) => {
      if (f.length !== s.columnas.length)
        this.fallo(`fila ${i + 1}: ${f.length} celdas para ${s.columnas.length} columnas`);
      f.forEach((c, j) => this.largo(`fila ${i + 1}, celda ${j + 1}`, c, LIMITE.celda));
    });
    if (s.anchos && (s.anchos.length !== s.columnas.length || s.anchos.some((a) => !(a > 0))))
      this.fallo('anchos: uno positivo por columna');
    // Alto aproximado de la tabla (13 pt: ~0,08" por carácter, 0,22" por línea).
    const anchos = s.anchos ?? s.columnas.map(() => 1);
    const suma = anchos.reduce((a, b) => a + b, 0);
    const porLinea = anchos.map((a) =>
      Math.max(4, Math.floor(((a / suma) * ANCHO_UTIL - 0.25) / 0.08)),
    );
    const lineas = (fila: string[]) =>
      Math.max(...fila.map((c, j) => Math.ceil(c.length / porLinea[j]!)));
    const alto = [s.columnas, ...s.filas].reduce(
      (h, f) => h + Math.max(0.42, 0.14 + lineas(f) * 0.22),
      0,
    );
    if (alto > ALTO_TABLA)
      this.fallo(
        `la tabla no cabe (≈${alto.toFixed(1)}" de ${ALTO_TABLA}"): menos filas, textos más cortos o en dos diapositivas`,
      );
    this.diapositivas.push({ tipo: 'hojaDeRuta', ...s });
  }

  texto(s: Texto) {
    this.comunes(s);
    if (!s.texto && !s.puntos?.length) this.fallo('texto o puntos');
    this.largo('el texto', s.texto, LIMITE.textoLibre);
    if (s.puntos) this.lista('puntos', s.puntos, s.texto ? 4 : LIMITE.puntos, LIMITE.punto);
    this.diapositivas.push({ tipo: 'texto', ...s });
  }
}

/** Lo que exporta cada archivo de parte. */
export interface ModuloParte {
  titulo: string;
  default: (d: Deck) => void;
}
