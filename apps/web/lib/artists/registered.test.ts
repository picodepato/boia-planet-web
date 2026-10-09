import type { BoiaRepository } from '@boia/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sbState = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('../account/session', () => ({
  accountClient: async () => sbState.client,
}));

import { readArtistCarnets } from './registered';

const repoLocal = { carnet: { mine: async () => null } } as unknown as BoiaRepository;
const BASE = 'user_id, nickname, avatar_key, avatar_image';
const MUSIC = `${BASE}, music_platform, music_url`;

/** Una base sin la migración de la música: pedir esas columnas da error. */
function mockClient(columns: string[]) {
  const selects: string[] = [];
  const client = {
    from: () => ({
      select: (cols: string) => {
        selects.push(cols);
        const missing = cols
          .split(',')
          .map((c) => c.trim())
          .filter((c) => !columns.includes(c));
        const res = missing.length
          ? { data: null, error: { status: 400, message: `column ${missing[0]} does not exist` } }
          : {
              data: [
                {
                  user_id: 'u1',
                  nickname: 'Ana',
                  avatar_key: null,
                  avatar_image: null,
                  ...(cols.includes('music_platform')
                    ? {
                        music_platform: 'spotify',
                        music_url: 'https://open.spotify.com/artist/x',
                      }
                    : {}),
                },
              ],
              error: null,
            };
        return { eq: () => ({ limit: async () => res }) };
      },
    }),
  };
  return { client, selects };
}

/** sessionStorage de prueba; `broken` simula un almacenamiento que lanza. */
function fakeStorage(broken = false) {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (broken) throw new Error('blocked');
      return m.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error('blocked');
      m.set(k, v);
    },
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
    get length() {
      return m.size;
    },
    key: () => null,
  };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('sessionStorage', fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  sbState.client = null;
  errorSpy.mockRestore();
});

describe('lista de artistas sin la columna de música', () => {
  it('sin la migración: la primera carga repite sin música y recuerda; la siguiente no pide la música', async () => {
    const { client, selects } = mockClient(['user_id', 'nickname', 'avatar_key', 'avatar_image']);
    sbState.client = client;

    const first = await readArtistCarnets(repoLocal);
    expect(selects).toEqual([MUSIC, BASE]);
    expect(first).toEqual([
      expect.objectContaining({ userId: 'u1', nickname: 'Ana', music: null }),
    ]);
    expect(sessionStorage.getItem('boia.artists.music-columns')).toBe('0');

    // Caché de la sesión: ya no se hace la petición que falla.
    selects.length = 0;
    const second = await readArtistCarnets(repoLocal);
    expect(selects).toEqual([BASE]);
    expect(second[0]?.music).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('con la migración: pide la música y la recuerda', async () => {
    const cols = [
      'user_id',
      'nickname',
      'avatar_key',
      'avatar_image',
      'music_platform',
      'music_url',
    ];
    const { client, selects } = mockClient(cols);
    sbState.client = client;

    const list = await readArtistCarnets(repoLocal);

    expect(selects).toEqual([MUSIC]);
    expect(list[0]?.music).toEqual({
      platform: 'spotify',
      url: 'https://open.spotify.com/artist/x',
    });
    expect(sessionStorage.getItem('boia.artists.music-columns')).toBe('1');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('con un almacenamiento que falla, sigue funcionando', async () => {
    vi.stubGlobal('sessionStorage', fakeStorage(true));
    const { client, selects } = mockClient(['user_id', 'nickname', 'avatar_key', 'avatar_image']);
    sbState.client = client;

    const list = await readArtistCarnets(repoLocal);

    expect(list).toHaveLength(1);
    expect(selects).toEqual([MUSIC, BASE]);
  });

  it('en modo local no hay consulta ni error', async () => {
    sbState.client = null;

    expect(await readArtistCarnets(repoLocal)).toEqual([]);
    expect(sessionStorage.getItem('boia.artists.music-columns')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
