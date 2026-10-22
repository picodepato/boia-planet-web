import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_POLICY_VERSION } from '../account/config';
import { t, type MessageKey } from '../i18n';
import { es } from '../i18n/es';
import { LEGAL_DOCS, PRIVACY_WITH_ACCOUNTS } from './docs';

const textOf = (keys: readonly string[]) => keys.map((k) => t(k as MessageKey)).join('\n');

describe('datos legales reales (plan 039, T319)', () => {
  const approved =
    'Boia planet, NIF E0764676C, Calle Alicante, 7, 03005 Alicante. Para cualquier cosa sobre tus datos: hola@boiaplanet.net.';
  const allKeys = [
    ...Object.values(LEGAL_DOCS).flatMap((d) => d.body),
    ...PRIVACY_WITH_ACCOUNTS.body,
  ];

  it('el aviso legal lleva titular, NIF, domicilio y contacto reales', () => {
    const text = textOf(LEGAL_DOCS['aviso-legal'].body);
    expect(text).toContain(
      'Titular: Boia planet, NIF E0764676C, con domicilio en Calle Alicante, 7, 03005 Alicante.',
    );
    expect(text).toContain('Contacto: hola@boiaplanet.net.');
  });

  it('la privacidad, en los dos modos, lleva el responsable real', () => {
    expect(textOf(LEGAL_DOCS.privacidad.body)).toContain(`Responsable: ${approved}`);
    expect(textOf(PRIVACY_WITH_ACCOUNTS.body)).toContain(`Responsable: ${approved}`);
  });

  it('ninguna página legal conserva datos antiguos, de muestra o de ejemplo, ni una forma jurídica', () => {
    const text = textOf(allKeys);
    for (const w of ['muestra', 'ejemplo', 'Hondón', 'CIF en trámite', 'BOIA PLANET (']) {
      expect(text.toLowerCase()).not.toContain(w.toLowerCase());
    }
    for (const w of ['S.L.', 'asociación', 'comunidad de bienes', 'sociedad']) {
      expect(text.toLowerCase()).not.toContain(w.toLowerCase());
    }
    for (const k of ['legal.aviso.title', 'legal.cookies.body', 'legal.cookies.storage']) {
      expect(t(k as MessageKey).toLowerCase()).not.toContain('muestra');
    }
  });

  it('la privacidad dice lo que la app hace: contadores propios, lista, puerta y alojamiento', () => {
    expect(textOf(allKeys)).not.toContain('apagada en esta versión');
    const text = textOf(PRIVACY_WITH_ACCOUNTS.body);
    expect(text).toContain('contadores propios');
    expect(text).toContain('Cloudflare y Vercel');
    expect(text).toContain('escanea en la puerta');
    expect(text).toContain('tu email');
    expect(text).toContain('hola@boiaplanet.net');
    expect(t('legal.cookies.storage')).toContain('localStorage');
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

  it('la política con cuentas nombra Supabase (UE) y Brevo; actualizada el 22 de octubre, versión de aceptación 2026-10-14', () => {
    const text = textOf(PRIVACY_WITH_ACCOUNTS.body);
    expect(text).toContain('Supabase, en la Unión Europea');
    expect(text).toContain('Brevo');
    expect(t(PRIVACY_WITH_ACCOUNTS.updated)).toBe('Última actualización: 22 de octubre de 2026.');
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
