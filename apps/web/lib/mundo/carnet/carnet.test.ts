import { CARNET_QUESTIONS, carnetQuestionsFor } from '@boia/contracts';
import { findDropSpot, isSeaSpot } from '@boia/engine/bottles';
import {
  type BoiaRepository,
  CARNET_EXISTS_MESSAGE,
  NICKNAME_TAKEN_MESSAGE,
  SAMPLE_BOTTLES,
  SAMPLE_CREW,
  StoreError,
  isStoreError,
} from '@boia/store';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { worlds } from '../demo-world';
import { gameRepository, seaWorld } from '../repo';
import { CarnetCard } from './carnet-card';
import { NEUTRAL_AVATARS } from './avatar';
import { CarnetForm, carnetErrorText, draftFrom, saveCarnet } from './carnet-editor';

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

  it('sólo una activa: echar la segunda sustituye a la primera (decisión 2026-10-02)', async () => {
    const repo = await withCarnet();
    const spot = findDropSpot(sea, spawn)!;
    const first = await repo.bottles.place({ message: 'primera', ...spot });
    const second = await repo.bottles.place({ message: 'segunda', ...spot });
    const mine = (await repo.bottles.list()).filter((b) => b.isMine);
    expect(mine.map((b) => b.id)).toEqual([second.id]);
    expect(mine.map((b) => b.id)).not.toContain(first.id);
    await repo.bottles.retire(second.id);
    await expect(repo.bottles.place({ message: 'tercera', ...spot })).resolves.toMatchObject({
      message: 'tercera',
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

/** Las 5 preguntas de REQ-IDE-014 (decisión de Álvaro, 2026-10-14), entre acentos graves. */
function specQuestions(): string[] {
  const text = readFileSync(path.join(ROOT, 'docs/spec/05-identidad-y-comunidad.md'), 'utf8');
  const line = text.split('\n').find((l) => l.includes('REQ-IDE-014'))!;
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!).filter((q) => q.length > 8);
}

/** La 1 del público (no artistas), textual (Álvaro, 2026-10-14; plan 030 T294). */
const DIA_SIGUIENTE = 'Completa la frase: al día siguiente de una fiesta yo…';

/** Las preguntas que enseña el formulario, en su orden (índices crecientes). */
function formShows(html: string, prompts: string[]): void {
  const at = prompts.map((q) => html.indexOf(q.replace(/"/g, '&quot;')));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((x, y) => x - y)).toEqual(at);
  for (const old of ['cosa más rara', 'mejor descubrimiento', 'mejor recuerdo'])
    expect(html).not.toContain(old);
}

describe('Carnet (REQ-IDE-010…015)', () => {
  it('las 5 de artista son las de REQ-IDE-014, textuales y en su orden', () => {
    const source = specQuestions();
    expect(source).toHaveLength(5);
    expect(carnetQuestionsFor(true).map((q) => q.prompt)).toEqual(source);
  });

  it('las 5 del público cambian sólo la primera por «al día siguiente…» (T294)', () => {
    const source = specQuestions();
    expect(carnetQuestionsFor(false).map((q) => q.prompt)).toEqual([
      DIA_SIGUIENTE,
      ...source.slice(1),
    ]);
    expect(t('carnet.q1Publico')).toBe(DIA_SIGUIENTE);
    const spec = readFileSync(path.join(ROOT, 'docs/spec/05-identidad-y-comunidad.md'), 'utf8');
    expect(spec).toContain(DIA_SIGUIENTE);
  });

  it('el formulario de un Carnet normal enseña «al día siguiente…» primero y luego la 2 a la 5', () => {
    const html = renderToStaticMarkup(
      createElement(CarnetForm, {
        questions: CARNET_QUESTIONS,
        initial: draftFrom(null),
        onSubmit: () => {},
      }),
    );
    formShows(html, [DIA_SIGUIENTE, ...specQuestions().slice(1)]);
    expect(html).not.toContain('yo quiero estar en esto');
    // Antes de crear se dice qué será público (REQ-IDE-013).
    expect(html).toContain('público');
  });

  it('el formulario de un Carnet de artista enseña las 5 de siempre, en su orden', () => {
    const html = renderToStaticMarkup(
      createElement(CarnetForm, {
        questions: CARNET_QUESTIONS,
        initial: draftFrom(null),
        artist: true,
        onSubmit: () => {},
      }),
    );
    formShows(html, specQuestions());
    expect(html).not.toContain(DIA_SIGUIENTE);
  });

  it('un Carnet de artista enseña sus 5 respuestas con su pregunta, en orden', async () => {
    const repo = gameRepository();
    await repo.carnet.create({ nickname: 'Artista Prueba', artistCode: 'enlace-demo' });
    let carnet = (await repo.carnet.mine())!;
    for (const q of carnetQuestionsFor(true)) carnet = await repo.carnet.answer(q.id, `R ${q.id}`);
    expect(carnet.answers.map((a) => a.question)).toEqual(specQuestions());
    const html = renderToStaticMarkup(createElement(CarnetCard, { carnet }));
    let at = -1;
    for (const q of specQuestions()) {
      const i = html.indexOf(q.replace(/"/g, '&quot;'));
      expect(i).toBeGreaterThan(at);
      at = i;
    }
    expect(html).not.toContain(DIA_SIGUIENTE);
  });

  it('el Carnet enseña cada respuesta con su pregunta textual, en el orden de las preguntas', async () => {
    const publicSet = carnetQuestionsFor(false);
    const full = SAMPLE_CREW.find((c) => publicSet.every((q) => c.answers[q.id]))!;
    const carnet = (await gameRepository().carnet.get(full.userId))!;
    const html = renderToStaticMarkup(createElement(CarnetCard, { carnet }));
    let at = -1;
    for (const q of publicSet) {
      const i = html.indexOf(q.prompt);
      expect(i, q.id).toBeGreaterThan(at);
      at = i;
      expect(html.indexOf(full.answers[q.id]!, i)).toBeGreaterThan(i);
    }
    expect(html).toContain(full.nickname);
    // T91: la tarjeta ID-1 dice «Miembro desde» en su campo (antes, «Miembro de BOIA desde»).
    expect(html).toContain(t('carnet.card.since'));
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

describe('carnetErrorText: sólo un apodo de otro es «apodo ocupado» (T293)', () => {
  const taken = t('carnet.error.nicknameTaken');
  const rejected = (reason: string) =>
    Object.assign(new StoreError('conflict', `rechazado (servidor: ${reason})`), { reason });

  it('el apodo de otro miembro, en local y con cuenta', () => {
    expect(carnetErrorText(new StoreError('conflict', NICKNAME_TAKEN_MESSAGE))).toBe(taken);
    expect(carnetErrorText(rejected('nickname_taken'))).toBe(taken);
  });

  it('otro choque no habla del apodo aunque su mensaje lo nombre', () => {
    expect(carnetErrorText(new StoreError('conflict', CARNET_EXISTS_MESSAGE))).toBe(
      t('juego.carnetEditor.yaTienesUnCarnet'),
    );
    for (const e of [
      new StoreError('conflict', 'el apodo choca con otra cosa'),
      rejected('member_number_busy'),
      new StoreError('forbidden', 'rechazado (servidor: artist_required)'),
    ]) {
      expect(carnetErrorText(e)).toBe(t('carnet.error.save'));
    }
  });

  it('el propio Carnet se guarda con su apodo y otro cambio', async () => {
    const repo = await withCarnet('Pulpo Propio');
    const before = await repo.carnet.mine();
    const avatarKey = NEUTRAL_AVATARS[1]!.key;
    const view = await saveCarnet(
      repo,
      before,
      { ...draftFrom(before), avatarKey },
      CARNET_QUESTIONS,
    );
    expect(view).toMatchObject({ nickname: 'Pulpo Propio', avatarKey });
  });
});
