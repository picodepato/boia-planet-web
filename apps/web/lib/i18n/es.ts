/**
 * Textos de interfaz en español (D-03, REQ-ARQ-020): el catálogo entero, por
 * clave. El inglés (L2) será otro archivo con las mismas claves. El contenido
 * administrable (eventos, artistas, bloques) no está aquí: es dato. Todo el
 * copy es `muestra` hasta que Álvaro lo apruebe (docs/spec/10-filosofia.md,
 * §31.2; docs/propuestas/textos-zonas.md).
 */
import { esAcceso } from './es-acceso';
import { esAdmin } from './es-admin';
import { esAdminEnlaces } from './es-admin-enlaces';
import { esAdminGestion } from './es-admin-gestion';
import { esAdminObjetos } from './es-admin-objetos';
import { esAdminReal } from './es-admin-real';
import { esCalitas } from './es-calitas';
import { esCarnet } from './es-carnet';
import { esCuenta } from './es-cuenta';
import { esJuego } from './es-juego';
import { esLib } from './es-lib';
import { esLibEventos } from './es-lib-eventos';
import { esMar } from './es-mar';
import { esMundo } from './es-mundo';
import { esPuerta } from './es-puerta';
import { esWeb } from './es-web';
import { esZonas } from './es-zonas';
import { esZonasEventos } from './es-zonas-eventos';

export { LANDING_TEXT_KEYS } from './es-web';

/**
 * El catálogo entero: el de la web pública (es-web.ts), el resto de
 * textos-zonas.md y las claves del 2D, /mar, el Admin y los módulos de
 * lib/ (T49), la cuenta con email (es-cuenta.ts, plan 008) y el Carnet como
 * tarjeta con sus sellos (es-carnet.ts, plan 008 T91) y el Admin con cuentas
 * (es-admin-real.ts, T94), los objetos nuevos del Admin (es-admin-objetos.ts,
 * plan 017 T190), los enlaces editables (es-admin-enlaces.ts, plan 017
 * T192) y la entrada con el Carnet 000, los códigos de respaldo y
 * «Descargar mis datos» (es-acceso.ts, plan 017 T193).
 */
export const es = {
  ...esWeb,
  ...esZonasEventos,
  ...esLibEventos,
  ...esZonas,
  ...esJuego,
  ...esMar,
  ...esMundo,
  ...esAdmin,
  ...esAdminReal,
  ...esAdminObjetos,
  ...esAdminEnlaces,
  ...esLib,
  ...esCuenta,
  ...esCarnet,
  ...esAcceso,
  // La puerta de la fiesta (plan 019 T218).
  ...esPuerta,
  // Las Calitas, la isla de los comentarios (plan 019 T222).
  ...esCalitas,
  // Acceso completo, papelera de cambios y analítica del Admin (plan 019 T223).
  ...esAdminGestion,
} as const;

export type MessageKey = keyof typeof es;

export type Messages = Record<MessageKey, string>;
