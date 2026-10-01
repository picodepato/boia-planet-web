'use client';

import type { BoiaRepository } from '@boia/store';
import { WORLD_REGISTRY, type WorldRegistry } from '@boia/world';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AdminError, type AdminActions, createAdminActions } from '../../lib/admin/actions';
import { gameRepository } from '../../lib/repo';
import { t } from '../../lib/i18n';

/**
 * El Admin de la demo lee y escribe el mismo repositorio que la landing y
 * el mar (`gameRepository`, T16/T22): lo que cambia aquí se ve allí, en este
 * navegador. Sólo existe en el navegador (tras montar).
 */
export interface AdminContext {
  repo: BoiaRepository;
  actions: AdminActions;
  registry: WorldRegistry;
  revision: number;
}

const noop = () => () => {};

export function useAdminContext(): AdminContext | null {
  const [base, setBase] = useState<Omit<AdminContext, 'revision'> | null>(null);
  useEffect(() => {
    const repo = gameRepository();
    setBase({
      repo,
      registry: WORLD_REGISTRY,
      actions: createAdminActions({ repo, registry: WORLD_REGISTRY }),
    });
  }, []);
  const revision = useSyncExternalStore(
    base ? base.repo.subscribe : noop,
    base ? base.repo.revision : () => -1,
    () => -1,
  );
  return base ? { ...base, revision } : null;
}

/** Lee del repositorio y vuelve a leer con cada cambio. */
export function useRead<T>(
  ctx: AdminContext,
  read: (repo: BoiaRepository) => Promise<T>,
): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    read(ctx.repo).then(
      (v) => alive && setData(v),
      (err: unknown) => console.warn('[boia] admin: no se pudo leer', err),
    );
    return () => {
      alive = false;
    };
    // `read` cambia en cada render; lo que importa es la revisión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.repo, ctx.revision]);
  return data;
}

export type Status =
  { kind: 'idle' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

function messageOf(err: unknown): string {
  if (err instanceof AdminError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Ejecuta un cambio y deja el resultado para la línea de estado de la sección. */
export function useRun(): {
  status: Status;
  busy: boolean;
  run: (work: () => Promise<unknown>, ok?: string) => Promise<boolean>;
} {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (work: () => Promise<unknown>, ok = t('admin.useAdmin.guardadoEnEsteNavegador')) => {
      setBusy(true);
      try {
        await work();
        setStatus({ kind: 'ok', text: ok });
        return true;
      } catch (err) {
        setStatus({
          kind: 'error',
          text: t('admin.useAdmin.noSeGuardo', { messageOf: messageOf(err) }),
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  return { status, busy, run };
}
