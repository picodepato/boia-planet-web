import type { AssetFile, ObjectAsset, ObjectAssetType } from '@boia/contracts';
import { type PhotoCodec, browserPhotoCodec, fitWithin, uploadStamp } from './photo-upload';
import { imageSize, sniffImageType } from './stamp-image';
import { t } from '../i18n';

/**
 * Validación de los assets de un objeto nuevo antes de publicarlo (plan 017
 * T190, REQ-ADM-012): formato, extensión, peso y dimensiones; después se
 * guarda el original tal cual y unas variantes optimizadas.
 *
 * - Formato: el real, leído de los primeros bytes (PNG, WebP, JPEG o un
 *   modelo glTF binario `.glb`); nunca SVG, GIF ni lo que diga el nombre.
 * - Extensión: la del nombre tiene que ser la del formato real.
 * - Peso: hasta 2 MB una imagen y 8 MB un modelo; vacío, no.
 * - Dimensiones: una imagen entre 32 y 4096 px por lado (la cabecera, sin
 *   decodificar); un modelo, cabecera glTF 2 con su longitud exacta.
 * - Variantes: de una imagen, WebP de 512 y 128 px de lado largo (nunca se
 *   agranda); un modelo se guarda sólo como original (optimizarlo pide
 *   Blender, fuera del navegador).
 *
 * El mar 3D pinta el archivo guardado (plan 022 T241,
 * `apps/web/app/mar/engine/object-art.ts`): el modelo `.glb` tal cual o la
 * variante principal de la imagen como cartel; si no llega, una boya.
 */

export const ASSET_RULES = {
  image: { maxBytes: 2 * 1024 * 1024, minSide: 32, maxSide: 4096 },
  model: { maxBytes: 8 * 1024 * 1024 },
  /** Lado largo de cada variante WebP de una imagen. */
  variantSides: [512, 128],
  quality: 0.85,
} as const;

/** Extensiones admitidas y el formato que tienen que tener. */
export const ASSET_EXTENSIONS: Readonly<Record<string, ObjectAssetType>> = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  glb: 'model/gltf-binary',
};

/** Lo que acepta el selector de archivos. */
export const ASSET_ACCEPT = Object.keys(ASSET_EXTENSIONS)
  .map((e) => `.${e}`)
  .join(',');

/** Reglas, en el orden en que se comprueban. Claves estables; el texto va en i18n. */
export const ASSET_RULE_KEYS = ['format', 'extension', 'weight', 'dimensions'] as const;
export type AssetRule = (typeof ASSET_RULE_KEYS)[number];

export interface AssetCheck {
  rule: AssetRule;
  ok: boolean;
  /** Por qué falla, para la interfaz (vacío si pasa). */
  why: string;
}

export interface AssetReport {
  /** El formato real, si se reconoce. */
  type: ObjectAssetType | null;
  width?: number;
  height?: number;
  checks: AssetCheck[];
  ok: boolean;
}

