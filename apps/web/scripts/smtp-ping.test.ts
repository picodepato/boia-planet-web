import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Correo de prueba dos veces al mes por el SMTP de Brevo (plan 033 T306): el
 * flujo y su script, leídos como texto. Mantienen viva la clave que usa Gmail
 * «Enviar como» para hola@ sin enseñar nunca los secretos.
 */

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const FLOW = read('.github/workflows/smtp-ping.yml');
const SCRIPT = read('.github/scripts/smtp-ping.py');
const CADUCIDADES = JSON.parse(read('apps/web/scripts/caducidades.json')) as {
  [k: string]: unknown;
};
const SECRETS = ['BREVO_SMTP_KEY', 'BREVO_SMTP_LOGIN'];
// Las líneas que no son comentario: lo que de verdad corre.
const CODE = FLOW.split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n');

describe('smtp-ping.yml', () => {
  it('los días 1 y 15 (UTC, fuera de la hora en punto) y a mano, sin tabuladores', () => {
    const crons = [...FLOW.matchAll(/- cron: '([^']+)'/g)].map((m) => m[1]!);
    expect(crons).toHaveLength(1);
    const [min, hour, dom, month, dow] = crons[0]!.split(' ');
    expect(Number(min)).toBeGreaterThan(0);
    expect(Number(min)).toBeLessThan(60);
    expect(Number(hour)).toBeGreaterThanOrEqual(0);
    expect(dom!.split(',').sort()).toEqual(['1', '15']);
    expect([month, dow]).toEqual(['*', '*']);
    expect(FLOW).toMatch(/^on:\n\s+schedule:/m);
    expect(FLOW).toContain('workflow_dispatch:');
    expect(FLOW).not.toContain('\t');
  });

  it('permisos mínimos: leer el repo; sólo keepalive-workflows reactiva flujos', () => {
    expect(FLOW).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    const perms = [...CODE.matchAll(/permissions:\n((?:\s+[a-z-]+: [a-z]+\n)+)/g)].map((m) =>
      m[1]!.trim().split(/\n\s*/),
    );
    expect(perms).toEqual([['contents: read'], ['actions: write']]);
    expect(CODE.indexOf('actions: write')).toBeGreaterThan(CODE.indexOf('keepalive-workflows:'));
  });

  it('sólo acciones de GitHub: nada de terceros para enviar', () => {
    const uses = [...CODE.matchAll(/uses: ([^\s@]+)@/g)].map((m) => m[1]!);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(['actions/checkout', 'actions/setup-python']).toContain(u);
    expect(CODE).toContain('run: python3 .github/scripts/smtp-ping.py');
  });

  it('los secretos sólo por secrets.*, comprobados antes de enviar y nunca escritos', () => {
    const used = [...new Set([...CODE.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]!))];
    expect(used.sort()).toEqual(SECRETS);
    for (const s of SECRETS) {
      // Cada `${{ … }}` que nombra el secreto lo lee de secrets.*.
      for (const m of CODE.matchAll(/\$\{\{([^}]*)\}\}/g)) {
        if (m[1]!.includes(s)) expect(m[1]!.trim()).toBe(`secrets.${s}`);
      }
      // Fuera de `${{ }}`, sólo como clave de env o en el `test -n` de la comprobación.
      for (const line of CODE.split('\n').filter((l) => l.includes(s))) {
        expect(line).toMatch(
          new RegExp(
            `^\\s+${s}: \\$\\{\\{ secrets\\.${s} \\}\\}$|^\\s+test -n "\\$${s}" \\|\\| \\{ echo "::error::Falta el secreto ${s}"; exit 1; \\}$`,
          ),
        );
      }
      expect(CODE).toContain(`echo "::error::Falta el secreto ${s}"`);
      expect(SCRIPT).toContain(`'${s}'`);
    }
    expect(CODE.indexOf('Falta el secreto')).toBeLessThan(CODE.indexOf('smtp-ping.py'));
    expect(CODE).not.toMatch(/set -[a-z]*x|printenv|^\s+env\s*$|\benv \||toJSON\(secrets\)/m);
  });

  it('va igual que los demás flujos programados: reactiva los flujos', () => {
    expect(FLOW).toMatch(/keepalive-workflows:\n\s+runs-on:/);
    expect(FLOW).toContain('/enable');
  });
});

describe('smtp-ping.py', () => {
  it('Brevo, puerto 587 y STARTTLS, de hola@ a hola@', () => {
    expect(SCRIPT).toContain("HOST = 'smtp-relay.brevo.com'");
    expect(SCRIPT).toContain('PORT = 587');
    expect(SCRIPT).toContain("ADDRESS = 'hola@boiaplanet.net'");
    expect(SCRIPT).toContain('smtplib.SMTP(HOST, PORT');
    expect(SCRIPT).toContain('smtp.starttls(context=context)');
    expect(SCRIPT).toContain('ssl.create_default_context()');
    expect(SCRIPT).toMatch(/msg\['From'\] = .*ADDRESS/);
    expect(SCRIPT).toContain("msg['To'] = ADDRESS");
    expect(FLOW).toContain('smtp-relay.brevo.com, puerto 587');
  });

  it('sólo la biblioteca estándar de Python', () => {
    const imports = [...SCRIPT.matchAll(/^(?:import (\w+)|from ([\w.]+) import)/gm)].map(
      (m) => (m[1] ?? m[2])!.split('.')[0]!,
    );
    expect(imports.sort()).toEqual(['datetime', 'email', 'os', 'smtplib', 'ssl', 'sys']);
  });

  it('un fallo de envío sale con código distinto de 0', () => {
    expect(SCRIPT).toContain('except (smtplib.SMTPException, OSError)');
    expect(SCRIPT).toMatch(/::error::No se pudo enviar[^\n]*\n\s+return 1/);
    expect(SCRIPT).toContain('sys.exit(main(dict(os.environ)))');
  });

  it('el texto: corto, en español, dice qué es, que se puede ignorar y la fecha', () => {
    expect(SCRIPT).toContain("msg['Subject'] = f'Prueba automática");
    expect(SCRIPT).toContain('today.isoformat()');
    expect(SCRIPT).toContain('«Enviar como»');
    expect(SCRIPT).toContain('Se puede ignorar.');
    expect(SCRIPT).not.toContain('add_alternative');
  });

  it('nunca escribe el login ni la clave', () => {
    for (const line of SCRIPT.split('\n').filter((l) => /\bprint\(/.test(l))) {
      expect(line).not.toMatch(/env\[|BREVO_SMTP_(LOGIN|KEY)'\]|\blogin\b|\bkey\b/);
    }
  });
});

describe('la caducidad de la clave y su recordatorio', () => {
  it('el issue mensual «enviar-desde-hola» sigue como segunda red', () => {
    const text = JSON.stringify(CADUCIDADES);
    expect(text).toContain('"id":"brevo-smtp-hola"');
    expect(text).toContain('"id":"enviar-desde-hola"');
    expect(text).toContain('smtp-ping.yml');
  });

  it('docs/DESPLIEGUE.md cuenta el flujo', () => {
    const doc = read('docs/DESPLIEGUE.md');
    expect(doc).toContain('`smtp-ping.yml`');
    expect(doc).toMatch(/smtp-ping\.yml`? los días 1 y 15/);
  });
});
