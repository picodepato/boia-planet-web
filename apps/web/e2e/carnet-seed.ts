import { MemoryStorage, STORE_KEY, createLocalRepository } from '@boia/store';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Comprar pide el Carnet BOIA (plan 019 T215, decisión 1). Las e2e que
 * compran sin probar el alta del Carnet empiezan con uno ya hecho en este
 * navegador (como quien vuelve con su Carnet); `prepare` deja además lo que
 * cada prueba necesite (un código encontrado…).
 */
export async function seedCarnet(
  page: Page,
  nickname = 'Grumete e2e',
  prepare?: (repo: ReturnType<typeof createLocalRepository>) => Promise<unknown>,
): Promise<void> {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.carnet.create({ nickname });
  if (prepare) await prepare(repo);
  const doc = storage.getItem(STORE_KEY)!;
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
      } catch {
        // sin almacenamiento: la prueba fallará más abajo, con su motivo
      }
    },
    [STORE_KEY, doc] as const,
  );
}

/**
 * En la landing, sin Carnet: el checkout lo pide; el alta rápida lo crea ahí
 * mismo y la compra sigue (hasta «Confirmar»).
 */
export async function createCarnetInCheckout(
  checkout: Locator,
  nickname = 'Grumete e2e',
  timeout = 20_000,
): Promise<void> {
  await expect(checkout.getByTestId('checkout-carnet-requerido')).toBeVisible({ timeout });
  await checkout.getByTestId('checkout-crear-carnet').click();
  await checkout.getByTestId('checkout-carnet-apodo').fill(nickname);
  await checkout.getByTestId('checkout-carnet-guardar').click();
  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible({ timeout });
}
