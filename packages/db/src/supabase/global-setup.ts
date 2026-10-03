/**
 * Antes y después de `pnpm test:supabase`. Al empezar borra las cuentas
 * `@example.test` olvidadas por una ejecución cortada (de hace más de 30
 * minutos: las de otra ejecución en marcha no se tocan). Al terminar borra
 * las de esta ejecución, comprueba que no queda ninguna y dice cuántas
 * `@example.test` quedan en el proyecto.
 */
import { supabaseEnv } from './env.ts';
import {
  deleteTestUsers,
  isThisRun,
  listTestUsers,
  serviceClient,
  staleTestUsers,
  testRunId,
} from './testkit.ts';

function service() {
  const r = supabaseEnv();
  if (!r.ok) throw new Error(r.problem ?? `faltan ${r.missing.join(', ')}`);
  return serviceClient(r.env);
}

export async function setup(): Promise<void> {
  testRunId();
  const s = service();
  await deleteTestUsers(s, await staleTestUsers(s));
}

export async function teardown(): Promise<void> {
  const s = service();
  await deleteTestUsers(
    s,
    (await listTestUsers(s)).filter((u) => isThisRun(u.email)),
  );
  const all = await listTestUsers(s);
  const mine = all.filter((u) => isThisRun(u.email)).length;
  console.log(
    `[test:supabase] cuentas @example.test que quedan: ${all.length} (de esta ejecución: ${mine})`,
  );
  if (mine > 0) throw new Error(`quedan ${mine} cuentas @example.test de esta ejecución`);
}
