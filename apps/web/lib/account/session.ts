/**
 * La sesión de la cuenta con email (plan 008, T89, decisiones 1–5): un
 * almacén de módulo que leen `useAccount` y `requireAccount`.
 *
 * - `local`: sin Supabase (producción hoy, pruebas unitarias, e2e por
 *   defecto). Nada de esto aparece y todo sigue en el navegador (D-20).
 * - `loading`: con Supabase, mientras se lee la sesión guardada.
 * - `guest`: sin sesión; navega, juega y lee como siempre.
 * - `incomplete`: con sesión pero sin Carnet (no terminó el paso del apodo).
 * - `member`: con sesión y Carnet.
 *
 * El cliente de Supabase se carga a demanda (`import()`): en modo local no
 * entra en ningún paquete que se descargue.
 */
import type { MergePayload, MergeResult, ProfileResult } from '@boia/db/rpc';
import type { BoiaSupabase } from '../supabase/browser';
import { isSupabaseConfigured } from '../supabase/config';
import { PRIVACY_POLICY_VERSION } from './config';

export type AccountStatus = 'local' | 'loading' | 'guest' | 'incomplete' | 'member';

export interface AccountProfile {
  nickname: string;
  memberNumber: number;
  memberSince: string;
  avatarKey: string | null;
  isArtist: boolean;
}

export interface AccountConsents {
  /** Política aceptada: versión y fecha. */
  privacy: { version: string; at: string } | null;
  /** Noticias de BOIA: el último sí o no, con su fecha. */
  news: { granted: boolean; at: string } | null;
}

export interface AccountState {
  status: AccountStatus;
  userId: string | null;
  email: string | null;
  profile: AccountProfile | null;
  consents: AccountConsents;
  /** Se cerró sesión (o se borró la cuenta) en esta pestaña. */
  signedOut: boolean;
}

const NO_CONSENTS: AccountConsents = { privacy: null, news: null };

function initialState(): AccountState {
  return {
    status: isSupabaseConfigured() ? 'loading' : 'local',
    userId: null,
    email: null,
    profile: null,
    consents: NO_CONSENTS,
    signedOut: false,
  };
}

let state: AccountState = initialState();
/** Lo que ve el servidor al pintar (igual que el primer render del navegador). */
const serverState: AccountState = initialState();
const listeners = new Set<() => void>();

function set(patch: Partial<AccountState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function accountSnapshot(): AccountState {
  return state;
}

export function accountServerSnapshot(): AccountState {
  return serverState;
}

export function subscribeAccount(listener: () => void): () => void {
  startAccount();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let clientPromise: Promise<BoiaSupabase | null> | null = null;

/** El cliente del navegador; null en modo local o en el servidor. */
export function accountClient(): Promise<BoiaSupabase | null> {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return Promise.resolve(null);
  clientPromise ??= import('../supabase/browser').then((m) => m.browserSupabase());
  return clientPromise;
}

async function client(): Promise<BoiaSupabase> {
  const sb = await accountClient();
  if (!sb) throw new Error('sin Supabase');
  return sb;
}

let started = false;

/** Empieza a escuchar la sesión (una vez por pestaña). */
export function startAccount(): void {
  if (started || typeof window === 'undefined' || !isSupabaseConfigured()) return;
  started = true;
  void accountClient().then((sb) => {
    if (!sb) {
      set({ status: 'local' });
      return;
    }
    // INITIAL_SESSION llega al suscribirse. No se llama a Supabase dentro del
    // aviso (lo pide su cliente): se deja para después.
    sb.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setTimeout(() => {
        if (!user) {
          if (state.status !== 'guest' || state.userId) {
            set({
              status: 'guest',
              userId: null,
              email: null,
              profile: null,
              consents: NO_CONSENTS,
            });
          }
          return;
        }
        if (user.id !== state.userId || state.status === 'loading' || state.status === 'guest') {
          set({ userId: user.id, email: user.email ?? null });
          void refreshAccount().catch((e: unknown) =>
            console.warn('[boia] no se pudo leer la cuenta', e),
          );
        }
      }, 0);
    });
  });
}

/** Espera a que se sepa si hay sesión (deja de estar en `loading`). */
export function accountReady(): Promise<AccountState> {
  startAccount();
  if (state.status !== 'loading') return Promise.resolve(state);
  return new Promise((resolve) => {
    const off = subscribeAccount(() => {
      if (state.status !== 'loading') {
        off();
        resolve(state);
      }
    });
  });
}

