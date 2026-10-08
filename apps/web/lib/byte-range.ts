/**
 * `Range: bytes=a-b` de un vídeo (Safari no reproduce un mp4 sin 206). null
 * si no hay o no se entiende (se sirve entero); 'fuera' si no cabe.
 */
export function byteRange(header: string | null, size: number): [number, number] | 'fuera' | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? [start, end] : 'fuera';
}
