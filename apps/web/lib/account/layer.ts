/**
 * El contenedor de las capas de la cuenta (hoja de acceso, avisos, «¿Borrar
 * tu cuenta?»): un <div> propio al final de <body>, no <body> mismo. Con la
 * raíz de React en el documento, <body> lo gestiona React y un portal
 * directo a él dejaba la hoja pintada al cerrarse (T89).
 */
export function accountLayer(): HTMLElement {
  const id = 'boia-cuenta-capa';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}
