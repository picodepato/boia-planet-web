import { objectAssetSchema } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import {
  ASSET_ACCEPT,
  ASSET_RULES,
  ASSET_RULE_KEYS,
  assetProblem,
  checkAsset,
  prepareAsset,
  sniffAssetType,
} from './asset-validation';
import type { PhotoCodec } from './photo-upload';

/**
 * Validación de assets antes de publicarlos (plan 017 T190, REQ-ADM-012):
 * formato, extensión, peso y dimensiones; se guarda el original y las
 * variantes optimizadas. Los límites salen de `ASSET_RULES`, no escritos a mano.
 */

/** La cabecera de un PNG de `w` × `h` (lo que lee `imageSize`) y `pad` bytes de relleno. */
function png(w: number, h: number, pad = 0): Uint8Array {
  const b = new Uint8Array(33 + pad);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  const v = new DataView(b.buffer);
  v.setUint32(16, w);
  v.setUint32(20, h);
  return b;
}

/** Un glTF binario mínimo: `glTF`, versión y longitud total. */
function glb(length = 64, version = 2, declared = length): Uint8Array {
  const b = new Uint8Array(length);
  b.set([0x67, 0x6c, 0x54, 0x46]);
  const v = new DataView(b.buffer);
  v.setUint32(4, version, true);
  v.setUint32(8, declared, true);
  return b;
}

const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]);
const rule = (name: string, bytes: Uint8Array, r: (typeof ASSET_RULE_KEYS)[number]) =>
  checkAsset(name, bytes).checks.find((c) => c.rule === r)!;

describe('REQ-ADM-012: cada regla de validación de un asset', () => {
  it('formato: el real, por los primeros bytes (PNG, WebP, JPEG o .glb; nunca GIF)', () => {
    expect(sniffAssetType(png(64, 64))).toBe('image/png');
    expect(sniffAssetType(glb())).toBe('model/gltf-binary');
    expect(rule('foto.png', GIF, 'format')).toEqual({
      rule: 'format',
      ok: false,
      why: t('admin.objects.asset.rule.formatBad'),
    });
    expect(rule('foto.png', png(64, 64), 'format').ok).toBe(true);
  });

  it('extensión: admitida y la del formato real', () => {
    expect(rule('foto.gif', png(64, 64), 'extension').why).toBe(
      t('admin.objects.asset.rule.extensionUnknown', { ext: 'gif' }),
    );
    expect(rule('foto.jpg', png(64, 64), 'extension').why).toBe(
      t('admin.objects.asset.rule.extensionMismatch', { ext: 'jpg' }),
    );
    expect(rule('modelo.glb', png(64, 64), 'extension').ok).toBe(false);
    expect(rule('FOTO.PNG', png(64, 64), 'extension').ok).toBe(true);
    expect(ASSET_ACCEPT.split(',')).toEqual(['.png', '.webp', '.jpg', '.jpeg', '.glb']);
  });

  it('peso: ni vacío ni por encima del máximo de imagen o de modelo', () => {
    expect(rule('x.png', new Uint8Array(0), 'weight').why).toBe(
      t('admin.objects.asset.rule.empty'),
    );
    const heavy = png(64, 64, ASSET_RULES.image.maxBytes);
    expect(rule('x.png', heavy, 'weight').ok).toBe(false);
    expect(rule('x.png', png(64, 64, ASSET_RULES.image.maxBytes - 64), 'weight').ok).toBe(true);
    // Un modelo admite más que una imagen.
    expect(rule('x.glb', glb(ASSET_RULES.image.maxBytes + 1), 'weight').ok).toBe(true);
    expect(rule('x.glb', glb(ASSET_RULES.model.maxBytes + 1), 'weight').ok).toBe(false);
  });

  it('dimensiones: cada lado de la imagen en su rango; el modelo, cabecera glTF 2 completa', () => {
    const { minSide, maxSide } = ASSET_RULES.image;
    expect(rule('x.png', png(minSide - 1, 200), 'dimensions').why).toBe(
      t('admin.objects.asset.rule.dimensionsRange', {
        w: minSide - 1,
        h: 200,
        min: minSide,
        max: maxSide,
      }),
    );
    expect(rule('x.png', png(maxSide + 1, 200), 'dimensions').ok).toBe(false);
    expect(rule('x.png', png(minSide, maxSide), 'dimensions').ok).toBe(true);
    expect(checkAsset('x.png', png(300, 200))).toMatchObject({ width: 300, height: 200, ok: true });
    expect(rule('x.glb', glb(64, 1), 'dimensions').why).toBe(
      t('admin.objects.asset.rule.modelHeader'),
    );
    expect(rule('x.glb', glb(64, 2, 80), 'dimensions').ok).toBe(false);
    expect(rule('x.glb', glb(), 'dimensions').ok).toBe(true);
  });

  it('el informe trae las cuatro reglas, en orden, y el primer motivo de rechazo', () => {
    expect(checkAsset('x.png', png(64, 64)).checks.map((c) => c.rule)).toEqual([
      ...ASSET_RULE_KEYS,
    ]);
    expect(assetProblem('x.png', png(64, 64))).toBeNull();
    expect(assetProblem('x.png', GIF)).toBe(t('admin.objects.asset.rule.formatBad'));
  });
});

