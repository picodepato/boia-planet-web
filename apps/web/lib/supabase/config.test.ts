import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserSupabase, resetBrowserSupabaseForTests } from './browser';
import { isSupabaseConfigured, supabasePublicConfig } from './config';
import { serverSupabase } from './server';
import { serviceSupabase } from './service';

const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetBrowserSupabaseForTests();
});

describe('modo local o Supabase (plan 008)', () => {
  it('sin variables, o vacías, la web sigue en modo local', () => {
    expect(isSupabaseConfigured({})).toBe(false);
    expect(isSupabaseConfigured({ url: '', anonKey: '' })).toBe(false);
    expect(isSupabaseConfigured({ url: URL_OK, anonKey: '  ' })).toBe(false);
    expect(isSupabaseConfigured({ url: '   ', anonKey: 'sb_publishable_x' })).toBe(false);
  });

  it('una URL que no es https (salvo localhost) no cuenta', () => {
    expect(isSupabaseConfigured({ url: 'http://example.com', anonKey: 'k' })).toBe(false);
    expect(isSupabaseConfigured({ url: 'no es una url', anonKey: 'k' })).toBe(false);
    expect(isSupabaseConfigured({ url: 'http://127.0.0.1:54321', anonKey: 'k' })).toBe(true);
  });

  it('con las dos variables hay Supabase', () => {
    expect(supabasePublicConfig({ url: ` ${URL_OK} `, anonKey: ' k ' })).toEqual({
      url: URL_OK,
      anonKey: 'k',
    });
  });

  it('lee process.env: sin variables no hay clientes', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
    expect(serverSupabase()).toBeNull();
    expect(serviceSupabase()).toBeNull();
    expect(browserSupabase()).toBeNull();
  });

  it('con variables hay clientes; el del navegador sólo en un navegador y uno por pestaña', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_OK);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_prueba');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_prueba');
    expect(isSupabaseConfigured()).toBe(true);
    expect(serverSupabase()).not.toBeNull();
    expect(serviceSupabase()).not.toBeNull();
    // En Node no hay window: nada de sesiones en el servidor.
    expect(browserSupabase()).toBeNull();

    const store = new Map<string, string>();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const a = browserSupabase();
    expect(a).not.toBeNull();
    expect(browserSupabase()).toBe(a);
    // Y la clave secreta nunca en un navegador.
    expect(() => serviceSupabase()).toThrow(/servidor/);
  });
});
