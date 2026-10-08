import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El flujo de copias de seguridad diarias (plan 019 T223, decisión 17) y su
 * guía, leídos como texto: cada día, 30 días, cifrado y con los secretos que
 * dice la guía.
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const FLOW = read('.github/workflows/supabase-backup.yml');
const GUIDE = read('docs/propuestas/2026-10-08-backups.md');

const SECRETS = [...new Set([...FLOW.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]!))];

describe('copias de seguridad diarias', () => {
  it('cada día (y a mano), sin tabuladores', () => {
    expect(FLOW).toMatch(/schedule:\n\s+(#.*\n\s+)?- cron: '\d+ \d+ \* \* \*'/);
    expect(FLOW).toContain('workflow_dispatch:');
    expect(FLOW).not.toContain('\t');
    expect(FLOW).toContain('permissions:\n  contents: read');
  });

  it('pg_dump de la web y de las cuentas, cifrado, 30 días', () => {
    expect(FLOW).toContain('--schema=public --schema=private');
    expect(FLOW).toContain('--table=auth.users');
    expect(FLOW).toMatch(/gpg [^\n]*\n[^\n]*--symmetric --cipher-algo AES256/);
    expect(FLOW).toContain('uses: actions/upload-artifact@v4');
    expect(FLOW).toContain('retention-days: 30');
    // Lo que se sube es sólo el archivo cifrado.
    expect(FLOW).toContain('path: ${{ env.BACKUP_NAME }}.tar.gz.gpg');
    expect(FLOW).toContain('rm -rf "$name" "$name.tar.gz"');
  });

  it('la guía explica cada secreto, la descarga y la restauración', () => {
    expect(SECRETS.sort()).toEqual(['BACKUP_PASSPHRASE', 'SUPABASE_DB_URL']);
    for (const s of SECRETS) {
      expect(GUIDE).toContain(`\`${s}\``);
      expect(FLOW).toContain(`Falta el secreto ${s}`);
    }
    expect(GUIDE).toContain('gpg --output copia.tar.gz --decrypt');
    expect(GUIDE).toContain("--command 'SET session_replication_role = replica'");
    expect(GUIDE).toContain('Session pooler');
  });
});
