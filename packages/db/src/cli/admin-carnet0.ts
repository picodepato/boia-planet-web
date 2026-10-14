/**
 * `pnpm admin:carnet0 -- <email>` (plan 029 T282): da el Carnet 000 a la
 * cuenta del Admin de ese email (con rol admin u owner y su Carnet ya
 * creado) en el proyecto Supabase de `apps/web/.env.local`, con la clave de
 * servicio. Llama a `assign_admin_carnet` (20261007100400_admin_access_export):
 * su número anterior queda libre y el cambio queda en la auditoría. Repetirlo
 * no cambia nada.
 *
 * Así no hace falta el editor SQL de Supabase. Nunca imprime una clave. Se
 * niega si `SUPABASE_DB_URL` no es del mismo proyecto que
 * `NEXT_PUBLIC_SUPABASE_URL` (la misma comprobación que `db:migrate:dev`).
 */
import { parseCarnet0Args } from '../grant.ts';
import { supabaseEnv } from '../supabase/env.ts';
import { serviceClient } from '../supabase/testkit.ts';
import { findUserByEmail } from '../supabase/users.ts';

/** Lo que se le dice a quien lo corre según el rechazo de la RPC. */
const WHY: Record<string, string> = {
  not_admin: 'esa cuenta no tiene rol admin u owner: antes, pnpm admin:grant -- <email> admin',
  unknown_member: 'esa cuenta aún no tiene Carnet: créalo en la web y vuelve a correr esto',
  number_taken: 'el Carnet 000 ya es de otra cuenta',
};

async function main(): Promise<void> {
  const { email } = parseCarnet0Args(process.argv.slice(2));
  const r = supabaseEnv();
  if (!r.ok) throw new Error(r.problem ?? `faltan ${r.missing.join(', ')}`);
  const service = serviceClient(r.env);
  const userId = await findUserByEmail(service, email);
  if (!userId) {
    throw new Error(`${email} no tiene cuenta: antes, pnpm admin:grant -- ${email} admin`);
  }
  const { error } = await service.rpc('assign_admin_carnet', { p_user: userId });
  if (error) throw new Error(WHY[error.message] ?? error.message);
  console.log(`admin:carnet0 OK — ${email} lleva el Carnet 000`);
}

main().catch((err: unknown) => {
  console.error(`admin:carnet0 FALLA — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
