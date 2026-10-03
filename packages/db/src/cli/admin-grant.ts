/**
 * `pnpm admin:grant -- <email> <owner|admin|editor|none>` (plan 008, T94,
 * decisión 11): da (o quita, con `none`) un rol del Admin a la cuenta de ese
 * email en el proyecto Supabase de desarrollo, con la clave de servicio de
 * `apps/web/.env.local`. Si el email aún no tiene cuenta, la crea confirmada
 * (se entra con el código de 6 cifras; el TOTP se da de alta al entrar en
 * /admin). Queda en la auditoría (disparador de `staff_roles`).
 *
 * Nunca imprime una clave. Se niega si `SUPABASE_DB_URL` no es del mismo
 * proyecto que `NEXT_PUBLIC_SUPABASE_URL` (la misma comprobación que
 * `db:migrate:dev`).
 */
import { parseGrantArgs } from '../grant.ts';
import { supabaseEnv } from '../supabase/env.ts';
import { serviceClient, type Client } from '../supabase/testkit.ts';

async function findUser(service: Client, email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
}

async function main(): Promise<void> {
  const { email, role } = parseGrantArgs(process.argv.slice(2));
  const r = supabaseEnv();
  if (!r.ok) throw new Error(r.problem ?? `faltan ${r.missing.join(', ')}`);
  const service = serviceClient(r.env);
  let userId = await findUser(service, email);
  if (!userId) {
    if (role === 'none') {
      console.log(`admin:grant — ${email} no tiene cuenta: nada que quitar`);
      return;
    }
    const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser: ${error?.message ?? 'sin usuario'}`);
    userId = data.user.id;
    console.log(`admin:grant — cuenta creada para ${email} (se entra con el código de 6 cifras)`);
  }
  if (role === 'none') {
    const { error } = await service.from('staff_roles').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    console.log(`admin:grant OK — ${email} ya no tiene rol en el Admin`);
    return;
  }
  const { error } = await service
    .from('staff_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  console.log(
    `admin:grant OK — ${email} es ${role}. Entra en /admin con el código del email; ` +
      'la primera vez da de alta el TOTP con el QR.',
  );
}

main().catch((err: unknown) => {
  console.error(`admin:grant FALLA — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
