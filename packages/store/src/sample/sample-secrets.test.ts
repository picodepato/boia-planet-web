import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// REQ-ARQ-006: los datos de ejemplo no llevan secretos (claves, tokens, contraseñas).
const HERE = dirname(fileURLToPath(import.meta.url));

// Patrones de claves reales: Stripe, Supabase (service_role y JWT), claves PEM,
// y asignaciones de contraseña o clave de API.
const SECRET = /sk_(live|test)_|service_role|eyJ[A-Za-z0-9_-]{10,}|-----BEGIN|password\s*[:=]|api[_-]?key\s*[:=]/i;

describe('datos de ejemplo (REQ-ARQ-006)', () => {
  it('REQ-ARQ-006: los datos de ejemplo no llevan secretos', () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.filter((f) => SECRET.test(readFileSync(join(HERE, f), 'utf8')));
    expect(hits).toEqual([]);
  });
});
