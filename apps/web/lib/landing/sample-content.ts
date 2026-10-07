import { type Album, albumSchema, homeContentSchema, type HomeContent } from '@boia/contracts';
import {
  SAMPLE_ALBUMS,
  SAMPLE_ARTISTS,
  SAMPLE_EVENTS,
  SAMPLE_HOME_BLOCKS,
  SAMPLE_PHOTOS,
  SAMPLE_PROMOTIONS,
} from '@boia/store';

/**
 * Contenido de MUESTRA de la home: el mismo de `@boia/store` (T16), así lo
 * que pinta el servidor es lo que el repositorio del navegador da mientras el
 * Admin de la demo no cambie nada (T26). La landing lo pinta primero y, al
 * montar, lo sustituye por lo del repositorio (`live-content.ts`). Todo lo que
 * no es textual de la v14 es inventado y está marcado `sample`.
 */
export const SAMPLE_CONTENT: HomeContent = homeContentSchema.parse({
  blocks: SAMPLE_HOME_BLOCKS,
  events: SAMPLE_EVENTS,
  artists: SAMPLE_ARTISTS,
  photos: SAMPLE_PHOTOS,
  albums: SAMPLE_ALBUMS,
  promotions: SAMPLE_PROMOTIONS,
});

/** Álbumes de la muestra (la home no los usa; sí «Fotos y eventos» y la ficha de evento). */
export const SAMPLE_ALBUM_CONTENT: Album[] = SAMPLE_ALBUMS.map((a) => albumSchema.parse(a));
