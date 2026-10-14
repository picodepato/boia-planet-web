/**
 * Buscar una cuenta de Supabase Auth por email con la clave de servicio
 * (los scripts del Admin: `admin:grant`, `admin:carnet0`).
 */
import type { Client } from './testkit.ts';

/** El id de la cuenta de ese email (en minúsculas), o null si no hay. */
export async function findUserByEmail(service: Client, email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
}
