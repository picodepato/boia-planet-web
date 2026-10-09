import { type BoiaRepository, DRAFT_AREAS, ENTITY_AREAS } from '@boia/store';
import { deleteLocalPhotoKeys, listLocalPhotoKeys } from './photo-store';
import { type LocalPhotoStore, localPhotoKeysIn, orphanPhotoKeys } from './local-photo-orphans';

/** Los archivos de este navegador (IndexedDB `boia-fotos`). */
export const BROWSER_LOCAL_PHOTOS: LocalPhotoStore = {
  keys: listLocalPhotoKeys,
  remove: deleteLocalPhotoKeys,
};

/**
 * Todo lo que puede apuntar a un archivo local: contenido publicado, borradores,
 * papelera (recuperable, así que su foto sigue viva) y lo que se puede deshacer.
 */
export async function referencedLocalPhotoKeys(repo: BoiaRepository): Promise<Set<string>> {
  const refs = new Set<string>();
  const add = (value: unknown) => {
    localPhotoKeysIn(value, refs);
  };
  for (const area of ENTITY_AREAS) add(await repo.content.list(area));
  for (const area of DRAFT_AREAS) add(await repo.admin.draftList(area));
  add(await repo.content.home());
  add(await repo.admin.draftHome());
  add(await repo.content.texts());
  add(await repo.admin.draftTexts());
  add(await repo.content.places());
  add(await repo.content.skins());
  add(await repo.content.missionDestinations());
  add(await repo.admin.trash());
  // Deshacer un cambio vuelve a su «antes»: esa foto debe seguir. El «después»
  // ya está en el contenido o en la papelera, así que no cuenta aparte.
  for (const change of await repo.admin.changes()) add(change.before);
  return refs;
}

/**
 * Borra los archivos locales que ya no referencia nada: tras una purga (del
 * Admin o la automática por el plazo de la papelera) o al abrir el Admin, una
 * vez. Devuelve las claves borradas. Sólo toca lo no referenciado.
 */
export async function pruneLocalPhotos(
  repo: BoiaRepository,
  store: LocalPhotoStore = BROWSER_LOCAL_PHOTOS,
): Promise<string[]> {
  const referenced = await referencedLocalPhotoKeys(repo);
  const orphans = orphanPhotoKeys(await store.keys(), referenced);
  await store.remove(orphans);
  return orphans;
}
