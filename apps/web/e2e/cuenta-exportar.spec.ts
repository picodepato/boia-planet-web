import { readFile } from 'node:fs/promises';
import { MemoryStorage, SAMPLE_CREW, STORE_KEY, createLocalRepository } from '@boia/store';
import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';

/**
 * «Descargar mis datos» (plan 017 T193, REQ-IDE-050) en modo local: bajo el
 * Carnet propio, un JSON con lo de este navegador; sólo lo propio (ni los
 * miembros de muestra ni sus botellas) y sin secretos. Corre en móvil
 * 360×640 y en escritorio.
 */
test.describe.configure({ timeout: 90_000 });

test('modo local: el Carnet propio descarga sus datos en JSON', async ({ page }, info) => {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  const nickname = `Exporta ${info.project.name}`;
  await repo.carnet.create({ nickname });
  await repo.progress.grantWorldReward({ sourceRef: 'e2e-exporta', points: 25, coins: 5 });
  await repo.bottles.place({ message: `Mi botella ${info.project.name}`, x: 2, y: 3 });
  const me = (await repo.identity.current())!.id;
  await page.addInitScript(
    ([key, doc]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, doc);
    },
    [STORE_KEY, storage.getItem(STORE_KEY)!] as const,
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/carnet');
  await expect(page.getByTestId('carnet-apodo')).toHaveText(nickname);
  const section = page.getByTestId('cuenta-local');
  await expect(section).toContainText(t('account.export.lead'));
  // Lo de la cuenta con email no aparece en modo local.
  await expect(page.getByTestId('cuenta')).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    section.getByTestId('cuenta-exportar-boton').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^boia-planet-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await readFile((await download.path())!, 'utf8');
  const data = JSON.parse(text) as Record<string, unknown>;
  expect(data).toMatchObject({
    format: 'boia-planet-account-export',
    mode: 'local',
    identity: { id: me },
    carnet: { userId: me, nickname },
    balances: { points: 25, coins: 5 },
    bottle: { message: `Mi botella ${info.project.name}`, isMine: true },
  });
  await expect(section.getByTestId('cuenta-exportar-estado')).toHaveText(t('account.export.done'));

  // Sólo lo propio y sin secretos.
  for (const m of SAMPLE_CREW) expect(text).not.toContain(m.userId);
  expect(text).not.toMatch(/"(password|token|access_token|refresh_token|secret|code_hash|salt)"/i);
  expect(errors).toEqual([]);
});
