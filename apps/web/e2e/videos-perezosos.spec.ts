import { expect, test } from '@playwright/test';

/**
 * REQ-COM-032, T197: hoy la home y las galerías sólo contienen fotos.
 * Registrar la red antes de navegar, también después de hidratar y recorrer
 * la galería. La transición del componente LazyVideo se prueba en Vitest;
 * no inyectar vídeos artificiales en el hero ni en los datos de producción.
 */
for (const path of ['/?intro=0', '/fotos']) {
  test(`REQ-COM-032: ${path} carga sin descargar vídeos`, async ({ page }) => {
    const downloads: string[] = [];
    page.on('request', (request) => {
      if (
        request.resourceType() === 'media' ||
        /\.(?:mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(request.url())
      ) {
        downloads.push(request.url());
      }
    });
    await page.goto(path);
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
}
