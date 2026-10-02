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

  it('el resto de cabeceras', () => {
    expect(get(false, 'X-Content-Type-Options')).toBe('nosniff');
    expect(get(false, 'X-Frame-Options')).toBe('SAMEORIGIN');
    expect(get(false, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(get(false, 'Permissions-Policy')).toContain('camera=()');
    expect(get(false, 'Strict-Transport-Security')).toContain('max-age=');
  });

  it('/juego (el mundo 2D, D-25) lleva al planeta 3D', () => {
    for (const source of ['/juego', '/juego/:path*']) {
      expect(RENAMED_ROUTES).toContainEqual(
        expect.objectContaining({ source, destination: '/mar' }),
      );
    }
  });

  it('«Condiciones» lleva al aviso legal', () => {
    expect(RENAMED_ROUTES).toContainEqual(
      expect.objectContaining({ source: '/legal/condiciones', destination: '/legal/aviso-legal' }),
    );
  });
});
