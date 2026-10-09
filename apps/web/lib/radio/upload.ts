import { RADIO_LIMITS } from '@boia/contracts';

/**
 * Los MP3 que sube el Admin a la radio (plan 022 T246): qué se acepta. Se
 * guardan tal cual (el navegador no recodifica audio): MP3 por sus primeros
 * bytes (una etiqueta ID3 o una cabecera de trama), de 15 MB como mucho (lo
 * repite el bucket `radio-songs` de la migración 20261009100100) y que el
 * navegador sepa abrir para leer su duración.
 */

export const RADIO_SONG_BUCKET = 'radio-songs';

export const SONG_UPLOAD_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  maxSeconds: RADIO_LIMITS.maxSeconds,
  types: ['audio/mpeg'] as const,
  accept: 'audio/mpeg,.mp3',
} as const;

/** Por qué no vale un archivo (claves estables; el texto va en i18n). */
export type SongUploadProblem = 'type' | 'size' | 'audio' | 'long';

/** ¿Es un MP3? `ID3` al principio, o una cabecera de trama MPEG audio (11 bits a 1, capa III). */
export function isMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0 && (bytes[1]! & 0x06) === 0x02;
}

/** null si el archivo vale por su tipo y su peso. */
export function songFileProblem(bytes: Uint8Array): SongUploadProblem | null {
  if (bytes.length > SONG_UPLOAD_LIMITS.maxBytes) return 'size';
  if (!isMp3(bytes)) return 'type';
  return null;
}

/** null si la duración leída vale. */
export function songDurationProblem(seconds: number | null): SongUploadProblem | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 'audio';
  if (seconds > SONG_UPLOAD_LIMITS.maxSeconds) return 'long';
  return null;
}

/** La duración de un MP3 (el navegador; las pruebas pasan una falsa). null si no se abre. */
export type SongProbe = (file: Blob) => Promise<number | null>;

export function browserSongProbe(): SongProbe {
  return (file) =>
    new Promise<number | null>((ok) => {
      const url = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      let done = false;
      const finish = (v: number | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        audio.removeAttribute('src');
        audio.load();
        URL.revokeObjectURL(url);
        ok(v);
      };
      const timer = setTimeout(() => finish(null), 15_000);
      audio.preload = 'metadata';
      audio.onerror = () => finish(null);
      audio.onloadedmetadata = () =>
        finish(Number.isFinite(audio.duration) ? audio.duration : null);
      audio.src = url;
    });
}

/** El título que se propone a partir del nombre del archivo (`02 - Mi canción.mp3` → `Mi canción`). */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/^\s*\d+\s*[-_.]\s*/, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

/** Dónde va un MP3 en el bucket: `<id>.mp3`. */
export function radioSongPath(songId: string): string {
  return `${songId.replace(/[^A-Za-z0-9_-]/g, '-')}.mp3`;
}

export class SongUploadError extends Error {
  constructor(readonly problem: SongUploadProblem) {
    super(problem);
    this.name = 'SongUploadError';
  }
}

/** Comprueba el archivo y lee su duración; lanza `SongUploadError` si no vale. */
export async function checkSongFile(
  file: Blob,
  probe: SongProbe = browserSongProbe(),
): Promise<number> {
  const early = songFileProblem(new Uint8Array(await file.arrayBuffer()));
  if (early) throw new SongUploadError(early);
  const seconds = await probe(file).catch(() => null);
  const late = songDurationProblem(seconds);
  if (late) throw new SongUploadError(late);
  return Math.round(seconds! * 100) / 100;
}
