import { describe, expect, it } from 'vitest';
import { cleanMinutes, parseGrantArgs } from './grant.ts';

describe('pnpm admin:grant -- <email> <rol> (T94)', () => {
  it('acepta email y rol, con o sin el «--» de pnpm', () => {
    expect(parseGrantArgs(['--', 'Hernan@Ejemplo.es', 'owner'])).toEqual({
      email: 'hernan@ejemplo.es',
      role: 'owner',
    });
    expect(parseGrantArgs(['a@b.es', 'editor']).role).toBe('editor');
    expect(parseGrantArgs(['a@b.es', 'none']).role).toBe('none');
  });

  it('rechaza un rol desconocido, un email raro o argumentos de más', () => {
    expect(() => parseGrantArgs(['a@b.es', 'root'])).toThrow(/rol no válido/);
    expect(() => parseGrantArgs(['no-es-email', 'admin'])).toThrow(/email no válido/);
    expect(() => parseGrantArgs(['a@b.es'])).toThrow(/uso/);
    expect(() => parseGrantArgs(['a@b.es', 'admin', 'x'])).toThrow(/uso/);
  });
});

describe('pnpm db:clean-test-users', () => {
  it('30 minutos de margen por defecto, todas con --all, o los que se digan', () => {
    expect(cleanMinutes([])).toBe(30);
    expect(cleanMinutes(['--all'])).toBe(0);
    expect(cleanMinutes(['--minutes', '5'])).toBe(5);
    expect(() => cleanMinutes(['--minutes', 'x'])).toThrow();
  });
});
