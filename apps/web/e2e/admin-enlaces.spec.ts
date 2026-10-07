import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';

/**
 * Enlaces sin código desde el Admin de la demo (plan 017 T192), en modo
 * local: se cambia el primer enlace del pie (etiqueta y dirección), el
 * contacto de «Comprar» de la tienda y el enlace de Contacto; una dirección
 * que no es web se rechaza; al «Publicar», la web enseña lo nuevo.
 */

test.describe.configure({ timeout: 120_000 });

const FOOTER = { label: 'Instagram del Admin', url: 'https://instagram.com/boia.admin' };
const STORE = { handle: '@boia.tienda', url: 'https://instagram.com/boia.tienda' };
const CONTACT = { label: 'WhatsApp del Admin', url: 'https://wa.me/34600000001' };

test('editar un enlace del pie, de contacto y de la tienda en el Admin y verlos en la web', async ({
  page,
}) => {
  await page.goto('/admin#enlaces');
  await expect(page.getByTestId('admin-seccion-enlaces')).toBeVisible();

  // El pie: una dirección que no es web se rechaza con su motivo.
  const footer = page.getByTestId('enlaces-pie');
  await footer.getByTestId('pie-etiqueta-0').fill(FOOTER.label);
  await footer.getByTestId('pie-url-0').fill('javascript:alert(1)');
  await footer.getByTestId('pie-guardar').click();
  await expect(footer.getByTestId('admin-error')).toContainText(FOOTER.label);
  await footer.getByTestId('pie-url-0').fill(FOOTER.url);
  await footer.getByTestId('pie-guardar').click();
  await expect(footer.getByTestId('admin-ok')).toHaveText(t('admin.links.saved'));

  const store = page.getByTestId('enlaces-tienda');
  await store.getByTestId('tienda-usuario').fill(STORE.handle);
  await store.getByTestId('tienda-url').fill(STORE.url);
  await store.getByTestId('tienda-guardar').click();
  await expect(store.getByTestId('admin-ok')).toBeVisible();

  const contact = page.getByTestId('enlaces-contacto');
  await contact.getByTestId('contacto-etiqueta-0').fill(CONTACT.label);
  await contact.getByTestId('contacto-url-0').fill(CONTACT.url);
  await contact.getByTestId('contacto-guardar').click();
  await expect(contact.getByTestId('admin-ok')).toBeVisible();

  // Va al borrador, como el resto de la home: se ve en la web al publicar.
  await expect(page.getByTestId('borrador')).not.toHaveAttribute('data-pendientes', '0');
  await page.getByTestId('publicar').click();
  await expect(page.getByTestId('borrador')).toHaveAttribute('data-pendientes', '0');

  await page.goto('/?intro=0');
  const official = page.getByRole('navigation', { name: t('footer.official') });
  const link = official.getByRole('link', { name: FOOTER.label });
  await expect(link).toHaveAttribute('href', FOOTER.url);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(
    page.getByTestId('contacto-datos').getByRole('link', { name: CONTACT.label }),
  ).toHaveAttribute('href', CONTACT.url);

  const buy = page.locator('#tienda').getByTestId('merchandise-buy').first();
  await buy.locator('summary').click();
  const message = buy.getByTestId('merchandise-buy-message');
  await expect(message).toContainText(STORE.handle);
  await expect(message.getByRole('link')).toHaveAttribute('href', STORE.url);
});