/** Un códec falso: decodifica a las medidas de la cabecera y «codifica» a un blob del tamaño pedido. */
function fakeCodec(w: number, h: number): PhotoCodec & { encoded: string[] } {
  const encoded: string[] = [];
  return {
    encoded,
    decode: async () => ({ width: w, height: h, close: () => undefined }),
    encode: async (_d, size, type) => {
      encoded.push(`${size.width}x${size.height}`);
      return new Blob([new Uint8Array(size.width)], { type });
    },
  };
}

function memoryStore() {
  const files = new Map<string, Blob>();
  return {
    files,
    put: async (key: string, blob: Blob) => {
      files.set(key, blob);
      return `local-photo:${key}`;
    },
  };
}

describe('REQ-ADM-012: guardar el original y las variantes optimizadas', () => {
  it('una imagen: el original tal cual y WebP de 512 y 128 px de lado largo', async () => {
    const bytes = png(2000, 1000);
    const store = memoryStore();
    const codec = fakeCodec(2000, 1000);
    const asset = await prepareAsset(
      { name: 'isla.png', bytes, blob: new Blob([bytes as BlobPart], { type: 'image/png' }) },
      store.put,
      codec,
      'abc',
    );
    expect(objectAssetSchema.safeParse(asset).success).toBe(true);
    expect(asset.original).toMatchObject({
      type: 'image/png',
      bytes: bytes.length,
      width: 2000,
      height: 1000,
    });
    expect(asset.variants.map((v) => [v.type, v.width, v.height])).toEqual([
      ['image/webp', 512, 256],
      ['image/webp', 128, 64],
    ]);
    expect(asset.ref).toBe(asset.variants[0]!.ref);
    expect(store.files.size).toBe(3);
    expect(asset.fileName).toBe('isla.png');
  });

  it('nunca agranda: una imagen pequeña da una sola variante de su tamaño', async () => {
    const bytes = png(100, 80);
    const codec = fakeCodec(100, 80);
    const asset = await prepareAsset(
      { name: 'p.png', bytes, blob: new Blob([bytes as BlobPart]) },
      memoryStore().put,
      codec,
    );
    expect(codec.encoded).toEqual(['100x80']);
    expect(asset.variants).toHaveLength(1);
  });

  it('un modelo .glb se guarda sólo como original', async () => {
    const bytes = glb();
    const store = memoryStore();
    const asset = await prepareAsset(
      { name: 'barca.glb', bytes, blob: new Blob([bytes as BlobPart]) },
      store.put,
      fakeCodec(1, 1),
    );
    expect(asset.variants).toEqual([]);
    expect(asset.ref).toBe(asset.original!.ref);
    expect(asset.original?.type).toBe('model/gltf-binary');
  });

  it('un archivo que no pasa las reglas no se guarda', async () => {
    const store = memoryStore();
    await expect(
      prepareAsset({ name: 'x.gif', bytes: GIF, blob: new Blob([GIF as BlobPart]) }, store.put),
    ).rejects.toThrow(t('admin.objects.asset.rule.formatBad'));
    expect(store.files.size).toBe(0);
  });
});
