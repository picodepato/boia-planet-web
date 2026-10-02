import { describe, expect, it } from 'vitest';
import { BOTTLES_IN_SEA_MAX, BOTTLE_MESSAGE_MAX } from '@boia/contracts';
import { SAMPLE_BOTTLES, SAMPLE_CREW, type SampleBottle } from './sample';
import { makeRepo } from './test-helpers';

async function member(nickname = 'Marinera de prueba') {
  const ctx = makeRepo();
  await ctx.repo.carnet.create({ nickname });
  return ctx;
}

describe('botellas', () => {
  it('sin Carnet no se escriben botellas', async () => {
    const { repo } = makeRepo();
    await expect(repo.bottles.place({ message: 'hola', x: 0, y: 0 })).rejects.toMatchObject({
      code: 'no_carnet',
    });
  });

  it(`hasta ${BOTTLE_MESSAGE_MAX} caracteres, contados como Postgres (un emoji es uno)`, async () => {
    const { repo } = await member();
    const tooLong = 'a'.repeat(BOTTLE_MESSAGE_MAX + 1);
    await expect(repo.bottles.place({ message: tooLong, x: 1, y: 1 })).rejects.toMatchObject({
      code: 'invalid',
    });
    await expect(repo.bottles.place({ message: '   ', x: 1, y: 1 })).rejects.toMatchObject({
      code: 'invalid',
    });
    const emojis = '🌊'.repeat(BOTTLE_MESSAGE_MAX);
    expect(emojis.length).toBeGreaterThan(BOTTLE_MESSAGE_MAX);
    const b = await repo.bottles.place({ message: emojis, x: 1, y: 1 });
    expect(b.message).toBe(emojis);
    await expect(repo.bottles.edit(b.id, { message: `${emojis}!` })).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('una botella activa por persona: echar otra sustituye a la tuya, también al recargar', async () => {
    const { repo, reload } = await member();
    const first = await repo.bottles.place({ message: 'la primera', x: 10, y: 20 });
    const second = await repo.bottles.place({ message: 'la segunda', x: 30, y: 40 });
    const mine = async (r = repo) => (await r.bottles.list()).filter((b) => b.isMine);
    expect((await mine()).map((b) => b.id)).toEqual([second.id]);
    expect((await repo.bottles.mine())?.id).toBe(second.id);
    // La anterior queda retirada (no borrada): ya no se edita.
    await expect(repo.bottles.edit(first.id, { message: 'otra' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    const later = reload();
    const third = await later.bottles.place({ message: 'la tercera', x: 50, y: 60 });
    expect((await mine(later)).map((b) => b.id)).toEqual([third.id]);
    // Retirarla a mano sigue funcionando y deja echar otra.
    await later.bottles.retire(third.id);
    expect(await later.bottles.mine()).toBeNull();
    const fourth = await later.bottles.place({ message: 'la cuarta', x: 70, y: 80 });
    expect((await mine(later)).map((b) => b.id)).toEqual([fourth.id]);
  });

  /** `n` botellas de muestra de otras personas, de la más antigua a la más nueva. */
  const crowd = (n: number): SampleBottle[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `botella-ajena-${i + 1}`,
      userId: `muestra-ajena-${i + 1}`,
      message: `botella ${i + 1}`,
      x: i,
      y: i,
      createdAt: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
    }));

  it(`como mucho ${BOTTLES_IN_SEA_MAX} en el mar: la nueva quita la más antigua (la muestra cuenta)`, async () => {
    const others = crowd(BOTTLES_IN_SEA_MAX);
    const { repo, reload } = makeRepo({ sample: { bottles: others } });
    expect(await repo.bottles.list()).toHaveLength(BOTTLES_IN_SEA_MAX);
    await repo.carnet.create({ nickname: 'Recién llegada' });
    const b = await repo.bottles.place({ message: 'hola', x: 1, y: 1 });
    const afloat = async (r = repo) => (await r.bottles.list()).map((x) => x.id);
    expect(await afloat()).toHaveLength(BOTTLES_IN_SEA_MAX);
    expect(await afloat()).toContain(b.id);
    expect(await afloat()).not.toContain(others[0]!.id);
    expect(await afloat()).toEqual(expect.arrayContaining(others.slice(1).map((x) => x.id)));
    // Se queda fuera al recargar: retirada, no escondida.
    expect(await afloat(reload())).not.toContain(others[0]!.id);
    const gone = (await repo.admin.bottles()).find((x) => x.id === others[0]!.id);
    expect(gone?.status).toBe('retired');
    // Sustituir la propia no empuja a nadie más.
    const again = await repo.bottles.place({ message: 'otra vez', x: 2, y: 2 });
    expect(await afloat()).toHaveLength(BOTTLES_IN_SEA_MAX);
    expect(await afloat()).toContain(again.id);
    expect(await afloat()).toContain(others[1]!.id);
  });

  it('con menos de las que caben no se quita ninguna; si la muestra trae de más, flotan las más nuevas', async () => {
    const few = crowd(BOTTLES_IN_SEA_MAX - 1);
    const { repo } = makeRepo({ sample: { bottles: few } });
    await repo.carnet.create({ nickname: 'Con sitio' });
    const b = await repo.bottles.place({ message: 'cabe', x: 1, y: 1 });
    expect((await repo.bottles.list()).map((x) => x.id).sort()).toEqual(
      [...few.map((x) => x.id), b.id].sort(),
    );
    const many = crowd(BOTTLES_IN_SEA_MAX + 3);
    const crowded = makeRepo({ sample: { bottles: many } }).repo;
    expect((await crowded.bottles.list()).map((x) => x.id).sort()).toEqual(
      many
        .slice(-BOTTLES_IN_SEA_MAX)
        .map((x) => x.id)
        .sort(),
    );
  });

  it('editar cambia mensaje y posición; la posición la valida quien conoce el mar', async () => {
    const { repo } = makeRepo({
      validate: { bottlePosition: (p) => (p.x < 0 ? 'eso es tierra' : null) },
    });
    await repo.carnet.create({ nickname: 'Validadora' });
    await expect(repo.bottles.place({ message: 'hola', x: -1, y: 0 })).rejects.toMatchObject({
      code: 'invalid',
    });
    const b = await repo.bottles.place({ message: 'hola', x: 5, y: 5 });
    const e = await repo.bottles.edit(b.id, { message: 'adiós', x: 6 });
    expect(e).toMatchObject({ message: 'adiós', x: 6, y: 5 });
  });

  it('leer no la quita del mar y deja la lectura; se ve el apodo y el Carnet del autor', async () => {
    const { repo } = makeRepo();
    const sample = SAMPLE_BOTTLES[0];
    if (!sample) throw new Error('sin botellas de muestra');
    const read = await repo.bottles.read(sample.id);
    expect(read.read).toBe(true);
    const author = SAMPLE_CREW.find((c) => c.userId === sample.userId);
    expect(read.authorNickname).toBe(author?.nickname);
    expect((await repo.bottles.list()).map((b) => b.id)).toContain(sample.id);
    const carnet = await repo.carnet.get(read.authorId);
    expect(carnet?.nickname).toBe(author?.nickname);
    expect(carnet?.isSample).toBe(true);
  });

  it('no dan puntos ni monedas (REQ-IDE-042)', async () => {
    const { repo } = await member();
    await repo.bottles.place({ message: 'hola', x: 1, y: 1 });
    const sample = SAMPLE_BOTTLES[0];
    if (sample) await repo.bottles.read(sample.id);
    expect(await repo.progress.balances()).toMatchObject({ points: 0, coins: 0 });
    expect(await repo.progress.ledger()).toHaveLength(0);
  });

  it('reportar una vez; el Admin la retira y desaparece del mar', async () => {
    const { repo } = await member();
    const sample = SAMPLE_BOTTLES[1];
    if (!sample) throw new Error('sin botellas de muestra');
    expect(await repo.bottles.report(sample.id, 'no me gusta')).toEqual({ first: true });
    expect(await repo.bottles.report(sample.id)).toEqual({ first: false });
    const flagged = (await repo.admin.bottles()).find((b) => b.id === sample.id);
    expect(flagged?.reports).toHaveLength(1);
    await repo.admin.removeBottle(sample.id, { reason: 'reportada' });
    expect((await repo.bottles.list()).map((b) => b.id)).not.toContain(sample.id);
    const removed = (await repo.admin.bottles()).find((b) => b.id === sample.id);
    expect(removed?.status).toBe('removed');
    expect(removed?.reports[0]?.resolvedAt).not.toBeNull();
    expect((await repo.admin.audit({ area: 'bottles' }))[0]?.action).toBe('moderate');
  });

  it('el autor no deshace una retirada por moderación', async () => {
    const { repo } = await member();
    const b = await repo.bottles.place({ message: 'hola', x: 1, y: 1 });
    await repo.admin.removeBottle(b.id);
    await expect(repo.bottles.edit(b.id, { message: 'otra' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(repo.bottles.retire(b.id)).rejects.toMatchObject({ code: 'forbidden' });
    // Retirada por moderación no cuenta como activa: puede echar otra.
    await repo.bottles.place({ message: 'otra', x: 2, y: 2 });
  });
});
