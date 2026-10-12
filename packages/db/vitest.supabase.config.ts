import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integración contra el proyecto Supabase de desarrollo. Se
 * lanzan con `pnpm test:supabase` (src/cli/test-supabase.ts), que antes
 * comprueba las variables. Un archivo cada vez: comparten proyecto y los
 * límites de entrada de Supabase Auth.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['src/supabase/**/*.supabase.ts'],
    environment: 'node',
    fileParallelism: false,
    // Una entrada puede esperar al límite de Supabase Auth (testkit.ts,
    // RATE_LIMIT_WAIT_MS) y un beforeAll hace varias.
    testTimeout: 420_000,
    hookTimeout: 900_000,
    globalSetup: ['src/supabase/global-setup.ts'],
  },
});
