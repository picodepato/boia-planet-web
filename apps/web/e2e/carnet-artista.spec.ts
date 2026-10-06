import { expect, test, type Page } from '@playwright/test';
import { t } from '../lib/i18n';

/**
 * El enlace de artistas (plan 016 T186) en modo local (D-20, demo): quien
 * abre `/artista/<código>` y crea su Carnet lleva el sello «ARTISTA» en el
 * anverso; un Carnet creado sin el enlace, no. Sin servidor no hay número.
 */
test.describe.configure({ timeout: 150_000 });

async function createCarnet(page: Page, nickname: string): Promise<void> {
  await expect(page.getByTestId('mar-carnet')).toBeVisible({ timeout: 60_000 });
  if (!(await page.getByTestId('carnet-form').isVisible())) {
    await page.getByTestId('carnet-crear').click();
  }
  const form = page.getByTestId('carnet-form');
  await expect(form).toBeVisible();
  await form.getByTestId('carnet-apodo-input').fill(nickname);
  await form.getByTestId('carnet-guardar').click();
  await expect(page.getByTestId('carnet-mio')).toBeVisible();
}

async function frontShot(page: Page, name: string): Promise<void> {
  await page.goto('/carnet');
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card).toHaveAttribute('data-cara', 'front');
  await card.scrollIntoViewIfNeeded();
  await card.locator('.idc-flip').screenshot({
    path: `node_modules/.playwright-results/${name}.png`,
  });
}

test('el enlace de artistas: el Carnet nuevo lleva el sello «ARTISTA» en el anverso', async ({
  page,
}, info) => {
  await page.goto('/artista/muestra-t186');
  await expect(page).toHaveURL(/\/mar/, { timeout: 60_000 });
  await expect(page.getByTestId('mar-carnet')).toBeVisible({ timeout: 60_000 });
  if (!(await page.getByTestId('carnet-form').isVisible())) {
    await page.getByTestId('carnet-crear').click();
  }
  await expect(page.getByTestId('carnet-aviso-artista')).toHaveText(
    t('carnet.artistLink.notice'),
  );
  await createCarnet(page, `Artista ${info.project.name}`);

  await frontShot(page, `t186-${info.project.name}-artista`);
  const front = page.getByTestId('carnet-anverso');
  await expect(front.getByTestId('carnet-sello-artista')).toBeVisible();
  await expect(front).toContainText(t('carnet.card.docArtist'));
  // Modo local: sin número (D-20).
  await expect(front.getByTestId('carnet-numero')).toHaveText('—');
});

test('sin el enlace, el Carnet es de socio y no lleva el sello', async ({ page }, info) => {
  await page.goto('/mar?menu=carnet');
  await createCarnet(page, `Socia ${info.project.name}`);
  await frontShot(page, `t186-${info.project.name}-socio`);
  const front = page.getByTestId('carnet-anverso');
  await expect(front).toContainText(t('carnet.card.docMember'));
  await expect(front.getByTestId('carnet-sello-artista')).toHaveCount(0);
});

test('un enlace con un código raro no se recuerda y lo dice', async ({ page }) => {
  await page.goto('/artista/no%20vale');
  await expect(page.getByTestId('enlace-artista')).toContainText(t('carnet.artistLink.bad'));
  await expect(page).toHaveURL(/\/artista\//);
});
