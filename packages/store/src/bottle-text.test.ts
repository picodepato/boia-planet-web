import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCKED_WORDS, foldText, textProblem } from './bottle-text';

/**
 * El filtro de las botellas en el navegador (T93) dice lo mismo que la guarda
 * de la base (`private.text_problem`): la lista de palabras se compara con la
 * de la migración, y los casos son los de `community.supabase.ts`.
 */
const MIGRATION = new URL(
  '../../../supabase/migrations/20261003100000_accounts.sql',
  import.meta.url,
);

function migrationWords(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8');
  const block = /insert into private\.blocked_words \(word\) values([\s\S]*?)on conflict/.exec(sql);
  if (!block) throw new Error('no está la lista de private.blocked_words');
  return [...block[1]!.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]!);
}

describe('filtro de texto de las botellas', () => {
  it('la lista de palabras es la de la base', () => {
    const words = migrationWords();
    expect(words.length).toBeGreaterThan(0);
    expect([...BLOCKED_WORDS].sort()).toEqual([...words].sort());
  });

  it('quita mayúsculas, tildes y eñes como fold_text', () => {
    expect(foldText('CABRÓN Ñandú Ça')).toBe('cabron nandu ca');
  });

  it('rechaza enlaces, emails, teléfonos y palabras ofensivas', () => {
    expect(textProblem('mira www.ejemplo.es')).toBe('link');
    expect(textProblem('https://trampa.io')).toBe('link');
    expect(textProblem('entra en boia.com ya')).toBe('link');
    expect(textProblem('t.me/boia')).toBe('link');
    expect(textProblem('escríbeme a yo@ejemplo.es')).toBe('email');
    expect(textProblem('yo (arroba) ejemplo.es')).toBe('email');
    expect(textProblem('llámame 612 345 678')).toBe('phone');
    expect(textProblem('+34 (612) 34-56-78')).toBe('phone');
    expect(textProblem('eres un cabrón')).toBe('offensive');
    expect(textProblem('Gilipollas 3000')).toBe('offensive');
    expect(textProblem('m13rd4')).toBe('offensive');
    expect(textProblem('moro  de mierda')).toBe('offensive');
  });

  it('deja pasar un mensaje normal', () => {
    for (const ok of [
      'Nos vemos en el All Day, ¡que suene fuerte!',
      'Fiesta el 31/10 a las 23:00, 2026',
      'Hola desde la Explanada. 140 caracteres de mar.',
      'Disfrutad mucho, idiotez ninguna',
      'cabronazo no está en la lista',
    ]) {
      expect(textProblem(ok), ok).toBeNull();
    }
  });
});
