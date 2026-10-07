import { defineConfig, devices } from '@playwright/test';
import { demoAdminStorageState } from './e2e/admin-session';
import { webServerSupabaseEnv } from './e2e/supabase-env';

/**
 * Capturas de la presentación a los socios (plan 018): no son pruebas, son
 * los specs `e2e/deck/NN-*.deck.ts`, que la config normal (`*.spec.ts`) no
 * recoge. Se corren con `pnpm deck:capturas [NN]` desde la raíz, que elige
 * un puerto libre (`DECK_PORT`) y la parte (`DECK_PARTE`).
 *
 * Servidor: el build de producción en modo local (sin Supabase, D-20), como
 * las e2e. Proyectos: `movil` (390×844 a escala 2, táctil) para todo, y
 * `escritorio` (1440×900, con la sesión del Admin de la demo) sólo para los
 * archivos `NN-*.escritorio.deck.ts`.
 */
const PORT = Number(process.env.DECK_PORT ?? 3207);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const parte = process.env.DECK_PARTE;
const prefijo = parte ? `${parte}-` : '';

export default defineConfig({
  testDir: './e2e/deck',
  // Noto Color Emoji para los emoji que Windows 10 no tiene (T209): se descarga una vez.
  globalSetup: './e2e/deck/fuente-emoji.ts',
  outputDir: './node_modules/.playwright-deck',
  fullyParallel: true,
  workers: 2,
  retries: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'movil',
      testMatch: `**/${prefijo}*.deck.ts`,
      testIgnore: '**/*.escritorio.deck.ts',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'escritorio',
      testMatch: `**/${prefijo}*.escritorio.deck.ts`,
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        storageState: demoAdminStorageState(BASE_URL),
      },
    },
  ],
  webServer: {
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: BASE_URL,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    env: webServerSupabaseEnv(),
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
