import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..', '..');

// Textos de usuario: el catálogo i18n, los datos de muestra que se ven en la web
// y los textos de los mundos (nombres, diálogos y carteles de `mundos/**/*.json`).
const SOURCES: { dir: string; ext: string; deep: boolean }[] = [
  { dir: join(__dirname), ext: '.ts', deep: false },
  { dir: join(ROOT, 'packages', 'store', 'src', 'sample'), ext: '.ts', deep: false },
  { dir: join(ROOT, 'mundos'), ext: '.json', deep: true },
];

function filesIn(dir: string, ext: string, deep: boolean): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return deep ? filesIn(p, ext, deep) : [];
    return f.endsWith(ext) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

function userTexts(): { file: string; text: string }[] {
  return SOURCES.flatMap(({ dir, ext, deep }) =>
    filesIn(dir, ext, deep).map((file) => ({ file, text: readFileSync(file, 'utf8') })),
  );
}

describe('términos de la comunidad en los textos de usuario (REQ-IDE-020)', () => {
  it('«tripulación» no aparece en ningún texto de usuario: 0 resultados', () => {
    const files = userTexts();
    expect(files.filter((f) => f.file.endsWith('.json')).length).toBeGreaterThan(5);
    expect(files.length).toBeGreaterThan(20);
    const hits = files.filter(({ text }) => /tripulaci/i.test(text)).map(({ file }) => file);
    expect(hits).toEqual([]);
  });
});
