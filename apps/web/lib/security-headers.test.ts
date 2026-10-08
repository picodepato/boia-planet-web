import { describe, expect, it } from 'vitest';
import { RENAMED_ROUTES, securityHeaders } from './security-headers';

const HOST = 'https://analytics.example';
const get = (dev: boolean, key: string) =>
  securityHeaders({ dev, analyticsHost: HOST }).find((h) => h.key === key)?.value ?? '';

describe('cabeceras de seguridad (REQ-ARQ-012)', () => {
  it('CSP: nada de fuera salvo imágenes https y la analítica', () => {
    const csp = get(false, 'Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain(`connect-src 'self' data: blob: ${HOST}`);
    // Sin `'unsafe-eval'` en producción (ver security-headers.ts).
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('ws:');
    // En desarrollo, el refresco en caliente sí lo necesita.
    expect(get(true, 'Content-Security-Policy')).toContain("'unsafe-eval'");
    expect(get(true, 'Content-Security-Policy')).toContain('ws:');
  });

  it('CSP con cuentas (plan 008): la API de Supabase; sin Supabase, nada más', () => {
    const csp = (supabaseUrl?: string) =>
      securityHeaders({ dev: false, analyticsHost: HOST, supabaseUrl }).find(
        (h) => h.key === 'Content-Security-Policy',
      )!.value;
    expect(csp('https://abc.supabase.co')).toContain(
      `connect-src 'self' data: blob: ${HOST} https://abc.supabase.co wss://abc.supabase.co;`,
    );
    expect(csp('')).toContain(`connect-src 'self' data: blob: ${HOST};`);
    expect(csp(undefined)).not.toContain('supabase');
    // Los clips de la Galería del bucket (plan 019 T216); en modo local, del navegador.
    expect(csp('https://abc.supabase.co')).toContain(
      "media-src 'self' data: blob: https://abc.supabase.co;",
    );
    expect(csp('')).toContain("media-src 'self' data: blob:;");
  });

  it('el resto de cabeceras', () => {
    expect(get(false, 'X-Content-Type-Options')).toBe('nosniff');
    expect(get(false, 'X-Frame-Options')).toBe('SAMEORIGIN');
    expect(get(false, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    // La cámara sólo la pide la propia web (escanear el sello, T91); el micro, nadie.
    expect(get(false, 'Permissions-Policy')).toContain('camera=(self)');
    expect(get(false, 'Permissions-Policy')).toContain('microphone=()');
    expect(get(false, 'Strict-Transport-Security')).toContain('max-age=');
  });

  it('/juego (el mundo 2D, D-25) lleva al planeta 3D', () => {
    for (const source of ['/juego', '/juego/:path*']) {
      expect(RENAMED_ROUTES).toContainEqual(
        expect.objectContaining({ source, destination: '/mar' }),
      );
    }
  });

  it('«Fotos y eventos» (/fotos) lleva a la Galería (plan 019 T216)', () => {
    expect(RENAMED_ROUTES).toContainEqual(
      expect.objectContaining({ source: '/fotos', destination: '/galeria' }),
    );
  });

  it('«Condiciones» lleva al aviso legal', () => {
    expect(RENAMED_ROUTES).toContainEqual(
      expect.objectContaining({ source: '/legal/condiciones', destination: '/legal/aviso-legal' }),
    );
  });
});
