import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 5: el océano `/mar` (plan 018 T208). El mundo está más o menos
// terminado (decisión 9), así que la parte enseña, pieza a pieza, lo que hay;
// un solo «qué falta» y unas «Preguntas y propuestas» para toda la parte.
// El mundo se llama «Mundo principal»; Acuarela está oculta y no sale.
export const titulo = 'El océano';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'El mundo en 3D que se recorre en barco: islas, personajes, secretos y descuentos',
    secciones: [
      'Llegada',
      'Mandos y menú',
      'Barcos',
      'Islas',
      'Boia Fiestera',
      'Personajes',
      'Secretos',
      'Descuentos',
    ],
    notas: [
      'Es la segunda vía para vender: quien juega encuentra descuentos y acaba en «Entradas».',
      'Está más o menos terminado: esta parte enseña lo que hay, pieza a pieza.',
      'Los minijuegos sólo se nombran aquí; tienen su parte, la 6.',
    ],
  });

  // ── Llegada y mandos ──
  d.queEs({
    seccion: 'Llegada',
    titulo: 'Zarpar: un planeta de agua',
    texto: [
      '«Zarpar» en la landing abre el océano: un planeta pequeño de agua que se recorre en barco, con islas, personajes y secretos.',
      'Al llegar sale «Welcome Aboard»: qué es BOIA.PLANET, el objetivo (encontrar a la Boia Fiestera y llevarla a la Isla de Nochevieja), dos consejos y dos botones: «A navegar» o «Comprar entradas».',
      'Se navega tocando y arrastrando en cualquier sitio, o tocando el mar o una isla para que el barco vaya solo.',
    ],
    destacado: 'Quien sólo quiere entradas las tiene a un toque, sin jugar.',
    captura: 'llegada',
    notas: [
      'Es el mismo planeta que se ve en el hero de la landing.',
      'En el ordenador: flechas o WASD, T para el turbo y M para el mapa.',
      'El barco recuerda dónde estaba al recargar.',
    ],
  });
  d.telefonos({
    seccion: 'Mandos y menú',
    titulo: 'Lo que hay en pantalla',
    telefonos: [
      { captura: 'navegando', pie: 'La primera boia saluda al salir del puerto' },
      { captura: 'menu', pie: 'El menú: logros, Carnet, barco, códigos…' },
      { captura: 'ayuda', pie: 'El «!»: el objetivo y una pista con rumbo' },
    ],
    notas: [
      'Arriba, enlaces a la web (Fotos, Shop, Artistas, Contacto) y el Carnet; a la derecha, puntos y monedas.',
      'Abajo sólo «Entradas», la velocidad, el turbo y el zoom: más mundo, menos botones.',
      'Menú: Logros, Mi Carnet, Barco, Mis códigos, Mi botella, Ranking, Ajustes, Controles, Welcome Aboard y la hora del día.',
    ],
  });
  d.telefonos({
    seccion: 'Mandos y menú',
    titulo: 'El mapa, las entradas y tus códigos',
    telefonos: [
      { captura: 'mapa', pie: 'El minimapa abre el planeta entero' },
      { captura: 'entradas', pie: '«Entradas» sin salir del mar' },
      { captura: 'codigos', pie: '«Mis códigos»: los descuentos ganados' },
    ],
    notas: [
      'El minimapa marca con «?» los descuentos escondidos; en grande, se toca una isla para ver qué hay.',
      '«Entradas» abre «Elige tu evento»: comprar, o «Ir a su isla» en barco.',
      'Cada código ganado queda en «Mis códigos», con «Copiar código» e «Ir a la isla».',
    ],
  });

  // ── Barcos ──
  d.telefonos({
    seccion: 'Barcos',
    titulo: 'El Puerto de Alicante y la tienda de barcos',
    telefonos: [
      { captura: 'puerto', pie: 'El Puerto: «Cambiar de barco»' },
      { captura: 'tienda-barcos', pie: 'Barcos, skins, estela y mascota' },
    ],
    notas: [
      'Se empieza con «Botijo»; los demás se compran con monedas o se ganan con logros y puntos.',
      'Sólo cambian cómo se ve el barco, nunca cómo navega: nadie paga por ir más rápido.',
      'La Fiestera tiene un barco exclusivo: sólo para quien la rescata.',
    ],
  });

  // ── Islas ──
  d.queTiene({
    seccion: 'Islas',
    titulo: 'Nueve islas, cada una con su papel',
    puntos: [
      'Halloween, Sonido y Nochevieja: islas de evento, con su fecha y «Comprar entrada»',
      'Puerto de Alicante: donde se cambia de barco',
      'Benidorm: las fotos de BOIA. Ibiza: el escaparate de la tienda',
      'Tabarca: el «Tablón del faro», que dice dónde jugar',
      "L'Illeta dels Banyets y el Castillo de Santa Bárbara: minijuegos (parte 6)",
      'La primera visita a una isla suele dar puntos y la deja descubierta',
    ],
    captura: 'castillo',
    notas: [
      'Las tres islas de evento, el Puerto, Benidorm, Ibiza y Tabarca tienen modelo propio de Blender.',
      'Halloween y Sonido avisan de que la entrada es en taquilla; Nochevieja tiene compra de prueba.',
      'Al acercarse se abre su ficha abajo, pequeña, sin parar el barco.',
    ],
  });
  d.telefonos({
    seccion: 'Islas',
    titulo: 'Las islas de los eventos',
    telefonos: [
      { captura: 'sonido', pie: 'Isla del Sonido: All Day BOIA' },
      { captura: 'nochevieja', pie: 'Isla de Nochevieja: el destino' },
      { captura: 'halloween', pie: 'Isla de Halloween: BOIA Club' },
    ],
    notas: [
      'Cada isla enseña su evento con la fecha y «Comprar entrada».',
      'Al pasar el evento, la isla puede enseñarlo como recuerdo, con sus fotos.',
      'Las fechas y los artistas son de muestra.',
    ],
  });
  d.telefonos({
    seccion: 'Islas',
    titulo: 'Fotos, tienda y el faro',
    telefonos: [
      { captura: 'benidorm', pie: 'Benidorm: «Ver Fotos y eventos»' },
      { captura: 'ibiza', pie: 'Ibiza: «Ir a la tienda»' },
      { captura: 'tabarca', pie: 'Tabarca: Cañón, Castillo y Carrera' },
    ],
    notas: [
      'Benidorm e Ibiza llevan a la web: la galería y la tienda.',
      'El Tablón del faro tiene un botón por minijuego: abre su ficha y «Navegar» lleva hasta él.',
      'Los Rápidos es la carrera de boias; el Cañón y el Castillo, sus islas. Todo en la parte 6.',
    ],
  });

  // ── Boia Fiestera ──
  d.queEs({
    seccion: 'Boia Fiestera',
    titulo: 'La misión: rescatar a la Boia Fiestera',
    texto: [
      'Una Boia Fiestera se ha perdido en el Remanso de los Cocodrilos. Al arrimarse, los cocodrilos se sumergen y ella sube a bordo.',
      'Hay que llevarla a la Isla de Nochevieja. Al dejarla, la fiesta empieza y da el premio grande: puntos, monedas, el código FIESTERA20 (-20 % en la próxima entrada) y su barco exclusivo.',
      'El «!» de la izquierda recuerda siempre el objetivo y da rumbo hasta ella.',
    ],
    destacado: 'Es el hilo del juego: termina en un descuento para comprar la entrada.',
    captura: 'fiestera',
    notas: [
      'El objetivo se da en «Welcome Aboard» y en la primera boia.',
      'La misión se guarda: si cierras, sigue a bordo al volver.',
      'Premios y código son de muestra: los decide Álvaro.',
    ],
  });

  // ── Personajes y cosas que recoger ──
  d.telefonos({
    seccion: 'Personajes',
    titulo: 'Quién vive en el mar',
    telefonos: [
      { captura: 'boia-habla', pie: 'Seis boias que hablan por el camino' },
      { captura: 'whatsapp', pie: 'La boia de WhatsApp, junto al puerto' },
      { captura: 'delfin', pie: 'El delfín (arriba) guía a lo que falta' },
    ],
    notas: [
      'Las boias cuentan qué es BOIA (espacio, descubrir, pertenecer…) y señalan algo pendiente.',
      'El náufrago pide que lo acerques a una fiesta y deja un código: NAUFRAGO10.',
      'El delfín sale en mar abierto y lleva hasta algo sin descubrir; el remolino gira el barco.',
    ],
  });
  d.telefonos({
    seccion: 'Personajes',
    titulo: 'Lo que se recoge al pasar',
    telefonos: [
      { captura: 'naufrago', pie: 'El náufrago: su código de descuento' },
      { captura: 'botella', pie: 'Botellas con mensajes de otros' },
      { captura: 'cueva', pie: 'Un secreto encontrado: monedas' },
    ],
    notas: [
      'Restos flotantes y cofres fugaces dan monedas; los cofres salen 20 segundos y se esconden.',
      'Las botellas traen mensajes de la tripulación; con Carnet se echa una propia.',
      'Las monedas compran barcos; los puntos suben en el ranking.',
    ],
  });

  // ── Secretos y descuentos ──
  d.queTiene({
    seccion: 'Secretos y descuentos',
    titulo: 'Secretos y descuentos escondidos',
    puntos: [
      'Cuatro secretos sin marca en el mapa: la cueva, el ánfora, la campana y el círculo de boias',
      'Tres descuentos en el mundo: el náufrago, el ánfora de Agost y la Fiestera',
      'Cada código queda en «Mis códigos» y la compra de dentro del mar lo aplica sola',
      'El minimapa marca con «?» los que faltan; el delfín y el «!» ayudan a buscarlos',
      'Desde el Admin se crean códigos nuevos y se elige dónde se esconden',
    ],
    captura: 'anfora',
    notas: [
      'El ánfora de Agost da COFRE5: 5 € menos en Nochevieja.',
      'Los códigos y sus porcentajes son inventados hasta tener la ticketera.',
      'Los secretos sin código dan monedas y puntos, y cuentan para los logros.',
    ],
  });

  // ── Qué falta y preguntas (toda la parte) ──
  d.queFalta({
    seccion: 'Todo el mar',
    items: [
      {
        texto: 'Visto bueno al mundo: el planeta de agua, los logros y los premios de cada cosa',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Los códigos de descuento reales, creados en la ticketera, con el % de cada uno',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Aprobar el arte de las islas y los textos: fichas, boias, náufrago y Fiestera',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Quitar los atajos de prueba: enlaces especiales que empiezan partidas o dan premios',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto: 'El Puerto de Alicante dice «Isla descubierta» al llegar: cambiar el aviso',
        etiqueta: 'puede-esperar',
        quien: 'Hernán',
      },
      {
        texto: 'Música con licencia para el mar (hoy suenan ambientes generados)',
        etiqueta: 'puede-esperar',
        quien: 'Álvaro',
      },
    ],
    notas: [
      'El mundo funciona entero: lo que falta es aprobar y poner lo real.',
      'Los códigos reales llegan con la ticketera: sin ella no se pueden canjear.',
      'Los atajos de prueba hoy ya no dan premios en la web publicada, pero se quitan al lanzar.',
    ],
  });
  d.preguntas({
    seccion: 'Todo el mar',
    preguntas: [
      '¿Os parece bien que los descuentos sean del 10 %, 20 % o 5 €? ¿Cuántos y para qué eventos?',
      '¿El rescate de la Fiestera es un buen hilo, o queréis otra misión por temporada?',
      '¿Qué islas nuevas querríais: una por cada fiesta real, o lugares de Alicante?',
      'El logro «Entre dos mundos» pide un mundo que está oculto: ¿lo quitamos?',
    ],
    propuestas: [
      'Cambiar el aviso del Puerto por «Puerto de Alicante: aquí cambias de barco».',
      'Cambiar los códigos del mar cada temporada desde el Admin, para que siempre haya algo que buscar.',
      'Medir cuántos que zarpan acaban comprando con un código del mar.',
    ],
    notas: [
      'Son propuestas del equipo: Hernán las revisa antes de hacer nada.',
      'Lo que se decida entra en la hoja de ruta de la parte 8.',
    ],
  });
}
