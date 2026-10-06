import { defineConfig } from 'vitest/config';
import { slowTests } from './vitest.config';

// `pnpm test:slow`: sólo las simulaciones de balance que la ejecución por
// defecto deja fuera. Mismas opciones, sin cambiar lo que comprueban.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: slowTests,
    exclude: ['**/node_modules/**', '**/.next/**'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
