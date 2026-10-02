import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';
import { LEGAL_DOCS } from '../lib/legal/docs';

/**
 * Entrega (T49): las cabeceras de seguridad llegan en el build de producción
 * (REQ-ARQ-012) y las páginas legales usan los textos de textos-zonas.md, con
 * el aviso de datos inventados arriba (D-23, O14); «Condiciones» redirige al
 * aviso legal.
 */

test('cada respuesta lleva la CSP y las cabeceras de seguridad', async ({ request }) => {
  for (const path of ['/', '/juego', '/mar', '/admin']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const h = res.headers();
    expect(h['content-security-policy'], path).toContain("default-src 'self'");
    expect(h['content-security-policy'], path).toContain("object-src 'none'");
    expect(h['x-content-type-options'], path).toBe('nosniff');
    expect(h['x-frame-options'], path).toBe('SAMEORIGIN');
    expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
  }
});

test('páginas legales: aviso de muestra arriba y sus textos; «Condiciones» lleva al aviso legal', async ({
  page,
}) => {
  const csp: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) csp.push(m.text());
  });
  for (const [id, doc] of Object.entries(LEGAL_DOCS)) {
    await page.goto(`/legal/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t(doc.title));
    await expect(page.getByTestId('legal-muestra')).toHaveText(t('legal.sampleBanner'));
    await expect(page.getByText(t(doc.body[0]!))).toBeVisible();
  }
  await page.goto('/legal/condiciones');
  await expect(page).toHaveURL(/\/legal\/aviso-legal$/);
  // El pie enlaza el aviso legal (la entrada puede tenerlo aún inerte: se mira el enlace).
  await page.goto('/');
  await expect(page.locator('footer a[href="/legal/aviso-legal"]')).toHaveText(
    t('footer.legalNotice'),
  );
  expect(csp).toEqual([]);
});