/** Vuelve a leer el Carnet y los consentimientos de la sesión actual. */
export async function refreshAccount(): Promise<AccountState> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user ?? null;
  if (!user) {
    set({ status: 'guest', userId: null, email: null, profile: null, consents: NO_CONSENTS });
    return state;
  }
  const [carnet, consents] = await Promise.all([
    sb
      .from('carnets')
      .select('nickname, member_number, member_since, avatar_key, is_artist')
      .eq('user_id', user.id)
      .maybeSingle(),
    sb
      .from('consents')
      .select('kind, granted, policy_version, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ]);
  if (carnet.error) throw carnet.error;
  if (consents.error) throw consents.error;
  const row = carnet.data;
  const privacy = consents.data.find((c) => c.kind === 'privacy' && c.granted);
  const news = consents.data.find((c) => c.kind === 'news');
  set({
    status: row ? 'member' : 'incomplete',
    userId: user.id,
    email: user.email ?? null,
    profile: row
      ? {
          nickname: row.nickname,
          memberNumber: Number(row.member_number),
          memberSince: row.member_since,
          avatarKey: row.avatar_key,
          isArtist: row.is_artist,
        }
      : null,
    consents: {
      privacy: privacy ? { version: privacy.policy_version, at: privacy.created_at } : null,
      news: news ? { granted: news.granted, at: news.created_at } : null,
    },
    signedOut: false,
  });
  return state;
}

// ---------------------------------------------------------------------------
// Acciones

/** Pide el código de 6 cifras (crea la cuenta si el email es nuevo). */
export async function sendCode(email: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Comprueba el código; con él queda abierta la sesión. */
export async function verifyCode(email: string, token: string): Promise<void> {
  const sb = await client();
  const { data, error } = await sb.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('sin sesión');
  set({ userId: data.session.user.id, email: data.session.user.email ?? null });
}

// Quien guarda la copia de la cuenta en el navegador (T90, lib/repo-member.ts)
// se entera de lo que cambia la cuenta desde aquí.
const mergeListeners = new Set<() => void>();
const signOutHooks = new Set<() => Promise<void>>();

/** Avisa cada vez que lo del invitado acaba de pasar a la cuenta. */
export function onGuestMerged(listener: () => void): () => void {
  mergeListeners.add(listener);
  return () => {
    mergeListeners.delete(listener);
  };
}

/** Algo que hacer con la sesión aún abierta antes de cerrarla (p. ej. mandar lo pendiente). */
export function onBeforeSignOut(hook: () => Promise<void>): () => void {
  signOutHooks.add(hook);
  return () => {
    signOutHooks.delete(hook);
  };
}

/** Pasa lo del invitado a la cuenta (decisión 4). */
export async function mergeGuest(payload: MergePayload): Promise<MergeResult> {
  const sb = await client();
  const { data, error } = await sb.rpc('merge_guest', { p_payload: payload as never });
  if (error) throw error;
  for (const l of mergeListeners) l();
  return data as unknown as MergeResult;
}

/** 'ok' o la clave con la que save_profile lo rechazaría. */
export async function nicknameStatus(nickname: string): Promise<string> {
  const sb = await client();
  const { data, error } = await sb.rpc('nickname_status', { p_nickname: nickname });
  if (error) throw error;
  return data;
}

export interface NewProfile {
  nickname: string;
  avatarKey: string | null;
  avatarImage: string | null;
  news: boolean;
}

/**
 * Crea el Carnet de la cuenta: apodo, la política aceptada con su versión y
 * las noticias (sí o no), cada consentimiento con su fecha (decisión 3).
 */
export async function createProfile(p: NewProfile): Promise<ProfileResult> {
  const sb = await client();
  const { data, error } = await sb.rpc('save_profile', {
    p_nickname: p.nickname.trim(),
    p_avatar_key: p.avatarKey,
    p_avatar_image: p.avatarImage,
    p_privacy_version: PRIVACY_POLICY_VERSION,
    p_news: p.news,
  } as never);
  if (error) throw error;
  await refreshAccount();
  return data as unknown as ProfileResult;
}

/** Noticias de BOIA sí o no; retirar es tan fácil como dar (decisión 3). */
export async function setNewsOptIn(news: boolean): Promise<void> {
  const sb = await client();
  const { error } = await sb.rpc('set_news_opt_in', { p_news: news });
  if (error) throw error;
  await refreshAccount();
}

function signedOutState(): Partial<AccountState> {
  return {
    status: 'guest',
    userId: null,
    email: null,
    profile: null,
    consents: NO_CONSENTS,
    signedOut: true,
  };
}

/** Cierra la sesión en este navegador (la cuenta sigue). */
export async function signOut(): Promise<void> {
  const sb = await client();
  await Promise.allSettled([...signOutHooks].map((h) => h()));
  const { error } = await sb.auth.signOut({ scope: 'local' });
  if (error) console.warn('[boia] cerrar sesión', error);
  set(signedOutState());
}

/** Borra la cuenta y todo lo suyo en el servidor, y cierra la sesión. */
export async function deleteAccount(): Promise<void> {
  const sb = await client();
  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;
  // La cuenta ya no existe: el cierre puede fallar en el servidor, da igual.
  await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
  set(signedOutState());
}

/** Sólo pruebas: vuelve al estado inicial. */
export function resetAccountForTests(patch: Partial<AccountState> = {}): void {
  started = false;
  clientPromise = null;
  state = { ...initialState(), ...patch };
  for (const l of listeners) l();
}
