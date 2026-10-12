/**
 * Textos de la app instalable (plan 027 T264): el manifiesto, la página «sin
 * conexión» del service worker y el aviso «Instalar app». Van en su propio
 * archivo porque el aviso es un trozo perezoso (`lib/pwa/t.ts`) que no entra en
 * la ruta crítica de la landing. También entran en el catálogo entero
 * (`es.ts`). Todo `muestra` hasta que Álvaro lo apruebe.
 */
export const esPwa = {
  // El manifiesto: nombre corto bajo el icono del móvil.
  'pwa.shortName': 'BOIA',
  // La página mínima que pinta el service worker si no hay red.
  'pwa.offline': 'Sin conexión. Vuelve a abrir BOIA.PLANET cuando tengas internet.',

  // El aviso «Instalar app».
  'pwa.prompt.label': 'Instalar la app',
  'pwa.prompt.title': 'Lleva BOIA.PLANET en el móvil',
  'pwa.prompt.android.text': 'Instálala como una app: se abre a pantalla completa y sin tienda.',
  'pwa.prompt.android.install': 'Instalar app',
  'pwa.prompt.ios.text': 'Toca Compartir y luego «Añadir a pantalla de inicio».',
  'pwa.prompt.ios.ok': 'Entendido',
  'pwa.prompt.dismiss': 'Ahora no',
} as const;

export type PwaKey = keyof typeof esPwa;
