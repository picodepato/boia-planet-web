import { expect, test } from '@playwright/test';
import { openMar } from './mar-helpers';

/**
 * Los personajes del agua (plan 029 T270): `?gaviota=1` trae la gaviota
 * ladrona ya; con el bolsillo vacío (un navegador nuevo) baja, no encuentra
 * nada (nunca deja el saldo en negativo) y se va; el cangrejo pasea en su
 * roca sin radio; el guiri se carga perezoso y nunca queda en error.
 */
test('T270: the seagull attacks on demand and leaves an empty pocket alone; crab and guiri are there', async ({
  page,
}) => {
  const errors = await openMar(page, '?gaviota=1&hora=4');
  const canvas = page.getByTestId('mar-canvas');
  await expect(canvas).toHaveAttribute('data-cangrejo', /^(pasea|baila)$/);
  await expect(canvas).toHaveAttribute('data-gaviota', /^(baja|no)$/);
  // Sin monedas no roba: aviso de que se va con las manos vacías y desaparece.
  await expect(page.locator('.mar-notice__text')).toContainText('no ha encontrado ninguna', {
    timeout: 15_000,
  });
  await expect(canvas).toHaveAttribute('data-gaviota', 'no', { timeout: 10_000 });
  await expect(page.getByTestId('mar-saldos').locator('[data-robadas]')).toHaveAttribute(
    'data-robadas',
    '0',
  );
  await expect(canvas).toHaveAttribute('data-guiri', /^(lejos|cargando|glb)$/);
  expect(errors).toEqual([]);
});
