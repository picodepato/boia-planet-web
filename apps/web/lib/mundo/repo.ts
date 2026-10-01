'use client';

import type { BoiaRepository } from '@boia/store';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { gameRepository } from '../repo';

/**
 * Enganches de React sobre el repositorio de la demo (T16, D-20). El
 * repositorio (`gameRepository`, `seaWorld`) vive en lib/repo.ts desde T25,
 * porque la compra de prueba de la landing también lo usa; se reexporta
 * aquí para quien ya lo importaba de este archivo.
 */
export { gameRepository, seaWorld } from '../repo';

const noop = () => () => {};

/** Revisión del repositorio: sube con cada cambio (también de otra pestaña). */
export function useRepoRevision(repo: BoiaRepository | null): number {
  return useSyncExternalStore(
    repo ? repo.subscribe : noop,
    repo ? repo.revision : () => -1,
    () => -1,
  );
}

/**
 * Lee del repositorio y vuelve a leer con cada cambio. `undefined` mientras
 * carga; el repositorio sólo existe en el navegador (tras montar).
 */
export function useRepoData<T>(
  read: (repo: BoiaRepository) => Promise<T>,
  deps: readonly unknown[] = [],
): { data: T | undefined; repo: BoiaRepository | null } {
  const [repo, setRepo] = useState<BoiaRepository | null>(null);
  useEffect(() => setRepo(gameRepository()), []);
  const revision = useRepoRevision(repo);
  const [data, setData] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    read(repo).then(
      (v) => alive && setData(v),
      (err: unknown) => console.warn('[boia] no se pudo leer del repositorio', err),
    );
    return () => {
      alive = false;
    };
    // `read` cambia en cada render; lo que importa es la revisión y las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, revision, ...deps]);
  return { data, repo };
}
