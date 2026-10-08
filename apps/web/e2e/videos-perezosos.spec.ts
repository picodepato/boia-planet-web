import { expect, test, type Page } from '@playwright/test';

/**
 * REQ-COM-032, T197: la home carga sin descargar vídeos. Registrar la red
 * antes de navegar, también después de hidratar y recorrer la página. La
 * transición del componente LazyVideo se prueba en Vitest; no inyectar
 * vídeos artificiales en el hero ni en los datos de producción.
 *
 * La Galería (plan 019 T216) sí tiene clips: el servidor sólo pinta sus
 * pósteres, y un clip sólo se descarga cuando está en pantalla y nadie pidió
 * reducir el movimiento.
 */
function mediaRequests(page: Page): string[] {
  const downloads: string[] = [];
  page.on('request', (request) => {
    if (
      request.resourceType() === 'media' ||
      /\.(?:mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(request.url())
    ) {
      downloads.push(request.url());
    }
  });
  return downloads;
}

test('REQ-COM-032: /?intro=0 carga sin descargar vídeos', async ({ page }) => {
  const downloads = mediaRequests(page);
  await page.goto('/?intro=0');
  await expect(page.locator('main')).toBeVisible();
  // Esperar scripts/efectos: una regresión de autoplay tras hidratar cuenta.
  await page.waitForLoadState('networkidle');
  expect(downloads).toEqual([]);
  await expect(page.locator('video')).toHaveCount(0);
  await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    // Dar tiempo al IntersectionObserver antes de consultar el estado idle.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await page.waitForLoadState('networkidle');
  expect(downloads).toEqual([]);
});

test.describe('la Galería con «reducir movimiento»', () => {
  test.use({ reducedMotion: 'reduce' });

  test('REQ-COM-032: /galeria enseña los pósteres de los clips y no descarga ninguno', async ({
    page,
  }) => {
    const downloads = mediaRequests(page);
    await page.goto('/galeria');
    await expect(page.locator('[data-kind="video"]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await page.waitForLoadState('networkidle');
    expect(downloads).toEqual([]);
    await expect(page.locator('.collage video')).toHaveCount(0);
  });
});

test.describe('la Galería sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('REQ-COM-032: el servidor sólo pinta pósteres', async ({ page }) => {
    const downloads = mediaRequests(page);
    await page.goto('/galeria');
    await expect(page.locator('[data-kind="video"] img').first()).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
    expect(downloads).toEqual([]);
  });
});
