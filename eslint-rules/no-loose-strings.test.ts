import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { noLooseStrings } from './no-loose-strings.mjs';

/** La regla `boia/no-loose-strings` (plan 032 T303) sobre trozos de componente. */
function run(code: string, allow: string[] = []): string[] {
  const linter = new Linter();
  const messages = linter.verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { boia: { rules: { 'no-loose-strings': noLooseStrings } } },
        rules: { 'boia/no-loose-strings': ['error', { allow }] },
      },
    ],
    { filename: 'x.tsx' },
  );
  return messages.map((m) => m.message);
}

describe('boia/no-loose-strings', () => {
  it('falla con texto suelto entre etiquetas', () => {
    expect(run('const A = () => <p>Hola, mundo</p>;')).toHaveLength(1);
  });

  it('falla con un literal en un atributo que se ve', () => {
    expect(run('const A = () => <img alt="Un barco" aria-label="Cerrar" />;')).toHaveLength(2);
  });

  it('falla con un literal como hijo, en una rama o en una plantilla', () => {
    expect(run("const A = () => <p>{'Hola'}</p>;")).toHaveLength(1);
    expect(run("const A = ({ x }) => <p>{x ? 'uno' : 'otros'}</p>;")).toHaveLength(2);
    expect(run('const A = ({ x }) => <p>{`resuelto: ${x}`}</p>;')).toHaveLength(1);
  });

  it('falla con plantillas y ramas en un atributo que se ve', () => {
    expect(run('const A = ({ x }) => <a aria-label={`Ir a ${x}`} />;')).toHaveLength(1);
    expect(run("const A = ({ x }) => <a title={x ? 'Abrir' : 'Cerrar'} />;")).toHaveLength(2);
    expect(
      run("const A = ({ x }) => <a alt={x && 'Un barco'} placeholder={x ?? 'Escribe'} />;"),
    ).toHaveLength(2);
  });

  it('deja pasar las claves, los símbolos, las direcciones y lo que no es texto', () => {
    expect(run("const A = () => <p aria-label={t('a.b')}>{t('a.c')} · 3 × 4 — %</p>;")).toEqual([]);
    expect(run('const A = () => <input placeholder="https://…" className="un texto" />;')).toEqual(
      [],
    );
    expect(run("const A = ({ x }) => <p data-k={'dos palabras'}>{x ? 1 : null}</p>;")).toEqual([]);
  });

  it('respeta la lista de excepciones por cadena exacta', () => {
    expect(run('const A = () => <b>BOIA</b>;')).toHaveLength(1);
    expect(run('const A = () => <b>BOIA</b>;', ['BOIA'])).toEqual([]);
  });
});
