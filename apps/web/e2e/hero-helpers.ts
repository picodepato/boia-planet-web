import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '../lib/i18n';

/**
 * The landing hero's two pills (plan 007 T79): «Zarpar» (a link to
 * `ZARPAR_HREF`, the dive into /mar) and «Entradas» (`#tickets`, opens the
 * Tickets panel), for the specs outside the landing ones (plan 007 T84).
 */

export const hero = (page: Page) => page.locator('.hero');
export const heroZarpar = (page: Page) =>
  hero(page).getByRole('link', { name: t('hero.explore'), exact: true });
export const heroTickets = (page: Page) =>
  hero(page).getByRole('link', { name: t('hero.tickets'), exact: true });
export const ticketsPanel = (page: Page) =>
  page.getByRole('dialog', { name: t('tickets.heading') });

/**
 * A real pointer click at the centre of `el`, as a visitor makes it (the
 * same as `tap` in landing-scroll.spec.ts, T81). Playwright's `click()`
 * first scrolls the target "into view", and on the sticky hero UI and the
 * fixed header Chrome scrolls the page for that: the scene would dive under
 * the click and the pills would move away from the pointer.
 */
export async function tap(page: Page, el: Locator): Promise<void> {
  await expect(el).toBeVisible();
  await expect(el).toBeInViewport();
  const b = (await el.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

/**
 * Scroll past the hero: on the hero the site header waits off screen and
 * slides in from 0.95 viewport heights down (plan 007 T79, T77 §7.2).
 */
export async function pastHero(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: 'instant' }));
  await expect(page.locator('html')).not.toHaveAttribute('data-hero-top', /.*/);
  await expect(page.locator('.site-header__inner')).toBeVisible();
}

/** «Entradas» in the hero opens the Tickets panel; returns the panel. */
export async function openHeroTickets(page: Page): Promise<Locator> {
  await tap(page, heroTickets(page));
  const panel = ticketsPanel(page);
  await expect(panel).toBeVisible();
  return panel;
}
