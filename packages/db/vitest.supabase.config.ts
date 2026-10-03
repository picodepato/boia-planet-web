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
    testTimeout: 60_000,
    hookTimeout: 180_000,
    globalSetup: ['src/supabase/global-setup.ts'],
  },
});
