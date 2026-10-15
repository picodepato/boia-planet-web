import { z } from 'zod';

/**
 * Contrato de los manifiestos de arte del mundo que produce el pipeline de
 * Blender (T01, `tools/blender/asset.schema.json`): islas, boies, rocas
 * (`kind: sprite`) y costas (`kind: tile`). Sólo se leen los campos que usa
 * el motor; el resto se ignora. Píxeles de la imagen, origen arriba a la
 * izquierda. Todos los recursos están a la densidad del barco
 * (`pixels_per_unit`), así el motor los dibuja con la escala del barco.
 */

const Px = z
  .union([
    z.tuple([z.number().finite(), z.number().finite()]),
    z.object({ x: z.number().finite(), y: z.number().finite() }),
  ])
  .transform((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }));

const Circle = z.object({
  shape: z.literal('circle'),
  center_px: Px,
  /** Semieje horizontal: el vertical mide la mitad en pantalla. */
  radius_px: z.number().finite().positive(),
});

const ArtImage = z.object({
  file: z.string().min(1),
  frame: z.number().int().nonnegative().default(0),
  animation: z.string().optional(),
  variant: z.string().optional(),
  anchors: z.record(z.string(), Px).optional(),
});

const TileVariant = z.object({
  file: z.string().min(1),
  land_side: z.enum(['left', 'right']),
  shore_x_px: z.object({ mean: z.number(), min: z.number(), max: z.number() }),
  /** Donde se para el casco: la costa de colisión del mundo. */
  collision_x_px: z.number().finite(),
  /** Color de la tierra más allá de la losa. */
  outer_fill: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

/**
 * Losa de un lugar (T18, `kind: place`): se repite a lo largo de `axis`. La
 * orilla de colisión (`collision_px`) cae sobre el límite del mundo; la
 * línea de costa de mapa.json está en `map_line_px`. Píxeles en el eje
 * perpendicular a `axis`.
 */
const Strip = z.object({
  axis: z.enum(['x', 'y']),
  land_side: z.enum(['left', 'right', 'bottom']),
  period_px: z.number().positive(),
  collision_px: z.number().finite(),
  map_line_px: z.number().finite(),
  outer_fill: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type ArtStrip = z.output<typeof Strip>;

/** Esquina que une una costa lateral con la de abajo; el pivote es el punto de las dos líneas. */
const Corner = z.object({
  land: z.array(z.enum(['left', 'right', 'bottom'])),
  outer_fill: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).default({}),
});
export type ArtCorner = z.output<typeof Corner>;

export const ArtManifest = z.object({
  id: z.string().min(1),
  kind: z.enum(['sprite', 'tile', 'layers', 'ship', 'place']),
  category: z.string().optional(),
  version: z.union([z.string(), z.number()]).transform(String),
  status: z.string().optional(),
  license: z.string().min(1),
  image: z
    .object({ width: z.number().int().positive(), height: z.number().int().positive() })
    .optional(),
  pivot_px: Px.optional(),
  anchors: z.record(z.string(), Px).default({}),
  hitbox_hint: Circle.optional(),
  proximity_hint: Circle.optional(),
  animations: z
    .record(
      z.string(),
      z.object({
        frames: z.number().int().positive(),
        fps: z.number().positive(),
        loop: z.boolean().default(true),
      }),
    )
    .default({}),
  images: z.array(ArtImage).default([]),
  tile: z
    .object({
      axis: z.literal('y'),
      period_px: z.number().positive(),
      variants: z.record(z.string(), TileVariant),
    })
    .optional(),
  /** Losa de un lugar (piezas `losa` de T18), ya normalizada por `placePartArt`. */
  strip: Strip.optional(),
  corner: Corner.optional(),
  /** Piezas de un manifiesto de lugar (`kind: place`, T18); se leen con `placePartArt`. */
  parts: z.array(z.record(z.string(), z.unknown())).optional(),
});
export type ArtManifest = z.output<typeof ArtManifest>;
export type ArtTileVariant = z.output<typeof TileVariant>;

export type ArtManifestResult = { ok: true; manifest: ArtManifest } | { ok: false; error: string };

export function parseArtManifest(input: unknown): ArtManifestResult {
  const r = ArtManifest.safeParse(input);
  return r.success
    ? { ok: true, manifest: r.data }
    : { ok: false, error: z.prettifyError(r.error) };
}

/**
 * Fotogramas de una animación en orden, o la imagen fija (fotograma 0 sin
 * animación) si la animación no existe. Vacío si no hay ninguna imagen.
 */
export function artFrames(
  m: ArtManifest,
  animation?: string,
): { files: string[]; fps: number; loop: boolean } {
  const anim = animation ? m.animations[animation] : undefined;
  if (anim && animation) {
    const files = m.images
      .filter((i) => i.animation === animation)
      .sort((a, b) => a.frame - b.frame)
      .map((i) => i.file);
    if (files.length > 0) return { files, fps: anim.fps, loop: anim.loop };
  }
  const still =
    m.images.find((i) => !i.animation && !i.variant && i.frame === 0) ??
    m.images.find((i) => i.frame === 0);
  return { files: still ? [still.file] : [], fps: 0, loop: false };
}

// --- Manifiestos de lugar (T18) ---------------------------------------------

/**
 * Un asset de lugar apunta a una pieza de su manifiesto: `<carpeta>#<pieza>`,
 * con `@<variante>` opcional (`mundos/arcilla/puerto#boia`,
 * `mundos/arcilla/restos#restos@b`). Sin `#`, el asset es el manifiesto
 * entero, como en T01.
 */
export interface AssetRef {
  /** Carpeta del manifiesto en `art/`. */
  base: string;
  part?: string;
  variant?: string;
}

export function parseAssetRef(id: string): AssetRef {
  const hash = id.indexOf('#');
  if (hash < 0) return { base: id };
  const base = id.slice(0, hash);
  const rest = id.slice(hash + 1);
  const at = rest.indexOf('@');
  const part = at < 0 ? rest : rest.slice(0, at);
  const variant = at < 0 ? undefined : rest.slice(at + 1);
  return { base, ...(part ? { part } : {}), ...(variant ? { variant } : {}) };
}

const PartImage = z.object({
  file: z.string().min(1),
  frame: z.number().int().nonnegative().default(0),
  animation: z.string().optional(),
  variant: z.string().optional(),
});

const PartCircle = z.object({
  shape: z.literal('circle'),
  center_px: Px,
  radius_px: z.number().finite().positive(),
});

const PlacePart = z.object({
  id: z.string().min(1),
  pivot_px: Px.optional(),
  anchors: z.record(z.string(), Px).default({}),
  hitbox_hint: PartCircle.optional(),
  proximity_hint: PartCircle.optional(),
  animations: z
    .record(
      z.string(),
      z.object({
        frames: z.number().int().positive(),
        fps: z.number().positive(),
        loop: z.boolean().default(true),
      }),
    )
    .default({}),
  images: z.array(PartImage).default([]),
  tile: z
    .object({
      axis: z.enum(['x', 'y']),
      land_side: z.enum(['left', 'right', 'bottom']),
      period_px: z.number().positive(),
      collision_px: z.number().finite(),
      outer_fill: z.string(),
      map_line: z.object({ px: z.number().finite() }),
    })
    .optional(),
  corner: z
    .object({
      land: z.array(z.enum(['left', 'right', 'bottom'])),
      outer_fill: z.record(z.string(), z.string()).default({}),
    })
    .optional(),
});

/**
 * La pieza `part` de un manifiesto de lugar como un manifiesto de sprite
 * (o de losa) más: pivote, anclajes, huellas, animaciones e imágenes de esa
 * pieza. Con `variant`, sólo las imágenes de esa variante, que pasan a ser
 * la imagen fija. `null` si la pieza no existe o no cumple el contrato.
 */
export function placePartArt(m: ArtManifest, part: string, variant?: string): ArtManifest | null {
  const raw = m.parts?.find((p) => p.id === part);
  if (!raw) return null;
  const r = PlacePart.safeParse(raw);
  if (!r.success) return null;
  const p = r.data;
  let images = p.images;
  if (variant) {
    images = images.filter((i) => i.variant === variant).map(({ variant: _v, ...i }) => i);
    if (images.length === 0) return null;
  }
  const t = p.tile;
  const out = ArtManifest.safeParse({
    id: `${m.id}#${part}${variant ? `@${variant}` : ''}`,
    kind: t ? 'tile' : 'sprite',
    ...(m.category ? { category: m.category } : {}),
    version: m.version,
    ...(m.status ? { status: m.status } : {}),
    license: m.license,
    ...(p.pivot_px ? { pivot_px: p.pivot_px } : {}),
    anchors: p.anchors,
    ...(p.hitbox_hint ? { hitbox_hint: p.hitbox_hint } : {}),
    ...(p.proximity_hint ? { proximity_hint: p.proximity_hint } : {}),
    animations: p.animations,
    images,
    ...(t
      ? {
          strip: {
            axis: t.axis,
            land_side: t.land_side,
            period_px: t.period_px,
            collision_px: t.collision_px,
            map_line_px: t.map_line.px,
            outer_fill: t.outer_fill,
          },
        }
      : {}),
    ...(p.corner ? { corner: p.corner } : {}),
  });
  return out.success ? out.data : null;
}
