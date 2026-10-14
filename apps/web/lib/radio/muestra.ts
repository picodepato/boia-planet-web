import { type RadioCatalog, radioCatalogSchema } from '@boia/contracts';
import data from './muestra.json' with { type: 'json' };
import reales from './reales.json' with { type: 'json' };

/**
 * El catálogo que trae la web (plan 022 T246; plan 030 T290): delante, las
 * canciones reales con el visto bueno de Álvaro (`reales.json`, en
 * `public/radio/real/`; «La Sosia», la primera que suena); detrás, cien
 * bucles cortos de muestra sintetizados por `art/radio/generar.py` (nada
 * descargado), 25 por género, en `public/radio/muestra/`. Regenerar la
 * muestra no toca `reales.json`, y la primera sale siempre de las reales.
 * Siembra la radio en modo local y es lo que suena con cuentas mientras la
 * tabla `radio_songs` esté vacía.
 *
 * Sólo lo importa el módulo perezoso del catálogo: nunca la ruta crítica de
 * la landing.
 */
export const SAMPLE_RADIO_CATALOG: RadioCatalog = radioCatalogSchema.parse(
  bundledCatalog(data, reales),
);

interface CatalogJson {
  genres?: readonly unknown[];
  songs: readonly { first?: unknown; order?: unknown }[];
}

/** Junta las reales (delante) y la muestra; la primera, la de las reales si la hay. */
export function bundledCatalog(sample: CatalogJson, real: CatalogJson): unknown {
  const realFirst = real.songs.some((s) => s.first === true);
  const songs = [
    ...real.songs.map((s) => ({ ...s })),
    ...sample.songs.map((s) => (realFirst ? { ...s, first: false } : { ...s })),
  ].map((s, i) => ({ ...s, order: i }));
  return { genres: sample.genres ?? [], songs };
}

/** Una copia que se puede cambiar (el repositorio local parte de ella). */
export function sampleRadioCatalog(): RadioCatalog {
  return {
    genres: SAMPLE_RADIO_CATALOG.genres.map((g) => ({ ...g })),
    songs: SAMPLE_RADIO_CATALOG.songs.map((s) => ({ ...s })),
  };
}
