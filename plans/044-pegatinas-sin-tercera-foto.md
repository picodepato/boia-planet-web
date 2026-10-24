# Plan 044 — Sticker pack without its third photo

Status: done
Created: 2026-10-24
Base branch: main
Goal: In the shop, the «Packs de pegatinas» product shows three sample photos. Álvaro wants the third one (`/contenido/tienda/pegatinas-modelo-muestra.webp`, kind `model`, «pegatinas BOIA sobre una persona») removed.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T324 — Remove the third sticker-pack photo
- Status: done
- Depends on: none
- Goal: Remove the `model` image of product `pegatinas` from `apps/web/lib/merchandise/products.json` and delete the file `apps/web/public/contenido/tienda/pegatinas-modelo-muestra.webp` if nothing else uses it. The product keeps its first two photos (alone, angle). If tests or the catalog validation require three images or a `model` image per product, make the rule accept this product without it (two images is valid) without loosening the other products' checks. Check where the shop block is stored besides the JSON (plan 029/T256 «reseed stored shop block»: the local store, a seed, `public.landing_blocks` or similar in Supabase): if a stored copy would keep showing the third photo, update the seed/reseed path the same way T256 did, and report under OUT OF SCOPE whether the production database holds a copy that needs updating (do not touch production).
- Context: `apps/web/lib/merchandise/products.json`, `apps/web/lib/merchandise/catalog.test.ts`, `apps/web/app/(landing)/components/blocks.tsx`, `apps/web/lib/admin/links.ts`, commit a826585 (T256), `packages/store/src/sample-reseed.test.ts`.
- Scope: may touch the product JSON, the image file, catalog validation and tests, the shop reseed path / must not touch other products, the landing layout, SQL migrations on production.
- Done when:
  - `pnpm exec vitest run apps/web/lib/merchandise` and the reseed test → pass
  - the project Test command → pass (landing budget OK)
- Outcome: pegatinas keeps alone+angle photos; model photo and file removed; catalog.test exempts only pegatinas from the 3-kind rule; nothing stored holds shop images (no prod update) — 6695357

## Decisions
- 2026-10-24: Remove the third sticker-pack photo (Álvaro)

## Proposals (new scope)
- 2026-10-24 T324: docs/presentacion (02-landing.ts:172, 03-paginas.ts:71, boia-planet.pptx) still say each product has three photos

## Log
- 2026-10-24 T324 launched · attempt 1 · agent a529730e4c5041c1b
- 2026-10-24 T324 done · branch worktree-agent-a529730e4c5041c1b → 6695357; plan done
