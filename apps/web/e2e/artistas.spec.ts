import { artistMusic } from '@boia/contracts';
import { artistCarnetId } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { t } from '../lib/i18n';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { carnetPath } from '../lib/mundo/carnet/share';

/**
 * Los artistas (plan 019 T217, decisión 10), en modo local (D-20): en
 * /artistas cada uno tiene su imagen al lado, su nombre abre su Carnet, y dos
 * botones, «Ver carnet» y su música con el icono y el nombre de la
 * plataforma. Un artista que crea su Carnet con el enlace de artistas pone
 * ahí su enlace (aquí, SoundCloud) y sale en la lista con él.
 */
test.describe.configure({ timeout: 150_000 });

const shotPath = (name: string) => `node_modules/.playwright-results/t217-${name}.png`;

/** En el móvil, a 390×844 (las capturas del plan); en el escritorio, como viene. */
async function phoneSize(page: Page, project: string): Promise<void> {
  if (project === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
}

test('/artistas: imagen, nombre que abre el Carnet, «Ver carnet» y el botón de su música', async ({
  page,
}, info) => {
  await phoneSize(page, info.project.name);
  await page.goto('/artistas');
  const list = page.getByTestId('artistas-lista');
  await expect(list.locator('li')).toHaveCount(SAMPLE_CONTENT.artists.length);

  const platforms = new Set<string>();
  for (const a of SAMPLE_CONTENT.artists) {
    const item = list.locator(`li[data-artist="${a.id}"]`);
    const href = carnetPath(artistCarnetId(a.id));
    await expect(item.locator('.artist-card__avatar, .artist-card__photo')).toBeVisible();
    await expect(item.getByTestId('artista-nombre')).toHaveText(a.name);
    await expect(item.getByTestId('artista-nombre')).toHaveAttribute('href', href);
    await expect(item.getByTestId('artista-carnet')).toHaveText(t('artist.carnet'));
    await expect(item.getByTestId('artista-carnet')).toHaveAttribute('href', href);
    const music = artistMusic(a);
    const button = item.getByTestId('artista-musica');
    if (!music) {
      await expect(button).toHaveCount(0);
      continue;
    }
    platforms.add(music.platform);
    await expect(button).toHaveAttribute('href', music.url);
    await expect(button).toHaveAttribute('data-platform', music.platform);
    await expect(button).toHaveAttribute('target', '_blank');
    await expect(button).toContainText(t(`artist.music.${music.platform}`));
    await expect(button.locator(`svg.music-icon[data-platform="${music.platform}"]`)).toHaveCount(
      1,
    );
  }
  expect([...platforms].sort()).toEqual(['bandcamp', 'instagram', 'soundcloud', 'spotify']);

  // La imagen va al lado del nombre (a su izquierda, a la misma altura).
  const first = list.locator('li').first();
  const img = (await first.locator('.artist-card__avatar, .artist-card__photo').boundingBox())!;
  const name = (await first.getByTestId('artista-nombre').boundingBox())!;
  expect(img.x + img.width).toBeLessThanOrEqual(name.x);
  expect(name.y).toBeLessThan(img.y + img.height);

  await page.screenshot({ path: shotPath(`${info.project.name}-lista`) });

  // El nombre abre su Carnet.
  const someone = SAMPLE_CONTENT.artists[0]!;
  await list.locator(`li[data-artist="${someone.id}"]`).getByTestId('artista-nombre').click();
  await expect(page).toHaveURL(new RegExp(`/carnet/${artistCarnetId(someone.id)}$`));
  await expect(page.getByTestId('carnet-pagina')).toContainText(someone.name, {
    timeout: 30_000,
  });
});

test('un artista pone su SoundCloud al crear su Carnet y la lista lo enseña', async ({
  page,
}, info) => {
  await phoneSize(page, info.project.name);
  const nickname = `Zzyzx ${info.project.name}`;
  const url = `https://soundcloud.com/zzyzx-${info.project.name}`;

  await page.goto('/artista/muestra-t217');
  await expect(page).toHaveURL(/\/mar/, { timeout: 60_000 });
  await expect(page.getByTestId('mar-carnet')).toBeVisible({ timeout: 60_000 });
  if (!(await page.getByTestId('carnet-form').isVisible())) {
    await page.getByTestId('carnet-crear').click();
  }
  const form = page.getByTestId('carnet-form');
  await expect(form.getByTestId('carnet-musica')).toBeVisible();
  await form.getByTestId('carnet-apodo-input').fill(nickname);

  // Un enlace que no es de las cuatro no deja crear el Carnet.
  await form.getByTestId('carnet-musica-input').fill('https://youtube.com/@zzyzx');
  await form.getByTestId('carnet-guardar').click();
  await expect(form.getByTestId('carnet-musica-estado')).toHaveText(t('carnet.music.invalid'));
  await expect(page.getByTestId('carnet-mio')).toHaveCount(0);

  await form.getByTestId('carnet-musica-input').fill(url);
  await expect(form.getByTestId('carnet-musica-estado')).toHaveAttribute(
    'data-platform',
    'soundcloud',
  );
  await form
    .getByTestId('carnet-musica')
    .screenshot({ path: shotPath(`${info.project.name}-alta`) });
  await form.getByTestId('carnet-guardar').click();
  await expect(page.getByTestId('carnet-mio')).toBeVisible();

  await page.goto('/artistas');
  const list = page.getByTestId('artistas-lista');
  await expect(list.locator('li')).toHaveCount(SAMPLE_CONTENT.artists.length + 1, {
    timeout: 30_000,
  });
  const mine = list.locator('li', { has: page.getByText(nickname, { exact: true }) });
  await expect(mine.locator('.artist-card__avatar, .artist-card__photo')).toBeVisible();
  const button = mine.getByTestId('artista-musica');
  await expect(button).toHaveAttribute('href', url);
  await expect(button).toHaveAttribute('data-platform', 'soundcloud');
  await expect(button).toContainText(t('artist.music.soundcloud'));
  await mine.scrollIntoViewIfNeeded();
  await mine.screenshot({ path: shotPath(`${info.project.name}-mio`) });

  // «Ver carnet» abre el suyo.
  await mine.getByTestId('artista-carnet').click();
  await expect(page).toHaveURL(/\/carnet\/[^/]+$/);
  await expect(page.getByTestId('carnet-pagina')).toContainText(nickname, { timeout: 30_000 });
});

test('la banda de la landing: el nombre abre el Carnet, «Ver carnet» y la música', async ({
  page,
}, info) => {
  await phoneSize(page, info.project.name);
  await page.goto('/#artistas');
  const trio = page.getByTestId('artist-trio');
  await expect(trio.locator('li')).toHaveCount(3);
  for (const item of await trio.locator('li').all()) {
    const href = await item.getByTestId('artista-nombre').getAttribute('href');
    expect(href).toMatch(/^\/carnet\/artista-/);
    await expect(item.getByTestId('artista-carnet')).toHaveAttribute('href', href!);
  }
  await expect(trio.getByTestId('artista-musica').first()).toBeVisible();
  await trio.scrollIntoViewIfNeeded();
  await page.locator('#artistas').screenshot({ path: shotPath(`${info.project.name}-landing`) });
});
