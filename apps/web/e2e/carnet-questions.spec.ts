import { CARNET_QUESTIONS } from '@boia/contracts';
import { expect, test } from '@playwright/test';
import { openMar } from './mar-helpers';
import { t } from '../lib/i18n';

test.describe.configure({ timeout: 120_000 });

for (const entry of ['mar', 'carnet'] as const) {
  test(`${entry}: questions precede creation and answers remain editable after reload`, async ({
    page,
  }, info) => {
    if (entry === 'mar') {
      await openMar(page);
      await page.getByTestId('mar-enlace-carnet').click();
    } else {
      await page.goto('/carnet');
      await page.getByRole('link', { name: t('carnet.create'), exact: true }).click();
      await expect(page.getByTestId('mar-carnet')).toBeVisible();
    }
    if (!(await page.getByTestId('carnet-form').isVisible())) {
      await page.getByTestId('carnet-crear').click();
    }
    const form = page.getByTestId('carnet-form');
    await expect(form).toBeVisible();
    for (const question of CARNET_QUESTIONS) {
      const field = form.getByTestId(`carnet-pregunta-${question.id}`);
      await expect(field).toHaveCount(1);
      await expect(field).not.toHaveAttribute('required', /.*/);
      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeVisible();
      await expect(form.getByText(question.prompt, { exact: true })).toBeVisible();
    }
    await form.screenshot({
      path: `node_modules/.playwright-results/t104-${entry}-${info.project.name}-questions.png`,
    });
    const first = CARNET_QUESTIONS[0]!;
    const last = CARNET_QUESTIONS.at(-1)!;
    await form.getByTestId('carnet-apodo-input').fill(`Preguntas ${entry} ${info.project.name}`);
    await form.getByTestId(`carnet-pregunta-${first.id}`).fill('Una primera respuesta');
    await form.getByTestId(`carnet-pregunta-${last.id}`).fill('La última respuesta');
    await form.getByTestId('carnet-guardar').click();
    await expect(page.getByTestId('carnet-mio')).toBeVisible();
    await openMar(page, '?menu=carnet');
    await expect(page.getByTestId('carnet-mio')).toBeVisible();
    await expect(page.getByTestId('carnet-form')).toHaveCount(0);
    await page.getByTestId('carnet-editar').click();
    await expect(page.getByTestId(`carnet-pregunta-${first.id}`)).toHaveValue(
      'Una primera respuesta',
    );
    await expect(page.getByTestId(`carnet-pregunta-${last.id}`)).toHaveValue('La última respuesta');
    await page.getByTestId(`carnet-pregunta-${first.id}`).fill('Respuesta editada');
    await page.getByTestId('carnet-guardar').click();
    await expect(page.getByTestId('carnet-mio')).toBeVisible();
    await openMar(page, '?menu=carnet');
    await page.getByTestId('carnet-editar').click();
    await expect(page.getByTestId(`carnet-pregunta-${first.id}`)).toHaveValue('Respuesta editada');
  });
}
