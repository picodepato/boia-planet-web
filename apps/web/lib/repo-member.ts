/**
 * La cuenta detrás de `gameRepository()` (plan 008, T90, decisión 6). Sólo
 * se carga con Supabase (`import()` en repo.ts): en modo local no entra en
 * ningún paquete que se descargue.
 *
 * - Invitado (sin sesión, o con sesión sin Carnet): el repositorio local de
 *   siempre, sin cambios.
 * - Miembro (sesión y Carnet): el repositorio de su cuenta, con su copia en
 *   este navegador (`boia.cuenta.<id>`), la cola de lo que va al servidor y
 *   la copia del resto del documento. Al entrar o salir se cambia sin
 *   recargar; al salir, la copia se borra de este navegador (la cola, sólo si
 *   quedó vacía: lo pendiente se manda al volver a entrar).
 * - Sin red al cargar: con sesión guardada y copia, se juega sobre la copia.
 *
 * Los avisos (sin conexión, de vuelta, rechazos) salen por los de la cuenta.
 */
import {
  type BoiaRepository,
  type MemberRepository,
  type SupabaseLike,
  type SwitchableRepository,
  type SyncEvent,
  createLocalRepository,
  createMemberRepository,
  defaultStorage,
  localDocAccess,
  memberSyncKey,
  supabaseMemberServer,
} from '@boia/store';
import {
  type AccountState,
  accountClient,
  accountSnapshot,
  onBeforeSignOut,
  onGuestMerged,
  subscribeAccount,
} from './account/session';
import { showAccountNotice } from './account/use-account';
import type { MessageKey } from './i18n';
import { repoOptions } from './repo';

/** Lo que se espera a saber si hay sesión antes de jugar como invitado. */
const ACCOUNT_WAIT_MS = 6000;
/** Lo que se espera a mandar lo pendiente antes de cerrar sesión. */
const SIGN_OUT_FLUSH_MS = 4000;
/** Cada cuánto se vuelve a leer la cuenta con la página a la vista. */
const REFRESH_EVERY_MS = 60_000;

/** Clave de la copia de una cuenta en este navegador. */
export function memberCopyKey(userId: string): string {
  return `boia.cuenta.${userId}`;
}

function storage() {
  return defaultStorage();
}

function hasMemberCopy(userId: string): boolean {
  try {
    return storage()?.getItem(memberCopyKey(userId)) != null;
  } catch {
    return false;
  }
}

/** Borra la copia de la cuenta de este navegador; la cola, sólo vacía. */
function clearMemberCopy(userId: string, pending: number): void {
  try {
    const s = storage();
    s?.removeItem(memberCopyKey(userId));
    if (pending === 0) s?.removeItem(memberSyncKey(memberCopyKey(userId)));
  } catch {
    // sin almacenamiento no hay nada que borrar
  }
}

function within(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    void p.finally(() => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** El aviso de cada rechazo, por familias de motivo (muestra). */
export function rejectionNotice(reason: string): MessageKey {
  if (reason === 'limit_daily' || reason === 'limit_action') return 'sync.rejected.limit';
  if (reason === 'insufficient_coins') return 'sync.rejected.coins';
  if (['too_fast', 'too_slow', 'unknown_circuit', 'invalid_time'].includes(reason))
    return 'sync.rejected.time';
  if (reason === 'nickname_taken') return 'sync.rejected.nickname';
  if (reason.startsWith('text_')) return 'sync.rejected.text';
  return 'sync.rejected.generic';
}

/**
 * Qué se avisa. Comprar y guardar el Carnet esperan la respuesta y explican
 * el rechazo donde se hicieron; lo demás, con un aviso.
 */
export function syncNotice(e: SyncEvent): MessageKey | null {
  if (e.type === 'offline') return 'sync.offline';
  if (e.type === 'online') return 'sync.online';
  if (e.type === 'rejected' && !['buy', 'profile', 'answer'].includes(e.op)) {
    return rejectionNotice(e.reason);
  }
  return null;
}

/** El contenido del Admin de la demo vive en el documento del invitado: la copia lo sigue. */
function mirrorContent(base: BoiaRepository, cache: BoiaRepository): () => void {
  const from = localDocAccess(base);
  const to = localDocAccess(cache);
  if (!from || !to) return () => {};
  const copy = () => {
    const content = from.view((d) => structuredClone(d.content));
    to.write(['content'], (d) => {
      d.content = content;
    });
  };
  copy();
  return base.subscribe((c) => {
    if (c.areas.includes('content')) copy();
  });
}

/** Mandar al ocultar la página o al volver la red; leer al volver a ella y cada minuto. */
function watchPage(repo: MemberRepository): () => void {
  const onOnline = () => void repo.sync.flush();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void repo.sync.flush();
    else void repo.sync.refresh(false);
  };
  const onHide = () => void repo.sync.flush();
  window.addEventListener('online', onOnline);
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onVisibility);
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void repo.sync.refresh(false);
  }, REFRESH_EVERY_MS);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onVisibility);
    clearInterval(timer);
  };
}

function client(): Promise<SupabaseLike> {
  return accountClient().then((c) => {
    if (!c) throw new Error('sin Supabase');
    return c as unknown as SupabaseLike;
  });
}

/**
 * Engancha `sw` a la sesión. La promesa se cumple cuando ya se sabe quién
 * juega (o pasado `ACCOUNT_WAIT_MS`): hasta entonces las llamadas esperan.
 */
export function startMemberSync(sw: SwitchableRepository): Promise<void> {
  const base = sw.base;
  let active: { uid: string; repo: MemberRepository; stop: () => void } | null = null;
  let settle!: () => void;
  const settled = new Promise<void>((r) => (settle = r));

  const activate = (uid: string) => {
    if (active?.uid === uid) return;
    deactivate();
    const cache = createLocalRepository({
      ...repoOptions(),
      storage: defaultStorage,
      key: memberCopyKey(uid),
      watch: true,
    });
    const stopMirror = mirrorContent(base, cache);
    const repo = createMemberRepository({
      userId: uid,
      cache,
      server: supabaseMemberServer(client(), uid),
      storage: storage(),
      onEvent: (e) => {
        const key = syncNotice(e);
        if (key) showAccountNotice(key);
      },
    });
    const stopPage = watchPage(repo);
    active = {
      uid,
      repo,
      stop: () => {
        stopMirror();
        stopPage();
        repo.sync.dispose();
      },
    };
    sw.switchTo(repo);
  };

  const deactivate = () => {
    if (!active) return;
    const { uid, repo, stop } = active;
    active = null;
    sw.switchTo(base);
    const pending = repo.sync.pending();
    stop();
    clearMemberCopy(uid, pending);
  };

  const apply = (s: AccountState) => {
    if (s.status === 'member' && s.userId) {
      activate(s.userId);
      settle();
    } else if (s.status === 'loading') {
      // Sin red al cargar no se llega a `member`: con copia, se juega sobre ella.
      if (s.userId && hasMemberCopy(s.userId)) {
        activate(s.userId);
        settle();
      }
    } else {
      deactivate();
      settle();
    }
  };

  subscribeAccount(() => apply(accountSnapshot()));
  apply(accountSnapshot());
  onBeforeSignOut(async () => {
    if (active) await within(active.repo.sync.flush(), SIGN_OUT_FLUSH_MS);
  });
  // Tras pasar lo del invitado, lo siguiente que se lea ya lo trae.
  onGuestMerged(() => {
    void active?.repo.sync.refresh();
  });
  return within(settled, ACCOUNT_WAIT_MS);
}
