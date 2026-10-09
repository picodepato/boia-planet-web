import type { RadioSong } from '@boia/contracts';

/**
 * Qué canciones han perdido su MP3 (plan 023 T257): el Admin las marca al
 * abrir la sección. `present` pregunta por un archivo (IndexedDB en local, un
 * HEAD a su URL con cuentas). Las respuestas se guardan en `memo` (por id y
 * ruta) para no repetir la pregunta al cambiar el catálogo.
 */

const CONCURRENCY = 6;

export async function missingSongFiles(
  songs: readonly RadioSong[],
  present: (song: RadioSong) => Promise<boolean>,
  memo: Map<string, boolean> = new Map(),
): Promise<Set<string>> {
  const missing = new Set<string>();
  for (let i = 0; i < songs.length; i += CONCURRENCY) {
    const slice = songs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (song) => {
        const key = `${song.id}|${song.src}`;
        let ok = memo.get(key);
        if (ok === undefined) {
          ok = await present(song).catch(() => true);
          memo.set(key, ok);
        }
        return { id: song.id, ok };
      }),
    );
    for (const r of results) if (!r.ok) missing.add(r.id);
  }
  return missing;
}
