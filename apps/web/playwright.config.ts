import { defineConfig, devices } from '@playwright/test';
import { E2E_SUPABASE, webServerSupabaseEnv } from './e2e/supabase-env';

/**
 * Pruebas e2e contra el build de producción (`next build` + `next start`),
 * en Chromium, con un proyecto móvil (360×640, táctil) y uno de escritorio.
 * Uso: `pnpm e2e` desde la raíz. La primera vez hace falta el navegador:
 * `pnpm --filter @boia/web exec playwright install chromium`.
 *
 * Supabase (plan 008): por defecto el servidor arranca en modo local, con
 * las variables de Supabase vacías aunque exista `apps/web/.env.local`.
 * `E2E_SUPABASE=1 pnpm e2e <specs>` lo arranca con Supabase (las variables
 * del entorno o de ese archivo); los specs de Supabase usan
 * `e2e/supabase.ts` y se saltan sin el interruptor.
 */
const PORT = Number(process.env.E2E_PORT ?? 3107);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './node_modules/.playwright-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  metadata: { supabase: E2E_SUPABASE },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        viewport: { width: 360, height: 640 },
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
  ],
  webServer: {
    // Un script de Node y no `pnpm … && pnpm exec next start`: así `next start`
    // cae con Playwright y la suite termina sola (T29, `scripts/e2e-server.mjs`).
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    env: webServerSupabaseEnv(),
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
