import { ADMIN_CARNET_LABEL, DEMO_ADMIN_SESSION_KEY } from '../lib/admin/demo-auth';

/**
 * Desde el plan 017 T193 (decisión 9) /admin de la demo pide el Carnet 000 y
 * su contraseña. La contraseña no está en el repositorio, así que las e2e
 * entran con la sesión del Admin de la demo ya puesta en localStorage (la
 * misma marca que deja entrar con la contraseña, 12 horas). La prueba de la
 * puerta (admin-acceso.spec.ts) empieza sin ella.
 */
export function demoAdminStorageState(baseURL: string) {
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL).origin,
        localStorage: [
          {
            name: DEMO_ADMIN_SESSION_KEY,
            value: JSON.stringify({ carnet: ADMIN_CARNET_LABEL, at: Date.now() }),
          },
        ],
      },
    ],
  };
}
