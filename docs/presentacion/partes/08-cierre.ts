import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 8: hoja de ruta para salir (plan 018 T211). Junta todos los
// «Necesario para salir» de las partes 2–7 más los globales (cuentas y base de
// datos de producción, dominio, analítica, copias, legales y el visto bueno de
// Álvaro), agrupados por quién actúa y numerados en orden. Lo repetido entre
// partes es una sola línea con las partes de las que viene (columna «Parte»;
// «global» = no sale de ninguna parte). Después, las decisiones pendientes
// y el cierre.
export const titulo = 'Hoja de ruta para salir';

const COLUMNAS = ['#', 'Qué hace falta', 'Quién', 'Parte'];
const ANCHOS = [0.6, 8.43, 1.75, 1.35];

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'Todo lo necesario para publicar, quién lo hace y qué decidimos hoy',
    secciones: ['Álvaro', 'Álvaro y socios', 'Hernán', 'Decisiones', 'Cierre'],
    notas: [
      'Aquí se junta todo lo marcado «Necesario para salir» en las partes 2 a 7.',
      'Más lo que no es de ninguna sección: cuentas, dominio, analítica, copias y legales.',
      'Va por quién tiene que actuar y en orden: lo de arriba desbloquea lo de abajo.',
      'La columna «Parte» dice de qué parte viene cada línea; «global», que no es de ninguna sección.',
    ],
  });

  d.hojaDeRuta({
    seccion: 'Álvaro',
    titulo: 'Álvaro: entradas, enlaces, arte y textos',
    columnas: COLUMNAS,
    anchos: ANCHOS,
    filas: [
      ['1', 'Elegir la ticketera y poner el enlace real de compra de cada evento, Nochevieja incluida', 'Álvaro', '2, 3'],
      ['2', 'Confirmar horas, precios y lugar de Halloween, Sonido y Nochevieja (hoy son de muestra)', 'Álvaro', '2, 3'],
      ['3', 'El cartel de Halloween, y luego los de Sonido y Nochevieja', 'Álvaro', '2, 3'],
      ['4', 'Crear en la ticketera los códigos de descuento reales del mar, con el % de cada uno', 'Álvaro', '5'],
      ['5', 'El enlace real de cada artista (Spotify u otro) y la lista de BOIA en Spotify', 'Álvaro', '2'],
      ['6', 'Enlaces reales de contacto (correo, WhatsApp, Instagram, TikTok) e Instagram de la tienda', 'Álvaro', '2, 3'],
      ['7', 'Datos legales reales (titular, NIF, domicilio, correo) y su revisión profesional', 'Álvaro', '3 + global'],
      ['8', 'Aprobar el arte del hero (planeta, objetos 3D, imagen fija) y el de las islas del mar', 'Álvaro', '2, 5'],
      ['9', 'El arte final del Carnet y del sello de cada fiesta (hoy la tarjeta naranja es de muestra)', 'Álvaro', '4'],
      ['10', 'Aprobar textos: Filosofía (tal cual o cambiada), esquinas, «Consigue descuentos», páginas', 'Álvaro', '2, 3'],
    ],
    notas: [
      'Lo primero es la ticketera: sin ella no hay compra real ni códigos de descuento.',
      'Fechas, carteles, enlaces y textos quitan la etiqueta «muestra» de casi toda la web.',
      'Los legales necesitan datos reales y que los revise un profesional.',
    ],
  });

  d.hojaDeRuta({
    seccion: 'Álvaro y socios',
    titulo: 'Álvaro y socios: aprobar, fijar y fotos',
    columnas: COLUMNAS,
    anchos: ANCHOS,
    filas: [
      ['11', 'Aprobar los textos del mar: fichas de islas, boias, náufrago y Boia Fiestera', 'Álvaro', '5'],
      ['12', 'Aprobar los textos del Carnet, del sello y del ranking, y la privacidad con cuentas', 'Álvaro', '4'],
      ['13', 'Visto bueno al mundo del mar: el planeta de agua, los logros y los premios de cada cosa', 'Álvaro', '5'],
      ['14', 'Aprobar los tres juegos: nombres, textos, Vecino Quejica, mascotas y el Castillo entero', 'Álvaro', '6'],
      ['15', 'Fijar los puntos de cada cosa, los rangos (nombres y cifras) y los límites contra trampas', 'Álvaro', '4'],
      ['16', 'Fijar premios de los juegos: puntos y monedas por medalla y logro, y los 80 s de «Rápido»', 'Álvaro', '6'],
      ['17', 'Decidir quién del equipo entra al Admin y con qué rol (propietario, administrador, editor)', 'Álvaro', '7'],
      ['18', 'Aprobar la taquilla de Halloween y Sonido: aviso, texto y 2 € de descuento con Carnet', 'Álvaro y socios', '2, 3'],
      ['19', 'Fotos de los productos reales de la tienda (solo, otro ángulo y puesto)', 'Álvaro y socios', '2, 3'],
      ['20', 'Fotos reales de las fiestas pasadas, para sustituir los recuadros de muestra', 'Álvaro y socios', '3'],
    ],
    notas: [
      'Casi todo es leer y decir «vale» o «cambia esto»: lo podemos repasar juntos en una tarde.',
      'Los puntos y premios hacen falta antes de encender las cuentas: con cuentas, cuentan de verdad.',
      'Las fotos de la tienda y de las fiestas las puede hacer o juntar cualquiera del equipo.',
    ],
  });

  d.hojaDeRuta({
    seccion: 'Hernán',
    titulo: 'Hernán, y el visto bueno final',
    columnas: COLUMNAS,
    anchos: ANCHOS,
    filas: [
      ['21', 'Encender cuentas y base de datos: entrada segura, sellos QR, Carnet, rankings, Admin', 'Hernán', '4, 7 + global'],
      ['22', 'Una cuenta propia para el Carnet 000: contraseña, app del móvil y códigos de respaldo', 'Hernán', '7'],
      ['23', 'Cambiar la contraseña de la versión de prueba del Admin: hoy se podría adivinar', 'Hernán', '7'],
      ['24', 'Quitar los atajos de prueba del mar y de los juegos, con el botón «Derrota: sumergirse»', 'Hernán', '5, 6'],
      ['25', 'Que «Menú» y el «!» no tapen las tarjetas de la carrera en el móvil', 'Hernán', '6'],
      ['26', 'Probarla en móviles reales (iPhone, Android): scroll, batería, datos, lector de pantalla', 'Hernán', '2'],
      ['27', 'Conectar el dominio definitivo y poner los servicios de la web a nombre de BOIA', 'Hernán', 'global'],
      ['28', 'Encender la analítica de visitas, con su aviso de cookies', 'Hernán', 'global'],
      ['29', 'Copias de seguridad de los datos, y probar que se pueden recuperar', 'Hernán', 'global'],
      ['30', 'Quitar todo lo de muestra y visto bueno final de Álvaro a la web entera: se publica', 'Hernán y Álvaro', 'global'],
    ],
    notas: [
      'Las cuentas ya están hechas y probadas aparte: encenderlas es una lista de pasos de Hernán.',
      'Dominio, analítica y copias no salen en ninguna sección, pero sin ellos no se publica.',
      'La contraseña de prueba del Admin se cambia sí o sí antes de publicar.',
      'El último paso es de Álvaro: revisa la web real, sin muestra, y da el visto bueno.',
    ],
  });

  d.hojaDeRuta({
    seccion: 'Decisiones',
    titulo: 'Lo que tenemos que decidir',
    columnas: ['Decisión', 'Qué hay sobre la mesa', 'Quién'],
    anchos: [2.4, 6.2, 1.6],
    filas: [
      ['Fecha para salir', '¿Publicamos antes de Halloween (31 de octubre)? Marca el ritmo de toda la lista', 'Socios'],
      ['Ticketera', 'Fourvenues es la candidata; ¿esa u otra, y hay ya cuenta?', 'Álvaro y socios'],
      ['Dominio', 'El nombre definitivo de la web (hoy, la dirección de prueba)', 'Álvaro y socios'],
      ['Próximo All Day BOIA', 'La fecha, para crear su evento en la web y en el mar', 'Álvaro y socios'],
      ['Puntos y premios', 'Cuánto vale cada cosa en el Carnet, los rangos y los premios de los juegos', 'Álvaro'],
      ['Lista de correos', 'Qué mandamos a quien acepta noticias, cada cuánto y quién lo lleva', 'Álvaro y socios'],
      ['Tipografía y música', '¿Compramos la letra Druk Wide y música con licencia, o salimos con lo libre?', 'Álvaro y socios'],
    ],
    notas: [
      'La fecha de salida es la primera decisión: con ella sabemos qué entra y qué espera.',
      'La ticketera desbloquea la compra real y los códigos de descuento.',
      'Tipografía y música pueden esperar: hoy hay alternativas libres que funcionan.',
    ],
  });

  d.texto({
    seccion: 'Cierre',
    titulo: 'Gracias: ¿preguntas y propuestas?',
    texto:
      'La web está construida: lo que falta es sobre todo contenido real, aprobar textos y encender las cuentas. Con la lista repartida, podemos salir pronto.',
    puntos: [
      'Hoy: decidir la fecha de salida y la ticketera.',
      'Esta semana: cada uno mira sus líneas de la hoja de ruta.',
      'Abrid la versión de prueba y mandad lo que veáis.',
    ],
    qr: 'https://boia-planet-roan.vercel.app',
    notas: [
      'Turno abierto de preguntas y propuestas sobre cualquier parte.',
      'Quien quiera, que pruebe la web con el QR y nos escriba lo que vea.',
      'Esta presentación se regenera sola cuando cambia la web.',
    ],
  });
}
