import { type RadioCatalog, radioCatalogSchema } from '@boia/contracts';
import data from './muestra.json' with { type: 'json' };

/**
 * El catálogo de muestra de la radio (plan 022 T246): cien bucles cortos
 * sintetizados por `art/radio/generar.py` (nada descargado), 25 por género,
 * en `public/radio/muestra/`. Siembra la radio en modo local y es lo que
 * suena con cuentas mientras la tabla `radio_songs` esté vacía.
 *
 * Sólo lo importa el módulo perezoso del catálogo: nunca la ruta crítica de
 * la landing.
 */
export const SAMPLE_RADIO_CATALOG: RadioCatalog = radioCatalogSchema.parse({
  genres: data.genres,
  songs: data.songs,
});

/** Una copia que se puede cambiar (el repositorio local parte de ella). */
export function sampleRadioCatalog(): RadioCatalog {
  return {
    genres: SAMPLE_RADIO_CATALOG.genres.map((g) => ({ ...g })),
    songs: SAMPLE_RADIO_CATALOG.songs.map((s) => ({ ...s })),
  };
}
