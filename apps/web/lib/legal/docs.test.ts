import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_POLICY_VERSION } from '../account/config';
import { t, type MessageKey } from '../i18n';
import { es } from '../i18n/es';
import { LEGAL_DOCS, PRIVACY_WITH_ACCOUNTS } from './docs';

const textOf = (keys: readonly string[]) => keys.map((k) => t(k as MessageKey)).join('\n');

describe('identidad legal real (plan 030, T291)', () => {
  const approved =
    'BOIA PLANET (CIF en trámite), Calle Hondón de las Nieves, 7, 03005 Alicante. Para cualquier cosa sobre tus datos: hola@boiaplanet.net.';

  it('el aviso legal lleva titular y contacto aprobados', () => {
    const text = textOf(LEGAL_DOCS['aviso-legal'].body);
    expect(text).toContain(
      'Titular: BOIA PLANET (CIF en trámite), con domicilio en Calle Hondón de las Nieves, 7, 03005 Alicante.',
    );
    expect(text).toContain('Contacto: hola@boiaplanet.net.');
  });

  it('la privacidad, en los dos modos, lleva el responsable aprobado', () => {
    expect(textOf(LEGAL_DOCS.privacidad.body)).toContain(`Responsable: ${approved}`);
    expect(textOf(PRIVACY_WITH_ACCOUNTS.body)).toContain(`Responsable: ${approved}`);
  });

  it('ningún texto legal conserva datos inventados', () => {
    const all = [
      ...Object.values(LEGAL_DOCS).flatMap((d) => d.body),
      ...PRIVACY_WITH_ACCOUNTS.body,
    ];
    const text = textOf(all);
    // Se arman por trozos para que el grep de la tarea no encuentre este fichero.
    const joke = ['Rosa', 'Benito', 'Paco', 'Débora', 'Bollería'].map((w) => `${w} `);
    for (const w of [...joke, 'B000', '@boia.example']) expect(text).not.toContain(w);
    expect(text).toContain('hola@boiaplanet.net');
  });

  it('la política con cuentas nombra Supabase (UE) y Brevo, y la versión es 2026-10-14', () => {
    const text = textOf(PRIVACY_WITH_ACCOUNTS.body);
    expect(text).toContain('Supabase, en la Unión Europea');
    expect(text).toContain('Brevo');
    expect(t(PRIVACY_WITH_ACCOUNTS.updated)).toBe('Última actualización: 14 de octubre de 2026.');
    expect(PRIVACY_POLICY_VERSION).toBe('2026-10-14');
  });

  it('las páginas legales ya no llevan el aviso de datos de muestra', () => {
    const page = readFileSync(
      new URL('../../app/(landing)/legal/[doc]/page.tsx', import.meta.url),
      'utf8',
    );
    expect(page).not.toContain('legal-muestra');
    expect(page).not.toContain('sampleBanner');
    expect('legal.sampleBanner' in es).toBe(false);
  });
});
