import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raíz del repositorio (tools/deck/src → ../../..). */
export const RAIZ = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const PRESENTACION = join(RAIZ, 'docs', 'presentacion');
export const PARTES = join(PRESENTACION, 'partes');
export const CAPTURAS = join(PRESENTACION, 'capturas');
/** Carpeta ignorada por git: PNG por diapositiva e índice, para la revisión visual. */
export const RENDER = join(PRESENTACION, 'render');
export const PPTX = join(PRESENTACION, 'boia-planet.pptx');
export const PDF = join(PRESENTACION, 'boia-planet.pdf');
export const MARCA = join(RAIZ, 'art', 'marca');

/** Un archivo de parte: `NN-slug.ts` (NN de 01 a 99, slug en minúsculas con guiones). */
export const PATRON_PARTE = /^(\d\d)-([a-z0-9]+(?:-[a-z0-9]+)*)\.ts$/;

export interface ArchivoParte {
  /** «02» */
  numero: string;
  /** «02-landing»: también el nombre de su carpeta de capturas. */
  id: string;
  ruta: string;
}

/** Las partes, por nombre de archivo y en orden: nadie tiene que apuntarlas en una lista. */
export function partes(): ArchivoParte[] {
  if (!existsSync(PARTES)) return [];
  const vistas = new Map<string, string>();
  return readdirSync(PARTES)
    .filter((f) => PATRON_PARTE.test(f))
    .sort()
    .map((f) => {
      const [, numero] = PATRON_PARTE.exec(f)!;
      const otra = vistas.get(numero!);
      if (otra) throw new Error(`Dos partes con el número ${numero}: ${otra} y ${f}`);
      vistas.set(numero!, f);
      return { numero: numero!, id: f.replace(/\.ts$/, ''), ruta: join(PARTES, f) };
    });
}
