/**
 * `pnpm db:clean-test-users`: borra del proyecto Supabase de desarrollo las
 * cuentas de prueba `@example.test` (y en cascada todo lo suyo) que dejaron
 * ejecuciones cortadas de `pnpm test:supabase` o de las e2e con
 * `E2E_SUPABASE=1`. Por defecto sólo las de hace más de 30 minutos, para no
 * pisar otra ejecución en marcha; `--all` las borra todas y `--minutes N`
 * cambia el margen. Nunca toca una cuenta de otro dominio.
 */
import { cleanMinutes } from '../grant.ts';
import { supabaseEnv } from '../supabase/env.ts';
import {
  TEST_EMAIL_DOMAIN,
  deleteTestUsers,
  listTestUsers,
  serviceClient,
} from '../supabase/testkit.ts';

async function main(): Promise<void> {
  const minutes = cleanMinutes(process.argv.slice(2));
  const r = supabaseEnv();
  if (!r.ok) throw new Error(r.problem ?? `faltan ${r.missing.join(', ')}`);
  const service = serviceClient(r.env);
  const limit = Date.now() - minutes * 60_000;
  const all = await listTestUsers(service);
  const old = all.filter(
    (u) =>
      u.email.endsWith(`@${TEST_EMAIL_DOMAIN}`) &&
      (minutes === 0 || (u.createdAt !== undefined && Date.parse(u.createdAt) < limit)),
  );
  await deleteTestUsers(service, old);
  const left = (await listTestUsers(service)).length;
  console.log(
    `db:clean-test-users OK — borradas ${old.length} de ${all.length} cuentas @${TEST_EMAIL_DOMAIN}` +
      `${minutes ? ` (de hace más de ${minutes} min)` : ''}; quedan ${left}`,
  );
}

main().catch((err: unknown) => {
  console.error(`db:clean-test-users FALLA — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
