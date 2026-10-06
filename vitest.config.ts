import { defineConfig } from 'vitest/config';

// Pruebas lentas (simulaciones de balance con bots): salen de la ejecución por
// defecto y corren con `pnpm test:slow` (vitest.slow.config.ts).
export const slowTests = ['packages/*/src/**/*-balance.test.ts'];

export default defineConfig({
  // apps/web usa "jsx": "preserve" (lo exige Next); las pruebas de componentes
  // necesitan que Vite transforme el JSX con el runtime automático de React.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', ...slowTests],
    environment: 'node',
  },
});
