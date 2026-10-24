#!/usr/bin/env node
/**
 * Los clips reales de la Galería (plan 048 T328): de los vídeos que manda
 * Álvaro (MP4 o MOV de iPhone) a clips que el collage acepta:
 *
 *   - H.264 (High), yuv420p, bt709, sin audio, `+faststart`;
 *   - 1280 px de lado largo con su proporción (girado según el móvil), los
 *     fotogramas por segundo de la fuente, ≤ 60 s;
 *   - las fuentes HDR (HLG o PQ en bt2020, las del iPhone) pasan a SDR bt709
 *     con un mapeo de tonos (zscale + tonemap); las SDR sólo se escalan;
 *   - un póster WebP (calidad 82) con el fotograma de 0,5 s.
 *
 * Salen en apps/web/public/contenido/galeria/<id>.mp4 y <id>.webp; REAL_CLIPS
 * de packages/store (sample/content.ts) los nombra con su tamaño. Las
 * fuentes no van al repositorio.
 *
 * Los clips de muestra de antes (boia-baila, puerto-dia-noche, barco-fiesta,
 * dibujados con arte del proyecto) ya no existen: este script ya no los crea.
 *
 * Uso (desde la raíz): node tools/galeria/clips.mjs <carpeta de las fuentes>
 * El ffmpeg es el del PATH, o el de la variable FFMPEG (ffprobe, a su lado).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'apps/web/public/contenido/galeria');
const LONG_SIDE = 1280;
const MAX_SECONDS = 60;

/** id y archivo de origen. */
export const CLIPS = [
  { id: 'clip-20260530-231216', file: '20260530_231216.mp4' },
  { id: 'clip-img-0561', file: 'IMG_0561.MOV' },
  { id: 'clip-img-0564', file: 'IMG_0564.MOV' },
];

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.FFMPEG
  ? join(dirname(process.env.FFMPEG), `ffprobe${process.platform === 'win32' ? '.exe' : ''}`)
  : 'ffprobe';

function probe(file) {
  const out = execFileSync(
    FFPROBE,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,color_transfer:stream_side_data=rotation',
      '-of',
      'json',
      file,
    ],
    { encoding: 'utf8' },
  );
  const s = JSON.parse(out).streams[0];
  const rotation = Math.abs(Number(s.side_data_list?.find((d) => 'rotation' in d)?.rotation ?? 0));
  const portrait = rotation === 90 || rotation === 270 ? s.width > s.height : s.height > s.width;
  return { hdr: ['arib-std-b67', 'smpte2084'].includes(s.color_transfer), portrait };
}

function convert(src, clip) {
  const { hdr, portrait } = probe(src);
  // ffmpeg ya gira el vídeo según el móvil (autorotate): sólo hay que escalar.
  const scale = portrait ? `scale=-2:${LONG_SIDE}` : `scale=${LONG_SIDE}:-2`;
  const tone = hdr
    ? 'zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,'
    : '';
  const mp4 = join(OUT, `${clip.id}.mp4`);
  execFileSync(FFMPEG, [
    '-v',
    'error',
    '-y',
    '-i',
    src,
    '-t',
    String(MAX_SECONDS),
    '-vf',
    `${tone}${scale}:flags=lanczos,format=yuv420p`,
    '-an',
    '-map_metadata',
    '-1',
    '-dn',
    '-sn',
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-preset',
    'slow',
    '-crf',
    '24',
    '-maxrate',
    '2400k',
    '-bufsize',
    '4800k',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-colorspace',
    'bt709',
    '-color_range',
    'tv',
    '-movflags',
    '+faststart',
    mp4,
  ]);
  const poster = join(OUT, `${clip.id}.webp`);
  execFileSync(FFMPEG, [
    '-v',
    'error',
    '-y',
    '-ss',
    '0.5',
    '-i',
    mp4,
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-quality',
    '82',
    '-map_metadata',
    '-1',
    poster,
  ]);
  const mb = (statSync(mp4).size / 1024 / 1024).toFixed(1);
  const kb = (statSync(poster).size / 1024).toFixed(0);
  console.log(`${clip.id}: ${hdr ? 'HDR → SDR, ' : ''}${mb} MB, póster ${kb} kB`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const from = process.argv[2];
  if (!from) {
    console.error('Uso: node tools/galeria/clips.mjs <carpeta de las fuentes>');
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  for (const clip of CLIPS) convert(join(from, clip.file), clip);
}
