import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { MERCHANDISE_CONTACT, MERCHANDISE_PRODUCTS, formatPrice } from '../lib/merchandise/catalog';
import { PRODUCT_ROTATION_MS } from '../lib/merchandise/rotation';
import { esWeb } from '../lib/i18n/es-web';
import { t } from '../lib/i18n';

const IMAGE_COUNT = MERCHANDISE_PRODUCTS.reduce((n, p) => n + p.images.length, 0);
const first = MERCHANDISE_PRODUCTS[0]!;

/** `T201_SHOTS=<folder>` saves the store screenshots for Hernán (plan 017 T201). */
async function shot(page: Page, name: string, project: string) {
  const dir = process.env.T201_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  // The product grid on desktop, the first card on mobile: both fit the viewport,
  // so the shot does not scroll the gallery out of view and stop its rotation.
  const target =
    project === 'desktop'
      ? page.locator('#tienda .merchandise__grid')
      : page.locator('#tienda .merchandise__card').first();
  await target.screenshot({ path: path.join(dir, `tienda-${name}-${project}.png`) });
  await page.getByTestId(`merchandise-gallery-${first.id}`).scrollIntoViewIfNeeded();
}

test('landing and internal shop show the same 3 products with name and price (decision 9)', async ({
  page,
}, info) => {
  await page.goto('/?intro=0#tienda');
  const store = page.locator('#tienda');
  await expect(store.locator('.merchandise__card')).toHaveCount(MERCHANDISE_PRODUCTS.length);
  for (const product of MERCHANDISE_PRODUCTS) {
    await expect(store.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
    await expect(store.getByTestId(`merchandise-price-${product.id}`)).toHaveText(
      formatPrice(product.priceCents),
    );
  }
  await expect(store.locator('img')).toHaveCount(IMAGE_COUNT);
  for (const product of MERCHANDISE_PRODUCTS) {
    for (const image of product.images) {
      const img = store.locator(`img[src="${image.src}"]`);
      await expect(img).toHaveAttribute('alt', image.alt);
      await expect(img).toHaveAttribute('loading', 'lazy');
      await expect(img).toHaveAttribute('data-kind', image.kind);
    }
  }
  const open = page.getByTestId('merchandise-open');
  await expect(open).not.toHaveAttribute('target');
  await open.click();
  await expect(page).toHaveURL(/\/tienda$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(esWeb['store.page.title']);
  await expect(page.getByTestId('merchandise-catalog')).toContainText('Fotos y diseños de muestra');
  await expect(page.locator('.merchandise__card')).toHaveCount(MERCHANDISE_PRODUCTS.length);
  for (const product of MERCHANDISE_PRODUCTS) {
    await page.getByTestId(`merchandise-gallery-${product.id}`).scrollIntoViewIfNeeded();
    for (const image of product.images) {
      const img = page.locator(`img[src="${image.src}"]`);
      await expect
        .poll(() => img.evaluate((node) => (node as HTMLImageElement).naturalWidth))
        .toBe(800);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.resolve(`node_modules/t103-preview/shop-${info.project.name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByTestId('merchandise-back').click();
  await expect(page).toHaveURL(/intro=0#tienda$/);
});

test('Botiga Ibiza opens the same internal shop and offers a return to sailing', async ({
  page,
}) => {
  await page.goto('/mar?ir=tienda');
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30000 });
  await page.getByTestId('mar-entradas-saltar').click();
  const open = page.getByTestId('mar-merchandise-open');
  await expect(open).toBeVisible({ timeout: 30000 });
  await expect(open).toHaveAttribute('href', '/tienda?from=mar');
  await expect(open).not.toHaveAttribute('target');
  // T219: Botiga Ibiza's card says «Sección de merchandising oficial».
  await expect(page.getByTestId('mar-ficha')).toContainText(t('mar.sheet.tienda.seccion'));
  await open.click();
  await expect(page).toHaveURL(/\/tienda\?from=mar$/);
  await expect(page.getByTestId('merchandise-back')).toHaveText(esWeb['store.page.backSea']);
  await page.getByTestId('merchandise-back').click();
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
});

test('shop is available without JavaScript or a Carnet', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/tienda');
  await expect(
    page.getByRole('heading', { name: esWeb['store.page.title'], exact: true }),
  ).toBeVisible();
  await expect(page.locator('.merchandise__grid img')).toHaveCount(IMAGE_COUNT);
  // Only each product's first image shows (inside its frame; the rest of the
  // strip is out of it, plan 020 T227); «Comprar» still opens its message.
  const shown = await page.locator('.merchandise__frame').evaluateAll((frames) =>
    frames.map((frame) => {
      const box = frame.getBoundingClientRect();
      return [...frame.querySelectorAll('img')].filter((img) => {
        const r = img.getBoundingClientRect();
        return r.left < box.right - 1 && r.right > box.left + 1;
      }).length;
    }),
  );
  expect(shown).toEqual(MERCHANDISE_PRODUCTS.map(() => 1));
  await expect(page.locator('.merchandise__grid img.is-active')).toHaveCount(
    MERCHANDISE_PRODUCTS.length,
  );
  await expect(page.locator('form, button')).toHaveCount(0);
  const buy = page.getByTestId('merchandise-buy').first();
  await buy.locator('summary').click();
  await expect(buy.getByTestId('merchandise-buy-message')).toBeVisible();
  await context.close();
});

test('each product rotates its images: alone, another angle, on a model (T201)', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?intro=0#tienda');
  const gallery = page.getByTestId(`merchandise-gallery-${first.id}`);
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-rotating', 'si');
  const active = gallery.locator('img.is-active');
  await expect(active).toHaveAttribute('data-kind', first.images[0]!.kind);
  await shot(page, 'rotacion-1', info.project.name);
  // Every image of the product comes up in turn, in order.
  for (const image of first.images.slice(1)) {
    await expect(active).toHaveAttribute('src', image.src, {
      timeout: PRODUCT_ROTATION_MS * 3,
    });
    // Only the visible image is exposed to screen readers.
    await expect(gallery.getByRole('img')).toHaveCount(1);
    await expect(gallery.getByRole('img')).toHaveAccessibleName(image.alt);
  }
  await page.waitForTimeout(700);
  await shot(page, 'rotacion-2', info.project.name);
  await expect(active).toHaveAttribute('src', first.images[0]!.src, {
    timeout: PRODUCT_ROTATION_MS * 3,
  });
});

test('under reduced motion the images stay still, and the dots still show them (T201)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?intro=0#tienda');
  const gallery = page.getByTestId(`merchandise-gallery-${first.id}`);
  await gallery.scrollIntoViewIfNeeded();
  await expect(page.getByTestId(`merchandise-dot-${first.id}-0`)).toBeVisible();
  await expect(gallery).toHaveAttribute('data-rotating', 'no');
  await page.waitForTimeout(PRODUCT_ROTATION_MS * 1.5);
  await expect(gallery).toHaveAttribute('data-index', '0');
  const last = first.images.length - 1;
  await page.getByTestId(`merchandise-dot-${first.id}-${last}`).click();
  await expect(gallery.locator('img.is-active')).toHaveAttribute('src', first.images[last]!.src);
  await expect(page.getByTestId(`merchandise-dot-${first.id}-${last}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('pressing buy explains each case and always points to the Instagram DM (decisions 9, 5)', async ({
  page,
}, info) => {
  await page.goto('/?intro=0#tienda');
  const store = page.locator('#tienda');
  for (const [i, product] of MERCHANDISE_PRODUCTS.entries()) {
    const buy = store.getByTestId('merchandise-buy').nth(i);
    const message = buy.getByTestId('merchandise-buy-message');
    await expect(message).toBeHidden();
    await buy.locator('summary').click();
    await expect(message).toBeVisible();
    if (product.sale === 'party') {
      await expect(message).toContainText(esWeb['store.buy.party']);
      // Plan 020 T227 (decision 5): sold in hand, but reserved on Instagram too.
      await expect(message).toContainText(esWeb['store.buy.party.reserve']);
    } else {
      await expect(message).toContainText(esWeb['store.buy.reserve']);
    }
    const link = message.getByRole('link');
    await expect(link).toHaveAttribute('href', MERCHANDISE_CONTACT.url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
  // Nothing navigates away.
  await expect(store.getByTestId('merchandise-buy-message').filter({ visible: true })).toHaveCount(
    MERCHANDISE_PRODUCTS.length,
  );
  await expect(page).toHaveURL(/#tienda$/);
  await shot(page, 'comprar', info.project.name);
});

test('the photos pass by swiping sideways: touch, mouse drag and arrows (plan 020 T227, decision 5)', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tienda');
  const gallery = page.getByTestId(`merchandise-gallery-${first.id}`);
  await gallery.scrollIntoViewIfNeeded();
  await expect(page.getByTestId(`merchandise-next-${first.id}`)).toBeVisible();
  const frame = gallery.locator('.merchandise__frame');
  const box = (await frame.boundingBox())!;
  const y = box.y + box.height / 2;
  // Mouse drag to the left: the next photo.
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 8 });
  await page.mouse.up();
  await expect(gallery).toHaveAttribute('data-index', '1');
  // Touch swipe to the right: back to the first.
  await frame.dispatchEvent('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    clientX: box.x + 40,
    clientY: y,
    isPrimary: true,
  });
  await frame.dispatchEvent('pointermove', {
    pointerId: 7,
    pointerType: 'touch',
    clientX: box.x + 120,
    clientY: y + 4,
    isPrimary: true,
  });
  await frame.dispatchEvent('pointermove', {
    pointerId: 7,
    pointerType: 'touch',
    clientX: box.x + box.width - 20,
    clientY: y + 6,
    isPrimary: true,
  });
  await frame.dispatchEvent('pointerup', {
    pointerId: 7,
    pointerType: 'touch',
    clientX: box.x + box.width - 20,
    clientY: y + 6,
    isPrimary: true,
  });
  await expect(gallery).toHaveAttribute('data-index', '0');
  // The arrows and the arrow keys, round the ends.
  await page.getByTestId(`merchandise-prev-${first.id}`).click();
  await expect(gallery).toHaveAttribute('data-index', String(first.images.length - 1));
  await page.getByTestId(`merchandise-next-${first.id}`).click();
  await expect(gallery).toHaveAttribute('data-index', '0');
  await gallery.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gallery).toHaveAttribute('data-index', '1');
  await expect(gallery.getByRole('img')).toHaveAccessibleName(first.images[1]!.alt);
  // The active photo is the one in the frame.
  const active = gallery.locator('img.is-active');
  await expect
    .poll(async () => Math.round((await active.boundingBox())!.x - (await frame.boundingBox())!.x))
    .toBe(0);
  await shot(page, 'deslizar', info.project.name);
});
