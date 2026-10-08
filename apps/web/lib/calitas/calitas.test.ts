import { describe, expect, it } from 'vitest';
import { CALITAS_STORAGE_KEY, createLocalCalitas } from './local';
import {
  CALITAS_ERROR_KEY,
  type CalitasComment,
  CalitasError,
  buildThreads,
  calitasErrorFrom,
  checkComment,
  nextVote,
} from './model';
import { SAMPLE_COMMENTS } from './sample';
import { type CalitasRow, commentFromRow } from './shared';
import { t } from '../i18n';

/** Un localStorage en memoria. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

function setup() {
  const storage = memoryStorage();
  let n = 0;
  let clock = Date.parse('2026-10-08T10:00:00.000Z');
  const local = createLocalCalitas({
    storage: () => storage,
    now: () => new Date((clock += 60_000)),
    newId: () => `local-${++n}`,
  });
  return { storage, ...local };
}

const byId = (list: CalitasComment[], id: string) => list.find((c) => c.id === id);
const sampleTop = SAMPLE_COMMENTS.find((c) => c.parentId === null)!;
const sampleReply = SAMPLE_COMMENTS.find((c) => c.parentId === sampleTop.id)!;

describe('Las Calitas en modo local (plan 019 T222, decisión 16)', () => {
  it('enseña los comentarios de muestra con sus respuestas', async () => {
    const { store } = setup();
    expect(store.shared).toBe(false);
    const list = await store.list();
    expect(list.map((c) => c.id).sort()).toEqual(SAMPLE_COMMENTS.map((c) => c.id).sort());
    expect(list.every((c) => c.isSample && !c.isMine && c.myVote === 0)).toBe(true);
    const threads = buildThreads(list);
    const top = threads.find((th) => th.comment.id === sampleTop.id)!;
    expect(top.replies.map((r) => r.id)).toContain(sampleReply.id);
  });

  it('publicar, responder y votar se guardan en este navegador', async () => {
    const { store, storage } = setup();
    const mine = await store.post('  Hola desde la cala  ', null, 'Ana');
    expect(mine).toMatchObject({
      body: 'Hola desde la cala',
      author: 'Ana',
      isMine: true,
      score: 0,
    });
    const reply = await store.post('Y yo te respondo', mine.id, null);
    expect(reply).toMatchObject({ parentId: mine.id, author: null, isMine: true });
    await store.vote(sampleTop.id, 1);
    let list = await store.list();
    expect(byId(list, sampleTop.id)).toMatchObject({ myVote: 1, score: sampleTop.score + 1 });
    await store.vote(sampleTop.id, -1);
    list = await store.list();
    expect(byId(list, sampleTop.id)).toMatchObject({ myVote: -1, score: sampleTop.score - 1 });
    await store.vote(sampleTop.id, 0);
    list = await store.list();
    expect(byId(list, sampleTop.id)).toMatchObject({ myVote: 0, score: sampleTop.score });
    // Lo propio sale primero en «Recientes» y con su respuesta debajo.
    const threads = buildThreads(list, 'recent');
    expect(threads[0]!.comment.id).toBe(mine.id);
    expect(threads[0]!.replies.map((r) => r.id)).toEqual([reply.id]);
    // Se guarda en su clave; otro almacén sobre el mismo navegador lo lee.
    expect(storage.getItem(CALITAS_STORAGE_KEY)).toContain('Hola desde la cala');
    const again = createLocalCalitas({ storage: () => storage });
    expect(byId(await again.store.list(), mine.id)?.body).toBe('Hola desde la cala');
  });

  it('el filtro de insultos rechaza antes de guardar, y no se responde a una respuesta', async () => {
    const { store } = setup();
    await expect(
      store.post('eres un gilipoyas no, un g-i-l-i-p-o-l-l-a-s', null, null),
    ).rejects.toEqual(new CalitasError('offensive'));
    await expect(store.post('escríbeme a yo@ejemplo.es', null, null)).rejects.toEqual(
      new CalitasError('contact'),
    );
    await expect(store.post('   ', null, null)).rejects.toEqual(new CalitasError('length'));
    await expect(store.post('x'.repeat(281), null, null)).rejects.toEqual(
      new CalitasError('length'),
    );
    await expect(store.post('hola', sampleReply.id, null)).rejects.toEqual(
      new CalitasError('gone'),
    );
    expect((await store.list()).some((c) => c.isMine)).toBe(false);
  });

  it('el propio no se vota', async () => {
    const { store } = setup();
    const mine = await store.post('Mi comentario', null, null);
    await expect(store.vote(mine.id, 1)).rejects.toEqual(new CalitasError('own'));
  });

  it('el Admin oculta un comentario (y sus respuestas se van con él) y lo devuelve', async () => {
    const { store, moderation } = setup();
    let changes = 0;
    store.subscribe(() => changes++);
    await expect(moderation.moderate(sampleTop.id, 'hide', 'no')).rejects.toThrow(
      'reason_required',
    );
    await moderation.moderate(sampleTop.id, 'hide', 'Spam de prueba');
    expect(changes).toBe(1);
    const visible = await store.list();
    expect(byId(visible, sampleTop.id)).toBeUndefined();
    expect(byId(visible, sampleReply.id)).toBeUndefined();
    const all = await moderation.list();
    expect(byId(all, sampleTop.id)?.hidden).toMatchObject({ reason: 'Spam de prueba' });
    expect(byId(all, sampleReply.id)?.hidden).toBeNull();
    // Oculto, no se vota ni se responde.
    await expect(store.vote(sampleTop.id, 1)).rejects.toEqual(new CalitasError('gone'));
    await moderation.moderate(sampleTop.id, 'show', '');
    expect(byId(await store.list(), sampleTop.id)).toBeDefined();
    expect(byId(await store.list(), sampleReply.id)).toBeDefined();
  });

  it('sin almacenamiento (modo privado) funciona en memoria', async () => {
    const local = createLocalCalitas({ storage: () => null });
    const c = await local.store.post('Sin guardar', null, null);
    expect(byId(await local.store.list(), c.id)).toBeDefined();
  });
});

describe('el modelo de Las Calitas', () => {
  it('«Más votados» ordena por votos y, a igualdad, lo más nuevo primero', () => {
    const c = (id: string, score: number, at: string, parentId: string | null = null) =>
      ({
        id,
        parentId,
        body: id,
        author: null,
        isMine: false,
        isSample: false,
        score,
        myVote: 0,
        createdAt: at,
        hidden: null,
      }) as CalitasComment;
    const list = [
      c('a', 1, '2026-10-01'),
      c('b', 5, '2026-10-02'),
      c('c', 5, '2026-10-03'),
      c('r', 9, '2026-10-04', 'a'),
      c('huerfana', 9, '2026-10-04', 'nada'),
    ];
    expect(buildThreads(list, 'top').map((th) => th.comment.id)).toEqual(['c', 'b', 'a']);
    expect(buildThreads(list, 'recent').map((th) => th.comment.id)).toEqual(['c', 'b', 'a']);
    expect(
      buildThreads(list, 'top')
        .find((th) => th.comment.id === 'a')!
        .replies.map((r) => r.id),
    ).toEqual(['r']);
  });

  it('el mismo voto otra vez lo quita', () => {
    expect(nextVote(0, 1)).toBe(1);
    expect(nextVote(1, 1)).toBe(0);
    expect(nextVote(1, -1)).toBe(-1);
    expect(nextVote(-1, -1)).toBe(0);
  });

  it('cada rechazo de la base tiene su texto', () => {
    expect(calitasErrorFrom('text_offensive')).toBe('offensive');
    expect(calitasErrorFrom('text_link')).toBe('contact');
    expect(calitasErrorFrom('invalid_message')).toBe('length');
    expect(calitasErrorFrom('limit_daily')).toBe('limit');
    expect(calitasErrorFrom('carnet_required')).toBe('account');
    expect(calitasErrorFrom('unknown_comment')).toBe('gone');
    expect(calitasErrorFrom('own_comment')).toBe('own');
    expect(calitasErrorFrom('lo que sea')).toBe('generic');
    for (const key of Object.values(CALITAS_ERROR_KEY)) expect(t(key)).not.toBe('');
    expect(checkComment('Hola')).toBeNull();
  });

  it('las filas de las RPC se leen como comentarios', () => {
    const row: CalitasRow = {
      id: 'x',
      parent_id: null,
      body: 'hola',
      author_nickname: 'Ana',
      is_mine: true,
      score: 3,
      my_vote: -1,
      created_at: '2026-10-08T10:00:00Z',
      hidden_at: '2026-10-08T11:00:00Z',
      hidden_reason: 'spam',
    };
    expect(commentFromRow(row)).toEqual({
      id: 'x',
      parentId: null,
      body: 'hola',
      author: 'Ana',
      isMine: true,
      isSample: false,
      score: 3,
      myVote: -1,
      createdAt: '2026-10-08T10:00:00Z',
      hidden: { at: '2026-10-08T11:00:00Z', reason: 'spam' },
    });
    expect(commentFromRow({ ...row, my_vote: 0, hidden_at: null }).hidden).toBeNull();
  });
});
