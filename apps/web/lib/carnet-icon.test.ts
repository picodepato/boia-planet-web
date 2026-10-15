import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The ID-card emoji (Unicode 14): an empty box on Windows 10. Built here so this file does not hold it. */
const ID_CARD = String.fromCodePoint(0x1faaa);
const root = join(import.meta.dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('the Carnet is drawn, never the ID-card emoji (plan 032 T299)', () => {
  it('no source file in apps/web or packages holds the emoji', () => {
    const files = execFileSync('git', ['ls-files', 'apps/web', 'packages'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => /\.(tsx?|css|mjs|json|md)$/.test(f) && !f.startsWith('apps/web/public/'));
    expect(files.length).toBeGreaterThan(100);
    const holding = files.filter((f) => {
      try {
        return read(f).includes(ID_CARD);
      } catch {
        return false; // listed but deleted in the working tree
      }
    });
    expect(holding).toEqual([]);
  });

  it('the places that showed it use the shared icon', () => {
    for (const f of [
      'apps/web/lib/account/sign-in-sheet.tsx',
      'apps/web/lib/logros/reward.tsx',
      'apps/web/lib/mundo/menu/sections/carnet.tsx',
      'apps/web/lib/ticketing/checkout.tsx',
      'apps/web/app/mar/a-bordo.tsx',
      'apps/web/app/mar/logros.tsx',
    ]) {
      expect(read(f), f).toContain('<CarnetIcon');
    }
  });

  it('the icon has no imports (it is on the landing critical path) and is decorative', () => {
    const src = read('apps/web/lib/carnet-icon.tsx');
    expect(src).not.toMatch(/^import /m);
    expect(src).toContain('aria-hidden="true"');
  });
});
