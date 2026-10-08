import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { textProblem } from './bottle-text';
import {
  COMMENT_EXTRA_WORDS,
  COMMENT_MAX,
  commentProblem,
  joinSpelled,
  squeezeLetters,
} from './comment-text';

/**
 * El filtro de insultos de Las Calitas en el navegador (plan 019 T222) dice
 * lo mismo que la guarda de la base (`private.comment_text_problem`): la
 * lista propia se compara con la de la migración, y las normalizaciones
 * están escritas igual en los dos sitios.
 */
const SQL = readFileSync(
  new URL('../../../supabase/migrations/20261008100500_calitas.sql', import.meta.url),
  'utf8',
);

function migrationWords(): string[] {
  const block =
    /insert into private\.comment_blocked_words \(word\) values([\s\S]*?)on conflict/.exec(SQL);
  if (!block) throw new Error('no está la lista de private.comment_blocked_words');
  return [...block[1]!.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]!);
}

describe('filtro de insultos de Las Calitas', () => {
  it('la lista propia es la de la base, sin tildes y sin repetir la común', () => {
    const words = migrationWords();
    expect(words.length).toBeGreaterThan(0);
    expect([...COMMENT_EXTRA_WORDS].sort()).toEqual([...words].sort());
    for (const w of words) expect(w).toMatch(/^[a-z]+( [a-z]+)*$/);
  });

  it('el límite de largo es el de la tabla', () => {
    expect(SQL).toContain(`check (char_length(body) between 1 and ${COMMENT_MAX})`);
    expect(SQL).toContain(`char_length(msg) not between 1 and ${COMMENT_MAX}`);
  });

  it('las normalizaciones son las de la base', () => {
    expect(SQL).toContain(`regexp_replace(coalesce(p, ''), '([a-z])\\1+', '\\1', 'g')`);
    expect(SQL).toContain(`'\\m([a-z])[^a-z0-9_]+(?=[a-z]\\M)'`);
    expect(squeezeLetters('putaaaa gilipollaaas')).toBe('puta gilipolas');
    expect(joinSpelled('p.u.t.a')).toBe('puta');
    expect(joinSpelled('p u t a madre')).toBe('puta madre');
    expect(joinSpelled('voy a la playa y nado')).toBe('voy a la playa y nado');
  });

  it('rechaza los insultos de las dos listas, deletreados o alargados', () => {
    for (const bad of [
      'eres un cabrón',
      'qué mamón',
      'menudo SOPLAPOLLAS',
      'putaaaaa',
      'p.u.t.a',
      'p u t a',
      'g-i-l-i-p-o-l-l-a-s',
      'GILIPOLLAAAAS',
      'cretin0',
      'basura   humana',
    ]) {
      expect(commentProblem(bad), bad).toBe('offensive');
    }
  });

  it('también lo de las botellas: enlaces, emails y teléfonos', () => {
    expect(commentProblem('mira www.ejemplo.es')).toBe('link');
    expect(commentProblem('yo@ejemplo.es')).toBe('email');
    expect(commentProblem('612 345 678')).toBe('phone');
  });

  it('deja pasar los comentarios normales', () => {
    for (const ok of [
      '¿Quién se viene al próximo ALL DAY BOIA?',
      'El pollo de la paella estaba buenísimo',
      'Me llamo Ana y me encanta el mar',
      'Una computadora en la playa, qué cosas',
      'Vamos a la cala y luego a la fiesta',
      'Tarde de playa y música, sin más',
      'a b c d e',
    ]) {
      expect(commentProblem(ok), ok).toBeNull();
      expect(textProblem(ok), ok).toBeNull();
    }
  });
});