const u32le = (b: Uint8Array, i: number) =>
  (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

/** ¿Empieza como un glTF binario (`glTF`)? */
const isGlb = (b: Uint8Array) =>
  b.length >= 4 && b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46;

/** El formato real por los primeros bytes. */
export function sniffAssetType(b: Uint8Array): ObjectAssetType | null {
  if (isGlb(b)) return 'model/gltf-binary';
  return sniffImageType(b);
}

export function extensionOf(fileName: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  return m ? m[1]!.toLowerCase() : '';
}

const MB = (n: number) => String(Math.round((n / (1024 * 1024)) * 10) / 10).replace('.', ',');

/** Las cuatro reglas sobre un archivo: cada una con su resultado y su motivo. */
export function checkAsset(fileName: string, bytes: Uint8Array): AssetReport {
  const type = sniffAssetType(bytes);
  const checks: AssetCheck[] = [];
  const add = (rule: AssetRule, why: string | null) =>
    checks.push({ rule, ok: why === null, why: why ?? '' });

  add('format', type ? null : t('admin.objects.asset.rule.formatBad'));

  const ext = extensionOf(fileName);
  const expected = ASSET_EXTENSIONS[ext];
  add(
    'extension',
    !expected
      ? t('admin.objects.asset.rule.extensionUnknown', { ext: ext || '—' })
      : type && expected !== type
        ? t('admin.objects.asset.rule.extensionMismatch', { ext })
        : null,
  );

  const model = type === 'model/gltf-binary';
  const max = model ? ASSET_RULES.model.maxBytes : ASSET_RULES.image.maxBytes;
  add(
    'weight',
    bytes.length === 0
      ? t('admin.objects.asset.rule.empty')
      : bytes.length > max
        ? t('admin.objects.asset.rule.heavy', { size: MB(bytes.length), max: MB(max) })
        : null,
  );

  let width: number | undefined;
  let height: number | undefined;
  if (!type) {
    add('dimensions', t('admin.objects.asset.rule.dimensionsUnknown'));
  } else if (model) {
    const ok = bytes.length >= 12 && u32le(bytes, 4) === 2 && u32le(bytes, 8) === bytes.length;
    add('dimensions', ok ? null : t('admin.objects.asset.rule.modelHeader'));
  } else {
    const size = imageSize(bytes);
    const { minSide, maxSide } = ASSET_RULES.image;
    if (!size || size.width <= 0 || size.height <= 0) {
      add('dimensions', t('admin.objects.asset.rule.dimensionsUnknown'));
    } else {
      width = size.width;
      height = size.height;
      const short = Math.min(size.width, size.height);
      const long = Math.max(size.width, size.height);
      add(
        'dimensions',
        short < minSide || long > maxSide
          ? t('admin.objects.asset.rule.dimensionsRange', {
              w: size.width,
              h: size.height,
              min: minSide,
              max: maxSide,
            })
          : null,
      );
    }
  }
  return {
    type,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    checks,
    ok: checks.every((c) => c.ok),
  };
}

/** El primer motivo por el que se rechaza, o null si el archivo vale. */
export function assetProblem(fileName: string, bytes: Uint8Array): string | null {
  return checkAsset(fileName, bytes).checks.find((c) => !c.ok)?.why ?? null;
}

/** Dónde se guardan los archivos (el navegador en modo local; las pruebas pasan uno falso). */
export type AssetStore = (key: string, blob: Blob) => Promise<string>;

/**
 * Valida y guarda un asset: el original tal cual y, si es una imagen, sus
 * variantes WebP. Lanza con el motivo si no pasa las reglas.
 */
export async function prepareAsset(
  file: { name: string; bytes: Uint8Array; blob: Blob },
  store: AssetStore,
  codec: PhotoCodec = browserPhotoCodec(),
  stamp: string = uploadStamp(),
): Promise<ObjectAsset> {
  const report = checkAsset(file.name, file.bytes);
  if (!report.ok || !report.type) {
    throw new Error(
      report.checks.find((c) => !c.ok)?.why ?? t('admin.objects.asset.rule.formatBad'),
    );
  }
  const base = `objeto-${stamp}`;
  const ext = extensionOf(file.name);
  const original: AssetFile = {
    ref: await store(`${base}-original-${ext}`, file.blob),
    type: report.type,
    bytes: file.bytes.length,
    ...(report.width ? { width: report.width, height: report.height! } : {}),
  };
  const variants: AssetFile[] = [];
  if (report.type !== 'model/gltf-binary' && report.width && report.height) {
    const decoded = await codec.decode(file.blob);
    try {
      const seen = new Set<string>();
      for (const side of ASSET_RULES.variantSides) {
        const size = fitWithin(report.width, report.height, side);
        const key = `${size.width}x${size.height}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const blob = await codec.encode(decoded, size, 'image/webp', ASSET_RULES.quality);
        if (!blob || blob.type !== 'image/webp') continue;
        variants.push({
          ref: await store(`${base}-${side}`, blob),
          type: 'image/webp',
          bytes: blob.size,
          ...size,
        });
      }
    } finally {
      decoded.close();
    }
  }
  return {
    ref: variants[0]?.ref ?? original.ref,
    fileName: file.name.slice(0, 200),
    original,
    variants,
  };
}
