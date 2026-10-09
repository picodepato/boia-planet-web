/**
 * Textos de la radio del sitio (plan 022 T247): el botón de la landing, el
 * reproductor y el aviso «Sonando». Van en su propio archivo porque sólo los
 * carga el trozo perezoso de la radio (`lib/radio/ui/t.ts`), nunca la ruta
 * crítica de la landing. También entran en el catálogo entero (`es.ts`).
 * Todo `muestra` hasta que Álvaro lo apruebe.
 */
export const esRadio = {
  // El botón de la landing (arriba a la derecha y, al bajar, junto a «Entradas»).
  'radio.boton.musica': 'Música',
  'radio.boton.radio': 'Radio',
  'radio.boton.poner': 'Pon música',
  'radio.boton.sonando': 'Radio puesta. Abre el reproductor',
  'radio.boton.abrir': 'Radio BOIA. Abre el reproductor',
  'radio.boton.cerrar': 'Radio BOIA. Cierra el reproductor',

  // El reproductor.
  'radio.titulo': 'Radio BOIA',
  'radio.cerrar': 'Cerrar el reproductor',
  'radio.lista.titulo': 'Lista',
  'radio.lista.aria': 'Canciones de la radio',
  'radio.lista.vacia': 'Ningún tema de este género.',
  'radio.lista.plegar': 'Plegar la lista',
  'radio.lista.desplegar': 'Desplegar la lista',
  'radio.generos': 'Géneros',
  'radio.generos.todos': 'Todos',
  'radio.generos.ninguno': 'Sin género',
  'radio.generos.antes': 'Ver los géneros de antes',
  'radio.generos.despues': 'Ver más géneros',
  'radio.cancion.aria': '{titulo}, {artista}, {duracion}',
  'radio.cancion.sonando': 'Sonando ahora',

  'radio.play': 'Reproducir',
  'radio.pausa': 'Pausa',
  'radio.stop': 'Parar',
  'radio.anterior': 'Anterior',
  'radio.siguiente': 'Siguiente',
  'radio.aleatorio': 'Aleatorio',
  'radio.repetir': 'Repetir',
  'radio.repetir.todas': 'Repetir todas',
  'radio.repetir.una': 'Repetir esta',
  'radio.repetir.no': 'Sin repetir',
  'radio.avance': 'Avance de la canción',
  'radio.volumen': 'Volumen de la radio',
  'radio.tiempo.cambiar': 'Cambiar entre tiempo pasado y restante',
  'radio.tiempo.pasado': 'Tiempo pasado',
  'radio.tiempo.queda': 'Tiempo que queda',

  'radio.estado.idle': 'Radio apagada',
  'radio.estado.loading': 'Cargando',
  'radio.estado.playing': 'Sonando',
  'radio.estado.paused': 'En pausa',
  'radio.estado.stopped': 'Parada',
  'radio.nada': 'Toca play para encender la radio.',
  'radio.error': 'La radio no suena ahora mismo. Prueba otra vez.',
  'radio.lcd.info': '{genero} · {duracion}',

  // El aviso al cambiar de canción con el reproductor cerrado.
  'radio.sonando': 'Sonando: {titulo} - {artista}',
} as const;

export type RadioKey = keyof typeof esRadio;
