import { CARNET_QUESTIONS } from '@boia/contracts';
import { findDropSpot, isSeaSpot } from '@boia/engine/bottles';
import { type BoiaRepository, SAMPLE_BOTTLES, SAMPLE_CREW, isStoreError } from '@boia/store';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { worlds } from '../demo-world';
import { gameRepository, seaWorld } from '../repo';
import { CarnetCard } from './carnet-card';
import { CarnetForm, draftFrom } from './carnet-editor';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const sea = seaWorld();
const spawn = sea.spawn!;
const land = sea.objects.find((o) => o.geometry.collision && o.identity.active)!;

/** En el servidor (y aquí) `gameRepository` da uno nuevo en memoria por llamada. */
async function withCarnet(nickname = 'Probadora'): Promise<BoiaRepository> {
  const repo = gameRepository();
  await repo.carnet.create({ nickname });
  return repo;
}

describe('botellas en la demo (REQ-IDE-040…044)', () => {
  it('una botella en tierra se rechaza con el motivo; en el mar junto al barco, no', async () => {
    const repo = await withCarnet();
    const onLand = repo.bottles.place({ message: 'hola', ...land.position });
    await expect(onLand).rejects.toSatisfy((e) => isStoreError(e, 'invalid'));
    await expect(onLand).rejects.toThrow(/tierra/);
    await expect(repo.bottles.mine()).resolves.toBeNull();

    const spot = findDropSpot(sea, spawn)!;
    const b = await repo.bottles.place({ message: 'hola', ...spot });
    expect(b.isMine).toBe(true);
  });

  it('sólo una activa: la segunda se rechaza (conflict) hasta retirar la primera', async () => {
    const repo = await withCarnet();
    const spot = findDropSpot(sea, spawn)!;
    const first = await repo.bottles.place({ message: 'primera', ...spot });
    await expect(repo.bottles.place({ message: 'segunda', ...spot })).rejects.toSatisfy((e) =>
      isStoreError(e, 'conflict'),
    );
    expect((await repo.bottles.list()).filter((b) => b.isMine)).toHaveLength(1);
    await repo.bottles.retire(first.id);
    await expect(repo.bottles.place({ message: 'segunda', ...spot })).resolves.toMatchObject({
      message: 'segunda',
    });
  });

  it('leer una botella nunca la quita del mar, y no da puntos ni monedas', async () => {
    const repo = await withCarnet();
    const before = await repo.progress.balances();
    const [sample] = await repo.bottles.list();
    expect(sample).toBeDefined();
    const read = await repo.bottles.read(sample!.id);
    await repo.bottles.read(sample!.id);
    expect(read.message).toBe(sample!.message);
    const after = await repo.bottles.list();
    expect(after.find((b) => b.id === sample!.id)).toMatchObject({ read: true, status: 'active' });
    expect(after).toHaveLength((await gameRepository().bottles.list()).length);
    expect(await repo.progress.balances()).toEqual(before);
  });

  it('escribir tampoco da puntos ni monedas', async () => {
    const repo = await withCarnet();
    const before = await repo.progress.balances();
    await repo.bottles.place({ message: 'sin premio', ...findDropSpot(sea, spawn)! });
    expect(await repo.progress.balances()).toEqual(before);
  });

  it('sin Carnet no se escriben botellas', async () => {
    const repo = gameRepository();
    await expect(
      repo.bottles.place({ message: 'hola', ...findDropSpot(sea, spawn)! }),
    ).rejects.toSatisfy((e) => isStoreError(e, 'no_carnet'));
  });

  it('todas las botellas de muestra flotan en el mar de todos los mundos y abren el Carnet de su autor', async () => {
    const repo = gameRepository();
    const list = await repo.bottles.list();
    expect(list.filter((b) => b.isSample)).toHaveLength(SAMPLE_BOTTLES.length);
    for (const w of worlds.list()) {
      const cfg = worlds.get(w.id).config;
      for (const b of list) expect(isSeaSpot(cfg, b), `${w.id}/${b.id}`).toBe(true);
    }
    for (const b of list) {
      const carnet = await repo.carnet.get(b.authorId);
      expect(carnet?.nickname).toBe(b.authorNickname);
    }
  });
});

/** Las preguntas de v14 §44.1, tal cual las escribió Álvaro. */
function v14Questions(): string[] {
  const text = readFileSync(path.join(ROOT, 'docs/fuente/v14-maestro.md'), 'utf8');
  const start = text.indexOf('## 44.1 ');
  const end = text.indexOf('\n## ', start + 1);
  return text
    .slice(start, end)
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());
}

describe('Carnet (REQ-IDE-010…015)', () => {
  it('las 5 preguntas son las de v14 §44.1, textuales y en su orden', () => {
    const source = v14Questions();
    expect(source).toHaveLength(5);
    expect(CARNET_QUESTIONS.map((q) => q.prompt)).toEqual(source);
  });

  it('el formulario enseña las 5 preguntas textuales de su fuente', () => {
    const html = renderToStaticMarkup(
      createElement(CarnetForm, {
        questions: CARNET_QUESTIONS,
        initial: draftFrom(null),
        onSubmit: () => {},
      }),
    );
    for (const q of v14Questions()) expect(html).toContain(q);
    // Antes de crear se dice qué será público (REQ-IDE-013).
    expect(html).toContain('público');
  });

  it('el Carnet enseña cada respuesta con su pregunta textual, en el orden de las preguntas', async () => {
    const full = SAMPLE_CREW.find(
      (c) => Object.keys(c.answers).length === CARNET_QUESTIONS.length,
    )!;
    const carnet = (await gameRepository().carnet.get(full.userId))!;
    const html = renderToStaticMarkup(createElement(CarnetCard, { carnet }));
    let at = -1;
    for (const q of CARNET_QUESTIONS) {
      const i = html.indexOf(q.prompt);
      expect(i, q.id).toBeGreaterThan(at);
      at = i;
      expect(html.indexOf(full.answers[q.id]!, i)).toBeGreaterThan(i);
    }
    expect(html).toContain(full.nickname);
    expect(html).toContain('Miembro de BOIA desde');
    expect(html).toContain(carnet.rank!.name);
  });

  it('una pregunta sin contestar no aparece sin respuesta (nunca pregunta suelta)', async () => {
    const repo = await withCarnet('Media');
    const q = CARNET_QUESTIONS[1]!;
    const carnet = await repo.carnet.answer(q.id, 'Un vinilo en un rastro.');
    const html = renderToStaticMarkup(createElement(CarnetCard, { carnet }));
    expect(html).toContain(q.prompt);
    for (const other of CARNET_QUESTIONS.filter((x) => x.id !== q.id)) {
      expect(html).not.toContain(other.prompt);
    }
  });
});
