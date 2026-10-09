# T103 sample product photographs

Original concept product photographs generated with the built-in ImageGen tool,
using `art/marca/boia-wordmark.jpg` and `boia-mascota.jpg` as identity references.
These are labelled samples in the landing and shop; they do not represent stock.
No price, availability or online checkout is offered.

Saved project assets (800 × 800 WebP, quality 82):

- `camiseta-muestra.webp` — 29856 bytes. (Replaced by the real T-shirt photos
  `camiseta-1-plano`, `-2-arena`, `-3-negra` in T249; the sample was removed.)
- `tote-muestra.webp` — 31144 bytes.
- `pegatinas-muestra.webp` — 43646 bytes.

## T201 placeholders (plan 017)

Each product rotates an ordered list of images: alone, another angle, on a
model (`apps/web/lib/merchandise/products.json`, contract
`merchandiseCatalogSchema`). Until the invented product photos arrive, the
angle and model slots are simple `muestra` placeholders made from the photos
above with Pillow (tilted crop; plain silhouette), 800 × 800 WebP, quality 60,
labelled «MUESTRA» in the image. Replace a file or repoint its `src` in
`products.json`; no code changes. Pressing «Comprar» says the products are
only sold at the party and links to Instagram (no checkout).

- (T249: the T-shirt's angle and model placeholders were removed; the T-shirt
  and the «Tote bag BOIA» (Manu Ropero) use real photos: `camiseta-*.webp`,
  `tote-1-bolsa.webp` … `tote-4-llena.webp`.)
- `tote-angulo-muestra.webp`, `tote-modelo-muestra.webp`
- `pegatinas-angulo-muestra.webp`, `pegatinas-modelo-muestra.webp`

Final prompts, built-in mode (no CLI/API fallback):

1. **T-shirt:** “Use case: product-mockup. Asset type: sample BOIA merchandise catalog photograph for a website, explicitly a concept not actual stock. Subject: one off-white cotton T-shirt laid flat, full garment centered and fully visible on a warm pale peach studio background, natural cotton texture and folds, soft daylight shadows, clean premium product photography, square frame. Printed large orange BOIA wordmark on chest. Input images are brand identity references only: reproduce the existing orange BOIA wordmark lettering precisely; optional small orange smiling buoy mascot below using the supplied exact mascot. No other text, no people, no labels or watermark, no price. Keep generous margins around garment.”
2. **Tote bag:** “Use case: product-mockup. Asset type: sample BOIA merchandise catalog photograph for a website, explicitly a concept not actual stock. Subject: one natural unbleached cotton tote bag standing upright with both handles visible, fully visible centered on a warm pale peach studio background, realistic woven cotton and subtle creases, soft daylight shadows, premium product photography, square frame. Large orange BOIA wordmark printed on fabric. Input image is a brand identity reference only: preserve the existing orange BOIA wordmark letter shapes precisely. No other text, no people, no labels, no price or watermark. Keep generous margins around the bag.”
3. **Stickers:** “Use case: product-mockup. Asset type: sample BOIA merchandise catalog photograph for a website, explicitly a concept not actual stock. Subject: three die-cut vinyl stickers casually arranged on a warm pale peach studio tabletop: one sticker with exact existing orange BOIA wordmark and two stickers with the exact smiling orange buoy mascot with purple cap in the references. Product photograph shot from above, realistic white die-cut edges and subtle paper texture, gentle soft daylight shadows, square frame, fully visible centered grouping. Input images are brand identity references only; preserve wordmark and mascot shapes and colors precisely. No other text, no people, no labels, no price or watermark.”
