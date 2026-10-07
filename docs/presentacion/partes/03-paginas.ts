import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 3: las páginas de la web (~7 diapositivas, plan 018 T206). Cada
// página se abre directa por su enlace, sin el 3D, y funciona sin JavaScript.
export const titulo = 'Páginas';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'Eventos, artistas, fotos, tienda y legales: las páginas que se abren por su enlace',
    secciones: ['Eventos', 'Artistas', 'Enlace de artistas', 'Fotos', 'Tienda', 'Legales'],
    notas: [
      'Son páginas sencillas, sin el planeta 3D: cargan rápido y se pueden compartir por WhatsApp.',
      'Todo lo que se ve hoy es de muestra salvo los nombres y fechas de los eventos.',
    ],
  });

  // ── Eventos ──
  d.queTiene({
    seccion: 'Eventos',
    titulo: 'La ficha de cada evento',
    puntos: [
      'Una página por evento, con su enlace propio para compartir: /eventos/halloween-2026',
      'Cartel, fecha y hora, lugar, formato y precio; mientras no hay cartel, «Cartel próximamente»',
      'Artistas del cartel, actividades (comida, mercadillo…) y descripción',
      '«Comprar entradas» si está a la venta e «Ir a su isla», que lleva en barco a su isla del mar',
      'Si ya pasó: sin compra, con sus recuerdos (fotos) y «Ver sus fotos»',
    ],
    captura: 'evento',
    notas: [
      'Hoy hay tres eventos a la venta: Halloween (31 oct), SONIDO (5 dic) y Nochevieja.',
      'Las fechas son reales; horas y precios, de muestra.',
      'Si alguien cambia algo en el Admin, la ficha lo enseña en ese navegador.',
    ],
  });
  d.telefonos({
    seccion: 'Eventos',
    titulo: 'Taquilla, actividades y recuerdos',
    telefonos: [
      { captura: 'evento-taquilla', pie: 'Halloween y SONIDO: sólo en taquilla, 2 € menos' },
      { captura: 'evento-actividades', pie: 'SONIDO: cartel, actividades y compra' },
      { captura: 'evento-recuerdos', pie: 'Un evento que ya pasó: sus recuerdos' },
    ],
    notas: [
      'Halloween y SONIDO no se venden en la web: entradas en la puerta y 2 € de descuento con el Carnet BOIA.',
      'El aviso invita a hacerse el Carnet; es una forma de conseguir socios.',
      'Nochevieja sigue con la compra de prueba, que no cobra nada.',
    ],
  });

  // ── Artistas y enlace de artistas ──
  d.telefonos({
    seccion: 'Artistas',
    titulo: 'Todos los artistas y su enlace',
    telefonos: [
      { captura: 'artistas', pie: '/artistas: los 26, de la A a la Z' },
      { captura: 'artista-enlace', pie: 'El enlace de artistas abre su alta de Carnet' },
    ],
    notas: [
      'La lista sale con iniciales en vez de foto y un Spotify de muestra en uno de cada dos.',
      'El enlace de artistas es uno solo: quien crea su Carnet con él lleva el sello «ARTISTA».',
      'Con cuentas, el Admin crea el enlace y puede cambiarlo; el anterior deja de valer.',
    ],
  });

  // ── Fotos y tienda ──
  d.telefonos({
    seccion: 'Fotos y tienda',
    titulo: 'Fotos y eventos, y la tienda',
    telefonos: [
      { captura: 'fotos', pie: 'Fotos por isla y por evento' },
      { captura: 'tienda', pie: 'Tienda: cada producto rota tres fotos' },
      { captura: 'tienda-comprar', pie: '«Comprar»: sólo a la venta en la fiesta' },
    ],
    notas: [
      'Fotos: una galería por isla y evento; desde cada isla del mar se llega a sus fotos.',
      'El Admin ya puede subir fotos reales a un evento; hoy todas son recuadros de muestra.',
      'Tienda: no se vende online; «Comprar» manda a escribir por Instagram a @boia.planet.',
    ],
  });

  // ── Legales ──
  d.queEs({
    seccion: 'Legales',
    titulo: 'Aviso legal, privacidad y cookies',
    texto: [
      'Tres páginas enlazadas desde el pie: aviso legal y condiciones de uso, privacidad y cookies. Explican quién está detrás, qué datos se guardan y que no hay cookies de publicidad.',
      'Hoy el titular y sus datos son inventados, y cada página lo avisa arriba en un recuadro. Con cuentas de usuario, la privacidad explica además qué se recoge y para qué.',
    ],
    destacado: 'Sin datos legales reales y revisados no se puede publicar.',
    captura: 'legal',
    notas: [
      'El aviso de arriba evita que alguien lo tome por real mientras tanto.',
      'Hace falta un profesional que revise los textos con los datos de BOIA.',
    ],
  });

  // ── Qué falta ──
  d.queFalta({
    seccion: 'Eventos y artistas',
    items: [
      {
        texto: 'Cartel de Halloween (y de SONIDO y Nochevieja cuando existan)',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Confirmar horas, precios y lugar de cada evento (hoy son de muestra)',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Elegir la ticketera y poner el enlace real de compra de Nochevieja',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Aprobar la taquilla de Halloween y SONIDO: el texto y los 2 € de descuento con Carnet',
        etiqueta: 'necesario',
        quien: 'Álvaro y socios',
      },
      {
        texto: 'Fecha del próximo All Day BOIA, para crear su evento',
        etiqueta: 'puede-esperar',
        quien: 'Álvaro',
      },
      {
        texto: 'Fotos de los 26 artistas y repartir el enlace de artistas (necesita cuentas)',
        etiqueta: 'puede-esperar',
        quien: 'Álvaro',
      },
    ],
    notas: [
      'Halloween es el primer evento real: su cartel es lo más urgente.',
      'Las fotos de artistas pueden esperar: las iniciales quedan dignas.',
    ],
  });
  d.queFalta({
    seccion: 'Fotos, tienda y legales',
    items: [
      {
        texto: 'Fotos reales de los eventos pasados para sustituir los recuadros de muestra',
        etiqueta: 'necesario',
        quien: 'Álvaro y socios',
      },
      {
        texto: 'Fotos de los productos reales de la tienda (sola, otro ángulo, con modelo)',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Confirmar el Instagram real al que se escribe para comprar en la tienda',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Datos legales reales (titular, NIF, domicilio, correo) y revisión profesional',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Leer y aprobar los textos de estas páginas, que hoy son de muestra',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Probar una subida real de fotos con cuentas de usuario',
        etiqueta: 'puede-esperar',
        quien: 'Hernán',
      },
    ],
    notas: [
      'Sin legales reales no se puede publicar: es lo que más tarda, hay que empezar ya.',
      'Las fotos de la tienda y de eventos dan mucha vida: mejor pocas y buenas.',
    ],
  });

  d.preguntas({
    seccion: 'Todas las páginas',
    preguntas: [
      '¿La taquilla con 2 € de descuento con Carnet se queda para Halloween y SONIDO, o también Nochevieja?',
      '¿Quién de BOIA tiene las fotos de fiestas pasadas y quién elige cuáles salen?',
      '¿Qué productos vendemos en la fiesta y quién les hace las fotos?',
      '¿Quién es el titular legal de la web (asociación, empresa, persona) y quién revisa los textos?',
    ],
    propuestas: [
      'Poder marcar «sólo en taquilla» desde el Admin, sin tocar el contenido a mano.',
      'Una foto de cada fiesta pasada ya basta para que la página de fotos no salga vacía.',
      'Poner precio orientativo a cada producto de la tienda para que nadie pregunte por Instagram.',
    ],
    notas: [
      'Las propuestas salen del código y de los documentos: son ideas, no decisiones; Hernán las revisa.',
      'Lo que se decida entra en la hoja de ruta de la parte 8.',
    ],
  });
}
