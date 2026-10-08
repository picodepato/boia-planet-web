import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eventSchema } from '@boia/contracts';
import { SAMPLE_EVENTS, SAMPLE_PHOTOS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { eventIslands, islandEvent } from '../lib/admin/world';
import { t } from '../lib/i18n';

/**
 * La Galería (plan 019 T216, decisión 8): un collage de fotos y clips, algo
 * superpuestos y sin textos. Abrir una pieza la hace crecer desde su sitio
 * sobre un fondo oscuro; cerrarla la devuelve a su sitio y aparta un poco a
 * las vecinas. El Admin de la demo (modo local) sube un clip y sale en el
 * collage. REQ-COM-031, REQ-COM-032, REQ-ADM-019.
 *
 * `T216_SHOTS=<carpeta>` guarda capturas y fotogramas de las animaciones.
 */

test.describe.configure({ timeout: 180_000 });

async function shot(page: Page, name: string, project: string) {
  const dir = process.env.T216_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${project}-${name}.png`) });
}

/** El móvil de las capturas para Hernán (390 × 844). */
async function phone(page: Page, project: string) {
  if (project === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
}

/** Un clic y, en el fotograma siguiente, el estado de las animaciones de la pieza abierta. */
async function clickAndSample(target: Locator): Promise<{ fase: string; running: number }> {
  return target.evaluate(async (el) => {
    (el as HTMLElement).click();
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const viewer = document.querySelector<HTMLElement>('[data-testid="collage-visor"]');
    const figure = viewer?.querySelector<HTMLElement>('.collage-viewer__figure');
    return {
      fase: viewer?.dataset.fase ?? 'ninguna',
      running: figure?.getAnimations().filter((a) => a.playState === 'running').length ?? 0,
    };
  });
}

test('el collage: fotos y clips superpuestos; abrir anima sobre fondo oscuro; cerrar devuelve y empuja', async ({
  page,
}, info) => {
  const project = info.project.name;
  await phone(page, project);
  await page.goto('/galeria');
  const pieces = page.locator('.galeria [data-pieza]');
  await expect(pieces).toHaveCount(SAMPLE_PHOTOS.length);
  const clips = SAMPLE_PHOTOS.filter((p) => p.kind === 'video');
  await expect(page.locator('.galeria [data-kind="video"]')).toHaveCount(clips.length);
  // Sin textos: el collage sólo tiene imágenes (los nombres, para lectores de pantalla).
  expect((await page.locator('.galeria').innerText()).trim()).toBe('');
  await shot(page, '1-collage', project);

  // Algo superpuestos: alguna pareja de piezas se pisa.
  const boxes = await pieces.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect),
  );
  const overlaps = boxes.some((a, i) =>
    boxes.some(
      (b, j) =>
        i < j &&
        a.left < b.right - 2 &&
        b.left < a.right - 2 &&
        a.top < b.bottom - 2 &&
        b.top < a.bottom - 2,
    ),
  );
  expect(overlaps).toBe(true);

  // Un clip en pantalla se reproduce solo, mudo.
  const clip = page.locator('.galeria [data-kind="video"]').first();
  await clip.scrollIntoViewIfNeeded();
  const video = clip.locator('video');
  await expect(video).toHaveCount(1, { timeout: 10_000 });
  await expect
    .poll(
      () => video.evaluate((v: HTMLVideoElement) => v.muted && !v.paused && v.currentTime > 0),
      {
        timeout: 15_000,
      },
    )
    .toBe(true);
  await shot(page, '2-clip', project);

  // Abrir una foto: crece desde su sitio (animación en marcha) sobre fondo oscuro.
  const photo = page.locator('.galeria [data-kind="image"]').nth(2);
  await photo.scrollIntoViewIfNeeded();
  const photoId = (await photo.getAttribute('data-pieza'))!;
  const before = await photo.boundingBox();
  const opening = await clickAndSample(photo.locator('button'));
  expect(opening).toEqual({ fase: 'opening', running: 1 });
  await shot(page, '3-abriendo', project);
  const viewer = page.getByTestId('collage-visor');
  await expect(viewer).toHaveAttribute('data-fase', 'open');
  await expect(viewer).toHaveAttribute('data-pieza', photoId);
  await expect(page.getByTestId('collage-cerrar')).toBeFocused();
  const dark = await viewer
    .locator('.collage-viewer__backdrop')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b, a] = dark.match(/[\d.]+/g)!.map(Number);
  expect(r! + g! + b!).toBeLessThan(90);
  expect(a ?? 1).toBeGreaterThan(0.85);
  const figure = viewer.locator('.collage-viewer__figure');
  const open = (await figure.boundingBox())!;
  // Más grande que en el collage y en el centro de la pantalla.
  expect(open.width * open.height).toBeGreaterThan(before!.width * before!.height * 1.3);
  const vp = page.viewportSize()!;
  expect(Math.abs(open.x + open.width / 2 - vp.width / 2)).toBeLessThan(4);
  expect(Math.abs(open.y + open.height / 2 - vp.height / 2)).toBeLessThan(4);
  // La pieza del collage deja su hueco mientras está abierta.
  await expect(photo).toHaveAttribute('data-abierta', '');
  await shot(page, '4-abierta', project);

  // Cerrar: vuelve a su sitio (animación), baja al fondo y las vecinas se apartan.
  const collageId = await photo.evaluate(
    (el) => el.closest('[data-empujes]')!.getAttribute('data-testid')!,
  );
  const collage = page.getByTestId(collageId);
  const zBefore = await collage.locator('[data-pieza]').evaluateAll((els) =>
    els.map((el) => Number(getComputedStyle(el).zIndex)),
  );
  const closing = await clickAndSample(page.getByTestId('collage-cerrar'));
  expect(closing).toEqual({ fase: 'closing', running: 1 });
  await shot(page, '5-cerrando', project);
  await expect(viewer).toHaveCount(0);
  await expect(collage).toHaveAttribute('data-empujes', '1');
  await expect(photo).not.toHaveAttribute('data-abierta');
  await expect(photo.locator('button')).toBeFocused();
  const nudged = await collage.locator('[data-pieza]').evaluateAll((els) =>
    els
      .filter((el) => {
        const s = (el as HTMLElement).style;
        return s.getPropertyValue('--nx') !== '0px' || s.getPropertyValue('--ny') !== '0px';
      })
      .map((el) => (el as HTMLElement).dataset.pieza),
  );
  expect(nudged.length).toBeGreaterThan(0);
  expect(nudged).not.toContain(photoId);
  const zAfter = Number(await photo.evaluate((el) => getComputedStyle(el).zIndex));
  expect(zAfter).toBeLessThan(Math.min(...zBefore));
  // El empujón se ve: una vecina se ha movido de verdad en pantalla.
  await page.waitForTimeout(800);
  await shot(page, '6-empujadas', project);

  // Un clip abierto se reproduce mudo; Esc cierra.
  const clipButton = clip.locator('button');
  await clipButton.scrollIntoViewIfNeeded();
  await clipButton.click();
  await expect(viewer).toHaveAttribute('data-fase', 'open');
  const big = page.getByTestId('collage-visor-video');
  await expect
    .poll(() => big.evaluate((v: HTMLVideoElement) => v.muted && !v.paused), { timeout: 15_000 })
    .toBe(true);
  await shot(page, '7-clip-abierto', project);
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
});

/**
 * Una pieza que tapa a otra, y un punto de la parte tapada (en pantalla,
 * `elementFromPoint` da la de encima). Para probar que arrastrarla la destapa.
 */
async function coveringPiece(page: Page) {
  return page.evaluate(() => {
    const pieces = [...document.querySelectorAll<HTMLElement>('.galeria [data-pieza]')];
    const owner = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-pieza]')?.dataset.pieza;
    for (const top of pieces) {
      const a = top.getBoundingClientRect();
      // Su centro (por donde se agarra) en pantalla.
      if (a.top + a.height / 2 < 80 || a.top + a.height / 2 > window.innerHeight - 10) continue;
      for (const under of pieces) {
        if (under === top) continue;
        const b = under.getBoundingClientRect();
        const l = Math.max(a.left, b.left);
        const r = Math.min(a.right, b.right);
        const t = Math.max(a.top, b.top);
        const btm = Math.min(a.bottom, b.bottom);
        if (r - l < 24 || btm - t < 24) continue;
        const x = (l + r) / 2;
        const y = (t + btm) / 2;
        if (owner(x, y) !== top.dataset.pieza) continue;
        // Hacia el lado con sitio dentro del collage, y que baste para destaparla.
        const grid = top.closest('.collage__grid')!.getBoundingClientRect();
        const roomRight = grid.right - a.right;
        const roomLeft = a.left - grid.left;
        const dir = roomRight >= roomLeft ? 1 : -1;
        // Lo que tiene que moverse para que el punto quede fuera de ella.
        const dist = (dir === 1 ? x - a.left : a.right - x) + 16;
        if (Math.max(roomLeft, roomRight) < dist) continue;
        return {
          top: top.dataset.pieza!,
          under: under.dataset.pieza!,
          x,
          y,
          dir,
          dist,
          from: { x: a.left + a.width / 2, y: a.top + a.height / 2 },
        };
      }
    }
    return null;
  });
}

const ownerAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([px, py]) =>
      document.elementFromPoint(px!, py!)?.closest<HTMLElement>('[data-pieza]')?.dataset.pieza,
    [x, y],
  );

test('arrastrar una pieza la aparta y deja ver la de debajo; sin arrastre, se abre (T234)', async ({
  page,
}, info) => {
  const project = info.project.name;
  await phone(page, project);
  await page.goto('/galeria');
  await expect(page.locator('.galeria [data-pieza]')).toHaveCount(SAMPLE_PHOTOS.length);
  const found = await coveringPiece(page);
  expect(found).not.toBeNull();
  const { top, x, y, dir, dist, from } = found!;
  const step = dist / 10;
  const piece = page.locator(`.galeria [data-pieza="${top}"]`);
  const grid = (await piece.evaluate((el) =>
    el.closest('.collage__grid')!.getBoundingClientRect().toJSON(),
  )) as DOMRect;
  await shot(page, 'arrastre-1-antes', project);

  if (project === 'mobile') {
    // Con el dedo, de lado (en vertical la página se desplaza).
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: from.y }],
      });
    await touch('touchStart', from.x);
    for (let i = 1; i <= 10; i++) await touch('touchMove', from.x + dir * i * step);
    await touch('touchEnd', from.x + dir * dist);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + dir * i * step, from.y);
    await page.mouse.up();
  }
  await expect(piece).toHaveAttribute('data-movida', '');
  // Soltar tras arrastrar no la abre.
  await expect(page.getByTestId('collage-visor')).toHaveCount(0);
  // Se apartó, sigue dentro del collage y ya no tapa a la de debajo.
  const after = (await piece.boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - from.x)).toBeGreaterThan(30);
  expect(after.x).toBeGreaterThanOrEqual(Math.min(grid.left, from.x - after.width / 2) - 2);
  expect(after.x + after.width).toBeLessThanOrEqual(
    Math.max(grid.right, from.x + after.width / 2) + 2,
  );
  // Donde la tapaba ya no está: se ve lo de debajo (otra pieza, o el fondo
  // si el punto era la esquina girada de la tapada).
  expect(await ownerAt(page, x, y)).not.toBe(top);
  await shot(page, 'arrastre-2-apartada', project);

  // Un toque sin arrastre la abre en grande.
  await piece.locator('button').click();
  await expect(page.getByTestId('collage-visor')).toHaveAttribute('data-pieza', top);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('collage-visor')).toHaveCount(0);
});

/** La isla de evento que abre hoy un evento de la muestra, y ese evento (como admin-fotos.spec). */
const now = new Date();
const events = SAMPLE_EVENTS.map((e) => eventSchema.parse(e));
const island = eventIslands(WORLD_REGISTRY.map).find((p) => islandEvent(p.id, events, now))!;
const event = islandEvent(island.id, events, now)!;
const islandName =
  WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).places.find((p) => p.id === island.id)?.name ??
  island.id;
const ALT = 'Clip de prueba en la isla';

test('el Admin sube un clip (modo local) y sale en el collage, mudo', async ({ page }, info) => {
  const project = info.project.name;
  await phone(page, project);
  await page.goto('/admin');
  await page.getByTestId('admin-nav-fotos').click();
  const form = page.getByTestId('fotos-isla');
  await form.getByTestId('fotos-isla-isla').selectOption(island.id);
  await expect(form.getByTestId('fotos-isla-evento')).toHaveValue(event.id);
  await form.getByTestId('fotos-isla-alt').fill(ALT);

  // Un .mov de QuickTime no vale.
  const mov = Buffer.alloc(64);
  mov.write('\u0000\u0000\u0000\u0018ftypqt  ', 0, 'latin1');
  await form.getByTestId('fotos-isla-archivos').setInputFiles({
    name: 'video.mov',
    mimeType: 'video/quicktime',
    buffer: mov,
  });
  await form.getByTestId('fotos-isla-subir').click();
  await expect(form).toContainText(t('admin.photos.upload.problem.type', { file: 'video.mov' }));

  // Un mp4 de verdad (un clip de muestra).
  const mp4 = readFileSync(new URL('../../../art/galeria/boia-baila.mp4', import.meta.url));
  await form.getByTestId('fotos-isla-archivos').setInputFiles({
    name: 'baile.mp4',
    mimeType: 'video/mp4',
    buffer: mp4,
  });
  await form.getByTestId('fotos-isla-subir').click();
  await expect(form).toContainText(
    t('admin.photos.upload.donePast1', { n: 1, island: islandName, event: event.name }),
    { timeout: 30_000 },
  );
  const row = page.locator('[data-testid^="foto-foto-"][data-kind="video"]');
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await expect(row).toContainText(t('admin.photos.clip'));
  const thumb = row.locator('img.admin-photo-thumb');
  await thumb.scrollIntoViewIfNeeded();
  await expect
    .poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 15_000 })
    .toBe(480);
  await shot(page, '8-admin-clip', project);

  // La Galería: el clip, en el grupo de su isla, con su póster y reproduciéndose mudo.
  await page.goto(`/galeria#${island.id}`);
  const group = page.getByTestId(`galeria-${island.id}`);
  const piece = group.locator('[data-kind="video"]').filter({
    has: page.getByRole('button', { name: t('gallery.open', { alt: ALT }) }),
  });
  await expect(piece).toHaveCount(1, { timeout: 15_000 });
  await piece.scrollIntoViewIfNeeded();
  await expect
    .poll(() => piece.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth), {
      timeout: 15_000,
    })
    .toBe(480);
  const video = piece.locator('video');
  await expect
    .poll(
      () =>
        video.evaluate((v: HTMLVideoElement) => v.src.startsWith('blob:') && v.muted && !v.paused),
      { timeout: 15_000 },
    )
    .toBe(true);
  await shot(page, '9-galeria-clip-subido', project);
});
