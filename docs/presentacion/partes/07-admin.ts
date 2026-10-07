import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 7: el Admin (~8 diapositivas, plan 018 T210). Capturas de escritorio
// (decisión 5): el Admin se usa en el ordenador. Hoy es la versión de prueba
// (D-20): lo que se cambia se queda en el navegador de quien lo cambia. Los
// paneles que piden cuentas van en una diapositiva de texto (decisión 8).
export const titulo = 'Admin';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'El panel para cambiar la web y el mar sin tocar código',
    secciones: ['Entrada', 'Contenido', 'Eventos y mundo', 'Control', 'Con cuentas'],
    notas: [
      'El Admin es donde BOIA cambia eventos, textos, fotos, descuentos y el mapa, sin pedírselo a nadie.',
      'Las capturas son de ordenador: es la herramienta del equipo, no de quien visita la web.',
    ],
  });

  // ── Entrada ──
  d.queEs({
    seccion: 'Entrada',
    titulo: 'Se entra con el Carnet 000 y una contraseña',
    texto: [
      'El Admin es el panel de BOIA para cambiar la web y el mar sin tocar código: eventos, textos, fotos, descuentos, el mapa… Se abre en /admin y está pensado para el ordenador.',
      'Hoy se entra con el Carnet 000 y la contraseña de la versión de prueba; la sesión dura 12 horas. Arriba, un aviso fijo recuerda que es una prueba, con «Salir del Admin».',
    ],
    destacado: 'Hoy lo que cambias sólo lo ves tú, en tu navegador: nadie más lo ve todavía.',
    captura: 'entrada',
    notas: [
      'El Carnet 000 está reservado al Admin: ninguna persona que se dé de alta lo recibe.',
      'Con cuentas, además de la contraseña pide el código de una app de autenticación del móvil.',
      'Todos los paneles se ven en la barra de la izquierda, agrupados aquí por tarea.',
    ],
  });

  // ── Contenido ──
  d.queTiene({
    seccion: 'Contenido',
    titulo: 'La página principal y lo que sale en ella',
    puntos: [
      'Página principal: ordenar, ocultar y programar bloques; titular, botones y evento destacado',
      'Enlaces: el contacto de «Comprar» de la tienda, el correo y los enlaces de Contacto y del pie',
      'Textos y música: buscar y cambiar los textos de la web; subir música con su licencia',
      'Artistas: nombre, géneros, foto y su enlace de Spotify',
      'Fotos y vídeos: álbumes y «Fotos de una isla», con subida de archivos',
      'Todo va a un borrador: «Vista previa» en móvil u ordenador y, al final, «Publicar»',
    ],
    captura: 'inicio',
    notas: [
      'En la captura se cambió el botón «Zarpar» por «Zarpar al mar»: arriba salen los cambios sin publicar.',
      'Nada se ve en la web hasta pulsar «Publicar»; «Descartar borrador» lo tira.',
      'Los enlaces reales (WhatsApp, Instagram, correo) se ponen en Enlaces en cuanto Álvaro los pase.',
    ],
  });
  d.telefonos({
    seccion: 'Contenido',
    titulo: 'La vista previa y las fotos de una isla',
    telefonos: [
      { captura: 'vista-previa', pie: 'Así quedará la web al pulsar «Publicar»' },
      { captura: 'fotos-isla', pie: 'Subir fotos y marcar el evento como pasado' },
    ],
    notas: [
      'En la vista previa el botón ya dice «Zarpar al mar»: la web publicada sigue con «Zarpar» hasta «Publicar».',
      'Después de una fiesta: eliges la isla y su evento, subes las fotos y la isla lo enseña como recuerdo.',
      'Las fotos se pasan solas a un formato ligero; el texto alternativo es obligatorio (accesibilidad).',
    ],
  });

  // ── Eventos y mundo ──
  d.queTiene({
    seccion: 'Eventos y mundo',
    titulo: 'Eventos, descuentos y el mar',
    puntos: [
      'Eventos: fecha, lugar, precio, cartel, artistas e isla; siete estados, por fechas o a mano',
      'Descuentos: código, % o €, fechas, prioridad y dónde se esconde en el mar',
      'Mundo: mover lugares del mapa, cambiar el nombre y los textos de cada isla u ocultarla',
      'Objetos: uno nuevo sin código en 10 pasos, desde cero o con 5 plantillas; nunca en tierra',
      'Destino de la Fiestera: a qué isla lleva la Boia Fiestera en las partidas nuevas',
      'Logros, cosméticos y rangos; Temporadas: qué mundo ve quien llega al mar',
    ],
    captura: 'objetos',
    notas: [
      'La captura es el paso 4 de 10 de un objeto nuevo: colocarlo en el mapa. El Admin no deja ponerlo en tierra.',
      'Un evento pasa solo de «Próximamente» a «A la venta» y a «Finalizado»; también se puede fijar a mano.',
      'Un objeto publicado sale en el mar con el modelo de su categoría.',
    ],
  });
  d.telefonos({
    seccion: 'Eventos y mundo',
    titulo: 'Los eventos y el mapa del mundo',
    telefonos: [
      { captura: 'eventos', pie: 'Cada evento con su estado y su isla' },
      { captura: 'mundo', pie: 'El mapa compartido: cada isla se edita aquí' },
    ],
    notas: [
      'Los eventos son los de hoy: Halloween, SONIDO y Nochevieja, más uno en borrador de muestra.',
      'El mapa es el mismo para todos los mundos: mover una isla la mueve en todos.',
    ],
  });

  // ── Control ──
  d.queTiene({
    seccion: 'Control',
    titulo: 'Moderación, papelera y auditoría',
    puntos: [
      'Moderación: ocultar un Carnet, retirar su apodo o su foto, devolver una botella; siempre con motivo',
      'Usuarios de administración: los roles (propietario, administrador, editor); hoy sólo se leen',
      'Integraciones: ticketera, datos, correo y analítica, con lo que está conectado y lo que no',
      'Papelera: lo borrado se recupera hasta que pasa el plazo; después se purga solo',
      'Auditoría: cada cambio con autor, fecha, antes y después; «Volver a la muestra» por área o todo',
    ],
    captura: 'moderacion',
    notas: [
      'Todo lo de moderación se puede deshacer y queda en la auditoría.',
      'Un Carnet oculto desaparece de la web; su apodo sale como «Miembro de BOIA».',
      '«Volver todo a la muestra» deja la versión de prueba como recién abierta.',
    ],
  });

  // ── Con cuentas (decisión 8) ──
  d.texto({
    seccion: 'Con cuentas',
    titulo: 'Los paneles que se encienden con las cuentas',
    puntos: [
      'Entrada segura: código al email (o Carnet 000 y contraseña) y el código de una app del móvil',
      'Fiestas y QR: el QR del sello de cada fiesta, cuándo vale, proyectarlo o imprimirlo, y su imagen',
      'Socios y emails: las cuentas, quién acepta noticias (en hoja de cálculo) y el enlace de artistas',
      'Moderación y Rankings sobre datos reales: anular una partida tramposa y poder devolverla',
      'Seguridad: 10 códigos de respaldo por si se pierde el móvil de la app',
      'Hechos y probados con un servidor de pruebas: falta encenderlos en la web publicada',
    ],
    notas: [
      'Estos paneles no se pueden enseñar aquí: sólo aparecen cuando la web tiene cuentas de usuario.',
      'Con cuentas, estos cuatro trabajan con datos de todos; el resto de paneles sigue en el navegador.',
      'Encender las cuentas es lo primero de la lista de qué falta.',
    ],
  });

  // ── Qué falta ──
  d.queFalta({
    seccion: 'Todo el Admin',
    items: [
      {
        texto: 'Encender las cuentas en la web publicada: entrada segura y los paneles de fiestas, socios y rankings',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto: 'Decidir quién del equipo entra al Admin y con qué rol (propietario, administrador o editor)',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Una cuenta propia para el Carnet 000, con su contraseña, la app del móvil y los códigos de respaldo',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto: 'Cambiar la contraseña de la versión de prueba del Admin: hoy se podría adivinar',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto: 'Que los cambios de contenido (eventos, textos, fotos…) lleguen a todos; mientras, el contenido real lo mete Hernán',
        etiqueta: 'puede-esperar',
        quien: 'Hernán',
      },
      {
        texto: 'Vídeos, el archivo propio de cada objeto nuevo en el mar y un editor del mapa de arrastrar y soltar',
        etiqueta: 'puede-esperar',
        quien: 'Hernán',
      },
    ],
    notas: [
      'Lo necesario es seguridad: quién entra y con qué llave. Sin eso no se publica con cuentas.',
      'Hoy, con cuentas, sólo fiestas, socios, moderación y rankings van con datos de todos; lo demás, en el navegador.',
      'Para salir no hace falta: el contenido real (eventos, enlaces, fotos) lo puede meter Hernán en la web.',
    ],
  });

  d.preguntas({
    seccion: 'Todo el Admin',
    preguntas: [
      '¿Quién entra al Admin, y quién puede publicar (administrador) o sólo preparar borradores (editor)?',
      '¿Salimos con el contenido real metido por Hernán, o esperamos a que el Admin publique para todos?',
      '¿Cuántos días guarda la papelera lo borrado antes de purgarlo?',
      '¿Quién modera Carnets y botellas, y quién crea y proyecta el QR de cada fiesta?',
    ],
    propuestas: [
      'Una prueba de 10 minutos con Álvaro usando el Admin para ver dónde se atasca (los requisitos la piden).',
      'Poner la vista previa del borrador detrás de la misma entrada que el Admin.',
      'Actualizar el aviso de arriba: aún dice «demo sin login» y ya se entra con el Carnet 000.',
      'Una guía de una página, «Cómo publicar un evento y sus fotos», para el equipo.',
    ],
    notas: [
      'Las propuestas salen del código y de los documentos: son ideas, no decisiones; Hernán las revisa.',
      'Lo que se decida entra en la hoja de ruta de la parte 8.',
    ],
  });
}
